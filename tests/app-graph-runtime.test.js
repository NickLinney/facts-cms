const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const stylesSource = fs.readFileSync(require.resolve('../public/styles.css'), 'utf8');

test('effective browser loader consumes the canonical graph response exactly once', () => {
  assert.equal((appSource.match(/async function load\(/g) || []).length, 1);
  assert.match(appSource, /state\.graph\]=await Promise\.all\(\[api\('\/api\/types'\),api\('\/api\/entities'\),api\('\/api\/relationships'\),api\('\/api\/graph'\)\]\)/);
  assert.match(appSource, /load\(\)\.catch\(err=>toast\(err\.message\)\);\s*$/);
});

test('effective client declarations are unique and source return restores graph context', () => {
  const declarations = [...appSource.matchAll(/^function ([A-Za-z0-9_]+)\(/gm)].map(match => match[1]);
  const duplicates = declarations.filter((name, index) => declarations.indexOf(name) !== index);
  assert.deepEqual(duplicates, []);
  assert.match(appSource, /state\.graphSelection=\{kind,id\};state\.graphInspector=true;state\.graphReturnFocus=\{kind,id\};state\.graphSourceRecord=\{kind,id\}/);
  assert.match(appSource, /function restoreGraphReturnFocus\(\)/);
  assert.match(appSource, /state\.graphSourceRecord=null;showSection\('graph'\);restoreGraphReturnFocus\(\)/);
  assert.match(appSource, /state\.graphSourceRecord=null;state\.graphReturnFocus=null;renderGraph\(\)/);
});

test('narrow Graph View keeps top-bar overflow inside a bounded scroll region', () => {
  assert.match(stylesSource, /@media\(max-width:800px\)\{body\{overflow-x:hidden\}\.topbar\{height:auto;min-height:70px;flex-wrap:wrap;[^}]*overflow-x:hidden;max-width:100vw\}/);
  assert.match(stylesSource, /\.ribbon\{order:3;flex:1 1 100%;width:100%;height:auto;min-width:0;flex-wrap:wrap;[^}]*overflow-x:auto\}/);
  assert.match(stylesSource, /\.graph-summary\{overflow-wrap:anywhere\}/);
  assert.match(stylesSource, /@media\(max-width:900px\)\{\.graph-layout\{grid-template-columns:1fr\}/);
});

test('structured graph output maps only directed relationships to arrows', () => {
  assert.match(appSource, /r\.directionality==='directed'\?'→':'—'/);
  assert.match(appSource, /data-graph-node/);
  assert.match(appSource, /data-graph-edge/);
  assert.match(appSource, /class="graph-edge-control" tabindex="0" role="button" aria-pressed="false"/);
  assert.match(appSource, /class="graph-node" tabindex="0" role="button" aria-pressed="false"/);
  assert.doesNotMatch(appSource, /class="graph-edge-control"[^>]*role="img"/);
  assert.doesNotMatch(appSource, /class="graph-node"[^>]*role="img"/);
  assert.match(appSource, /No data-quality warnings/);
  assert.match(appSource, /structured-panel \[data-graph-edge=/);
  assert.match(appSource, /density envelope exceeded/);
  assert.match(appSource, /data-graph-action="select"/);
  assert.match(appSource, /data-graph-action="inspect"/);
  assert.match(appSource, /data-graph-action="source-open"/);
  assert.match(appSource, /denseInput/);
  assert.match(appSource, /const svg=denseInput\?'':/);
  assert.match(appSource, /graph-density-fallback/);
  assert.match(appSource, /setAttribute\('aria-live','polite'\)/);
  assert.match(appSource, /onclick="inspectGraphItem\('node','\$\{e\.id\}'\)"/);
  assert.match(appSource, /onclick="inspectGraphItem\('edge','\$\{r\.id\}'\)"/);
  assert.match(appSource, /graph-source-record/);
  assert.match(appSource, /state\.graphSourceRecord=\{kind,id\}/);
  assert.match(appSource, /state\.graphSelection=null;state\.graphInspector=false/);
  assert.match(appSource, /aria-pressed/);
  assert.match(appSource, /graph-item-selected/);
  assert.match(appSource, /Source record identity masked/);
  assert.match(appSource, /Additional warnings omitted/);
  assert.match(appSource, /structuredNodeOverflow\|\|structuredEdgeOverflow/);
  assert.match(appSource, /action:\$\{activeAction\}:\$\{activeItemKind\}/);
  assert.doesNotMatch(appSource, /Source ref \$\{esc\(graphText\(item\.id\)\.slice/);
  assert.match(appSource, /state\.graphSourceRecord=null;state\.graphReturnFocus=null;renderGraph\(\)/);
  assert.match(appSource, /event\.key!==['"]Escape['"]/);
  assert.match(appSource, /function clearGraphInteraction\(\)/);
  assert.match(appSource, /state\.graphSelection=null;state\.graphInspector=false;state\.graphSourceRecord=null/);
  assert.match(appSource, /item\.getAttribute\('role'\)==='button'.*aria-pressed/);
  assert.match(appSource, /target\?\.focus\(\)/);
  assert.match(stylesSource, /prefers-reduced-motion:\s*reduce/);
});
