const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const rootDir = path.join(__dirname, '..', '..');
const k8sDir = path.join(rootDir, 'k8s');
const migrationsDir = path.join(rootDir, 'backend', 'migrations');

function loadManifests(file) {
  return yaml.loadAll(fs.readFileSync(path.join(k8sDir, file), 'utf8'));
}

function find(docs, kind, name) {
  return docs.find((doc) => doc && doc.kind === kind && doc.metadata.name === name);
}

describe('postgres init scripts', () => {
  const configMap = find(loadManifests('postgres-init-scripts.yaml'), 'ConfigMap', 'postgres-init-scripts');

  test('generated ConfigMap exists in the app namespace', () => {
    expect(configMap).toBeDefined();
    expect(configMap.metadata.namespace).toBe('time-tracking');
  });

  test('contains exactly the migration files, unchanged', () => {
    const migrations = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    expect(Object.keys(configMap.data).sort()).toEqual(migrations);
    for (const file of migrations) {
      expect(configMap.data[file]).toBe(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    }
  });

  test('is mounted into postgres as required, not optional', () => {
    const deployment = find(loadManifests('postgres.yaml'), 'Deployment', 'postgres');
    const volume = deployment.spec.template.spec.volumes.find((v) => v.name === 'init-scripts');
    expect(volume.configMap.name).toBe('postgres-init-scripts');
    expect(volume.configMap.optional).not.toBe(true);
  });
});

describe('database connection config', () => {
  const docs = loadManifests('configmap.yaml');
  const configMap = find(docs, 'ConfigMap', 'time-tracking-config');
  const dbSecret = find(docs, 'Secret', 'time-tracking-db');

  test('DATABASE_URL is stored in a Secret, not the ConfigMap', () => {
    expect(configMap.data.DATABASE_URL).toBeUndefined();
    expect(dbSecret.stringData.DATABASE_URL).toMatch(/^postgresql:\/\//);
  });

  test('SSL is off by default for the in-cluster database', () => {
    expect(configMap.data.DB_SSL).toBe('false');
  });

  test('backend loads both the ConfigMap and the database Secret', () => {
    const deployment = find(loadManifests('backend.yaml'), 'Deployment', 'backend');
    const container = deployment.spec.template.spec.containers.find((c) => c.name === 'backend');
    expect(container.envFrom).toEqual(expect.arrayContaining([
      { configMapRef: { name: 'time-tracking-config' } },
      { secretRef: { name: 'time-tracking-db' } },
    ]));
  });
});

describe('ingress', () => {
  const ingress = find(loadManifests('ingress.yaml'), 'Ingress', 'time-tracking');
  const rule = ingress.spec.rules[0];
  const route = (p) => rule.http.paths.find((entry) => entry.path === p);

  test('has exactly the routes of the frontend and the backend', () => {
    expect(rule.http.paths.map((entry) => entry.path).sort()).toEqual(['/', '/api', '/health']);
  });

  test('serves the tool on its own host in the app namespace', () => {
    expect(ingress.metadata.namespace).toBe('time-tracking');
    expect(ingress.spec.ingressClassName).toBe('nginx');
    expect(ingress.spec.rules).toHaveLength(1);
    expect(rule.host).toBe('time-tracking.local');
  });

  test('the allowed CORS origin is the ingress host', () => {
    const configMap = find(loadManifests('configmap.yaml'), 'ConfigMap', 'time-tracking-config');
    expect(configMap.data.CORS_ORIGIN.split(',')).toContain(`http://${rule.host}`);
  });

  test.each([
    ['/api', 'backend', 'Prefix', 'backend.yaml'],
    ['/health', 'backend', 'Exact', 'backend.yaml'],
    ['/', 'frontend', 'Prefix', 'frontend.yaml'],
  ])('routes %s to the port of the %s service', (p, name, pathType, file) => {
    const service = find(loadManifests(file), 'Service', name);
    expect(route(p)).toBeDefined();
    expect(route(p).pathType).toBe(pathType);
    expect(route(p).backend.service).toEqual({ name, port: { number: service.spec.ports[0].port } });
  });

  test.each([['backend.yaml', 'backend'], ['frontend.yaml', 'frontend']])(
    '%s is only reachable through the ingress, not on a host port',
    (file, name) => {
      expect(find(loadManifests(file), 'Service', name).spec.type).toBe('ClusterIP');
    },
  );

  // VITE_API_URL is built into the frontend image, so the Dockerfile default is what the cluster uses
  test('the frontend image calls the API on its own host', () => {
    const dockerfile = fs.readFileSync(path.join(rootDir, 'frontend', 'Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/^ARG VITE_API_URL=\/api$/m);
  });
});
