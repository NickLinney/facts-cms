const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const stylesSource = fs.readFileSync(require.resolve('../public/styles.css'), 'utf8');

test('effective browser loader consumes the canonical graph response exactly once', () => {
  assert.equal((appSource.match(/async function load\(/g) || []).length, 1);
  assert.match(appSource, /state\.graph\]=await Promise\.all\(\[api\('\/api\/types'\),api\('\/api\/entities'\),api\('\/api\/relationships'\),api\('\/api\/graph'\)\]\)/);
});

test('structured graph output maps only directed relationships to arrows', () => {
  assert.match(appSource, /r\.directionality==='directed'\?'→':'—'/);
  assert.match(appSource, /data-graph-node/);
  assert.match(appSource, /data-graph-edge/);
  assert.match(appSource, /class="graph-edge-control" tabindex="0"/);
  assert.match(appSource, /No data-quality warnings/);
  assert.match(appSource, /structured-panel \[data-graph-edge=/);
  assert.match(appSource, /density envelope exceeded/);
  assert.match(appSource, /target\?\.focus\(\)/);
  assert.match(stylesSource, /prefers-reduced-motion:\s*reduce/);
});
