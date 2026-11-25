/* TÓPICO SMART QR — Inicialización de base de datos, esquema y datos base */
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const { pool, query, withTransaction } = require('./db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(160) UNIQUE,
  password_hash TEXT NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'personal')),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS medicamentos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  nombre VARCHAR(160) NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  concentracion VARCHAR(80),
  presentacion VARCHAR(80),
  laboratorio VARCHAR(120),
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lotes (
  id SERIAL PRIMARY KEY,
  medicamento_id INTEGER NOT NULL REFERENCES medicamentos(id) ON DELETE CASCADE,
  numero_lote VARCHAR(60) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  ubicacion VARCHAR(80),
  qr_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (medicamento_id, numero_lote)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo VARCHAR(12) NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  medicamento_id INTEGER NOT NULL REFERENCES medicamentos(id),
  lote_id INTEGER NOT NULL REFERENCES lotes(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  cantidad_antes INTEGER NOT NULL,
  cantidad_despues INTEGER NOT NULL,
  motivo VARCHAR(160) NOT NULL,
  observaciones TEXT,
  usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario_nombre VARCHAR(120) NOT NULL,
  lote_numero VARCHAR(60),
  medicamento_nombre VARCHAR(160)
);

CREATE TABLE IF NOT EXISTS alertas (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(200) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  nivel VARCHAR(20) NOT NULL CHECK (nivel IN ('critico', 'advertencia', 'info')),
  titulo VARCHAR(160) NOT NULL,
  mensaje TEXT NOT NULL,
  medicamento_id INTEGER REFERENCES medicamentos(id) ON DELETE SET NULL,
  lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  resuelta BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS alertas_activas_clave ON alertas (clave) WHERE resuelta = FALSE;
CREATE INDEX IF NOT EXISTS idx_lotes_medicamento ON lotes (medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lotes_vencimiento ON lotes (fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta ON alertas (resuelta, created_at DESC);
`;

async function crearBaseDatos() {
  const admin = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 55432),
    database: 'postgres',
    user: process.env.DB_USER || 'topico',
    password: process.env.DB_PASSWORD || ''
  });
  try {
    await admin.connect();
    const nombre = process.env.DB_NAME || 'topico_smart_qr';
    const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
    if (existe.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${nombre.replace(/"/g, '')}"`);
      console.log(`[DB] Base de datos "${nombre}" creada.`);
    }
  } finally {
    await admin.end();
  }
}

const fechaOffset = (dias) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fechaHace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

async function sembrarCatalogo(client) {
  const categorias = (await client.query('SELECT COUNT(*)::int AS n FROM categorias')).rows[0].n;
  if (categorias === 0) {
    const cats = [
      ['Analgésicos', 'Medicamentos para el alivio del dolor y la fiebre'],
      ['Antibióticos', 'Tratamiento de infecciones bacterianas'],
      ['Vitaminas', 'Suplementos nutricionales'],
      ['Respiratorio', 'Medicamentos para vías respiratorias'],
      ['Antihistamínicos', 'Tratamiento de alergias'],
      ['Cardiovascular', 'Medicamentos para el sistema cardiovascular']
    ];
    for (const [nombre, descripcion] of cats) {
      await client.query('INSERT INTO categorias (nombre, descripcion) VALUES ($1, $2)', [nombre, descripcion]);
    }
  }

  const meds = (await client.query('SELECT COUNT(*)::int AS n FROM medicamentos')).rows[0].n;
  if (meds > 0) return;

  const catalogo = [
    { codigo: 'MED-001', nombre: 'Paracetamol', categoria: 'Analgésicos', concentracion: '500 mg', presentacion: 'Tabletas', laboratorio: 'Farmacéutica Nacional S.A.', descripcion: 'Analgésico y antipirético de uso general', lotes: [
      { num: 'L-PAR-2601', vence: 300, inicial: 120, salidas: [], min: 30, ubic: 'A-01' },
      { num: 'L-PAR-2602', vence: 180, inicial: 50, salidas: [10], min: 30, ubic: 'A-02' }
    ] },
    { codigo: 'MED-002', nombre: 'Amoxicilina', categoria: 'Antibióticos', concentracion: '500 mg', presentacion: 'Cápsulas', laboratorio: 'Antibióticos del Sur', descripcion: 'Antibiótico de amplio espectro', lotes: [
      { num: 'L-AMX-2601', vence: 25, inicial: 25, salidas: [7], min: 25, ubic: 'B-01' }
    ] },
    { codigo: 'MED-003', nombre: 'Vitamina C', categoria: 'Vitaminas', concentracion: '1 g', presentacion: 'Efervescente', laboratorio: 'VitaSalud', descripcion: 'Suplemento de ácido ascórbico', lotes: [
      { num: 'L-VTC-2601', vence: 75, inicial: 60, salidas: [15], min: 20, ubic: 'C-01' },
      { num: 'L-VTC-2602', vence: 5, inicial: 12, salidas: [], min: 20, ubic: 'C-02' }
    ] },
    { codigo: 'MED-004', nombre: 'Ibuprofeno', categoria: 'Analgésicos', concentracion: '400 mg', presentacion: 'Tabletas', laboratorio: 'Farmacéutica Nacional S.A.', descripcion: 'Antiinflamatorio no esteroideo', lotes: [
      { num: 'L-IBU-2501', vence: -12, inicial: 8, salidas: [], min: 20, ubic: 'A-03' }
    ] },
    { codigo: 'MED-005', nombre: 'Salbutamol', categoria: 'Respiratorio', concentracion: '100 mcg', presentacion: 'Inhalador', laboratorio: 'Respira Pharma', descripcion: 'Broncodilatador de acción rápida', lotes: [
      { num: 'L-SAL-2601', vence: 400, inicial: 14, salidas: [14], min: 10, ubic: 'D-01' },
      { num: 'L-SAL-2509', vence: -40, inicial: 0, salidas: [], min: 10, ubic: 'D-02' }
    ] },
    { codigo: 'MED-006', nombre: 'Loratadina', categoria: 'Antihistamínicos', concentracion: '10 mg', presentacion: 'Tabletas', laboratorio: 'Antihist Pharma', descripcion: 'Antialérgico de uso oral', lotes: [
      { num: 'L-LOR-2601', vence: 110, inicial: 60, salidas: [], min: 15, ubic: 'E-01' }
    ] }
  ];

  const admin = await client.query("SELECT id, nombre FROM usuarios WHERE rol = 'admin' ORDER BY id LIMIT 1");
  const usuario = admin.rows[0] || { id: null, nombre: 'Sistema' };

  for (const med of catalogo) {
    const cat = await client.query('SELECT id FROM categorias WHERE nombre = $1', [med.categoria]);
    const r = await client.query(
      `INSERT INTO medicamentos (codigo, nombre, categoria_id, concentracion, presentacion, laboratorio, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [med.codigo, med.nombre, cat.rows[0]?.id || null, med.concentracion, med.presentacion, med.laboratorio, med.descripcion]
    );
    const medId = r.rows[0].id;
    for (const lote of med.lotes) {
      const lr = await client.query(
        `INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, cantidad, stock_minimo, ubicacion)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [medId, lote.num, fechaOffset(lote.vence), lote.inicial, lote.min, lote.ubic]
      );
      const loteId = lr.rows[0].id;
      if (lote.inicial > 0) {
        await client.query(
          `INSERT INTO movimientos (tipo, medicamento_id, lote_id, cantidad, cantidad_antes, cantidad_despues, motivo, observaciones, usuario_id, usuario_nombre, lote_numero, medicamento_nombre, fecha)
           VALUES ('entrada',$1,$2,$3,0,$3,'Stock inicial','Carga inicial de inventario',$4,$5,$6,$7,$8)`,
          [medId, loteId, lote.inicial, usuario.id, usuario.nombre, lote.num, med.nombre, fechaHace(35)]
        );
      }
      let antes = lote.inicial;
      for (let i = 0; i < lote.salidas.length; i++) {
        const cant = lote.salidas[i];
        await client.query('UPDATE lotes SET cantidad = cantidad - $1 WHERE id = $2', [cant, loteId]);
        await client.query(
          `INSERT INTO movimientos (tipo, medicamento_id, lote_id, cantidad, cantidad_antes, cantidad_despues, motivo, observaciones, usuario_id, usuario_nombre, lote_numero, medicamento_nombre, fecha)
           VALUES ('salida',$1,$2,$3,$4,$5,'Dispensación','Salida registrada en carga inicial',$6,$7,$8,$9,$10)`,
          [medId, loteId, cant, antes, antes - cant, usuario.id, usuario.nombre, lote.num, med.nombre, fechaHace(12 - i * 3)]
        );
        antes -= cant;
      }
    }
  }
  console.log('[DB] Catálogo inicial insertado (6 medicamentos con lotes y movimientos reales).');
}

async function sembrarUsuarios(client) {
  const total = (await client.query('SELECT COUNT(*)::int AS n FROM usuarios')).rows[0].n;
  if (total > 0) return;
  const usuarios = [
    { nombre: 'Administrador del Tópico', username: process.env.SEED_ADMIN_USER || 'admin', pass: process.env.SEED_ADMIN_PASSWORD || 'Admin123!', rol: 'admin', email: 'admin@topico.local' },
    { nombre: 'Personal del Tópico', username: process.env.SEED_STAFF_USER || 'personal', pass: process.env.SEED_STAFF_PASSWORD || 'Personal123!', rol: 'personal', email: 'personal@topico.local' }
  ];
  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.pass, 10);
    await client.query(
      'INSERT INTO usuarios (nombre, username, email, password_hash, rol) VALUES ($1,$2,$3,$4,$5)',
      [u.nombre, u.username, u.email, hash, u.rol]
    );
  }
  console.log('[DB] Usuarios iniciales creados: admin / personal.');
}

/** Si el clúster propio no está activo (por ejemplo tras reiniciar la PC), lo inicia. */
async function asegurarPostgres() {
  try { await query('SELECT 1'); return; } catch (_) { /* se intenta iniciar */ }
  const bin = process.env.PG_BIN || 'C:\\Program Files\\PostgreSQL\\15\\bin';
  const datos = path.resolve(__dirname, '..', process.env.PG_DATA || 'data/pgdata');
  const puerto = Number(process.env.DB_PORT || 55432);
  const resultado = spawnSync(path.join(bin, 'pg_ctl.exe'), [
    '-D', datos, '-o', `-p ${puerto} -h 127.0.0.1`,
    '-l', path.join(datos, 'server.log'), 'start'
  ], { windowsHide: true, encoding: 'utf8', stdio: 'ignore', timeout: 30000 });
  if (resultado.status !== 0 && !/already running|ya está|ya se está ejecutando/i.test(resultado.stdout + resultado.stderr)) {
    console.error('[DB] No se pudo iniciar PostgreSQL:', (resultado.stderr || resultado.stdout || '').trim());
  }
  for (let intento = 0; intento < 20; intento++) {
    try { await query('SELECT 1'); return; } catch (_) { await new Promise((r) => setTimeout(r, 500)); }
  }
  throw new Error('PostgreSQL no respondió en el puerto ' + puerto + '. Revise PG_BIN y PG_DATA en .env.');
}

async function initDB() {
  await asegurarPostgres();
  await crearBaseDatos();
  await query('SELECT 1');
  await query(SCHEMA);
  await withTransaction(async (client) => {
    await sembrarUsuarios(client);
    await sembrarCatalogo(client);
  });
  const { evaluarAlertas } = require('../src/services/alertas');
  await evaluarAlertas();
  const { rows } = await query('SELECT COUNT(*)::int AS n FROM medicamentos');
  console.log(`[DB] PostgreSQL conectado. Medicamentos en base: ${rows[0].n}.`);
}

if (require.main === module) {
  initDB().then(async () => { await pool.end(); process.exit(0); }).catch(async (e) => {
    console.error('[DB] Error de inicialización:', e);
    await pool.end();
    process.exit(1);
  });
}

module.exports = { initDB, SCHEMA };
