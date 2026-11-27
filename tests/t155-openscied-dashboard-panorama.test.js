const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const read = file => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
test('the responsive picture reserves both sizes and names subjects common to its crops', () => {
  const page = read('openscied-dashboard.html');
  const picture = page.match(/<picture class="dashboard-panorama-picture">([\s\S]+?)<\/picture>/)?.[1];
  assert.ok(picture, 'dashboard still uses one responsive picture');
  assert.match(picture, /media="\(max-width: 580px\)" srcset="assets\/bench-field-atlas-mobile\.webp" width="600" height="272"/);
  assert.match(picture, /src="assets\/bench-field-atlas-desktop\.webp" width="1800" height="302"/);
  assert.match(picture, /alt="Biology field atlas with a Serengeti wildebeest and a close-up of an animal cell\."/);
});

for (const [variant, width, height] of [['mobile', 1200, 544], ['desktop', 1800, 302]]) {
  test(variant + ' WebP keeps its intended dimensions without loading the original PNG', () => {
    const art = fs.readFileSync(path.resolve(__dirname, '..', 'assets/bench-field-atlas-' + variant + '.webp'));
    assert.equal(art.toString('ascii', 0, 4), 'RIFF');
    assert.equal(art.toString('ascii', 8, 16), 'WEBPVP8 ');
    assert.deepEqual([art.readUInt16LE(26)&0x3fff, art.readUInt16LE(28)&0x3fff], [width, height]);
    assert.ok(art.length < 160 * 1024, variant + ' WebP stays within its size budget');
  });
}
