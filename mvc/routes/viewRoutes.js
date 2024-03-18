const express = require('express');
const viewController = require('../controllers/viewController');
const authController = require('../controllers/authController');

const router = express.Router();

//run this middleware for all routes
// router.use(viewController.handleAlert);

router.get('/', viewController.getHome);
router.get('/:id', authController.isLoggedIn, viewController.getEvent);

module.exports = router;
