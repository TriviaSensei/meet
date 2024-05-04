const express = require('express');
const eventController = require('../controllers/eventController');
const viewController = require('../controllers/viewController');

const router = express.Router();

//run this middleware for all routes
// router.use(viewController.handleAlert);

router.get('/', viewController.getHome);
router.get('/help', viewController.getHelp);
router.get('/:id', eventController.isLoggedIn, viewController.getEvent);
module.exports = router;
