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
    expect(job.strategy.matrix.package.sort()).toEqual(['backend', 'frontend']);
    expect(job.defaults.run['working-directory']).toBe('${{ matrix.package }}');
    expect(steps).toEqual(expect.arrayContaining(['npm ci', 'npm test']));
  });

  test('uses Node 22 or newer, the version the project needs', () => {
    const setup = job.steps.find((s) => s.uses && s.uses.startsWith('actions/setup-node'));
    expect(Number(setup.with['node-version'])).toBeGreaterThanOrEqual(22);
  });

  test('every package has the lock file npm ci needs', () => {
    ['backend', 'frontend'].forEach((pkg) => {
      expect(fs.existsSync(path.join(rootDir, pkg, 'package-lock.json'))).toBe(true);
    });
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
  test.each(['CONTRIBUTING.md', 'SECURITY.md', 'LICENSE', '.github/pull_request_template.md'])('%s exists', (file) => {
    expect(read(file).trim().length).toBeGreaterThan(0);
  });

  test('SECURITY.md warns that the API has no login', () => {
    expect(read('SECURITY.md')).toMatch(/no authentication/);
  });

  test('every link to a file in CONTRIBUTING.md points to an existing file', () => {
    const links = [...read('CONTRIBUTING.md').matchAll(/\]\(((?!https?:)[^)#]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(fs.existsSync(path.join(rootDir, link))).toBe(true));
  });
});
