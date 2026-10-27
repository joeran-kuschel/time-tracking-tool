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

describe('images in the chapters', () => {
  const images = [...chapters('ui'), ...chapters('backend')].flatMap((chapter) => {
    const text = fs.readFileSync(path.join(docsDir, chapter), 'utf8');
    return [...text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map((m) => ({ chapter, alt: m[1], src: m[2] }));
  });

  it('has screenshots in the chapters', () => {
    expect(images.length).toBeGreaterThan(0);
  });

  const resolve = (image) => path.resolve(docsDir, path.dirname(image.chapter), image.src);
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it.each(images.map((i) => [i.chapter, i.src, i]))('%s: %s has an alt text', (chapter, src, image) => {
    expect(image.alt.trim()).not.toBe('');
  });

  it.each(images.map((i) => [i.chapter, i.src, i]))('%s: %s is a relative path inside documentation/', (chapter, src, image) => {
    expect(image.src).not.toMatch(/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i);
    expect(path.relative(docsDir, resolve(image)).startsWith('..')).toBe(false);
  });

  it.each(images.map((i) => [i.chapter, i.src, i]))('%s: %s is an existing, non-empty PNG file', (chapter, src, image) => {
    const file = resolve(image);
    expect(fs.existsSync(file)).toBe(true);
    const data = fs.readFileSync(file);
    expect(data.length).toBeGreaterThan(PNG.length);
    expect(data.subarray(0, PNG.length).equals(PNG)).toBe(true);
  });

  it('has no image in documentation/ui/images/ that no chapter shows', () => {
    const used = images.map((i) => resolve(i));
    const files = fs.readdirSync(path.join(docsDir, 'ui', 'images')).map((f) => path.join(docsDir, 'ui', 'images', f));
    files.forEach((file) => expect(used).toContain(file));
  });
});
