/* TÓPICO SMART QR — Reportes exportables (JSON, PDF, Excel) */
const express = require('express');
const { query } = require('../../database/db');
const { autenticar, asyncRoute } = require('../middleware');
const { enviarReporte } = require('../services/exportar');

const router = express.Router();
router.use(autenticar);

const COLS = {
  inventario: [
    { header: 'Código', key: 'codigo', ancho: 14 },
    { header: 'Medicamento', key: 'nombre', ancho: 26 },
    { header: 'Categoría', key: 'categoria', ancho: 20 },
    { header: 'Concentración', key: 'concentracion', ancho: 16 },
    { header: 'Presentación', key: 'presentacion', ancho: 16 },
    { header: 'Laboratorio', key: 'laboratorio', ancho: 24 },
    { header: 'Lotes', key: 'lotes', ancho: 10 },
    { header: 'Unidades', key: 'unidades', ancho: 12 },
    { header: 'Próx. vencimiento', key: 'proximo_vencimiento', ancho: 18 }
  ],
  stock: [
    { header: 'Medicamento', key: 'medicamento', ancho: 26 },
    { header: 'Lote', key: 'numero_lote', ancho: 16 },
    { header: 'Existencia', key: 'cantidad', ancho: 12 },
    { header: 'Mínimo', key: 'stock_minimo', ancho: 10 },
    { header: 'Ubicación', key: 'ubicacion', ancho: 14 },
    { header: 'Vencimiento', key: 'fecha_vencimiento', ancho: 16 },
    { header: 'Situación', key: 'situacion', ancho: 18 }
  ],
  vencimientos: [
    { header: 'Medicamento', key: 'medicamento', ancho: 26 },
    { header: 'Lote', key: 'numero_lote', ancho: 16 },
    { header: 'Vencimiento', key: 'fecha_vencimiento', ancho: 16 },
    { header: 'Días', key: 'dias', ancho: 10 },
    { header: 'Unidades', key: 'cantidad', ancho: 12 },
    { header: 'Ubicación', key: 'ubicacion', ancho: 14 },
    { header: 'Estado', key: 'estado', ancho: 18 }
  ],
  movimientos: [
    { header: 'Fecha', key: 'fecha', ancho: 22 },
    { header: 'Tipo', key: 'tipo', ancho: 12 },
    { header: 'Medicamento', key: 'medicamento', ancho: 26 },
    { header: 'Lote', key: 'lote', ancho: 16 },
    { header: 'Cantidad', key: 'cantidad', ancho: 12 },
    { header: 'Antes', key: 'antes', ancho: 10 },
    { header: 'Después', key: 'despues', ancho: 10 },
    { header: 'Motivo', key: 'motivo', ancho: 24 },
    { header: 'Usuario', key: 'usuario', ancho: 20 }
  ]
};

const formato = (req) => String(req.query.formato || 'json').toLowerCase();
const archivo = (nombre) => `topico_qr_${nombre}_${new Date().toISOString().slice(0, 10)}`;

router.get('/inventario', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT m.codigo, m.nombre, COALESCE(c.nombre,'Sin categoría') AS categoria,
            m.concentracion, m.presentacion, m.laboratorio,
            COUNT(l.id) FILTER (WHERE l.activo)::int AS lotes,
            COALESCE(SUM(l.cantidad) FILTER (WHERE l.activo),0)::int AS unidades,
            MIN(l.fecha_vencimiento) FILTER (WHERE l.activo AND l.cantidad > 0) AS proximo_vencimiento
     FROM medicamentos m LEFT JOIN categorias c ON c.id = m.categoria_id
     LEFT JOIN lotes l ON l.medicamento_id = m.id
     GROUP BY m.id, c.nombre ORDER BY m.nombre`
  );
  await enviarReporte(res, { titulo: 'Reporte de Inventario General', columnas: COLS.inventario, filas: rows.map((r) => ({ ...r, proximo_vencimiento: r.proximo_vencimiento || '—' })), formato: formato(req), nombre: archivo('inventario') });
}));

router.get('/stock-bajo', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT m.nombre AS medicamento, l.numero_lote, l.cantidad, l.stock_minimo, l.ubicacion, l.fecha_vencimiento,
            CASE WHEN l.cantidad = 0 THEN 'Agotado' ELSE 'Stock bajo' END AS situacion
     FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
     WHERE l.activo = TRUE AND m.activo = TRUE AND l.cantidad <= l.stock_minimo
     UNION ALL
     SELECT m.nombre, 'SIN LOTE', 0, 0, '—', NULL, 'Sin lotes activos'
     FROM medicamentos m WHERE m.activo = TRUE
       AND NOT EXISTS (SELECT 1 FROM lotes WHERE medicamento_id = m.id AND activo = TRUE)
     ORDER BY medicamento, cantidad`
  );
  await enviarReporte(res, { titulo: 'Reporte de Stock Bajo', columnas: COLS.stock, filas: rows.map((r) => ({ ...r, fecha_vencimiento: r.fecha_vencimiento || '—' })), formato: formato(req), nombre: archivo('stock_bajo') });
}));

router.get('/vencimientos', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT m.nombre AS medicamento, l.numero_lote, l.fecha_vencimiento,
            (l.fecha_vencimiento - CURRENT_DATE)::int AS dias, l.cantidad, l.ubicacion,
            CASE WHEN l.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDO'
                 WHEN l.fecha_vencimiento <= CURRENT_DATE + 7 THEN 'VENCE ≤ 7 DÍAS'
                 WHEN l.fecha_vencimiento <= CURRENT_DATE + 30 THEN 'VENCE ≤ 30 DÍAS'
                 ELSE 'VENCE ≤ 90 DÍAS' END AS estado
     FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
     WHERE l.activo = TRUE AND m.activo = TRUE AND l.fecha_vencimiento <= CURRENT_DATE + 90
     ORDER BY l.fecha_vencimiento`
  );
  await enviarReporte(res, { titulo: 'Reporte de Vencimientos (90 días)', columnas: COLS.vencimientos, filas: rows, formato: formato(req), nombre: archivo('vencimientos') });
}));

router.get('/movimientos', asyncRoute(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1 ';
  if (req.query.tipo) { params.push(String(req.query.tipo)); where += ` AND mv.tipo = $${params.length}`; }
  if (req.query.desde) { params.push(String(req.query.desde)); where += ` AND mv.fecha::date >= $${params.length}`; }
  if (req.query.hasta) { params.push(String(req.query.hasta)); where += ` AND mv.fecha::date <= $${params.length}`; }
  const { rows } = await query(
    `SELECT to_char(mv.fecha, 'YYYY-MM-DD HH24:MI') AS fecha, mv.tipo,
            COALESCE(mv.medicamento_nombre, '—') AS medicamento,
            COALESCE(mv.lote_numero, '—') AS lote, mv.cantidad,
            mv.cantidad_antes AS antes, mv.cantidad_despues AS despues,
            mv.motivo, mv.usuario_nombre AS usuario
     FROM movimientos mv ${where} ORDER BY mv.fecha DESC LIMIT 2000`, params
  );
  await enviarReporte(res, { titulo: 'Reporte de Entradas y Salidas', columnas: COLS.movimientos, filas: rows, formato: formato(req), nombre: archivo('movimientos') });
}));

module.exports = router;
