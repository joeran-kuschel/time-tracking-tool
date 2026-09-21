const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/customer/:customerId/pdf', reportController.generatePDF);
router.get('/customer/:customerId', reportController.getMonthlyReport);

module.exports = router;
