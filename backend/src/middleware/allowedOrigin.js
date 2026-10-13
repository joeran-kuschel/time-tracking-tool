const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Rejects requests that change data and come from a page on another origin. Together with the JSON-only
// bodies and the CORS check, this keeps other websites from using the logged-in session.
// Requests without an Origin header don't come from a browser page and pass.
function allowedOrigin(corsOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (SAFE_METHODS.includes(req.method) || !origin || corsOrigins.includes(origin)) {
      return next();
    }
    res.status(403).json({ error: 'Origin not allowed' });
  };
}

module.exports = allowedOrigin;
