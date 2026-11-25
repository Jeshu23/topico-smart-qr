/* TÓPICO SMART QR — Pool de conexiones PostgreSQL */
require('dotenv').config();
const { Pool } = require('pg');

const usaURL = Boolean(process.env.DATABASE_URL);
const configuracion = {
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000
};

if (usaURL) {
  // PostgreSQL administrado (Neon / Supabase / Render): la URL ya incluye usuario,
  // contraseña, host y base de datos. SSL es obligatorio en estos servicios.
  configuracion.connectionString = process.env.DATABASE_URL;
  configuracion.ssl = { rejectUnauthorized: false };
} else {
  configuracion.host = process.env.DB_HOST || '127.0.0.1';
  configuracion.port = Number(process.env.DB_PORT || 55432);
  configuracion.database = process.env.DB_NAME || 'topico_smart_qr';
  configuracion.user = process.env.DB_USER || 'topico';
  configuracion.password = process.env.DB_PASSWORD || '';
}

const pool = new Pool(configuracion);

pool.on('error', (err) => console.error('[DB] Error inesperado del pool:', err.message));

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignorar */ }
    throw error;
  } finally {
    client.release();
  }
}

const query = (texto, params) => pool.query(texto, params);

module.exports = { pool, query, withTransaction };
