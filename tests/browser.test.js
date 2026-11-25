/* TÓPICO SMART QR — Prueba de navegador real (Chrome headless) */
require('dotenv').config();
const puppeteer = require('puppeteer-core');

const BASE = `http://127.0.0.1:${process.env.PORT || 3100}`;
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const VISTAS = ['dashboard', 'medicamentos', 'lotes', 'inventario', 'movimientos', 'alertas', 'reportes', 'escaner', 'usuarios', 'perfil'];
const resultados = [];

function check(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

(async () => {
  const navegador = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream']
  });
  try {
    const pagina = await navegador.newPage();
    const cerrarModal = async () => {
      await pagina.click('#modal-root [data-cerrar-modal]');
      await pagina.waitForFunction(() => !document.querySelector('#modal-root .modal-overlay'), { timeout: 5000 });
    };
    await pagina.setViewport({ width: 1440, height: 900 });
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(e.message));
    pagina.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

    await pagina.goto(BASE, { waitUntil: 'networkidle0' });
    check('Pantalla de login desplegada', await pagina.$eval('#login-screen', (e) => getComputedStyle(e).display !== 'none'));

    await pagina.type('#login-usuario', 'admin');
    await pagina.type('#login-password', 'Admin123!');
    await pagina.click('#form-login button[type=submit]');
    await pagina.waitForSelector('#app-shell', { visible: true, timeout: 20000 });
    await pagina.waitForSelector('#vista-contenido .stat-card', { timeout: 20000 });
    check('Inicio de sesión desde el navegador', true);

    for (const vista of VISTAS) {
      await pagina.evaluate((v) => { location.hash = '#/' + v; }, vista);
      try {
        await pagina.waitForFunction(() => document.querySelector('#vista-contenido .view') && !document.querySelector('#vista-contenido .spinner'), { timeout: 15000 });
        await new Promise((r) => setTimeout(r, 250));
        const info = await pagina.evaluate(() => ({
          titulo: document.querySelector('#topbar-titulo')?.textContent || '',
          html: document.querySelector('#vista-contenido')?.textContent || '',
          activo: document.querySelector('.nav-item.is-active')?.dataset.nav || ''
        }));
        const fallo = /No se pudo cargar la vista|Error 5\d\d/.test(info.html);
        check(`Vista ${vista} renderiza`, !fallo && info.html.length > 80 && info.activo === vista, `${info.titulo} · ${info.html.length} caracteres`);
      } catch (err) {
        check(`Vista ${vista} renderiza`, false, err.message);
      }
    }

    /* Botones que abren formularios y ventanas */
    await pagina.evaluate(() => { location.hash = '#/medicamentos'; });
    await pagina.waitForSelector('[data-action=nuevo-med]');
    await pagina.click('[data-action=nuevo-med]');
    await pagina.waitForSelector('#form-med');
    check('Botón nuevo medicamento abre formulario', true);
    await cerrarModal();

    await pagina.evaluate(() => { location.hash = '#/lotes'; });
    await pagina.waitForSelector('[data-action=ver-qr]');
    await pagina.click('[data-action=ver-qr]');
    await pagina.waitForSelector('#qr-img', { timeout: 15000 });
    const qrOk = await pagina.$eval('#qr-img', (img) => img.src.startsWith('data:image/png'));
    check('Botón QR genera imagen real', qrOk);
    await cerrarModal();

    await pagina.evaluate(() => { location.hash = '#/inventario'; });
    await pagina.waitForSelector('[data-action=abrir-entrada]');
    await pagina.click('[data-action=abrir-entrada]');
    await pagina.waitForSelector('#form-entrada');
    check('Botón registrar entrada abre formulario', true);
    await cerrarModal();

    /* Consulta manual de QR en el escáner */
    const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'Admin123!' }) }).then((r) => r.json());
    const lotes = await fetch(`${BASE}/api/catalogo/lotes`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    const qrInfo = await fetch(`${BASE}/api/catalogo/lotes/${lotes[0].id}/qr`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    await pagina.evaluate(() => { location.hash = '#/escaner'; });
    await pagina.waitForSelector('#form-token');
    await pagina.type('#token-qr', qrInfo.token);
    await pagina.click('#form-token button[type=submit]');
    await pagina.waitForFunction(() => document.querySelector('#modal-root')?.textContent.includes('Medicamento identificado'), { timeout: 15000 });
    check('Lectura manual de QR muestra ficha en navegador', true);
    await cerrarModal();

    /* Formularios reales: registro de medicamento, lote, entrada y salida */
    const sufijo = String(Date.now()).slice(-7);
    const codigo = `UI-${sufijo}`;
    await pagina.evaluate(() => { location.hash = '#/medicamentos'; });
    await pagina.waitForSelector('[data-action=nuevo-med]');
    await pagina.click('[data-action=nuevo-med]');
    await pagina.waitForSelector('#form-med');
    await pagina.type('#med-codigo', codigo);
    await pagina.type('#med-nombre', `Medicamento UI ${sufijo}`);
    await pagina.type('#med-concentracion', '250 mg');
    await pagina.type('#med-presentacion', 'Tabletas');
    await pagina.click('#form-med button[type=submit]');
    await pagina.waitForFunction((c) => !document.querySelector('#form-med') && document.querySelector('#vista-contenido').textContent.includes(c), { timeout: 15000 }, codigo);
    check('Formulario de medicamento guarda en base de datos', true);

    const medUI = await fetch(`${BASE}/api/catalogo/medicamentos?q=${codigo}`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    const medId = medUI[0].id;
    const fechaV = new Date(); fechaV.setDate(fechaV.getDate() + 45);
    const fechaStr = `${fechaV.getFullYear()}-${String(fechaV.getMonth() + 1).padStart(2, '0')}-${String(fechaV.getDate()).padStart(2, '0')}`;
    await pagina.evaluate(() => { location.hash = '#/lotes'; });
    await pagina.waitForSelector('[data-action=nuevo-lote]');
    await pagina.click('[data-action=nuevo-lote]');
    await pagina.waitForSelector('#form-lote');
    await pagina.select('#lote-med', String(medId));
    await pagina.type('#lote-num', `UIL-${sufijo}`);
    await pagina.$eval('#lote-vence', (el, v) => { el.value = v; }, fechaStr);
    await pagina.$eval('#lote-cant', (el, v) => { el.value = v; }, '50');
    await pagina.$eval('#lote-min', (el, v) => { el.value = v; }, '10');
    await pagina.click('#form-lote button[type=submit]');
    await pagina.waitForFunction((c) => !document.querySelector('#form-lote') && document.querySelector('#vista-contenido').textContent.includes(c), { timeout: 15000 }, `UIL-${sufijo}`);
    check('Formulario de lote guarda y genera QR', true);

    const loteUI = await fetch(`${BASE}/api/catalogo/lotes?medicamento_id=${medId}`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    const loteId = loteUI[0].id;
    await pagina.evaluate(() => { location.hash = '#/inventario'; });
    await pagina.waitForSelector('[data-action=abrir-entrada]');
    await pagina.click('[data-action=abrir-entrada]');
    await pagina.waitForSelector('#form-entrada');
    await pagina.select('#ent-lote', String(loteId));
    await pagina.$eval('#ent-cant', (el, v) => { el.value = v; }, '20');
    await pagina.click('#form-entrada button[type=submit]');
    await pagina.waitForFunction(() => !document.querySelector('#form-entrada'), { timeout: 15000 });
    const trasEntradaUI = await fetch(`${BASE}/api/catalogo/lotes/${loteId}`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    check('Formulario de entrada actualiza existencias', trasEntradaUI.cantidad === 70, `cantidad=${trasEntradaUI.cantidad}`);

    await pagina.click('[data-action=abrir-salida]');
    await pagina.waitForSelector('#form-salida');
    await pagina.select('#sal-med', String(medId));
    await new Promise((r) => setTimeout(r, 200));
    await pagina.$eval('#sal-cant', (el, v) => { el.value = v; }, '10');
    await pagina.click('#form-salida button[type=submit]');
    await pagina.waitForFunction(() => !document.querySelector('#form-salida'), { timeout: 15000 });
    const trasSalidaUI = await fetch(`${BASE}/api/catalogo/lotes/${loteId}`, { headers: { Authorization: `Bearer ${login.token}` } }).then((r) => r.json());
    check('Formulario de salida descarga con FEFO', trasSalidaUI.cantidad === 60, `cantidad=${trasSalidaUI.cantidad}`);

    /* Diseño responsive */
    await pagina.evaluate(() => { document.querySelector('#toast-stack').innerHTML = ''; });
    await pagina.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 400));
    await pagina.mouse.click(31, 33);
    const abierto = await pagina.$eval('#sidebar', (e) => e.classList.contains('abierto'));
    check('Menú lateral responsive en móvil', abierto);
    await pagina.mouse.click(370, 400);

    /* Cierre de sesión */
    await pagina.setViewport({ width: 1440, height: 900 });
    await pagina.evaluate(() => { document.querySelector('#toast-stack').innerHTML = ''; });
    await pagina.click('#btn-salir');
    await pagina.waitForFunction(() => getComputedStyle(document.querySelector('#login-screen')).display !== 'none', { timeout: 10000 });
    check('Cierre de sesión desde el navegador', true);

    const { query, pool } = require('../database/db');
    await query('DELETE FROM alertas WHERE medicamento_id = $1', [medId]);
    await query('DELETE FROM movimientos WHERE medicamento_id = $1', [medId]);
    await query('DELETE FROM lotes WHERE medicamento_id = $1', [medId]);
    await query('DELETE FROM medicamentos WHERE id = $1', [medId]);
    await pool.end();
    console.log('Datos creados desde el navegador eliminados de la base de datos.');

    check('Sin errores JavaScript en consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  } finally {
    await navegador.close();
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\nRESULTADO NAVEGADOR: ${resultados.length - fallos.length}/${resultados.length} verificaciones correctas.`);
  if (fallos.length) process.exitCode = 1;
})().catch((e) => { console.error('Error en prueba de navegador:', e); process.exitCode = 1; });
