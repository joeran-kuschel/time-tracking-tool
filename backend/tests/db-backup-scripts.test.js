const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

const k8sDir = path.join(__dirname, '..', '..', 'k8s');
const completeDump = '-- PostgreSQL database dump\nCREATE TABLE customers ();\n-- PostgreSQL database dump complete\n';

// Fake kubectl: logs its arguments, prints $FAKE_DUMP for pg_dump and stores stdin for psql.
const fakeKubectl = `#!/bin/bash
echo "$@" >> "$FAKE_DIR/kubectl.log"
case "\${@: -1}" in
  pg_dump*) cat "$FAKE_DUMP" ;;
  psql*) cat > "$FAKE_DIR/psql-stdin" ;;
esac
exit "\${FAKE_EXIT:-0}"
`;
const fakeLaunchctl = '#!/bin/bash\necho "$@" >> "$FAKE_DIR/launchctl.log"\n';

let dir;
let backupDir;

function writeExecutable(file, content) {
  fs.writeFileSync(file, content);
  fs.chmodSync(file, 0o755);
}

function run(script, args = [], { env = {}, input = '' } = {}) {
  return spawnSync('bash', [path.join(k8sDir, script), ...args], {
    input,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`,
      HOME: dir,
      FAKE_DIR: dir,
      FAKE_DUMP: path.join(dir, 'dump.sql'),
      BACKUP_DIR: backupDir,
      ...env,
    },
  });
}

function backups() {
  return fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql.gz')).sort();
}

function kubectlCalls() {
  const log = path.join(dir, 'kubectl.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '';
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-scripts-'));
  backupDir = path.join(dir, 'backups');
  fs.mkdirSync(path.join(dir, 'bin'));
  writeExecutable(path.join(dir, 'bin', 'kubectl'), fakeKubectl);
  writeExecutable(path.join(dir, 'bin', 'launchctl'), fakeLaunchctl);
  fs.writeFileSync(path.join(dir, 'dump.sql'), completeDump);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('backup-db.sh', () => {
  test('writes a compressed dump taken inside the postgres pod', () => {
    const result = run('backup-db.sh');

    expect(result.status).toBe(0);
    expect(backups()).toHaveLength(1);
    const content = zlib.gunzipSync(fs.readFileSync(path.join(backupDir, backups()[0]))).toString();
    expect(content).toBe(completeDump);
    expect(kubectlCalls()).toContain('--context docker-desktop -n time-tracking exec -i deploy/postgres');
    expect(kubectlCalls()).toContain('pg_dump --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"');
  });

  test('keeps previous backups and writes nothing when the dump is incomplete', () => {
    fs.mkdirSync(backupDir);
    fs.writeFileSync(path.join(backupDir, 'time_tracking-20260920-100000.sql.gz'), 'old');
    fs.writeFileSync(path.join(dir, 'dump.sql'), '-- PostgreSQL database dump\nCREATE TABLE');

    const result = run('backup-db.sh');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Backup incomplete');
    expect(fs.readdirSync(backupDir)).toEqual(['time_tracking-20260920-100000.sql.gz']);
  });

  test('fails without writing a backup when the cluster is not reachable', () => {
    const result = run('backup-db.sh', [], { env: { FAKE_EXIT: '1' } });

    expect(result.status).not.toBe(0);
    expect(backups()).toEqual([]);
  });

  test('keeps only the newest BACKUP_KEEP dumps', () => {
    fs.mkdirSync(backupDir);
    ['20260918-100000', '20260919-100000', '20260920-100000'].forEach((stamp, i) => {
      const file = path.join(backupDir, `time_tracking-${stamp}.sql.gz`);
      fs.writeFileSync(file, 'old');
      const time = new Date(Date.UTC(2026, 8, 18 + i, 10));
      fs.utimesSync(file, time, time);
    });

    const result = run('backup-db.sh', [], { env: { BACKUP_KEEP: '2' } });

    expect(result.status).toBe(0);
    expect(backups()).toHaveLength(2);
    expect(backups()).toContain('time_tracking-20260920-100000.sql.gz');
    expect(backups()).not.toContain('time_tracking-20260919-100000.sql.gz');
  });
});

describe('restore-db.sh', () => {
  let backupFile;

  beforeEach(() => {
    fs.mkdirSync(backupDir);
    backupFile = path.join(backupDir, 'time_tracking-20260921-100000.sql.gz');
    fs.writeFileSync(backupFile, zlib.gzipSync(completeDump));
  });

  test('feeds the decompressed dump to psql in the postgres pod', () => {
    const result = run('restore-db.sh', [backupFile, '--yes']);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'psql-stdin'), 'utf8')).toBe(completeDump);
    expect(kubectlCalls()).toContain('psql -v ON_ERROR_STOP=1 --single-transaction');
  });

  test('restores after typing the confirmation word', () => {
    const result = run('restore-db.sh', [backupFile], { input: 'restore\n' });

    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'psql-stdin'))).toBe(true);
  });

  test('aborts without touching the database when not confirmed', () => {
    const result = run('restore-db.sh', [backupFile], { input: 'yes\n' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Aborted');
    expect(kubectlCalls()).toBe('');
  });

  test('shows the usage for a missing backup file', () => {
    const result = run('restore-db.sh', [path.join(backupDir, 'missing.sql.gz'), '--yes']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Usage:');
    expect(kubectlCalls()).toBe('');
  });
});

describe('install-backup-job.sh', () => {
  const plist = () => path.join(dir, 'Library', 'LaunchAgents', 'com.timetracking.db-backup.plist');

  test('installs an hourly launchd job that runs backup-db.sh', () => {
    const result = run('install-backup-job.sh');

    expect(result.status).toBe(0);
    const content = fs.readFileSync(plist(), 'utf8');
    expect(content).toContain(`<string>${path.join(k8sDir, 'backup-db.sh')}</string>`);
    expect(content).toContain('<key>StartInterval</key><integer>3600</integer>');
    expect(content).toContain(`<key>BACKUP_DIR</key><string>${backupDir}</string>`);
    expect(fs.readFileSync(path.join(dir, 'launchctl.log'), 'utf8')).toContain(`bootstrap gui/${process.getuid()} ${plist()}`);
  });

  const onMac = process.platform === 'darwin' ? test : test.skip;
  onMac('writes a valid property list', () => {
    run('install-backup-job.sh');
    expect(spawnSync('plutil', ['-lint', plist()]).status).toBe(0);
  });

  test('removes the job but keeps the backups on --uninstall', () => {
    run('install-backup-job.sh');
    fs.writeFileSync(path.join(backupDir, 'time_tracking-20260921-100000.sql.gz'), 'kept');

    const result = run('install-backup-job.sh', ['--uninstall']);

    expect(result.status).toBe(0);
    expect(fs.existsSync(plist())).toBe(false);
    expect(backups()).toEqual(['time_tracking-20260921-100000.sql.gz']);
  });
});
