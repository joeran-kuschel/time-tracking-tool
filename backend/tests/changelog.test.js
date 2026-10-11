const fs = require('fs');
const path = require('path');

const GROUPS = ['Added', 'Changed', 'Fixed', 'Removed'];
const file = path.join(__dirname, '..', '..', 'CHANGELOG.md');

function parseSections(text) {
  const sections = [];
  let section = null;
  let group = null;
  text.split('\n').forEach((line) => {
    const heading = line.match(/^## (.+)$/);
    const groupHeading = line.match(/^### (.+)$/);
    if (heading) {
      section = { title: heading[1], groups: [] };
      sections.push(section);
      group = null;
    } else if (groupHeading && section) {
      group = { name: groupHeading[1], entries: 0 };
      section.groups.push(group);
    } else if (/^- \S/.test(line) && group) {
      group.entries += 1;
    }
  });
  return sections;
}

describe('CHANGELOG.md', () => {
  const sections = parseSections(fs.readFileSync(file, 'utf8'));

  it('starts with Unreleased, followed by dated sections', () => {
    expect(sections[0].title).toBe('[Unreleased]');
    sections.slice(1).forEach((section) => expect(section.title).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });

  it('lists the dated sections newest first', () => {
    const dates = sections.slice(1).map((section) => section.title);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('uses only the four groups, once each and in order', () => {
    sections.forEach((section) => {
      const names = section.groups.map((group) => group.name);
      expect(names.every((name) => GROUPS.includes(name))).toBe(true);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual(GROUPS.filter((name) => names.includes(name)));
    });
  });

  it('has an entry in every group and in every dated section', () => {
    sections.forEach((section) => {
      section.groups.forEach((group) => expect(group.entries).toBeGreaterThan(0));
    });
    sections.slice(1).forEach((section) => expect(section.groups.length).toBeGreaterThan(0));
  });
});
