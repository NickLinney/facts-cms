CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS type_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), kind TEXT NOT NULL CHECK (kind IN ('entity','relationship','view','presentation')),
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (kind, name)
);
CREATE TABLE IF NOT EXISTS entity_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type_id UUID NOT NULL REFERENCES type_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS relationship_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), type_id UUID NOT NULL REFERENCES type_definitions(id) ON DELETE CASCADE,
  from_entity_id UUID NOT NULL REFERENCES entity_records(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES entity_records(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entity_records_type_idx ON entity_records(type_id);
CREATE INDEX IF NOT EXISTS relationship_records_type_idx ON relationship_records(type_id);
INSERT INTO type_definitions (kind,name,description,schema) VALUES
 ('entity','Entity','A thing that exists in the modeled domain.','{"fields":[{"name":"summary","type":"text"}]}'),
 ('relationship','Relationship','A directed connection between two entity records.','{"fields":[{"name":"notes","type":"text"}]}'),
 ('view','View','Rules for composing and rendering a projection.','{"fields":[{"name":"layout","type":"text"}]}'),
 ('presentation','Presentation','A saved composition of views for a workspace.','{"fields":[{"name":"views","type":"json"}]}')
ON CONFLICT (kind,name) DO NOTHING;
