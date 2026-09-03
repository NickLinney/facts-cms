# FACTS modeling guide

Use an entity-reference property when a record needs a lightweight pointer or ordered membership list, such as `Event.participants` or `Character.equipment`. Use a relationship when the connection has its own meaning, direction, identity, or metadata, such as `travels toward`, `warns about`, or `owns` with a quantity and date.

Avoid modeling the same fact both ways unless the two representations intentionally serve different purposes. If a connection needs to be queried, labeled, filtered, or annotated, prefer a relationship type. If it is only a compact collection of related records, prefer an entity-reference property.

Entity-reference properties store stable record IDs and should be configured with allowed entity types and cardinality. Relationship endpoints should be constrained to compatible entity types. Both choices are user-defined model contracts; FACTS does not prescribe world-building types.
