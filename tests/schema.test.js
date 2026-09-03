const test = require('node:test');
const assert = require('node:assert/strict');
const {normalizeSchema, validateData} = require('../server');

test('optional single and many entity references accept an explicit empty value', () => {
  const schema = normalizeSchema({properties: [
    {name: 'location', value_kind: 'entity_reference', cardinality: 'one'},
    {name: 'equipment', value_kind: 'entity_reference', cardinality: 'many'}
  ]});
  assert.equal(validateData(schema, {location: '', equipment: []}), null);
});

test('many entity references enforce list shape and cardinality limits', () => {
  const schema = normalizeSchema({properties: [
    {name: 'participants', value_kind: 'entity_reference', cardinality: 'many', min: 1, max: 2}
  ]});
  assert.match(validateData(schema, {participants: 'not-a-list'}), /must be a list/);
  assert.match(validateData(schema, {participants: []}), /Too few/);
  assert.match(validateData(schema, {participants: ['a', 'b', 'c']}), /Too many/);
});
