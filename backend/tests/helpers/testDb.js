const fs = require('fs');
const path = require('path');
const { newDb, DataType } = require('pg-mem');

const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

// In-memory Postgres with the real schema from backend/migrations.
function createTestPool() {
  // pg-mem ignores details it can't model, e.g. the DECIMAL(10, 2) precision
  const db = newDb({ noAstCoverageCheck: true });
  // pg-mem lacks strpos (position of a substring, 0 when absent), which the entry search uses
  db.public.registerFunction({
    name: 'strpos',
    args: [DataType.text, DataType.text],
    returns: DataType.integer,
    implementation: (text, search) => text.indexOf(search) + 1,
  });
  // pg-mem lacks round (halves away from zero, like Postgres rounds a numeric), which the entry search uses
  db.public.registerFunction({
    name: 'round',
    args: [DataType.float],
    returns: DataType.float,
    implementation: (value) => Math.sign(value) * Math.round(Math.abs(value)),
  });
  // pg-mem lacks to_char, which the invoices use for their dates; only the format 'YYYY-MM-DD' of a date is supported here
  db.public.registerFunction({
    name: 'to_char',
    args: [DataType.date, DataType.text],
    returns: DataType.text,
    implementation: (date, format) => {
      if (format !== 'YYYY-MM-DD') throw new Error(`to_char: the test database only knows YYYY-MM-DD, not ${format}`);
      return date.toISOString().slice(0, 10);
    },
  });
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.public.none(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  const { Pool } = db.adapters.createPg();
  return new Pool();
}

module.exports = { createTestPool };
