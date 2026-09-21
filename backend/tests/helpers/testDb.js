const fs = require('fs');
const path = require('path');
const { newDb } = require('pg-mem');

const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

// In-memory Postgres with the real schema from backend/migrations.
function createTestPool() {
  // pg-mem ignores details it can't model, e.g. the DECIMAL(10, 2) precision
  const db = newDb({ noAstCoverageCheck: true });
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.public.none(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

module.exports = { createTestPool };
