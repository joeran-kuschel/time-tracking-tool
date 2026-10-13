const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const rootDir = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

describe('test workflow', () => {
  const workflow = yaml.load(read('.github/workflows/test.yml'));
  const job = workflow.jobs.test;
  const steps = job.steps.map((s) => s.run || s.uses);

  test('runs on pushes to main and on pull requests', () => {
    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on).toHaveProperty('pull_request');
  });

  test('has read-only access to the repository', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
  });

  test('runs the backend and the frontend suite', () => {
    expect([...job.strategy.matrix.package].sort()).toEqual(['backend', 'frontend']);
    expect(job.defaults.run['working-directory']).toBe('${{ matrix.package }}');
    expect(steps).toEqual(expect.arrayContaining(['npm ci', 'npm test']));
  });

  test('uses Node 22 or newer, the version the project needs', () => {
    const setup = job.steps.find((s) => s.uses && s.uses.startsWith('actions/setup-node'));
    expect(parseInt(setup.with['node-version'], 10)).toBeGreaterThanOrEqual(22);
  });

  test('every package has the lock file npm ci needs', () => {
    ['backend', 'frontend'].forEach((pkg) => {
      expect(fs.existsSync(path.join(rootDir, pkg, 'package-lock.json'))).toBe(true);
    });
  });
});

describe('dependabot', () => {
  const config = yaml.load(read('.github/dependabot.yml'));
  const byEcosystem = (ecosystem) => config.updates.filter((u) => u['package-ecosystem'] === ecosystem);

  test('checks both npm packages and the GitHub Actions weekly', () => {
    expect(byEcosystem('npm').map((u) => u.directory).sort()).toEqual(['/backend', '/frontend']);
    expect(byEcosystem('github-actions').map((u) => u.directory)).toEqual(['/']);
    config.updates.forEach((u) => expect(u.schedule.interval).toBe('weekly'));
  });

  test('every checked directory has a package.json, and the workflows exist', () => {
    byEcosystem('npm').forEach((u) => expect(fs.existsSync(path.join(rootDir, u.directory, 'package.json'))).toBe(true));
    const workflows = fs.readdirSync(path.join(rootDir, '.github', 'workflows'));
    expect(workflows.filter((f) => f.endsWith('.yml')).length).toBeGreaterThan(0);
  });

  test('ignores major updates of the Babel plugin, which Jest 30 can only use in version 7', () => {
    const backend = byEcosystem('npm').find((u) => u.directory === '/backend');
    expect(backend.ignore).toEqual([
      { 'dependency-name': '@babel/plugin-transform-modules-commonjs', 'update-types': ['version-update:semver-major'] },
    ]);
    const { devDependencies } = JSON.parse(read('backend/package.json'));
    expect(devDependencies['@babel/plugin-transform-modules-commonjs']).toMatch(/^\^7\./);
  });

  test('groups minor and patch updates for every entry', () => {
    config.updates.forEach((u) => expect(u.groups['minor-and-patch']['update-types']).toEqual(['minor', 'patch']));
  });
});

describe('issue templates', () => {
  const dir = path.join(rootDir, '.github', 'ISSUE_TEMPLATE');

  test.each(['bug_report.md', 'feature_request.md'])('%s has a name, a description and a label', (file) => {
    const front = fs.readFileSync(path.join(dir, file), 'utf8').match(/^---\n([\s\S]*?)\n---/);
    expect(front).not.toBeNull();
    expect(yaml.load(front[1])).toEqual(
      expect.objectContaining({ name: expect.any(String), about: expect.any(String), labels: expect.any(String) })
    );
  });

  test('blank issues are off and vulnerabilities go to private reporting', () => {
    const config = yaml.load(fs.readFileSync(path.join(dir, 'config.yml'), 'utf8'));
    expect(config.blank_issues_enabled).toBe(false);
    expect(config.contact_links[0].url).toMatch(/security\/advisories\/new$/);
  });
});

describe('community files', () => {
  test.each(['CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'LICENSE', '.github/pull_request_template.md'])('%s exists', (file) => {
    expect(read(file).trim().length).toBeGreaterThan(0);
  });

  test('CODE_OF_CONDUCT.md names a contact for reports, and CONTRIBUTING.md and README.md link to it', () => {
    expect(read('CODE_OF_CONDUCT.md')).toMatch(/reported to the community leaders[\s\S]*@[\w.-]+\.\w+/);
    expect(read('CONTRIBUTING.md')).toContain('(CODE_OF_CONDUCT.md)');
    expect(read('README.md')).toContain('(CODE_OF_CONDUCT.md)');
  });

  test('SECURITY.md says what the login protects and what it does not', () => {
    expect(read('SECURITY.md')).toMatch(/needs a login/);
    expect(read('SECURITY.md')).toMatch(/no second factor/);
  });

  test.each(['README.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', '.github/pull_request_template.md'])(
    'every relative link in %s points to an existing file',
    (file) => {
      const links = [...read(file).matchAll(/\]\(((?!https?:|#)[^)#]+)\)/g)].map((m) => m[1]);
      links.forEach((link) => expect(fs.existsSync(path.join(rootDir, path.dirname(file), link))).toBe(true));
    }
  );
});
