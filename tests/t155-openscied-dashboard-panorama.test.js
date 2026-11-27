const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const choices = {
  'bench-field-atlas.svg': { size: '1200 226', subjects: ['wildebeest','forest-fire','animal-cell','rat','polar-bear'] },
  'bench-field-atlas-mobile.svg': { size: '600 272', subjects: ['wildebeest','animal-cell'] },
};
for (const [name, { size, subjects }] of Object.entries(choices)) {
  test(name + ' uses intentional, self-contained illustration subjects', () => {
    const svg = read('assets/' + name);
    assert.ok(svg.includes('viewBox="0 0 ' + size + '"'), 'preserve intrinsic ratio');
    assert.deepEqual([...svg.matchAll(/data-subject="([^"]+)"/g)].map(match => match[1]), subjects);
    assert.match(svg, /<title[^>]*>[^<]+<\/title>\s*<desc[^>]*>[^<]+<\/desc>/);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|(?:href|src)="https?:\/\//i);
  });
}
test('the responsive picture reserves both sizes and names subjects common to its crops', () => {
  const page = read('openscied-dashboard.html');
  const picture = page.match(/<picture class="dashboard-panorama-picture">([\s\S]+?)<\/picture>/)?.[1];
  assert.ok(picture, 'dashboard still uses one responsive picture');
  assert.match(picture, /media="\(max-width: 580px\)" srcset="assets\/bench-field-atlas-mobile\.svg" width="600" height="272"/);
  assert.match(picture, /src="assets\/bench-field-atlas\.svg" width="1200" height="226"/);
  assert.match(picture, /alt="Biology field atlas, with grassland wildlife and a close-up of an animal cell\."/);
});
