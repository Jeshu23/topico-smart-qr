/* TÓPICO SMART QR — Verificación local de la Netlify Function */
require('dotenv').config();
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/api');

function evento(ruta, metodo = 'GET', cuerpo = null, token = null) {
  return {
    httpMethod: metodo,
    path: ruta,
    rawUrl: `http://localhost${ruta}`,
    headers: Object.assign({ host: 'localhost', 'content-type': 'application/json' }, token ? { authorization: `Bearer ${token}` } : {}),
    queryStringParameters: {},
    body: cuerpo ? JSON.stringify(cuerpo) : null,
    isBase64Encoded: false,
    requestContext: { httpMethod: metodo, path: ruta }
  };
}

(async () => {
  const ctx = { callbackWaitsForEmptyEventLoop: false };
  const salud = await handler(evento('/api/public/salud'), ctx);
  assert.equal(salud.statusCode, 200, salud.body);
  console.log('OK   Netlify Function /api/public/salud');

  const login = await handler(evento('/api/auth/login', 'POST', { username: 'admin', password: 'Admin123!' }), ctx);
  assert.equal(login.statusCode, 200, login.body);
  const token = JSON.parse(login.body).token;
  console.log('OK   Netlify Function /api/auth/login');

  const dash = await handler(evento('/api/inventario/dashboard', 'GET', null, token), ctx);
  assert.equal(dash.statusCode, 200, dash.body);
  const stats = JSON.parse(dash.body).stats;
  assert.ok(stats.total_medicamentos >= 6);
  console.log(`OK   Netlify Function dashboard (${stats.total_medicamentos} medicamentos)`);

  const protegida = await handler(evento('/api/catalogo/medicamentos'), ctx);
  assert.equal(protegida.statusCode, 401);
  console.log('OK   Netlify Function protege rutas');

  console.log('\nRESULTADO NETLIFY FUNCTION: 4/4 verificaciones correctas.');
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e); process.exit(1); });
