const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', '..', 'k8s', 'setup-tls.sh');

// Fake kubectl: logs its arguments, prints $FAKE_CRT (base64) for "get secret" and swallows stdin for "apply"
const fakeKubectl = `#!/bin/bash
echo "$@" >> "$FAKE_DIR/kubectl.log"
case " $* " in
  *" get namespace "*) exit "\${FAKE_NS_EXIT:-0}" ;;
  *" get secret "*) [ -n "\${FAKE_CRT:-}" ] && printf '%s' "$FAKE_CRT"; exit "\${FAKE_GET_EXIT:-0}" ;;
  *" apply "*) cat > "$FAKE_DIR/applied.yaml" ;;
  *" create secret "*) echo "kind: Secret" ;;
esac
`;
// Fake mkcert: logs its arguments and writes the files named by -cert-file and -key-file
const fakeMkcert = `#!/bin/bash
echo "$@" >> "$FAKE_DIR/mkcert.log"
while [ $# -gt 0 ]; do
  case "$1" in -cert-file|-key-file) echo "$1" > "$2"; echo "$2" >> "$FAKE_DIR/mkcert-files.log"; shift ;; esac
  shift
done
`;
// Fake openssl: logs its arguments; "x509 -checkend" fails when $FAKE_EXPIRING is set
const fakeOpenssl = '#!/bin/bash\necho "$@" >> "$FAKE_DIR/openssl.log"\n[ -z "${FAKE_EXPIRING:-}" ]\n';

let dir;

function writeExecutable(name, content) {
  const file = path.join(dir, 'bin', name);
  fs.writeFileSync(file, content);
  fs.chmodSync(file, 0o755);
}

function run(args = [], env = {}) {
  return spawnSync('/bin/bash', [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, FAKE_DIR: dir, ...env },
  });
}

function log(name) {
  const file = path.join(dir, name);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-script-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  writeExecutable('kubectl', fakeKubectl);
  writeExecutable('mkcert', fakeMkcert);
  writeExecutable('openssl', fakeOpenssl);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('k8s/setup-tls.sh', () => {
  test('installs the local CA and creates the Secret when there is none', () => {
    const result = run();

    expect(result.status).toBe(0);
    expect(log('mkcert.log')).toContain('-install');
    expect(log('mkcert.log')).toContain('-cert-file');
    expect(log('mkcert.log')).toContain('time-tracking.local');
    expect(log('kubectl.log')).toContain(
      '--context docker-desktop -n time-tracking create secret tls time-tracking-tls',
    );
    expect(log('kubectl.log')).toContain('--context docker-desktop -n time-tracking apply -f -');
    expect(log('applied.yaml')).toContain('kind: Secret');
    expect(result.stdout).toContain('Secret time-tracking-tls written for time-tracking.local');
  });

  test('does nothing while the existing certificate is valid for long enough', () => {
    const result = run([], { FAKE_CRT: Buffer.from('cert').toString('base64') });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Secret time-tracking-tls is up to date');
    expect(log('mkcert.log')).toBe('');
    expect(log('kubectl.log')).not.toContain('apply');
  });

  test('creates a new certificate when the existing one expires within 30 days', () => {
    const result = run([], { FAKE_CRT: Buffer.from('cert').toString('base64'), FAKE_EXPIRING: '1' });

    expect(result.status).toBe(0);
    expect(log('kubectl.log')).toContain('apply -f -');
  });

  test('--force creates a new certificate although the existing one is valid', () => {
    const result = run(['--force'], { FAKE_CRT: Buffer.from('cert').toString('base64') });

    expect(result.status).toBe(0);
    expect(log('kubectl.log')).not.toContain('get secret');
    expect(log('kubectl.log')).toContain('apply -f -');
  });

  test('uses KUBE_CONTEXT, NAMESPACE, TLS_HOST and TLS_SECRET from the environment', () => {
    run([], { KUBE_CONTEXT: 'other', NAMESPACE: 'apps', TLS_HOST: 'zeit.local', TLS_SECRET: 'zeit-tls' });

    expect(log('mkcert.log')).toContain('zeit.local');
    expect(log('kubectl.log')).toContain('--context other -n apps create secret tls zeit-tls');
  });

  test('keeps the private key out of the repository and removes the temporary files', () => {
    run();

    const files = log('mkcert-files.log').trim().split('\n');
    expect(files).toHaveLength(2);
    files.forEach((file) => {
      expect(file.startsWith(os.tmpdir()) || file.startsWith('/var/') || file.startsWith('/tmp/')).toBe(true);
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  test('removes the temporary files when kubectl fails', () => {
    fs.writeFileSync(
      path.join(dir, 'bin', 'kubectl'),
      '#!/bin/bash\ncase " $* " in *" create secret "*) exit 1 ;; esac\n',
    );
    const result = run();

    expect(result.status).not.toBe(0);
    log('mkcert-files.log').trim().split('\n').forEach((file) => expect(fs.existsSync(file)).toBe(false));
  });

  test('fails with a hint when mkcert is not installed', () => {
    fs.rmSync(path.join(dir, 'bin', 'mkcert'));
    const result = spawnSync('/bin/bash', [script], {
      encoding: 'utf8',
      env: { PATH: `${path.join(dir, 'bin')}:/usr/bin:/bin`, HOME: dir, FAKE_DIR: dir },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('brew install mkcert');
    expect(log('kubectl.log')).toBe('');
  });

  test('stops before touching the trust store when the cluster or namespace is not reachable', () => {
    const result = run([], { FAKE_NS_EXIT: '1' });

    expect(result.status).not.toBe(0);
    expect(log('mkcert.log')).toBe('');
    expect(log('kubectl.log')).not.toContain('apply');
    expect(result.stdout).not.toContain('written');
  });

  test('checks that the certificate is valid for 30 more days', () => {
    run([], { FAKE_CRT: Buffer.from('cert').toString('base64') });

    expect(log('openssl.log')).toContain('x509 -noout -checkend 2592000');
  });

  test('replaces an existing Secret whose certificate is not valid base64', () => {
    const result = run([], { FAKE_CRT: '%%% not base64 %%%' });

    expect(result.status).toBe(0);
    expect(log('kubectl.log')).toContain('apply -f -');
  });

  test('creates a Secret when the lookup fails, for example because the cluster is unreachable', () => {
    const result = run([], { FAKE_GET_EXIT: '1' });

    expect(result.status).toBe(0);
    expect(log('kubectl.log')).toContain('apply -f -');
  });

  test('installs the CA before it creates the certificate', () => {
    run();

    const lines = log('mkcert.log').trim().split('\n');
    expect(lines[0]).toBe('-install');
    expect(lines[1]).toContain('-cert-file');
  });

  test('stops without a Secret when mkcert -install fails', () => {
    writeExecutable('mkcert', '#!/bin/bash\necho "$@" >> "$FAKE_DIR/mkcert.log"\n[ "$1" != "-install" ]\n');
    const result = run();

    expect(result.status).not.toBe(0);
    expect(log('mkcert.log')).not.toContain('-cert-file');
    expect(log('kubectl.log')).not.toContain('apply');
    expect(result.stdout).not.toContain('written');
  });

  test('stops without a Secret when mkcert cannot create the certificate', () => {
    writeExecutable('mkcert', '#!/bin/bash\n[ "$1" = "-install" ]\n');
    const result = run();

    expect(result.status).not.toBe(0);
    expect(log('kubectl.log')).not.toContain('create secret');
    expect(log('kubectl.log')).not.toContain('apply');
    expect(result.stdout).not.toContain('written');
  });

  test('fails without reporting success when kubectl apply fails', () => {
    writeExecutable('kubectl', '#!/bin/bash\ncase " $* " in *" apply "*) cat > /dev/null; exit 1 ;; *" create secret "*) echo "kind: Secret" ;; esac\n');
    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('written');
  });

  test('fails without reporting success when creating the Secret manifest fails', () => {
    writeExecutable('kubectl', '#!/bin/bash\ncase " $* " in *" apply "*) cat > /dev/null ;; *" create secret "*) exit 1 ;; esac\n');
    const result = run();

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('written');
  });

  test('fails and removes the temporary files when kubectl is not installed', () => {
    fs.rmSync(path.join(dir, 'bin', 'kubectl'));
    const bash = spawnSync('/bin/bash', ['-c', 'command -v kubectl'], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
    if (bash.status === 0) return; // a real kubectl in the system path would make this test meaningless
    const result = spawnSync('/bin/bash', [script], {
      encoding: 'utf8',
      env: { PATH: `${path.join(dir, 'bin')}:/usr/bin:/bin`, HOME: dir, FAKE_DIR: dir },
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).not.toContain('written');
    log('mkcert-files.log').trim().split('\n').forEach((file) => expect(fs.existsSync(file)).toBe(false));
  });

  test.each([['--forse'], ['x', '--force'], ['--force', '--force']])(
    'rejects the arguments %s instead of ignoring them',
    (...args) => {
      const result = run(args, { FAKE_CRT: Buffer.from('cert').toString('base64') });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Usage:');
      expect(log('mkcert.log')).toBe('');
      expect(log('kubectl.log')).toBe('');
    },
  );
});
