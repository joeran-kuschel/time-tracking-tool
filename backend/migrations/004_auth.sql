-- The user of the tool and their login sessions. The email is stored in lower case.
-- A session is identified by the SHA-256 hash of the token in the cookie, so a leaked database or backup
-- doesn't contain a usable token. expires_at is the idle expiry and moves forward while the session is used.
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id);
