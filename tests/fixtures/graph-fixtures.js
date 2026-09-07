const ids = {
  types: {
    character: '00000000-0000-4000-8000-000000000101',
    item: '00000000-0000-4000-8000-000000000102',
    location: '00000000-0000-4000-8000-000000000103',
    knows: '00000000-0000-4000-8000-000000000201',
    uses: '00000000-0000-4000-8000-000000000202',
    foundAt: '00000000-0000-4000-8000-000000000203'
  },
  entities: {
    margot: '00000000-0000-4000-8000-000000001001',
    etienne: '00000000-0000-4000-8000-000000001002',
    feather: '00000000-0000-4000-8000-000000001003',
    inn: '00000000-0000-4000-8000-000000001004'
  },
  relationships: {
    knows: '00000000-0000-4000-8000-000000002001',
    uses: '00000000-0000-4000-8000-000000002002',
    foundAt: '00000000-0000-4000-8000-000000002003'
  }
};

const populatedGraphFixture = Object.freeze({
  name: 'F-02-populated-graph',
  version: 1,
  seed: 'facts-sprint-05-f02',
  nodes: [
    {id: ids.entities.margot, name: 'Margot', type_id: ids.types.character, type_name: 'Character'},
    {id: ids.entities.etienne, name: 'Étienne', type_id: ids.types.character, type_name: 'Character'},
    {id: ids.entities.feather, name: 'Owl Feather', type_id: ids.types.item, type_name: 'Item'},
    {id: ids.entities.inn, name: 'Three Bells Inn', type_id: ids.types.location, type_name: 'Location'}
  ],
  edges: [
    {id: ids.relationships.knows, source: ids.entities.margot, target: ids.entities.etienne, type_id: ids.types.knows, type_name: 'knows', directionality: 'directed'},
    {id: ids.relationships.uses, source: ids.entities.margot, target: ids.entities.feather, type_id: ids.types.uses, type_name: 'uses', directionality: 'directed'},
    {id: ids.relationships.foundAt, source: ids.entities.feather, target: ids.entities.inn, type_id: ids.types.foundAt, type_name: 'found at', directionality: 'undirected'}
  ],
  expected: Object.freeze({eligible_nodes: 4, eligible_edges: 3, omitted_nodes: 0, omitted_edges: 0})
});

const malformedProjectionFixture = Object.freeze({
  name: 'F-03-malformed-projection',
  version: 1,
  seed: 'facts-sprint-05-f03',
  nodes: populatedGraphFixture.nodes,
  edges: [
    ...populatedGraphFixture.edges,
    {id: '00000000-0000-4000-8000-000000002004', source: ids.entities.margot, target: '00000000-0000-4000-8000-000000009999', type_id: ids.types.knows, type_name: 'knows', directionality: 'directed'},
    {id: '00000000-0000-4000-8000-000000002005', source: ids.entities.etienne, target: ids.entities.margot, type_id: ids.types.knows, type_name: 'knows', directionality: 'sideways'},
    {id: ids.relationships.knows, source: ids.entities.margot, target: ids.entities.etienne, type_id: ids.types.knows, type_name: 'knows', directionality: 'directed'},
    {id: 'not-a-uuid', source: ids.entities.margot, target: ids.entities.etienne, type_id: ids.types.knows, type_name: 'knows', directionality: 'directed'}
  ]
});

module.exports = {ids, populatedGraphFixture, malformedProjectionFixture};
