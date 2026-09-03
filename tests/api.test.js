const test = require('node:test');
const assert = require('node:assert/strict');
test('release version is the requested pre-alpha snapshot', () => {
  const pkg = require('../package.json');
  assert.equal(pkg.version, '0.0.0-pre-alpha.2');
});
