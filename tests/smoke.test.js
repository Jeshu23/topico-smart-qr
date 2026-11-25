/* TÓPICO SMART QR — Pruebas de integración reales contra API + PostgreSQL */
require('dotenv').config();
const assert = require('node:assert/strict');
const { query } = require('../database/db');

const BASE = `http://127.0.0.1:${process.env.PORT || 3000}`;
const sufijo = String(Date.now()).slice(-7);
const resultados = [];

async function req(ruta, { metodo = 'GET', cuerpo, token, raw = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${ruta}`, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const datos = raw ? await res.arrayBuffer() : await res.json().catch(() => ({}));
  return { estado: res.status, datos, tipo: res.headers.get('content-type') || '' };
}

function check(nombre, condicion, detalle = '') {
  resultados.push({ nombre, ok: !!condicion, detalle });
  console.log(`${condicion ? 'OK  ' : 'FAIL'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

async function main() {
  const health = await req('/api/public/salud');
  check('Conexión a base de datos y servicio', health.estado === 200 && health.datos.ok);

  const sinToken = await req('/api/catalogo/medicamentos');
  check('Rutas protegidas rechazan acceso sin token', sinToken.estado === 401);

  const loginAdmin = await req('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'admin', password: 'Admin123!' } });
  check('Inicio de sesión administrador', loginAdmin.estado === 200 && !!loginAdmin.datos.token);
  const admin = loginAdmin.datos.token;

  const loginMal = await req('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'admin', password: 'incorrecta' } });
  check('Contraseña incorrecta es rechazada', loginMal.estado === 401);

  const loginStaff = await req('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'personal', password: 'Personal123!' } });
  check('Inicio de sesión personal del tópico', loginStaff.estado === 200 && loginStaff.datos.usuario.rol === 'personal');
  const personal = loginStaff.datos.token;

  const permisos = await req('/api/usuarios', { token: personal });
  check('Permisos por rol (personal no gestiona usuarios)', permisos.estado === 403);

  const dashboard = await req('/api/inventario/dashboard', { token: admin });
  check('Dashboard con estadísticas reales', dashboard.estado === 200 && dashboard.datos.stats.total_medicamentos >= 6,
    `med=${dashboard.datos.stats.total_medicamentos} und=${dashboard.datos.stats.unidades}`);

  /* ---------------- Medicamento y lotes de prueba ---------------- */
  const medRes = await req('/api/catalogo/medicamentos', { metodo: 'POST', token: admin, cuerpo: {
    codigo: `TST-${sufijo}`, nombre: `Medicamento Prueba ${sufijo}`, categoria_id: null,
    concentracion: '100 mg', presentacion: 'Tabletas', laboratorio: 'Lab Prueba', descripcion: 'Prueba de integración'
  } });
  check('Registro de medicamento', medRes.estado === 201, `estado=${medRes.estado}`);
  const medId = medRes.datos.id;

  const hoy = new Date();
  const f = (dias) => {
    const x = new Date(hoy); x.setDate(x.getDate() + dias);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };

  async function crearLote(num, dias, cantidad) {
    const r = await req('/api/catalogo/lotes', { metodo: 'POST', token: admin, cuerpo: {
      medicamento_id: medId, numero_lote: num, fecha_vencimiento: f(dias),
      cantidad, stock_minimo: 10, ubicacion: 'Z-99'
    } });
    check(`Registro de lote ${num}`, r.estado === 201, `estado=${r.estado}`);
    return r.datos.id;
  }
  const loteTarde = await crearLote(`TARDE-${sufijo}`, 150, 20);
  const loteAntes = await crearLote(`ANTES-${sufijo}`, 60, 40);
  const loteVencido = await crearLote(`VENC-${sufijo}`, -3, 5);

  const qr = await req(`/api/catalogo/lotes/${loteAntes}/qr`, { token: admin });
  check('Generación de QR único por lote', qr.estado === 200 && qr.datos.imagen.startsWith('data:image/png'), qr.datos?.contenido);
  const lectura = await req(`/api/public/qr/${qr.datos.token}`);
  check('Lectura pública del QR con ficha completa', lectura.estado === 200 && lectura.datos.numero_lote === `ANTES-${sufijo}` && lectura.datos.dias_para_vencer >= 59);
  const qrMal = await req('/api/public/qr/no-es-un-uuid');
  check('QR inválido es rechazado', qrMal.estado === 400);

  const entrada = await req('/api/inventario/movimientos/entrada', { metodo: 'POST', token: admin, cuerpo: {
    lote_id: loteAntes, cantidad: 10, motivo: 'Reposición de prueba'
  } });
  check('Entrada actualiza existencias', entrada.estado === 201, `estado=${entrada.estado}`);
  const trasEntrada = await req(`/api/catalogo/lotes/${loteAntes}`, { token: admin });
  check('Existencia tras entrada = 50', trasEntrada.datos.cantidad === 50, `cantidad=${trasEntrada.datos.cantidad}`);

  const salida = await req('/api/inventario/movimientos/salida', { metodo: 'POST', token: personal, cuerpo: {
    medicamento_id: medId, cantidad: 25, motivo: 'Dispensación de prueba'
  } });
  check('Salida FEFO registrada por personal', salida.estado === 201, `estado=${salida.estado}`);
  check('FEFO eligió primero el lote que vence antes',
    salida.datos?.lotes_usados?.[0]?.lote_id === loteAntes && salida.datos.lotes_usados[0].cantidad === 25,
    JSON.stringify(salida.datos?.lotes_usados?.map((x) => [x.numero_lote, x.cantidad])));
  const trasSalida = await req(`/api/catalogo/lotes/${loteAntes}`, { token: admin });
  check('Salida descuenta del lote correcto (50 → 25)', trasSalida.datos.cantidad === 25, `cantidad=${trasSalida.datos.cantidad}`);

  const bloqueado = await req('/api/inventario/movimientos/salida', { metodo: 'POST', token: admin, cuerpo: {
    medicamento_id: medId, lote_id: loteVencido, cantidad: 1, motivo: 'Prueba'
  } });
  check('Salida de lote vencido bloqueada', bloqueado.estado === 400 && /vencid/i.test(bloqueado.datos.error), bloqueado.datos.error);

  const negativa = await req('/api/inventario/movimientos/entrada', { metodo: 'POST', token: admin, cuerpo: {
    lote_id: loteAntes, cantidad: -5, motivo: 'Prueba'
  } });
  check('Cantidades negativas rechazadas', negativa.estado === 400);

  const sinStock = await req('/api/inventario/movimientos/salida', { metodo: 'POST', token: admin, cuerpo: {
    medicamento_id: medId, cantidad: 9999, motivo: 'Prueba'
  } });
  check('Salida sin existencias suficientes rechazada', sinStock.estado === 400);

  const ajuste = await req('/api/inventario/movimientos/ajuste', { metodo: 'POST', token: admin, cuerpo: {
    lote_id: loteTarde, cantidad_nueva: 15, motivo: 'Inventario físico de prueba'
  } });
  check('Ajuste de inventario registrado', ajuste.estado === 201 && ajuste.datos.nueva === 15);

  const alertas = await req('/api/alertas', { token: admin });
  check('Alertas automáticas generadas', alertas.datos.alertas.length > 0, `activas=${alertas.datos.resumen.activas}`);
  const historial = await req('/api/alertas?historial=1', { token: admin });
  check('Historial de alertas conservado', Array.isArray(historial.datos.alertas));

  const movimientos = await req('/api/inventario/movimientos?q=' + sufijo, { token: admin });
  check('Historial de movimientos consultable', movimientos.estado === 200 && movimientos.datos.length >= 5, `registros=${movimientos.datos.length}`);

  for (const [nombre, ruta] of [
    ['JSON', '/api/reportes/inventario?formato=json'],
    ['PDF', '/api/reportes/inventario?formato=pdf'],
    ['Excel', '/api/reportes/inventario?formato=excel']
  ]) {
    const r = await req(ruta, { token: admin, raw: nombre !== 'JSON' });
    const esperado = nombre === 'PDF' ? 'application/pdf' : nombre === 'Excel' ? 'spreadsheetml' : 'application/json';
    check(`Reporte ${nombre}`, r.estado === 200 && r.tipo.includes(esperado));
  }

  const userRes = await req('/api/usuarios', { metodo: 'POST', token: admin, cuerpo: {
    nombre: `Usuario Prueba ${sufijo}`, username: `prueba${sufijo}`, password: 'ClaveSegura123!', rol: 'personal'
  } });
  check('Registro de usuarios', userRes.estado === 201, `estado=${userRes.estado}`);
  const userId = userRes.datos.id;
  const nuevoLogin = await req('/api/auth/login', { metodo: 'POST', cuerpo: { username: `prueba${sufijo}`, password: 'ClaveSegura123!' } });
  check('Acceso con usuario recién registrado', nuevoLogin.estado === 200);

  /* ------------------------------ Limpieza ------------------------------ */
  await query('DELETE FROM alertas WHERE medicamento_id = $1', [medId]);
  await query('DELETE FROM movimientos WHERE medicamento_id = $1', [medId]);
  await query('DELETE FROM lotes WHERE medicamento_id = $1', [medId]);
  await query('DELETE FROM medicamentos WHERE id = $1', [medId]);
  await query('DELETE FROM usuarios WHERE id = $1', [userId]);
  console.log('\nDatos de prueba eliminados de la base de datos.');

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\nRESULTADO: ${resultados.length - fallos.length}/${resultados.length} verificaciones correctas.`);
  if (fallos.length) process.exitCode = 1;
}

main().catch((e) => { console.error('Error en pruebas:', e); process.exitCode = 1; }).finally(async () => {
  const { pool } = require('../database/db');
  await pool.end();
});
