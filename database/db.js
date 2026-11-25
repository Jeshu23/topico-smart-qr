/* TÓPICO SMART QR — Pool de conexiones PostgreSQL */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 55432),
  database: process.env.DB_NAME || 'topico_smart_qr',
  user: process.env.DB_USER || 'topico',
  password: process.env.DB_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

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
