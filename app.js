const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const viewRouter = require('.mvc/routes/viewRoutes');
const viewsController = require('./mvc/controllers/viewsController');
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
	max: 50,
	windowMs: 60 * 60 * 1000,
	message: 'Too many requests from this IP - please try again later.',
});

app.use('/', viewLimiter);

//body parser, read data from body to req.body
app.use(express.json());

app.use(cookieParser());
app.use(compression());

// 2) Routes
app.use('/', viewRouter);
// app.all('*', (req, res, next) => {
//   //   //any argument passed to a next() function is assumed to be an error; skips all other middleware and goes to the error handler.
//   next(new AppError(`Could not find ${req.originalUrl} on this server.`, 404));
// });

app.all('*', viewsController.redirectToIndex);

app.use(errorHandler);

module.exports = app;
