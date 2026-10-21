const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const rootDir = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(rootDir, ...parts), 'utf8');
const manifests = (file) => yaml.loadAll(read('k8s', file)).filter(Boolean);
const find = (docs, kind, name) => docs.find((doc) => doc.kind === kind && doc.metadata.name === name);

const deployment = (file, name) => find(manifests(file), 'Deployment', name);
const service = (file, name) => find(manifests(file), 'Service', name);

describe.each([
  ['network-policy-postgres.yaml', 'postgres-allow-backend', 'postgres.yaml', 'postgres', 'backend.yaml', 'backend'],
  ['network-policy-backend.yaml', 'backend-from-frontend', 'backend.yaml', 'backend', 'frontend.yaml', 'frontend'],
])('%s', (file, name, targetFile, target, sourceFile, source) => {
  const policy = find(manifests(file), 'NetworkPolicy', name);
  const podLabels = (f, n) => deployment(f, n).spec.template.metadata.labels;

  test('is in the app namespace and selects the target pods', () => {
    expect(policy).toBeDefined();
    expect(policy.metadata.namespace).toBe('time-tracking');
    expect(policy.spec.podSelector).toEqual({ matchLabels: podLabels(targetFile, target) });
  });

  test('is ingress only', () => {
    expect(policy.spec.policyTypes).toEqual(['Ingress']);
    expect(policy.spec).not.toHaveProperty('egress');
  });

  test('allows one source, a pod label in the same namespace', () => {
    expect(policy.spec.ingress).toHaveLength(1);
    const { from } = policy.spec.ingress[0];
    expect(from).toEqual([{ podSelector: { matchLabels: podLabels(sourceFile, source) } }]);
  });

  test('the target service selects the same pods the policy protects', () => {
    expect(service(targetFile, target).spec.selector).toEqual(policy.spec.podSelector.matchLabels);
  });

  test('allows only the TCP port of the target service', () => {
    const port = service(targetFile, target).spec.ports[0].targetPort;
    expect(policy.spec.ingress[0].ports).toEqual([{ protocol: 'TCP', port }]);
  });
});

test('the postgres policy port is the database port of the container', () => {
  const container = deployment('postgres.yaml', 'postgres').spec.template.spec.containers[0];
  expect(container.ports[0].containerPort).toBe(5432);
});

test('no Job, CronJob or StatefulSet in k8s/ that could connect to the database', () => {
  const kinds = fs.readdirSync(path.join(rootDir, 'k8s'))
    .filter((f) => f.endsWith('.yaml'))
    .flatMap((f) => manifests(f).map((doc) => doc.kind));
  expect(kinds.filter((kind) => ['Job', 'CronJob', 'StatefulSet'].includes(kind))).toEqual([]);
});

describe('frontend/nginx.conf', () => {
  const conf = read('frontend', 'nginx.conf');
  const backend = service('backend.yaml', 'backend');
  const upstream = `http://${backend.metadata.name}:${backend.spec.ports[0].port}`;
  const block = (header) => {
    const start = conf.indexOf(header);
    expect(start).toBeGreaterThan(-1);
    return conf.slice(start, conf.indexOf('}', start));
  };

  test.each(['location ^~ /api/ {', 'location = /health {'])('%s proxies to the backend service', (header) => {
    const text = block(header);
    expect(text).toContain(`proxy_pass ${upstream};`);
    expect(text).toContain('proxy_set_header Host $host;');
  });

  test('the proxy_pass has no path, so the request URI is passed unchanged', () => {
    const targets = [...conf.matchAll(/proxy_pass\s+(\S+);/g)].map((m) => m[1]);
    expect(targets).toEqual([upstream, upstream]);
  });

  test('keeps the single-page fallback and the static-file rule', () => {
    expect(conf).toContain('try_files $uri $uri/ /index.html;');
    expect(conf).toContain('location ~* \\.(js|css');
  });
});

describe('Docker Compose', () => {
  const base = yaml.load(read('docker-compose.yml'));
  const dev = yaml.load(read('docker-compose.dev.yml'));

  test('the base file publishes no port of the database and the backend', () => {
    expect(base.services.postgres.ports).toBeUndefined();
    expect(base.services.backend.ports).toBeUndefined();
  });

  test('the base file publishes the frontend on this machine only', () => {
    expect(base.services.frontend.ports).toEqual(['127.0.0.1:80:80']);
  });

  test('the frontend build has no VITE_API_URL, so the Dockerfile default /api goes through nginx', () => {
    expect(base.services.frontend.build.args).toBeUndefined();
  });

  test('the base file keeps the default CORS origin', () => {
    expect(base.services.backend.environment.CORS_ORIGIN).toBe('${CORS_ORIGIN:-http://localhost}');
  });

  test('the dev file publishes only the database and the backend, on 127.0.0.1', () => {
    expect(Object.keys(dev.services).sort()).toEqual(['backend', 'postgres']);
    expect(dev.services.postgres.ports).toEqual(['127.0.0.1:5432:5432']);
    expect(dev.services.backend.ports).toEqual(['127.0.0.1:3000:3000']);
  });

  test('the dev file allows the Vite dev server as origin', () => {
    expect(dev.services.backend.environment.CORS_ORIGIN).toBe('${CORS_ORIGIN:-http://localhost,http://localhost:5173}');
  });
});

describe('docs list the policies in the apply order', () => {
  test.each(['README.md', 'k8s/README.md'])('%s applies both policies after the ingress', (file) => {
    const text = read(file);
    const ingress = text.indexOf('kubectl apply -f k8s/ingress.yaml');
    expect(ingress).toBeGreaterThan(-1);
    expect(text.indexOf('kubectl apply -f k8s/network-policy-postgres.yaml')).toBeGreaterThan(ingress);
    expect(text.indexOf('kubectl apply -f k8s/network-policy-backend.yaml')).toBeGreaterThan(ingress);
  });

  test('CLAUDE.md applies every manifest except the namespace, the policies after the ingress', () => {
    const loop = read('CLAUDE.md').match(/for f in (.+); do kubectl apply/)[1].split(/\s+/);
    const applied = fs.readdirSync(path.join(rootDir, 'k8s'))
      .filter((f) => f.endsWith('.yaml') && f !== 'namespace.yaml')
      .map((f) => f.replace(/\.yaml$/, ''));
    expect([...loop].sort()).toEqual(applied.sort());
    expect(loop.indexOf('network-policy-postgres')).toBeGreaterThan(loop.indexOf('ingress'));
    expect(loop.indexOf('network-policy-backend')).toBeGreaterThan(loop.indexOf('ingress'));
  });

  test('deployment.md lists both policies after the ingress', () => {
    const text = read('documentation', 'backend', 'deployment.md');
    expect(text).toMatch(/`ingress`, `network-policy-postgres`,\s+`network-policy-backend`/);
  });

  test('k8s/README.md documents the upgrade order: frontend first, backend restart last', () => {
    const text = read('k8s', 'README.md');
    const frontend = text.indexOf('rollout restart deployment/frontend');
    const ingress = text.indexOf('kubectl apply -f k8s/ingress.yaml', frontend);
    const backend = text.indexOf('rollout restart deployment/backend', ingress);
    expect(frontend).toBeGreaterThan(-1);
    expect(ingress).toBeGreaterThan(frontend);
    expect(backend).toBeGreaterThan(ingress);
  });
});
