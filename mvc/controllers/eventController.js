const Event = require('../models/eventModel');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const moment = require('moment-timezone');
const Filter = require('bad-words');
const filter = new Filter();
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const noBadWords = (val) => !filter.isProfane(val);

//each document will be deleted 7 days after the latest possible meeting date.
const deletionPeriod = 1000 * 60 * 60 * 24 * 7;
const msInDay = 1000 * 60 * 60 * 24;
const max32 = 2147483647;

const allTimeZones = moment.tz.names();

const autoDeleteEvent = (id) => {
	return async () => {
		await Event.findOneAndDelete({ _id: id });
	};
};

const scheduleDeletes = async () => {
	const allEvents = await Event.find();
	allEvents.forEach(async (ev) => {
		let timeUntilDelete;
		let deleteDate;
		if (!ev.scheduledDeletion) {
			if (['date-list', 'date-time', 'date'].includes(ev.eventType)) {
				const latestDate = ev.dates.reduce((p, c) => {
					return new Date(p) > new Date(c) ? p : c;
				});
				deleteDate = new Date(Date.parse(latestDate) + deletionPeriod);
				timeUntilDelete = new Date(deleteDate) - new Date();
				ev.scheduledDeletion = deleteDate;
			} else {
				if (!ev.created) ev.created = new Date();
				deleteDate = new Date(Date.parse(ev.created) + deletionPeriod * 4);
				ev.scheduledDeletion = deleteDate;
				timeUntilDelete = new Date(deleteDate) - new Date();
			}
			await ev.save();
		} else {
			timeUntilDelete = new Date(ev.scheduledDeletion) - new Date();
			deleteDate = ev.scheduledDeletion;
		}
		const d = Math.floor(timeUntilDelete / msInDay);
		const h = Math.floor((timeUntilDelete % msInDay) / (1000 * 60 * 60));
		const m = Math.floor((timeUntilDelete % 3600000) / 60000);
		const s = (timeUntilDelete % 60000) / 1000;
		console.log(
			`Event ${ev.url} will be deleted on ${deleteDate} (${d}d ${h}h ${m}m ${s}s)`
		);

		if (timeUntilDelete <= max32)
			setTimeout(autoDeleteEvent(ev._id), timeUntilDelete);
	});
};
scheduleDeletes();

const signToken = (url, id) => {
	return jwt.sign({ url, id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

const createAndSendToken = (event, user, statusCode, req, res) => {
	const token = signToken(event.url, user);

	res.cookie('jwt', token, {
		expires: new Date(
			Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
		),
		httpOnly: true,
		secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
	});
	//remove password from output
	user.password = undefined;

	if (event.users)
		event.users = event.users.map((u) => {
			return {
				...u,
				password: '',
			};
		});

	res.status(statusCode).json({
		status: 'success',
		user,
		token,
		event,
	});
};

const filterObj = (obj, ...allowedFields) => {
	const newObj = {};
	Object.keys(obj).forEach((el) => {
		if (allowedFields.includes(el)) newObj[el] = obj[el];
	});
	return newObj;
};

function randomString(length) {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	const randomArray = new Uint8Array(length);
	crypto.getRandomValues(randomArray);
	randomArray.forEach((number) => {
		result += chars[number % chars.length];
	});
	return noBadWords(result) ? result : randomString(length);
}

const timeZones = moment.tz.names();

exports.isLoggedIn = catchAsync(async (req, res, next) => {
	try {
		// get the token and check if it exists
		if (!req.cookies) {
			return next();
		}
		let token;
		if (!req.cookies.jwt) {
			if (
				req.headers.authorization &&
				req.headers.authorization.startsWith('Bearer')
			) {
				token = req.headers.authorization.split(' ')[1];
			} else {
				return next();
			}
		} else {
			token = req.cookies.jwt;
		}

		if (!token) return next();

		const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
		if (!decoded) return next();

		if (decoded.url !== req.params.id) return next();

		// check if the user exists
		const event = await Event.findOne({ url: decoded.url });
		if (!event) return next();

		const currentUser = event.users.find((u) => {
			return u.id === decoded.id;
		});
		if (!currentUser) {
			return next();
		}

		const { name, id, timeZone, availability } = currentUser;
		//we've passed the gauntlet. There is a logged in user.
		res.locals.user = {
			name,
			id,
			timeZone,
			availability,
			url: decoded.url,
		};
		next();
	} catch (err) {
		console.log(err);
		next();
	}
});

exports.login = catchAsync(async (req, res, next) => {
	const { name, password, timeZone } = req.body;
	if (!name || !password)
		return next(new AppError('Please provide username and password.', 400));

	if (name.indexOf(',') >= 0)
		return next(new AppError('Invalid character in name', 400));

	const event = await Event.findOne({ url: req.params.id });
	if (!event) return next(new AppError('Event not found.', 404));

	const user = event.users.find((u) => {
		return u.name.toUpperCase() === name.toUpperCase();
	});

	//if the user doesn't exist, create it and add it to the event's user list and log them in
	if (!user) {
		if (!timeZones.includes(timeZone))
			return next(new AppError('Invalid time zone specified.', 400));
		const newId =
			event.users.length === 0 ? 0 : event.users.slice(-1).pop().id + 1;
		event.users.push({
			id: newId,
			name,
			password,
			saved: false,
			timeZone,
			availability: [],
		});
		event.markModified('users');
		await event.save();
		createAndSendToken(event, newId, 200, req, res);
	} else {
		//try to log the user in
		if (!(await event.correctPassword(password, user.password))) {
			return res.status(200).json({
				status: 'fail',
				message: 'Incorrect password',
			});
		}

		if (timeZone !== user.timeZone) {
			event.users.some((u) => {
				if (u.name.toUpperCase() === name.toUpperCase()) {
					event.markModified('users');
					u.timeZone = timeZone;
					return true;
				}
			});
			await event.save();
		}

		createAndSendToken(event, user.id, 200, req, res);
	}
});

exports.logout = (req, res) => {
	res.cookie('jwt', 'logged out', {
		expires: new Date(Date.now() + 1),
		httpOnly: true,
	});
	res.status(200).json({ status: 'success' });
};

exports.updateAvailability = catchAsync(async (req, res, next) => {
	if (!res.locals.user)
		return next(new AppError('You must be logged in.', 403));

	const event = await Event.findOne({ url: req.params.id });

	if (!event || event.url !== res.locals.user.url)
		return next(new AppError('Invalid event', 404));

	if (event.eventType === 'date-time') {
		if (
			req.body.availability.some((d) => {
				return !Date.parse(d);
			})
		)
			return next(new AppError('Invalid date/time specified', 400));
	}

	const user = event.users.find((u) => {
		if (u.id === res.locals.user.id) {
			u.availability = req.body.availability;
			return true;
		}
		return false;
	});

	event.markModified('users');
	await event.save();

	res.status(200).json({
		status: 'success',
		data: event,
		user: {
			...user,
			password: '',
		},
	});
});

exports.updateTimeZone = catchAsync(async (req, res, next) => {
	if (!res.locals.user)
		return next(new AppError('You must be logged in.', 403));

	const event = await Event.findOne({ url: req.params.id });

	if (!event || event.url !== res.locals.user.url)
		return next(new AppError('Invalid event', 404));

	if (event.type === 'weekday' || event.type === 'date')
		return next(new AppError('This event does not use time zones', 400));

	if (!allTimeZones.includes(req.body.timeZone))
		return next(new AppError('Invalid time zone specified', 400));

	const user = event.users.find((u) => {
		if (u.id === res.locals.user.id) {
			u.availability = u.availability.map((d) => {
				return moment.tz(d, u.timeZone).tz(req.body.timeZone).format();
			});
			u.timeZone = req.body.timeZone;
			return true;
		}
	});
	if (user) {
		event.markModified('users');
		await event.save();
		return res.status(200).json({
			status: 'success',
			user: { ...user, password: '' },
			event,
		});
	}
});

exports.updateEvent = catchAsync(async (req, res, next) => {
	if (req.body.users)
		return next(new AppError('You may not edit users with this route.', 403));
	if (req.body.eventType)
		return next(
			new AppError(
				'You may not edit the event type. Please create a new event instead.',
				403
			)
		);

	if (!res.locals.user || res.locals.user.id !== 0)
		return next(new AppError('You are not the owner of this event', 403));

	const updatedData = filterObj(req.body, 'name', 'dates', 'times', 'timeZone');

	const doc = await Event.findOneAndUpdate(
		{ url: req.params.id },
		updatedData,
		{
			new: true,
			runValidators: true,
		}
	);
	if (!doc) {
		return next(new AppError('Event not found.', 404));
	}

	res.status(200).json({
		status: 'success',
		data: doc,
	});
});

exports.createEvent = catchAsync(async (req, res, next) => {
	if (!req.body.userName || !req.body.password)
		return next(
			new AppError('You must specify an initial user and password', 400)
		);

	let existing;
	const allEvents = await Event.find();
	do {
		req.body.url = randomString(16);
		existing = await Event.findOne({ url: req.body.url });
	} while (existing);

	if (!moment.tz.names().includes(req.body.timeZone))
		return next(new AppError('Invalid time zone specified', 400));

	req.body.users = [
		{
			id: 0,
			name: req.body.userName,
			password: req.body.password,
			saved: false,
			timeZone: req.body.timeZone,
			availability: [],
		},
	];

	if (Array.isArray(req.body.times) && req.body.eventType === 'date-time') {
		if (req.body.times[1] < req.body.times[0])
			req.body.times[1] = req.body.times[1] + 1440;
	}

	let timeUntilDelete;
	req.body.created = new Date();
	if (req.body.eventType.split('-')[0] === 'date') {
		let latestDate, deleteDate;
		if (req.body.eventType === 'date-list') {
			latestDate = req.body.timeList.reduce((p, c) => {
				return new Date(p) > new Date(c.timeString)
					? p
					: new Date(c.timeString);
			});
		} else if (req.body.eventType === 'date-time') {
			latestDate = req.body.dates.reduce((p, c) => {
				return new Date(p) > new Date(c) ? p : c;
			});
		}
		deleteDate = new Date(Date.parse(latestDate) + deletionPeriod);
		timeUntilDelete = new Date(deleteDate) - new Date();
		req.body.scheduledDeletion = deleteDate;
	} else {
		const deleteDate = new Date(
			Date.parse(req.body.created) + deletionPeriod * 4
		);
		req.body.scheduledDeletion = deleteDate;
		timeUntilDelete = new Date(deleteDate) - new Date();
	}

	if (timeUntilDelete <= max32)
		setTimeout(autoDeleteEvent(req.body.url), timeUntilDelete);

	if (req.body.eventType === 'date-time' || req.body.eventType === 'date') {
		if (!Array.isArray(req.body.dates))
			return next(new AppError('Invalid value(s) for event date.', 400));

		let datesValid = true;
		let laterDate = false;
		req.body.dates = req.body.dates.map((d) => {
			const pd = Date.parse(d);
			const now = moment(new Date()).tz('GMT').startOf('day');
			if (!pd) datesValid = false;
			else if (new Date(pd) >= now) laterDate = true;
			return pd;
		});
		if (!datesValid) return next(new AppError('Invalid date specified', 400));
		if (!laterDate)
			return next(new AppError('At least one date must be today or later'));
	} else if (req.body.eventType === 'date-list') {
		let laterDate = false;

		req.body.dates = req.body.timeList.map((t) => {
			let m = moment.tz(t.timeString, req.body.timeZone).format();
			if (new Date(m) >= new Date()) laterDate = true;
			return m;
		});
		if (!laterDate)
			return next(new AppError('At least one time must be in the future'));
		req.body.timeZone = 'GMT';
	} else if (req.body.eventType === 'weekday-time') {
		let datesValid = true;
		if (req.body.dates.length > 7)
			return next(new AppError('Too many weekdays specified', 400));
		req.body.dates = req.body.dates.map((d) => {
			if (d < 0 || d > 6 || d !== Math.floor(d)) datesValid = false;
			return new Date(`2024-03-${10 + d}`);
		});
		if (!datesValid) return next(new AppError('Invalid date specified', 400));
	} else if (req.body.eventType === 'weekday-list') {
		let datesValid = true;
		req.body.dates = req.body.timeList.map((d) => {
			if (
				d.dayOfWeek < 0 ||
				d.dayOfWeek > 6 ||
				d.dayOfWeek !== Math.floor(d.dayOfWeek)
			)
				datesValid = false;
			return new Date(`2024-03-${10 + d.dayOfWeek} ${d.time}`);
		});
		req.body.timeZone = 'GMT';
		if (!datesValid) return next(new AppError('Invalid date specified', 400));
	} else if (req.body.eventType === 'weekday') {
		let datesValid = true;
		req.body.dates = req.body.dates.map((d) => {
			if (d < 0 || d > 6 || d !== Math.floor(d)) datesValid = false;
			return new Date(`2024-03-${10 + d}`);
		});
		if (!datesValid) return next(new AppError('Invalid date specified', 400));
	} else {
		return next(new AppError('Invalid event type', 400));
	}

	const doc = await Event.create(req.body);

	createAndSendToken(
		{
			...doc,
			url: req.body.url,
		},
		0,
		200,
		req,
		res
	);
});

exports.getEvent = catchAsync(async (req, res, next) => {
	if (!res.locals.user)
		return next(new AppError('You must be logged in.', 403));

	const event = await Event.findOne({ url: req.params.id });

	if (!event || event.url !== res.locals.user.url)
		return next(new AppError('Invalid event', 404));

	if (
		!event.users.some((u) => {
			return u.id === res.locals.user.id;
		})
	)
		event.users = event.users.map((u) => {
			return filterObj(u, 'name', 'timeZone', 'availability');
		});
	res.status(200).json({
		status: 'success',
		data: event,
	});
});
// exports.getAllEvents = factory.getAll(Event);
exports.deleteEvent = catchAsync(async (req, res, next) => {
	const doc = await Event.findByIdAndDelete(req.params.id);

	res.status(204).json({
		status: 'success',
		data: null,
	});
});
