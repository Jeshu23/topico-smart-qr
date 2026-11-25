/* TÓPICO SMART QR — Categorías, medicamentos y lotes */
const express = require('express');
const QRCode = require('qrcode');
const { query } = require('../../database/db');
const { evaluarAlertas } = require('../services/alertas');
const { autenticar, permitir, asyncRoute, texto, entero, fecha } = require('../middleware');

const router = express.Router();
router.use(autenticar);

const SELECT_MEDS = `
  SELECT m.*, c.nombre AS categoria_nombre,
         COALESCE(SUM(CASE WHEN l.activo THEN l.cantidad ELSE 0 END), 0)::int AS stock_total,
         COUNT(l.id) FILTER (WHERE l.activo)::int AS total_lotes,
         MIN(l.fecha_vencimiento) FILTER (WHERE l.activo AND l.cantidad > 0) AS proximo_vencimiento
  FROM medicamentos m
  LEFT JOIN categorias c ON c.id = m.categoria_id
  LEFT JOIN lotes l ON l.medicamento_id = m.id
`;
const GROUP_MEDS = ' GROUP BY m.id, c.nombre ';

/* ------------------------------- Categorías ------------------------------- */
router.get('/categorias', asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT * FROM categorias ORDER BY nombre');
  res.json(rows);
}));

router.post('/categorias', permitir('admin'), asyncRoute(async (req, res) => {
  const nombre = texto(req.body.nombre, 'Nombre de la categoría', { max: 80 });
  const descripcion = texto(req.body.descripcion, 'Descripción', { max: 300, requerido: false });
  try {
    const { rows } = await query('INSERT INTO categorias (nombre, descripcion) VALUES ($1,$2) RETURNING *', [nombre, descripcion]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('Ya existe una categoría con ese nombre.'), { status: 400 });
    throw e;
  }
}));

router.put('/categorias/:id', permitir('admin'), asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const nombre = texto(req.body.nombre, 'Nombre de la categoría', { max: 80 });
  const descripcion = texto(req.body.descripcion, 'Descripción', { max: 300, requerido: false });
  const { rows } = await query('UPDATE categorias SET nombre=$1, descripcion=$2 WHERE id=$3 RETURNING *', [nombre, descripcion, id]);
  if (!rows[0]) throw Object.assign(new Error('Categoría no encontrada.'), { status: 404 });
  res.json(rows[0]);
}));

router.delete('/categorias/:id', permitir('admin'), asyncRoute(async (req, res) => {
  const { rowCount } = await query('DELETE FROM categorias WHERE id = $1', [Number(req.params.id)]);
  if (!rowCount) throw Object.assign(new Error('Categoría no encontrada.'), { status: 404 });
  res.json({ mensaje: 'Categoría eliminada.' });
}));

/* ------------------------------ Medicamentos ------------------------------ */
router.get('/medicamentos', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const categoria = String(req.query.categoria || '');
  const estado = String(req.query.estado || 'activos');
  const params = [`%${q}%`];
  let where = ' WHERE (m.nombre ILIKE $1 OR m.codigo ILIKE $1 OR m.laboratorio ILIKE $1) ';
  if (categoria) { params.push(Number(categoria)); where += ` AND m.categoria_id = $${params.length}`; }
  if (estado === 'activos') where += ' AND m.activo = TRUE';
  if (estado === 'inactivos') where += ' AND m.activo = FALSE';
  const { rows } = await query(SELECT_MEDS + where + GROUP_MEDS + ' ORDER BY m.id', params);
  res.json(rows);
}));

router.get('/medicamentos/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(SELECT_MEDS + ' WHERE m.id = $1' + GROUP_MEDS, [Number(req.params.id)]);
  if (!rows[0]) throw Object.assign(new Error('Medicamento no encontrado.'), { status: 404 });
  const lotes = await query('SELECT * FROM lotes WHERE medicamento_id = $1 ORDER BY fecha_vencimiento, id', [Number(req.params.id)]);
  res.json({ ...rows[0], lotes: lotes.rows });
}));

function datosMedicamento(body) {
  return {
    codigo: texto(body.codigo, 'Código', { max: 30 }).toUpperCase(),
    nombre: texto(body.nombre, 'Nombre', { max: 160 }),
    categoria_id: body.categoria_id ? entero(body.categoria_id, 'Categoría', { min: 1 }) : null,
    concentracion: texto(body.concentracion, 'Concentración', { max: 80, requerido: false }),
    presentacion: texto(body.presentacion, 'Presentación', { max: 80, requerido: false }),
    laboratorio: texto(body.laboratorio, 'Laboratorio', { max: 120, requerido: false }),
    descripcion: texto(body.descripcion, 'Descripción', { max: 500, requerido: false })
  };
}

router.post('/medicamentos', asyncRoute(async (req, res) => {
  const d = datosMedicamento(req.body);
  try {
    const { rows } = await query(
      `INSERT INTO medicamentos (codigo, nombre, categoria_id, concentracion, presentacion, laboratorio, descripcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [d.codigo, d.nombre, d.categoria_id, d.concentracion, d.presentacion, d.laboratorio, d.descripcion]
    );
    await evaluarAlertas();
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('El código de medicamento ya está registrado.'), { status: 400 });
    throw e;
  }
}));

router.put('/medicamentos/:id', asyncRoute(async (req, res) => {
  const d = datosMedicamento(req.body);
  try {
    const { rows } = await query(
      `UPDATE medicamentos SET codigo=$1, nombre=$2, categoria_id=$3, concentracion=$4,
        presentacion=$5, laboratorio=$6, descripcion=$7, updated_at=now() WHERE id=$8 RETURNING *`,
      [d.codigo, d.nombre, d.categoria_id, d.concentracion, d.presentacion, d.laboratorio, d.descripcion, Number(req.params.id)]
    );
    if (!rows[0]) throw Object.assign(new Error('Medicamento no encontrado.'), { status: 404 });
    await evaluarAlertas();
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('El código de medicamento ya está registrado.'), { status: 400 });
    throw e;
  }
}));

router.patch('/medicamentos/:id/estado', permitir('admin'), asyncRoute(async (req, res) => {
  const activo = Boolean(req.body.activo);
  const { rows } = await query('UPDATE medicamentos SET activo = $1, updated_at = now() WHERE id = $2 RETURNING *', [activo, Number(req.params.id)]);
  if (!rows[0]) throw Object.assign(new Error('Medicamento no encontrado.'), { status: 404 });
  await evaluarAlertas();
  res.json(rows[0]);
}));

/* --------------------------------- Lotes --------------------------------- */
router.get('/lotes', asyncRoute(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1 ';
  if (req.query.medicamento_id) { params.push(Number(req.query.medicamento_id)); where += ` AND l.medicamento_id = $${params.length}`; }
  if (req.query.estado === 'activos') where += ' AND l.activo = TRUE';
  if (req.query.estado === 'inactivos') where += ' AND l.activo = FALSE';
  const { rows } = await query(
    `SELECT l.*, m.nombre AS medicamento_nombre, m.codigo AS medicamento_codigo, c.nombre AS categoria_nombre
     FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
     LEFT JOIN categorias c ON c.id = m.categoria_id ${where}
     ORDER BY l.fecha_vencimiento, l.id`, params
  );
  res.json(rows);
}));

router.get('/lotes/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT l.*, m.nombre AS medicamento_nombre, m.codigo AS medicamento_codigo,
            m.concentracion, m.presentacion, m.laboratorio, c.nombre AS categoria_nombre
     FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
     LEFT JOIN categorias c ON c.id = m.categoria_id WHERE l.id = $1`, [Number(req.params.id)]
  );
  if (!rows[0]) throw Object.assign(new Error('Lote no encontrado.'), { status: 404 });
  res.json(rows[0]);
}));

function datosLote(body) {
  return {
    medicamento_id: entero(body.medicamento_id, 'Medicamento', { min: 1 }),
    numero_lote: texto(body.numero_lote, 'Número de lote', { max: 60 }).toUpperCase(),
    fecha_vencimiento: fecha(body.fecha_vencimiento, 'Fecha de vencimiento'),
    cantidad: entero(body.cantidad, 'Cantidad', { min: 0 }),
    stock_minimo: entero(body.stock_minimo, 'Stock mínimo', { min: 0 }),
    ubicacion: texto(body.ubicacion, 'Ubicación', { max: 80, requerido: false })
  };
}

router.post('/lotes', asyncRoute(async (req, res) => {
  const d = datosLote(req.body);
  const existe = await query('SELECT 1 FROM medicamentos WHERE id = $1 AND activo = TRUE', [d.medicamento_id]);
  if (!existe.rowCount) throw Object.assign(new Error('El medicamento no existe o está desactivado.'), { status: 400 });
  try {
    const { rows } = await query(
      `INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, cantidad, stock_minimo, ubicacion)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [d.medicamento_id, d.numero_lote, d.fecha_vencimiento, d.cantidad, d.stock_minimo, d.ubicacion]
    );
    await query(
      `INSERT INTO movimientos (tipo, medicamento_id, lote_id, cantidad, cantidad_antes, cantidad_despues,
        motivo, observaciones, usuario_id, usuario_nombre, lote_numero, medicamento_nombre)
       VALUES ('entrada',$1,$2,$3,0,$3,'Registro de lote','Alta de nuevo lote',$4,$5,$6,$7)`,
      [d.medicamento_id, rows[0].id, d.cantidad, req.usuario.sub, req.usuario.nombre, d.numero_lote, (await query('SELECT nombre FROM medicamentos WHERE id=$1', [d.medicamento_id])).rows[0].nombre]
    );
    await evaluarAlertas();
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('Ya existe un lote con ese número para este medicamento.'), { status: 400 });
    throw e;
  }
}));

router.put('/lotes/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  const anterior = await query('SELECT * FROM lotes WHERE id = $1', [id]);
  if (!anterior.rowCount) throw Object.assign(new Error('Lote no encontrado.'), { status: 404 });
  const numero_lote = texto(req.body.numero_lote, 'Número de lote', { max: 60 }).toUpperCase();
  const fecha_vencimiento = fecha(req.body.fecha_vencimiento, 'Fecha de vencimiento');
  const stock_minimo = entero(req.body.stock_minimo, 'Stock mínimo', { min: 0 });
  const ubicacion = texto(req.body.ubicacion, 'Ubicación', { max: 80, requerido: false });
  try {
    const { rows } = await query(
      `UPDATE lotes SET numero_lote=$1, fecha_vencimiento=$2, stock_minimo=$3, ubicacion=$4, updated_at=now()
       WHERE id=$5 RETURNING *`, [numero_lote, fecha_vencimiento, stock_minimo, ubicacion, id]
    );
    await evaluarAlertas();
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('Ya existe un lote con ese número para este medicamento.'), { status: 400 });
    throw e;
  }
}));

router.patch('/lotes/:id/estado', permitir('admin'), asyncRoute(async (req, res) => {
  const { rows } = await query('UPDATE lotes SET activo = $1, updated_at = now() WHERE id = $2 RETURNING *', [Boolean(req.body.activo), Number(req.params.id)]);
  if (!rows[0]) throw Object.assign(new Error('Lote no encontrado.'), { status: 404 });
  await evaluarAlertas();
  res.json(rows[0]);
}));

/* ---------------------------------- QR ----------------------------------- */
router.get('/lotes/:id/qr', asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT qr_token, numero_lote FROM lotes WHERE id = $1', [Number(req.params.id)]);
  if (!rows[0]) throw Object.assign(new Error('Lote no encontrado.'), { status: 404 });
  const origin = `${req.protocol}://${req.get('host')}`;
  const contenido = `${origin}/escanear?t=${rows[0].qr_token}`;
  const png = await QRCode.toDataURL(contenido, {
    width: 512, margin: 2, errorCorrectionLevel: 'M',
    color: { dark: '#123c5e', light: '#ffffff' }
  });
  res.json({ token: rows[0].qr_token, contenido, imagen: png, numero_lote: rows[0].numero_lote });
}));

module.exports = router;
