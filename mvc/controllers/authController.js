const jwt = require('jsonwebtoken');
const { createAndSendToken } = require('../../utils/token');
const { promisify } = require('util');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');

//activation token times out in 10 minutes
const activationTimeout = 1000 * 60 * 10;

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
		const currentUser = await User.findById(decoded.id);
		if (!currentUser) {
			return next();
		}

		// check if the user changed password after the token was issued
		if (currentUser.changedPasswordAfter(decoded.iat)) {
			return next();
		}
		//we've passed the gauntlet. There is a logged in user.
		res.locals.user = currentUser;
		next();
	} catch (err) {
		console.log(err);
		next();
	}
});
