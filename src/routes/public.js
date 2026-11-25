/* TÓPICO SMART QR — Consulta pública del QR (solo lectura, sin datos sensibles) */
const express = require('express');
const { query } = require('../../database/db');
const { asyncRoute } = require('../middleware');

const router = express.Router();

router.get('/qr/:token', asyncRoute(async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    throw Object.assign(new Error('El código QR no tiene un formato válido.'), { status: 400 });
  }
  const { rows } = await query(
    `SELECT l.id AS lote_id, l.numero_lote, l.fecha_vencimiento, l.cantidad, l.stock_minimo, l.ubicacion,
            l.qr_token, l.activo AS lote_activo,
            m.id AS medicamento_id, m.codigo, m.nombre, m.concentracion, m.presentacion,
            m.laboratorio, m.descripcion, m.activo AS medicamento_activo,
            c.nombre AS categoria
     FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
     LEFT JOIN categorias c ON c.id = m.categoria_id
     WHERE l.qr_token = $1::uuid`, [token]
  );
  if (!rows[0]) throw Object.assign(new Error('No se encontró ningún lote para este código QR.'), { status: 404 });
  const dato = rows[0];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaStr = dato.fecha_vencimiento instanceof Date
    ? `${dato.fecha_vencimiento.getFullYear()}-${String(dato.fecha_vencimiento.getMonth() + 1).padStart(2, '0')}-${String(dato.fecha_vencimiento.getDate()).padStart(2, '0')}`
    : String(dato.fecha_vencimiento).slice(0, 10);
  const vencimiento = new Date(`${fechaStr}T12:00:00`);
  const dias = Math.round((vencimiento - hoy) / 86400000);
  res.json({
    ...dato,
    estado_vencimiento: dias < 0 ? 'vencido' : dias <= 7 ? 'vence_7' : dias <= 30 ? 'vence_30' : dias <= 90 ? 'vence_90' : 'vigente',
    dias_para_vencer: dias,
    consultado_en: new Date().toISOString()
  });
}));

router.get('/salud', asyncRoute(async (req, res) => {
  await query('SELECT 1');
  res.json({ ok: true, servicio: 'TÓPICO SMART QR', base_de_datos: 'PostgreSQL', hora: new Date().toISOString() });
}));

module.exports = router;
