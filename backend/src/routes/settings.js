const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/', settingsController.get);
router.put('/', settingsController.update);
router.get('/logo', settingsController.getLogo);
router.put('/logo', settingsController.putLogo);
router.delete('/logo', settingsController.deleteLogo);

module.exports = router;
