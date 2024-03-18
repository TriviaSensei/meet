const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/appError');
const APIFeatures = require('../../utils/apiFeatures');
const Filter = require('bad-words');
const filter = new Filter();
const noBadWords = (val) => !filter.isProfane(val);
// const User = require('../models/userModel');
const Event = require('../models/eventModel');

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

//this will delete one of any document, depending on what gets passed to it.
exports.deleteOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const doc = await Model.findByIdAndDelete(req.params.id);

		res.status(204).json({
			status: 'success',
			data: null,
		});
	});

exports.updateOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});
		if (!doc) {
			return next(new AppError('No document found with that ID.', 404));
		}

		res.status(200).json({
			status: 'success',
			data: doc,
		});
	});

exports.createOne = (Model) =>
	catchAsync(async (req, res, next) => {
		const arr = req.originalUrl.trim().split('/');
		const loc = arr.length > 3 ? arr[3] : '';

		if (loc === 'events') {
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
			let existing = await Model.findOne({
				url: req.body.url,
			});
			while (existing) {
				req.body.url = randomString(16);
			}

			req.body.users = [
				{
					name: req.body.userName,
					password: req.body.password,
					saved: false,
					availability: [],
				},
			];
		}

		const doc = await Model.create(req.body);

		res.status(201).json({
			status: 'success',
			//envelope the new object
			data: doc,
		});
	});

exports.getOne = (Model, popOptions) =>
	catchAsync(async (req, res, next) => {
		let filter = { _id: req.params.id };
		query = Model.find(filter);

		if (popOptions) query = query.populate(popOptions);

		res.status(200).json({
			status: 'success',
			data: doc,
		});
	});

exports.getAll = (Model, popOptions) =>
	catchAsync(async (req, res, next) => {
		let filter = {};

		let features;
		if (popOptions) {
			features = new APIFeatures(
				Model.find(filter).populate(popOptions),
				req.query
			)
				.filter()
				.sort()
				.limitFields()
				.paginate();
		} else {
			features = new APIFeatures(Model.find(filter), req.query)
				.filter()
				.sort()
				.limitFields()
				.paginate();
		}
		let doc = await features.query;

		res.status(200).json({
			status: 'success',
			results: doc.length,
			data: doc,
		});
	});
