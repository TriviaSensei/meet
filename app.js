const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const AppError = require('./utils/appError');
const viewRouter = require('./mvc/routes/viewRoutes');
const eventRouter = require('./mvc/routes/eventRoutes');
const errorHandler = require('./mvc/controllers/errorController');

const app = express();

app.set('view engine', 'pug');
//directory for views is /views
app.set('views', path.join(__dirname, 'mvc/views'));

//development logging
// if (process.env.NODE_ENV === 'development') {
app.use(morgan('dev'));
// }

//serving static files
//all static files (css, js, images) will be served from this folder as a result
app.use(express.static(path.join(__dirname, 'public')));

const viewLimiter = rateLimit({
	max: 3600,
	windowMs: 60 * 60 * 1000,
	message: 'You are making too many requests - please try again later.',
});
const getLimiter = rateLimit({
	max: 3600,
	windowMs: 60 * 60 * 1000,
	message: 'You are making too many requests - please try again later.',
});
const editLimiter = rateLimit({
	max: 5,
	windowMs: 1000,
	message: {
		status: 'fail',
		message: 'You are doing that too much. Please try again in a few seconds.',
	},
});
const eventLimiter = rateLimit({
	max: 50,
	windowMs: 60 * 60 * 1000,
	message: {
		status: 'fail',
		message: 'You are creating too many events. Try again later.',
	},
});
const emailLimiter = rateLimit({
	max: 3,
	windowMs: 60 * 60 * 1000,
	message: {
		status: 'fail',
		message: 'You are doing that too much. Try again later.',
	},
});

app.use('/', viewLimiter);
app.use('/api/v1/events/createEvent', eventLimiter);
app.use('/api/v1/events/getEvent', getLimiter);
app.use('/api/v1/events/updateAvailability/:id', editLimiter);
app.use('/api/v1/contact', emailLimiter);

app.post('/api/v1/contact', async (req, res) => {
	const sgMail = require('@sendgrid/mail');
	sgMail.setApiKey(process.env.SG_API_KEY);

	const msg = {
		from: process.env.SERVER_EMAIL,
		to: process.env.ADMIN_EMAIL,
		reply_to: req.body.email,
		subject: `Meet-You-@ message from ${req.body.name}: ${req.body.subject}`,
		text: req.body.message,
	};
	try {
		await sgMail.send(msg);
	} catch (e) {
		console.log(e);
		console.log(e.response.body.errors[0]);
		return res
			.status(e.code)
			.json({ status: 'fail', message: e.response.body.errors[0].message });
	}
	res.status(200).json({
		status: 'success',
		message: 'message sent.',
	});
});

//body parser, read data from body to req.body
app.use(express.json());

app.use(cookieParser());
app.use(compression());

// 2) Routes
app.use('/', viewRouter);
app.use('/api/v1/events', eventRouter);
// app.all('*', (req, res, next) => {
//   //   //any argument passed to a next() function is assumed to be an error; skips all other middleware and goes to the error handler.
//   next(new AppError(`Could not find ${req.originalUrl} on this server.`, 404));
// });

// app.all('*', viewsController.redirectToIndex);

app.use(errorHandler);

module.exports = app;
