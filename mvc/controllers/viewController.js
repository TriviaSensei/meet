const AppError = require('../../utils/appError');
const catchAsync = require('../../utils/catchAsync');
const Event = require('../models/eventModel');
const moment = require('moment-timezone');

exports.getHome = catchAsync(async (req, res, next) => {
	res.status(200).render('home', {
		title: 'Home',
		timeZones: moment.tz.names(),
	});
});

exports.getEvent = catchAsync(async (req, res, next) => {
	const event = await Event.findOne({
		url: req.params.id,
	});

	if (!event) {
		return res.status(200).render('home', {
			title: 'Home',
			alert: {
				status: 'error',
				message: 'That event does not exist',
				duration: 2000,
			},
		});
	}

	res.status(200).render('event', {
		title: `View event: ${event.name}`,
		data: event,
	});
});
