const mongoose = require('mongoose');
const AppError = require('../../utils/appError');
const bcrypt = require('bcryptjs');
const Filter = require('bad-words');
const filter = new Filter();
const moment = require('moment-timezone');
const noBadWords = (val) => !filter.isProfane(val);

const validateArrayLength = (min, max) => {
	return (val) => {
		if (!Array.isArray(val)) return false;
		if ((min === null || isNaN(min)) && (max === null || isNaN(max)))
			return true;
		else if (min === null || isNaN(min)) return val.length <= max;
		else if (max === null || isNaN(max)) return val.length >= min;
		return val.length >= min && val.length <= max;
	};
};

const eventSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'You must specify the name of your event.'],
	},
	description: {
		type: String,
	},
	url: {
		type: String,
		unique: true,
		required: [true, 'There must be a URL'],
	},
	eventType: {
		type: String,
		required: [true, 'You must specify the scheduling method.'],
		enum: [
			'date-time',
			'date-list',
			'date',
			'weekday-time',
			'weekday-list',
			'weekday',
		],
		default: 'date-time',
	},
	dates: {
		type: [Date],
		validate: {
			validator: validateArrayLength(1, null),
			message: 'You must specify at least one date.',
		},
	},
	times: [Number],
	timeZone: {
		type: String,
		required: [true, 'You must specify a time zone'],
		enum: moment.tz.names(),
	},
	users: [Object],
	created: Date,
	scheduledDeletion: Date,
});

// eventSchema.pre('save', function (next) {
// 	if (!noBadWords(this.name) || !noBadWords(this.description))
// 		return next(new AppError('Please watch your language.', 400));

// 	next();
// });

// eventSchema.pre('save', async function (next) {
// 	//set up scheduled deletion
// 	if (!this.isNew) return next();

// 	this.created = new Date();
// 	let timeUntilDelete;
// 	if (this.eventType.split('-')[0] === 'date') {
// 		// console.log(this.dates);
// 		const latestDate = this.dates.reduce((p, c) => {
// 			return new Date(p) > new Date(c) ? p : c;
// 		});
// 		const deleteDate = new Date(Date.parse(latestDate) + deletionPeriod);
// 		timeUntilDelete = new Date(deleteDate) - new Date();
// 		this.scheduledDeletion = deleteDate;
// 	} else {
// 		const deleteDate = new Date(Date.parse(this.created) + deletionPeriod * 4);
// 		this.scheduledDeletion = deleteDate;
// 		timeUntilDelete = new Date(deleteDate) - new Date();
// 	}

// 	setTimeout(async () => {
// 		const thisThing = await eventSchema.find({ url: this.url });
// 		console.log(thisThing);
// 	}, 5000);

// 	next();
// });

eventSchema.pre('save', async function (next) {
	//only run this function if the password was modified
	if (!this.isModified('users')) {
		return next();
	}
	//hash the passwords
	await Promise.all(
		this.users.map(async (u) => {
			if (!u.saved) {
				u.saved = true;
				u.password = await bcrypt.hash(u.password, 12);
			}
			return u;
		})
	);

	//times only matter on continuous events
	if (this.isModified('times')) {
		if (this.eventType === 'continuous') {
			if (this.times.length !== 2)
				return next(
					new AppError(
						'You must specify a start and end of a time window for your event.'
					)
				);

			if (
				this.times[0] < 0 ||
				this.times[0] > 1425 ||
				this.times[0] % 15 !== 0 ||
				this.times[1] < 0 ||
				this.times[1] > 1425 ||
				this.times[1] % 15 !== 0
			)
				return next(new AppError('Invalid time window bounds for your event.'));
		}
	}
	next();
});

// //this runs whenever we run anything starting with "find"
// userSchema.pre(/^find/, function (next) {
//   this.find({ active: { $ne: false } });
//   next();
// });

eventSchema.methods.correctPassword = async function (candidatePW, userPW) {
	return await bcrypt.compare(candidatePW, userPW);
};

const Events = mongoose.model('Events', eventSchema, 'events');

module.exports = Events;
