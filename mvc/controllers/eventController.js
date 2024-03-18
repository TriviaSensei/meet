const Event = require('../models/eventModel');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const moment = require('moment-timezone');
const Filter = require('bad-words');
const filter = new Filter();
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const noBadWords = (val) => !filter.isProfane(val);

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

		const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
		// check if the user exists
		const event = await Event.findOne({ url: decoded.url });
		const currentUser = event.users.find((u) => {
			return u.id === decoded.id;
		});
		if (!currentUser) {
			return next();
		}

		//we've passed the gauntlet. There is a logged in user.
		res.locals.user = {
			...currentUser,
			password: '',
			url: event.url,
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

	let datesValid = true;
	req.body.availability = req.body.availability.map((a) => {
		const d = Date.parse(a);
		if (!d) {
			datesValid = false;
			return null;
		} else return new Date(Date.parse(a));
	});
	if (!datesValid)
		return next(new AppError('Invalid date value given for availability', 400));

	event.users.some((u) => {
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
	});
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
	if (!Array.isArray(req.body.dates))
		return next(new AppError('Invalid value(s) for event date.', 400));

	let datesValid = true;
	req.body.dates = req.body.dates.map((d) => {
		if (!Date.parse(d)) datesValid = false;
		return Date.parse(d);
	});

	if (!datesValid) return next(new AppError('Invalid date specified', 400));

	if (!req.body.userName || !req.body.password)
		return next(
			new AppError('You must specify an initial user and password', 400)
		);

	req.body.url = randomString(16);
	let existing = await Event.findOne({
		url: req.body.url,
	});
	while (existing) {
		req.body.url = randomString(16);
	}

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

	const doc = await Event.create(req.body);

	createAndSendToken(doc, 0, 200, req, res);
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
