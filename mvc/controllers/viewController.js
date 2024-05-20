const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const Event = require('../models/eventModel');
const moment = require('moment-timezone');

exports.getHome = catchAsync(async (req, res, next) => {
	res.status(200).render('home', {
		title: 'Home',
	});
});

exports.getEvent = catchAsync(async (req, res, next) => {
	const event = await Event.findOne({
		url: req.params.id,
	});

	if (!event) {
		return next(new AppError('Could not find that event', 404));
	}

	event.users = event.users.map((u) => {
		return {
			...u,
			password: '',
		};
	});

	console.log(event);

	if (res.locals.user?.id !== 0) {
		event.users = event.users.map((u) => {
			return {
				...u,
				notes: '',
			};
		});
	}

	res.status(200).render('event', {
		title: `${event.name}`,
		event,
		user: res.locals.user,
	});
});

exports.getHelp = (req, res, next) => {
	res.status(200).render('help', {
		title: 'Help',
	});
};
