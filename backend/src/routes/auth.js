const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');

// Nothing here may be cached: the answers say who is logged in
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.post('/login', authController.login);
// Without requireAuth: logging out with an expired or stale cookie still removes the cookie
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
