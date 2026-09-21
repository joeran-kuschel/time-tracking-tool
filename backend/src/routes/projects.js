const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');

router.get('/customer/:customerId', projectController.getByCustomerId);
router.get('/:id', projectController.getById);
router.post('/', projectController.create);
router.put('/:id', projectController.update);
router.delete('/:id', projectController.delete);

module.exports = router;
