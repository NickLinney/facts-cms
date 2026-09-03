const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeSchema, validateData, validatePresentationConfig} = require('../server');

test('OWL-002 mixed-domain property contracts support ordered reference lists', () => {
  const schema = normalizeSchema({properties: [
    {name: 'participants', value_kind: 'entity_reference', cardinality: 'many', target_kinds: ['Character'], min: 1},
    {name: 'timing', value_kind: 'text'},
    {name: 'outcome', value_kind: 'long_text'}
  ]});
  assert.equal(validateData(schema, {participants: ['00000000-0000-4000-8000-000000000001'], timing: 'dawn', outcome: 'Escaped'}), null);
  assert.match(validateData(schema, {participants: []}), /Too few/);
});

test('presentation contracts reject free-form view names and invalid active views', async () => {
  assert.equal(await validatePresentationConfig({config: {view_ids: ['Character dossier']}}), 'Presentations must reference view IDs');
  assert.equal(await validatePresentationConfig({config: {view_ids: [], active_view_id: 'not-selected'}}), 'Active view must be one of the selected presentation views');
});
