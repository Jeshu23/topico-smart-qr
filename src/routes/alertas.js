/* TÓPICO SMART QR — Alertas e historial */
const express = require('express');
const { query } = require('../../database/db');
const { evaluarAlertas, listarAlertas, resumenAlertas } = require('../services/alertas');
const { autenticar, permitir, asyncRoute } = require('../middleware');

const router = express.Router();
router.use(autenticar);

router.get('/', asyncRoute(async (req, res) => {
  const historial = String(req.query.historial || '') === '1';
  const limite = Math.min(Number(req.query.limite) || 200, 1000);
  const alertas = await listarAlertas({ activas: !historial, limite });
  res.json({ alertas, resumen: await resumenAlertas() });
}));

router.get('/resumen', asyncRoute(async (req, res) => res.json(await resumenAlertas())));

router.patch('/:id/leida', asyncRoute(async (req, res) => {
  const { rows } = await query('UPDATE alertas SET leida = TRUE WHERE id = $1 RETURNING *', [Number(req.params.id)]);
  if (!rows[0]) throw Object.assign(new Error('Alerta no encontrada.'), { status: 404 });
  res.json(rows[0]);
}));

router.patch('/leer-todas', asyncRoute(async (req, res) => {
  const { rowCount } = await query('UPDATE alertas SET leida = TRUE WHERE resuelta = FALSE AND leida = FALSE');
  res.json({ mensaje: `${rowCount} alerta(s) marcada(s) como leídas.` });
}));

router.post('/reevaluar', permitir('admin'), asyncRoute(async (req, res) => {
  const total = await evaluarAlertas();
  res.json({ mensaje: `Evaluación completada. ${total} alerta(s) vigente(s).`, activas: total });
}));

module.exports = router;
