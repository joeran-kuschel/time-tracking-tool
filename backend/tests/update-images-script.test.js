const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', '..', 'k8s', 'update-images.sh');
const HEADER = 'REF TYPE DIGEST SIZE PLATFORMS LABELS';

// Fake docker: logs its arguments. `ctr images ls` prints the listing before the import, or the one after it once an
// import happened; `ctr images rm` fails for the references in $FAKE_RM_FAIL.
const fakeDocker = `#!/bin/bash
echo "$@" >> "$FAKE_DIR/docker.log"
echo "docker $@" >> "$FAKE_DIR/all.log"
case "$*" in
  save*) [ -z "$FAKE_SAVE_FAIL" ] || exit 1; echo "image-tar" ;;
  *"images import"*) case "$*" in "exec -i "*) ;; *) echo "import without -i: no stdin" >&2; exit 1 ;; esac; cat > /dev/null; touch "$FAKE_DIR/imported" ;;
  *"images ls"*) if [ -e "$FAKE_DIR/imported" ]; then cat "$FAKE_DIR/after"; else cat "$FAKE_DIR/before"; fi ;;
  *"images rm"*) case " $FAKE_RM_FAIL " in *" \${@: -1} "*) exit 1 ;; esac ;;
  *"df -h"*) printf 'Filesystem Size Used Avail Use%% Mounted on\\n/dev/vda1 59G 40G 17G 70%% /var\\n' ;;
esac
exit 0
`;
const fakeKubectl = `#!/bin/bash
echo "$@" >> "$FAKE_DIR/kubectl.log"
echo "kubectl $@" >> "$FAKE_DIR/all.log"
case "$*" in
  *"rollout restart"*) exit "\${FAKE_RESTART_EXIT:-0}" ;;
  *"rollout status"*)
    case "$*" in *"deployment/\$FAKE_ROLLOUT_FAIL "*) exit 1 ;; esac
    exit "\${FAKE_ROLLOUT_EXIT:-0}" ;;
esac
exit 0
`;

const BACKEND_OLD = 'sha256:' + 'a'.repeat(64);
const BACKEND_NEW = 'sha256:' + 'b'.repeat(64);
const FRONTEND_OLD = 'sha256:' + 'c'.repeat(64);
const FRONTEND_NEW = 'sha256:' + 'd'.repeat(64);
const OTHER = 'sha256:' + 'e'.repeat(64);

const row = (ref, digest) => `${ref} application/vnd.oci.image.manifest.v1+json ${digest} 100.0 MiB linux/arm64 io=managed`;
const listing = (...rows) => [HEADER, ...rows].join('\n') + '\n';

// What the node holds before and after the new build is imported: the tags move, the old ids stay behind.
const before = listing(
  row('docker.io/library/time-tracking-backend:latest', BACKEND_OLD),
  row('sha256:0001', BACKEND_OLD),
  row('docker.io/library/time-tracking-frontend:latest', FRONTEND_OLD),
  row('sha256:0002', FRONTEND_OLD),
  row('docker.io/library/watchlist-backend:20261114135150', OTHER),
  row('sha256:0003', OTHER),
);
const after = listing(
  row('docker.io/library/time-tracking-backend:latest', BACKEND_NEW),
  row('sha256:0001', BACKEND_OLD),
  row('sha256:0011', BACKEND_NEW),
  row('docker.io/library/time-tracking-frontend:latest', FRONTEND_NEW),
  row('sha256:0002', FRONTEND_OLD),
  row('sha256:0012', FRONTEND_NEW),
  row('docker.io/library/watchlist-backend:20261114135150', OTHER),
  row('sha256:0003', OTHER),
  row('import-2026-06-02@sha256:' + 'f'.repeat(64), 'sha256:' + 'f'.repeat(64)),
);

let dir;

function writeExecutable(file, content) {
  fs.writeFileSync(file, content);
  fs.chmodSync(file, 0o755);
}

function run(env = {}) {
  return spawnSync('bash', [script], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, FAKE_DIR: dir, ...env },
  });
}

const dockerCalls = () => fs.readFileSync(path.join(dir, 'docker.log'), 'utf8').trim().split('\n');
const kubectlCalls = () => fs.readFileSync(path.join(dir, 'kubectl.log'), 'utf8');
const removed = () => dockerCalls().filter((c) => c.includes('images rm')).map((c) => c.split(' ').pop());

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-images-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  writeExecutable(path.join(dir, 'bin', 'docker'), fakeDocker);
  writeExecutable(path.join(dir, 'bin', 'kubectl'), fakeKubectl);
  fs.writeFileSync(path.join(dir, 'before'), before);
  fs.writeFileSync(path.join(dir, 'after'), after);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('update-images.sh', () => {
  test('imports both images, restarts both deployments and waits for them', () => {
    const result = run();

    expect(result.status).toBe(0);
    const calls = dockerCalls();
    expect(calls).toContain('save time-tracking-backend:latest');
    expect(calls).toContain('save time-tracking-frontend:latest');
    expect(calls.filter((c) => c.includes('images import'))).toHaveLength(2);
    expect(kubectlCalls()).toContain('--context docker-desktop -n time-tracking rollout restart deployment/backend deployment/frontend');
    expect(kubectlCalls()).toContain('rollout status deployment/backend --timeout=180s');
    expect(kubectlCalls()).toContain('rollout status deployment/frontend --timeout=180s');
  });

  test('removes the previous copies of the two images and nothing else', () => {
    const result = run();

    expect(result.status).toBe(0);
    expect(removed().sort()).toEqual(['sha256:0001', 'sha256:0002']);
    expect(result.stdout).toContain('Removed the previous copy sha256:0001');
    expect(result.stdout).toContain('2 previous copies removed');
    // The new copies, the other apps' images and the unrelated import reference stay.
    expect(removed()).not.toContain('sha256:0011');
    expect(removed()).not.toContain('sha256:0003');
    expect(removed().join(' ')).not.toContain('import-2026');
  });

  test('removes the copies only after the rollout finished', () => {
    run();

    const calls = fs.readFileSync(path.join(dir, 'all.log'), 'utf8').trim().split('\n');
    const lastStatus = calls.map((c) => c.includes('rollout status')).lastIndexOf(true);
    const firstRemove = calls.findIndex((c) => c.includes('images rm'));
    expect(lastStatus).toBeGreaterThan(-1);
    expect(firstRemove).toBeGreaterThan(lastStatus);
  });

  test('keeps a copy that a tag still shares, as when the build did not change', () => {
    fs.writeFileSync(path.join(dir, 'after'), before);

    const result = run();

    expect(result.status).toBe(0);
    expect(removed()).toEqual([]);
    expect(result.stdout).toContain('0 previous copies removed');
  });

  test('is safe to run again: nothing is left to remove the second time', () => {
    fs.writeFileSync(
      path.join(dir, 'after'),
      listing(
        row('docker.io/library/time-tracking-backend:latest', BACKEND_NEW),
        row('sha256:0011', BACKEND_NEW),
        row('docker.io/library/time-tracking-frontend:latest', FRONTEND_NEW),
        row('sha256:0012', FRONTEND_NEW),
      ),
    );
    fs.writeFileSync(path.join(dir, 'before'), fs.readFileSync(path.join(dir, 'after'), 'utf8'));

    const result = run();

    expect(result.status).toBe(0);
    expect(removed()).toEqual([]);
  });

  test('works on a first install, when the node has no copy of the images yet', () => {
    fs.writeFileSync(path.join(dir, 'before'), listing());

    const result = run();

    expect(result.status).toBe(0);
    expect(removed()).toEqual([]);
  });

  test('only warns when a copy cannot be removed, and still succeeds', () => {
    const result = run({ FAKE_RM_FAIL: 'sha256:0001' });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Warning: could not remove sha256:0001');
    expect(result.stdout).toContain('Removed the previous copy sha256:0002');
    expect(result.stdout).toContain('1 previous copy removed');
  });

  test('removes nothing and fails when a rollout does not finish, so a rollback still has its images', () => {
    const result = run({ FAKE_ROLLOUT_EXIT: '1' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('did not finish');
    expect(removed()).toEqual([]);
  });

  test('reports the free space of the node', () => {
    const result = run();

    expect(result.stdout).toContain('The node has 17G free (70% used) on /var.');
  });

  test('uses the node and the timeout from the environment', () => {
    run({ NODE_CONTAINER: 'other-node', NODE: '/usr/local/bin/node', ROLLOUT_TIMEOUT: '30s' });

    expect(dockerCalls().join('\n')).toContain('exec other-node ctr --namespace k8s.io images ls');
    expect(kubectlCalls()).toContain('--timeout=30s');
  });

  test('removes nothing and fails when only the second rollout does not finish', () => {
    const result = run({ FAKE_ROLLOUT_FAIL: 'frontend' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('rollout of frontend did not finish');
    expect(removed()).toEqual([]);
  });

  test('stops before restarting or removing anything when an image cannot be exported', () => {
    const result = run({ FAKE_SAVE_FAIL: '1' });

    expect(result.status).not.toBe(0);
    expect(fs.existsSync(path.join(dir, 'kubectl.log'))).toBe(false);
    expect(removed()).toEqual([]);
  });

  test('removes nothing when the restart fails', () => {
    const result = run({ FAKE_RESTART_EXIT: '1' });

    expect(result.status).not.toBe(0);
    expect(kubectlCalls()).not.toContain('rollout status');
    expect(removed()).toEqual([]);
  });

  test('keeps a previous copy that another app tags with the same digest', () => {
    const shared = row('docker.io/library/watchlist-backend:20261114135150', BACKEND_OLD);
    fs.writeFileSync(path.join(dir, 'after'), after + shared + '\n');

    const result = run();

    expect(result.status).toBe(0);
    expect(removed()).toEqual(['sha256:0002']);
  });

  test('removes a previous copy that is listed as name@sha256 without a tag', () => {
    const ref = 'import-2026-05-01@' + BACKEND_OLD;
    fs.writeFileSync(path.join(dir, 'after'), after + row(ref, BACKEND_OLD) + '\n');

    run();

    expect(removed().sort()).toEqual([ref, 'sha256:0001', 'sha256:0002'].sort());
  });

  test('still succeeds when the listing after the rollout cannot be read', () => {
    fs.writeFileSync(path.join(dir, 'after'), '');

    const result = run();

    expect(result.status).toBe(0);
    expect(removed()).toEqual([]);
  });

  test('is a bash script that is executable, so the login shell does not matter', () => {
    expect(fs.readFileSync(script, 'utf8').split('\n')[0]).toBe('#!/bin/bash');
    expect(fs.statSync(script).mode & 0o111).not.toBe(0);
  });
});
