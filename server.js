const express = require('express');
const path = require('node:path');
const { Pool } = require('pg');
const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({connectionString: process.env.DATABASE_URL || 'postgres://facts:facts@localhost:5432/facts'});
app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'public')));
const json = (v, fallback={}) => { if (v === undefined || v === null || v === '') return fallback; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return fallback; } };
const propertyKinds = new Set(['text','long_text','number','boolean','date','json','entity_reference']);
const normalizeSchema = (schema) => {
  const input = json(schema);
  const properties = Array.isArray(input.properties) ? input.properties.map((p, index) => ({
    name: String(p.name || '').trim(), label: String(p.label || p.name || '').trim(), value_kind: p.value_kind || 'text',
    cardinality: p.cardinality === 'many' ? 'many' : 'one', required: Boolean(p.required), description: String(p.description || ''),
    target_kinds: Array.isArray(p.target_kinds) ? p.target_kinds : [], min: p.min === '' || p.min == null ? null : Number(p.min), max: p.max === '' || p.max == null ? null : Number(p.max), order: index
  })) : [];
  return {...input, properties};
};
const validateSchema = (schema) => {
  const normalized = normalizeSchema(schema); const names = new Set();
  for (const p of normalized.properties) {
    if (!p.name || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(p.name)) return 'Property names must start with a letter and contain only letters, numbers, and underscores';
    if (names.has(p.name)) return `Duplicate property: ${p.name}`; names.add(p.name);
    if (!propertyKinds.has(p.value_kind)) return `Unsupported property kind: ${p.value_kind}`;
    if (p.cardinality === 'many' && p.min != null && p.max != null && p.min > p.max) return `Invalid limits for property: ${p.name}`;
  }
  return null;
};
const validateData = (schema, data) => {
  const value = json(data); const properties = normalizeSchema(schema).properties;
  for (const p of properties) {
    const present = Object.prototype.hasOwnProperty.call(value, p.name); const v = value[p.name];
    if (p.required && (!present || v === '' || v == null || (p.cardinality === 'many' && !Array.isArray(v)))) return `Required property missing: ${p.name}`;
    if (!present || v === '' || v == null) continue;
    const values = p.cardinality === 'many' ? v : [v];
    if (p.cardinality === 'many' && !Array.isArray(v)) return `Property must be a list: ${p.name}`;
    if (p.min != null && values.length < p.min) return `Too few values for property: ${p.name}`;
    if (p.max != null && values.length > p.max) return `Too many values for property: ${p.name}`;
    for (const item of values) {
      if (p.value_kind === 'number' && typeof item !== 'number') return `Property must be a number: ${p.name}`;
      if (p.value_kind === 'boolean' && typeof item !== 'boolean') return `Property must be boolean: ${p.name}`;
      if (p.value_kind === 'entity_reference' && typeof item !== 'string') return `Property must contain entity IDs: ${p.name}`;
    }
  }
  return null;
};
app.get('/api/health', async (_req,res) => { try { await pool.query('SELECT 1'); res.json({ok:true,version:'0.0.0-pre-alpha.1'}); } catch (e) { res.status(503).json({ok:false,error:e.message}); } });
app.get('/api/types', async (req,res) => { try { const p=req.query.kind?[req.query.kind]:[]; const r=await pool.query(`SELECT * FROM type_definitions ${p.length?'WHERE kind=$1':''} ORDER BY kind,name`,p); res.json(r.rows); } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/types', async (req,res) => { const {kind,name,description='',schema={}}=req.body||{}; if(!['entity','relationship','view','presentation'].includes(kind)||!name?.trim()) return res.status(400).json({error:'kind and name are required'}); const normalized=normalizeSchema(schema); const schemaError=validateSchema(normalized); if(schemaError)return res.status(400).json({error:schemaError}); try { const r=await pool.query('INSERT INTO type_definitions (kind,name,description,schema) VALUES ($1,$2,$3,$4) RETURNING *',[kind,name.trim(),description,normalized]); res.status(201).json(r.rows[0]); } catch(e) { res.status(e.code==='23505'?409:500).json({error:e.message}); } });
app.put('/api/types/:id', async (req,res) => { const {name,description='',schema={}}=req.body||{}; const normalized=normalizeSchema(schema); const schemaError=validateSchema(normalized); if(schemaError)return res.status(400).json({error:schemaError}); try { const r=await pool.query('UPDATE type_definitions SET name=COALESCE($1,name),description=$2,schema=$3 WHERE id=$4 RETURNING *',[name?.trim()||null,description,normalized,req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Type not found'}); res.json(r.rows[0]); } catch(e) { res.status(e.code==='23505'?409:500).json({error:e.message}); } });
app.get('/api/entities', async (_req,res) => { try { const r=await pool.query('SELECT e.*,t.name AS type_name FROM entity_records e JOIN type_definitions t ON t.id=e.type_id ORDER BY e.created_at DESC'); res.json(r.rows); } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/entities', async (req,res) => { const {typeId,name,data={}}=req.body||{}; if(!typeId||!name?.trim()) return res.status(400).json({error:'typeId and name are required'}); try { const type=await pool.query('SELECT schema FROM type_definitions WHERE id=$1 AND kind=$2',[typeId,'entity']); if(!type.rowCount)return res.status(400).json({error:'Entity type not found'}); const validation=validateData(type.rows[0].schema,data); if(validation)return res.status(400).json({error:validation}); const r=await pool.query('INSERT INTO entity_records (type_id,name,data) VALUES ($1,$2,$3) RETURNING *',[typeId,name.trim(),json(data)]); res.status(201).json(r.rows[0]); } catch(e) { res.status(500).json({error:e.message}); } });
app.put('/api/entities/:id', async (req,res) => { const {name,data={}}=req.body||{}; try { const type=await pool.query('SELECT t.schema FROM entity_records e JOIN type_definitions t ON t.id=e.type_id WHERE e.id=$1',[req.params.id]); if(!type.rowCount)return res.status(404).json({error:'Entity not found'}); const validation=validateData(type.rows[0].schema,data); if(validation)return res.status(400).json({error:validation}); const r=await pool.query('UPDATE entity_records SET name=COALESCE($1,name),data=$2 WHERE id=$3 RETURNING *',[name?.trim()||null,json(data),req.params.id]); res.json(r.rows[0]); } catch(e) { res.status(500).json({error:e.message}); } });
app.delete('/api/entities/:id', async (req,res) => { try { const r=await pool.query('DELETE FROM entity_records WHERE id=$1',[req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Entity not found'}); res.status(204).end(); } catch(e) { res.status(500).json({error:e.message}); } });
app.get('/api/relationships', async (_req,res) => { try { const r=await pool.query('SELECT r.*,t.name AS type_name,f.name AS from_name,to_entity.name AS to_name FROM relationship_records r JOIN type_definitions t ON t.id=r.type_id JOIN entity_records f ON f.id=r.from_entity_id JOIN entity_records to_entity ON to_entity.id=r.to_entity_id ORDER BY r.created_at DESC'); res.json(r.rows); } catch(e) { res.status(500).json({error:e.message}); } });
app.post('/api/relationships', async (req,res) => { const {typeId,fromEntityId,toEntityId,data={}}=req.body||{}; if(!typeId||!fromEntityId||!toEntityId) return res.status(400).json({error:'typeId, fromEntityId and toEntityId are required'}); try { const r=await pool.query('INSERT INTO relationship_records (type_id,from_entity_id,to_entity_id,data) VALUES ($1,$2,$3,$4) RETURNING *',[typeId,fromEntityId,toEntityId,json(data)]); res.status(201).json(r.rows[0]); } catch(e) { res.status(500).json({error:e.message}); } });
app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));
if(require.main===module) app.listen(port,()=>console.log(`FACTS listening on http://localhost:${port}`));
module.exports={app,pool};
