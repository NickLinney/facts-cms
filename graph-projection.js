const crypto = require('node:crypto');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = value => typeof value === 'string' && UUID_PATTERN.test(value);
const text = value => typeof value === 'string' ? value.trim() : '';
const safeRecordRef = recordId => isUuid(recordId)
  ? `ref-${crypto.createHash('sha256').update(recordId).digest('hex').slice(0, 8)}`
  : undefined;

const warning = (code, message, recordId) => ({
  code,
  message,
  ...(safeRecordRef(recordId) ? {record_ref: safeRecordRef(recordId)} : {})
});

const compareText = (left, right) => String(left ?? '').localeCompare(String(right ?? ''), 'en', {numeric: true});

const sortNodes = rows => [...rows].sort((a, b) =>
  compareText(a.name, b.name) || compareText(a.type_name, b.type_name) || compareText(a.id, b.id));

const sortEdges = rows => [...rows].sort((a, b) =>
  compareText(a.type_name, b.type_name) || compareText(a.source_name, b.source_name) ||
  compareText(a.target_name, b.target_name) || compareText(a.id, b.id));

const normalizeFilter = filter => {
  if (filter === undefined || filter === null || filter === 'all') return null;
  if (filter instanceof Set) return new Set([...filter].map(String));
  if (Array.isArray(filter)) return new Set(filter.map(String));
  const value = String(filter).trim();
  if (!value || value === 'all') return null;
  if (value === 'none') return new Set();
  return new Set(value.split(',').map(item => item.trim()).filter(Boolean));
};

const selected = (filter, typeId) => filter === null || filter.has(typeId);
const DENSITY_LIMITS = Object.freeze({nodes: 250, edges: 500});

const fingerprint = (nodes, edges, state) => crypto.createHash('sha256')
  .update(JSON.stringify({nodes, edges, state}))
  .digest('hex')

/**
 * Project database-shaped rows into the renderer-neutral Graph View contract.
 * The function is deliberately pure so fixtures can exercise malformed input
 * without a live database or HTTP server.
 */
const projectGraph = ({nodes = [], edges = [], entityTypes = null, relationshipTypes = null,
  entityFilter = null, relationshipFilter = null} = {}) => {
  const warnings = [];
  const omittedNodes = [];
  const omittedEdges = [];
  const seenNodeIds = new Set();
  const eligibleNodes = [];

  for (const row of sortNodes(nodes)) {
    const id = row?.id;
    const typeId = text(row?.type_id);
    const typeName = text(row?.type_name);
    if (!isUuid(id) || !typeId || !typeName) {
      omittedNodes.push(row);
      warnings.push(warning('malformed-node', 'Entity row omitted because its stable identity or type is invalid.', id));
      continue;
    }
    if (seenNodeIds.has(id)) {
      omittedNodes.push(row);
      warnings.push(warning('duplicate-node-id', 'Entity row omitted because its stable identity is duplicated.', id));
      continue;
    }
    seenNodeIds.add(id);
    const rawName = text(row.name);
    const name = rawName || `Unnamed ${typeName}`;
    if (!rawName) warnings.push(warning('missing-node-name', 'Entity row uses a bounded placeholder because its display name is missing.', id));
    eligibleNodes.push({id, name, type_name: typeName, type_id: typeId});
  }

  const labelCounts = new Map();
  for (const node of eligibleNodes) {
    const key = `${node.type_id}\u0000${node.name}`;
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1);
  }
  for (const node of eligibleNodes) {
    const key = `${node.type_id}\u0000${node.name}`;
    node.label = labelCounts.get(key) > 1 ? `${node.name} · …${node.id.slice(-4)}` : node.name;
  }

  const nodeById = new Map(eligibleNodes.map(node => [node.id, node]));
  const seenEdgeIds = new Set();
  const eligibleEdges = [];
  for (const row of sortEdges(edges)) {
    const id = row?.id;
    const typeId = text(row?.type_id);
    const typeName = text(row?.type_name);
    const source = text(row?.source ?? row?.from_entity_id);
    const target = text(row?.target ?? row?.to_entity_id);
    if (!isUuid(id) || !typeId || !typeName || !isUuid(source) || !isUuid(target)) {
      omittedEdges.push(row);
      warnings.push(warning('malformed-edge', 'Relationship row omitted because its stable identity, type, or endpoint is invalid.', id));
      continue;
    }
    if (seenEdgeIds.has(id)) {
      omittedEdges.push(row);
      warnings.push(warning('duplicate-edge-id', 'Relationship row omitted because its stable identity is duplicated.', id));
      continue;
    }
    if (!nodeById.has(source) || !nodeById.has(target)) {
      omittedEdges.push(row);
      warnings.push(warning('missing-endpoint', 'Relationship row omitted because one or both endpoints are unavailable.', id));
      continue;
    }
    seenEdgeIds.add(id);
    const rawDirectionality = text(row.directionality);
    const directionality = rawDirectionality === 'directed' || rawDirectionality === 'undirected' ? rawDirectionality : 'unknown';
    if (directionality === 'unknown') {
      warnings.push(warning('unknown-direction', 'Relationship direction is unknown; the edge remains neutral and has no inferred arrow.', id));
    }
    eligibleEdges.push({
      id,
      source,
      target,
      type_id: typeId,
      type_name: typeName,
      directionality
    });
  }

  const selectedEntityTypes = normalizeFilter(entityFilter);
  const selectedRelationshipTypes = normalizeFilter(relationshipFilter);
  const entityFacetIds = new Set(eligibleNodes.map(node => node.type_id));
  const relationshipFacetIds = new Set(eligibleEdges.map(edge => edge.type_id));
  if (eligibleNodes.length > DENSITY_LIMITS.nodes || eligibleEdges.length > DENSITY_LIMITS.edges) {
    warnings.push(warning('density-limit', 'This projection exceeds the provisional interactive density envelope; narrow the filters before visual exploration.', null));
  }
  const visibleNodes = eligibleNodes.filter(node => selected(selectedEntityTypes, node.type_id));
  const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
  const hiddenNodesByEntityFilter = eligibleNodes.length - visibleNodes.length;
  const hiddenEdgesByRelationshipFilter = eligibleEdges.filter(edge => !selected(selectedRelationshipTypes, edge.type_id));
  const relationshipEligible = eligibleEdges.filter(edge => selected(selectedRelationshipTypes, edge.type_id));
  const hiddenEdgesByEntityFilter = relationshipEligible.filter(edge => !visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target));
  const visibleEdges = relationshipEligible.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  const normalizedNodeTypes = entityTypes || [...new Map(eligibleNodes.map(node => [node.type_id, {id: node.type_id, name: node.type_name}])).values()];
  const normalizedRelationshipTypes = relationshipTypes || [...new Map(eligibleEdges.map(edge => [edge.type_id, {id: edge.type_id, name: edge.type_name}])).values()];
  const sortFacets = facets => [...facets].sort((a, b) => compareText(a.name, b.name) || compareText(a.id, b.id));
  const canonicalNodes = sortNodes(eligibleNodes);
  const canonicalEdges = sortEdges(eligibleEdges);
  const revision = fingerprint(canonicalNodes, canonicalEdges, {
    omitted_nodes: omittedNodes.length,
    omitted_edges: omittedEdges.length,
    warnings: warnings.map(({code, record_ref}) => ({code, ...(record_ref ? {record_ref} : {})}))
  });
  if (selectedEntityTypes) {
    for (const typeId of selectedEntityTypes) {
      if (!entityFacetIds.has(typeId)) warnings.push(warning('unknown-entity-filter', 'An Entity filter is no longer available in this projection and was ignored.', null));
    }
  }
  if (selectedRelationshipTypes) {
    for (const typeId of selectedRelationshipTypes) {
      if (!relationshipFacetIds.has(typeId)) warnings.push(warning('unknown-relationship-filter', 'A Relationship filter is no longer available in this projection and was ignored.', null));
    }
  }

  return {
    schema_version: 1,
    revision,
    nodes: visibleNodes,
    edges: visibleEdges,
    facets: {
      entity_types: sortFacets(normalizedNodeTypes).map(facet => facet.id),
      relationship_types: sortFacets(normalizedRelationshipTypes).map(facet => facet.id)
    },
    counts: {
      eligible_nodes: eligibleNodes.length,
      eligible_edges: eligibleEdges.length,
      visible_nodes: visibleNodes.length,
      visible_edges: visibleEdges.length,
      hidden_nodes: hiddenNodesByEntityFilter,
      hidden_nodes_by_entity_filter: hiddenNodesByEntityFilter,
      hidden_edges: hiddenEdgesByRelationshipFilter.length + hiddenEdgesByEntityFilter.length,
      hidden_edges_by_relationship_filter: hiddenEdgesByRelationshipFilter.length,
      hidden_edges_by_entity_filter: hiddenEdgesByEntityFilter.length,
      omitted_nodes: omittedNodes.length,
      omitted_edges: omittedEdges.length,
      warnings: warnings.length,
      warning_count: warnings.length
    },
    warnings
  };
};

module.exports = {projectGraph, normalizeFilter, isUuid, DENSITY_LIMITS};
