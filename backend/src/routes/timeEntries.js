const express = require('express');
const router = express.Router();
const timeEntryController = require('../controllers/timeEntryController');

router.get('/project/:projectId', timeEntryController.getByProjectId);
router.get('/:id', timeEntryController.getById);
router.post('/', timeEntryController.create);
router.patch('/:id', timeEntryController.update);
router.delete('/:id', timeEntryController.delete);

module.exports = router;
