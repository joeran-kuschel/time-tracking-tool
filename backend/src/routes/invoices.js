const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');

router.post('/preview', invoiceController.preview);
router.post('/', invoiceController.create);
router.get('/', invoiceController.getAll);
router.get('/:id/pdf', invoiceController.getPdf);
router.delete('/:id', invoiceController.delete);

module.exports = router;
