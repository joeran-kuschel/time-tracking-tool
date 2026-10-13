const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const docsDir = path.join(root, 'documentation');
const index = fs.readFileSync(path.join(docsDir, 'README.md'), 'utf8');

function chapters(sub) {
  return fs.readdirSync(path.join(docsDir, sub)).filter((f) => f.endsWith('.md')).map((f) => `${sub}/${f}`);
}

describe('documentation/README.md', () => {
  const links = [...index.matchAll(/\]\(([^)#\s]+\.md)\)/g)].map((m) => m[1]);

  it.each([...chapters('ui'), ...chapters('backend')])('links the chapter %s', (chapter) => {
    expect(links).toContain(chapter);
  });

  it('links only to files that exist', () => {
    links.forEach((link) => expect(fs.existsSync(path.join(docsDir, link))).toBe(true));
  });

  it('lists every chapter once', () => {
    expect(new Set(links).size).toBe(links.length);
  });
});

describe('CLAUDE.md', () => {
  it('points only to documentation chapters that exist', () => {
    const text = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    const refs = [...text.matchAll(/`(documentation\/[\w./-]+\.md)`/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    refs.forEach((ref) => expect(fs.existsSync(path.join(root, ref))).toBe(true));
  });
});
