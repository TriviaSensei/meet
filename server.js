process.on('uncaughtException', (err) => {
	console.log('Uncaught exception');
	console.log(err.name, err.message);
	console.log(err.stack);
	process.exit(1);
});

const mongoose = require('mongoose');
const app = require('./app');
// const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DB_PASSWORD);

mongoose.connect(DB).then(() => {
	console.log('DB connection successful');
});

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
	console.log(`App running on port ${port}`);
});

const http = require('http').Server(app);

process.on('unhandledRejection', (err) => {
	console.log(err.name, err.message);
	console.log(err);
	console.log('Unhandled rejection. Shutting down.');
	server.close(() => {
		process.exit(1);
	});
});

process.on('SIGTERM', () => {
	console.log('SIGTERM RECEIVED. Shutting down.');
	server.close(() => {
		console.log('Process terminated.');
	});
});
