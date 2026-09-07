const test = require('node:test');
const assert = require('node:assert/strict');
const {projectGraph, DENSITY_LIMITS} = require('../graph-projection');
const {ids, populatedGraphFixture, malformedProjectionFixture} = require('./fixtures/graph-fixtures');

const typeFacets = [
  {id: ids.types.character, name: 'Character'},
  {id: ids.types.item, name: 'Item'},
  {id: ids.types.location, name: 'Location'}
];
const relationshipFacets = [
  {id: ids.types.knows, name: 'knows'},
  {id: ids.types.uses, name: 'uses'},
  {id: ids.types.foundAt, name: 'found at'}
];

const project = (entityFilter = null, relationshipFilter = null) => projectGraph({
  nodes: populatedGraphFixture.nodes,
  edges: populatedGraphFixture.edges,
  entityTypes: typeFacets,
  relationshipTypes: relationshipFacets,
  entityFilter,
  relationshipFilter
});

test('populated fixture is deterministic and keeps directed/undirected semantics', () => {
  const first = project();
  const second = project();
  assert.deepEqual(first, second);
  assert.equal(first.revision, '4ca0889e552623a86970102ad8471f50f3937146f04811ec415c2c4c628c17cf');
  assert.deepEqual(first.nodes.map(node => node.id), [ids.entities.etienne, ids.entities.margot, ids.entities.feather, ids.entities.inn]);
  assert.deepEqual(first.nodes.map(node => node.label), first.nodes.map(node => node.name));
  assert.deepEqual(first.edges.map(edge => edge.directionality), ['undirected', 'directed', 'directed']);
  assert.deepEqual(first.counts, {
    eligible_nodes: 4,
    eligible_edges: 3,
    visible_nodes: 4,
    visible_edges: 3,
    hidden_nodes: 0,
    hidden_nodes_by_entity_filter: 0,
    hidden_edges: 0,
    hidden_edges_by_relationship_filter: 0,
    hidden_edges_by_entity_filter: 0,
    omitted_nodes: 0,
    omitted_edges: 0,
    warnings: 0,
    warning_count: 0
  });
});

test('F-02 filter truth table applies Entity and Relationship filters independently', () => {
  const rows = [
    {name: 'All / All', entity: null, relationship: null, nodes: 4, edges: 3, hiddenNodes: 0, hiddenEntity: 0, hiddenRelationship: 0},
    {name: 'Character / All', entity: [ids.types.character], relationship: null, nodes: 2, edges: 1, hiddenNodes: 2, hiddenEntity: 2, hiddenRelationship: 0},
    {name: 'Character + Item / All', entity: [ids.types.character, ids.types.item], relationship: null, nodes: 3, edges: 2, hiddenNodes: 1, hiddenEntity: 1, hiddenRelationship: 0},
    {name: 'All / uses', entity: null, relationship: [ids.types.uses], nodes: 4, edges: 1, hiddenNodes: 0, hiddenEntity: 0, hiddenRelationship: 2},
    {name: 'Character + Item / uses', entity: [ids.types.character, ids.types.item], relationship: [ids.types.uses], nodes: 3, edges: 1, hiddenNodes: 1, hiddenEntity: 0, hiddenRelationship: 2},
    {name: 'Item / All', entity: [ids.types.item], relationship: null, nodes: 1, edges: 0, hiddenNodes: 3, hiddenEntity: 3, hiddenRelationship: 0},
    {name: 'All / None', entity: null, relationship: [], nodes: 4, edges: 0, hiddenNodes: 0, hiddenEntity: 0, hiddenRelationship: 3},
    {name: 'None / All', entity: [], relationship: null, nodes: 0, edges: 0, hiddenNodes: 4, hiddenEntity: 3, hiddenRelationship: 0},
    {name: 'None / None', entity: [], relationship: [], nodes: 0, edges: 0, hiddenNodes: 4, hiddenEntity: 0, hiddenRelationship: 3}
  ];

  for (const row of rows) {
    const result = project(row.entity, row.relationship);
    assert.equal(result.counts.visible_nodes, row.nodes, row.name);
    assert.equal(result.counts.visible_edges, row.edges, row.name);
    assert.equal(result.counts.hidden_nodes_by_entity_filter, row.hiddenNodes, row.name);
    assert.equal(result.counts.hidden_edges_by_entity_filter, row.hiddenEntity, row.name);
    assert.equal(result.counts.hidden_edges_by_relationship_filter, row.hiddenRelationship, row.name);
    assert.equal(result.counts.eligible_edges, result.counts.visible_edges + result.counts.hidden_edges_by_entity_filter + result.counts.hidden_edges_by_relationship_filter, row.name);
  }
});

test('malformed and unavailable rows are omitted with bounded warnings', () => {
  const result = projectGraph(malformedProjectionFixture);
  assert.equal(result.counts.eligible_nodes, 4);
  assert.equal(result.counts.eligible_edges, 4);
  assert.equal(result.counts.omitted_nodes, 0);
  assert.equal(result.counts.omitted_edges, 3);
  assert.equal(result.counts.warning_count, 4);
  assert.deepEqual(new Set(result.edges.map(edge => edge.id)), new Set([
    ids.relationships.foundAt,
    ids.relationships.knows,
    ids.relationships.uses,
    '00000000-0000-4000-8000-000000002005'
  ]));
  assert.equal(result.edges.find(edge => edge.id === '00000000-0000-4000-8000-000000002005').directionality, 'unknown');
  assert.deepEqual(result.warnings.map(item => item.code).sort(), [
    'duplicate-edge-id', 'missing-endpoint', 'malformed-edge', 'unknown-direction'
  ].sort());
  assert.ok(result.warnings.find(item => item.code === 'unknown-direction').message.includes('neutral'));
  assert.ok(result.warnings.every(item => !item.message.includes('not-a-uuid')));
  assert.equal(result.warnings.find(item => item.code === 'malformed-edge').record_id, undefined);
});

test('malformed nodes do not create placeholder facts, while missing names use a warning placeholder', () => {
  const result = projectGraph({
    nodes: [
      ...populatedGraphFixture.nodes,
      {id: 'not-a-uuid', name: 'Fabricated', type_id: ids.types.item, type_name: 'Item'},
      {id: '00000000-0000-4000-8000-000000001005', name: '', type_id: ids.types.location, type_name: 'Location'}
    ],
    edges: populatedGraphFixture.edges
  });
  assert.equal(result.counts.omitted_nodes, 1);
  assert.equal(result.counts.eligible_nodes, 5);
  assert.equal(result.nodes.find(node => node.id.endsWith('1005')).name, 'Unnamed Location');
  assert.deepEqual(result.warnings.map(item => item.code).sort(), ['malformed-node', 'missing-node-name']);
});

test('duplicate labels receive deterministic short disambiguators', () => {
  const duplicate = {...populatedGraphFixture.nodes[0], id: '00000000-0000-4000-8000-000000001005'};
  const result = projectGraph({nodes: [...populatedGraphFixture.nodes, duplicate], edges: populatedGraphFixture.edges});
  const labels = result.nodes.filter(node => node.type_id === ids.types.character).map(node => node.label);
  assert.deepEqual(labels, ['Étienne', 'Margot · …1001', 'Margot · …1005']);
});

test('stale filters warn without exposing filter values and density stays explicit', () => {
  const stale = projectGraph({nodes: populatedGraphFixture.nodes, edges: populatedGraphFixture.edges, entityFilter: ['stale-entity'], relationshipFilter: ['stale-relationship']});
  assert.equal(stale.counts.visible_nodes, 0);
  assert.deepEqual(stale.warnings.map(item => item.code).sort(), ['unknown-entity-filter', 'unknown-relationship-filter']);
  assert.ok(stale.warnings.every(item => !item.message.includes('stale-')));

  const nodes = Array.from({length: DENSITY_LIMITS.nodes + 1}, (_, index) => ({
    id: `00000000-0000-4000-8000-${(10000 + index).toString(16).padStart(12, '0')}`,
    name: `Node ${index}`,
    type_id: ids.types.character,
    type_name: 'Character'
  }));
  const dense = projectGraph({nodes, edges: []});
  assert.equal(dense.counts.eligible_nodes, DENSITY_LIMITS.nodes + 1);
  assert.ok(dense.warnings.some(item => item.code === 'density-limit'));
});
