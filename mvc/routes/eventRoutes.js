const express = require('express');
const eventController = require('../controllers/eventController');

const router = express.Router();

router.post('/', eventController.createEvent);

router.post('/login/:id', eventController.login);
router.post('/logout/:id', eventController.logout);

router
	.route('/:id')
	.get(eventController.isLoggedIn, eventController.getEvent)
	.patch(eventController.isLoggedIn, eventController.updateEvent)
	.delete(eventController.isLoggedIn, eventController.deleteEvent);

router.patch(
	'/updateAvailability/:id',
	eventController.isLoggedIn,
	eventController.updateAvailability
);

router.patch(
	'/updateNotes/:id',
	eventController.isLoggedIn,
	eventController.updateNotes
);

router.patch(
	'/updateTimeZone/:id',
	eventController.isLoggedIn,
	eventController.updateTimeZone
);
module.exports = router;
