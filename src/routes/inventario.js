/* TÓPICO SMART QR — Inventario: entradas, salidas FEFO, ajustes y movimientos */
const express = require('express');
const { query, withTransaction } = require('../../database/db');
const { evaluarAlertas, listarAlertas, resumenAlertas } = require('../services/alertas');
const { autenticar, asyncRoute, texto, entero, fecha } = require('../middleware');

const router = express.Router();
router.use(autenticar);

const ymd = (fecha) => {
  if (fecha instanceof Date) return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  return String(fecha).slice(0, 10);
};
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const sumarDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function registrarMovimiento(client, datos) {
  return client.query(
    `INSERT INTO movimientos (tipo, medicamento_id, lote_id, cantidad, cantidad_antes, cantidad_despues,
       motivo, observaciones, usuario_id, usuario_nombre, lote_numero, medicamento_nombre, fecha)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13::timestamptz, now())) RETURNING *`,
    [datos.tipo, datos.medicamento_id, datos.lote_id, datos.cantidad, datos.cantidad_antes,
     datos.cantidad_despues, datos.motivo, datos.observaciones || null, datos.usuario_id,
     datos.usuario_nombre, datos.lote_numero, datos.medicamento_nombre, datos.fecha || null]
  );
}

/* -------------------------------- Dashboard ------------------------------- */
router.get('/dashboard', asyncRoute(async (req, res) => {
  const hoy = hoyISO();
  const { rows: stats } = await query(
    `SELECT
      (SELECT COUNT(*)::int FROM medicamentos WHERE activo) AS total_medicamentos,
      (SELECT COALESCE(SUM(cantidad),0)::int FROM lotes WHERE activo) AS unidades,
      (SELECT COUNT(*)::int FROM lotes WHERE activo AND cantidad > 0 AND cantidad <= stock_minimo) AS stock_bajo,
      (SELECT COUNT(*)::int FROM lotes WHERE activo AND cantidad > 0 AND fecha_vencimiento >= $1 AND fecha_vencimiento <= $2) AS proximos_vencer,
      (SELECT COUNT(*)::int FROM lotes WHERE activo AND cantidad > 0 AND fecha_vencimiento < $1) AS vencidos,
      (SELECT COUNT(*)::int FROM medicamentos WHERE activo AND COALESCE((SELECT SUM(cantidad) FROM lotes WHERE medicamento_id = medicamentos.id AND activo),0) = 0) AS agotados`,
    [hoy, sumarDias(90)]
  );

  const { rows: movimientos } = await query(
    `SELECT mv.*, l.numero_lote FROM movimientos mv LEFT JOIN lotes l ON l.id = mv.lote_id
     ORDER BY mv.fecha DESC LIMIT 8`
  );

  const { rows: porMes } = await query(
    `SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
            COUNT(*) FILTER (WHERE tipo = 'entrada')::int AS entradas,
            COUNT(*) FILTER (WHERE tipo = 'salida')::int AS salidas
     FROM movimientos WHERE fecha >= date_trunc('month', now()) - INTERVAL '5 months'
     GROUP BY 1 ORDER BY 1`
  );

  const { rows: porCategoria } = await query(
    `SELECT COALESCE(c.nombre, 'Sin categoría') AS nombre,
            COALESCE(SUM(l.cantidad),0)::int AS unidades,
            COUNT(DISTINCT m.id)::int AS medicamentos
     FROM medicamentos m
     LEFT JOIN categorias c ON c.id = m.categoria_id
     LEFT JOIN lotes l ON l.medicamento_id = m.id AND l.activo
     WHERE m.activo GROUP BY c.nombre ORDER BY unidades DESC`
  );

  const { rows: porTipo } = await query(
    `SELECT tipo, COUNT(*)::int AS total, COALESCE(SUM(cantidad),0)::int AS unidades
     FROM movimientos GROUP BY tipo ORDER BY tipo`
  );

  res.json({
    stats: stats[0],
    movimientos,
    graficas: { porMes, porCategoria, porTipo },
    alertas: (await listarAlertas({ activas: true, limite: 6 })),
    resumenAlertas: await resumenAlertas(),
    fecha: hoy
  });
}));

/* ------------------------------- Movimientos ------------------------------ */
router.get('/movimientos', asyncRoute(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1 ';
  const q = String(req.query.q || '').trim();
  if (q) { params.push(`%${q}%`); where += ` AND (mv.medicamento_nombre ILIKE $${params.length} OR mv.lote_numero ILIKE $${params.length} OR mv.usuario_nombre ILIKE $${params.length} OR mv.motivo ILIKE $${params.length})`; }
  if (req.query.tipo) { params.push(String(req.query.tipo)); where += ` AND mv.tipo = $${params.length}`; }
  if (req.query.desde) { params.push(String(req.query.desde)); where += ` AND mv.fecha::date >= $${params.length}`; }
  if (req.query.hasta) { params.push(String(req.query.hasta)); where += ` AND mv.fecha::date <= $${params.length}`; }
  const limite = Math.min(Number(req.query.limite) || 300, 1000);
  const { rows } = await query(
    `SELECT mv.* FROM movimientos mv ${where} ORDER BY mv.fecha DESC, mv.id DESC LIMIT $${params.length + 1}`,
    [...params, limite]
  );
  res.json(rows);
}));

/* --------------------------------- Entrada -------------------------------- */
router.post('/movimientos/entrada', asyncRoute(async (req, res) => {
  const cantidad = entero(req.body.cantidad, 'Cantidad', { min: 1 });
  const motivo = texto(req.body.motivo, 'Motivo', { max: 160 });
  const observaciones = texto(req.body.observaciones, 'Observaciones', { max: 500, requerido: false });
  const loteId = req.body.lote_id ? entero(req.body.lote_id, 'Lote', { min: 1 }) : null;
  const fechaMovimiento = req.body.fecha ? fecha(req.body.fecha, 'Fecha') : null;

  const resultado = await withTransaction(async (client) => {
    let lote;
    let esNuevo = false;
    if (loteId) {
      const r = await client.query('SELECT * FROM lotes WHERE id = $1 AND activo = TRUE', [loteId]);
      if (!r.rowCount) throw Object.assign(new Error('El lote seleccionado no existe o está inactivo.'), { status: 400 });
      lote = r.rows[0];
      await client.query('UPDATE lotes SET cantidad = cantidad + $1, updated_at = now() WHERE id = $2', [cantidad, loteId]);
    } else {
      const medicamento_id = entero(req.body.medicamento_id, 'Medicamento', { min: 1 });
      const numero_lote = texto(req.body.numero_lote, 'Número de lote', { max: 60 }).toUpperCase();
      const vencimiento = fecha(req.body.fecha_vencimiento, 'Fecha de vencimiento');
      const minimo = entero(req.body.stock_minimo, 'Stock mínimo', { min: 0 });
      const ubicacion = texto(req.body.ubicacion, 'Ubicación', { max: 80, requerido: false });
      const med = await client.query('SELECT id, nombre FROM medicamentos WHERE id = $1 AND activo = TRUE', [medicamento_id]);
      if (!med.rowCount) throw Object.assign(new Error('El medicamento no existe o está desactivado.'), { status: 400 });
      const dup = await client.query('SELECT 1 FROM lotes WHERE medicamento_id = $1 AND numero_lote = $2', [medicamento_id, numero_lote]);
      if (dup.rowCount) throw Object.assign(new Error('Ya existe ese número de lote. Seleccione el lote existente en el formulario.'), { status: 400 });
      const r = await client.query(
        `INSERT INTO lotes (medicamento_id, numero_lote, fecha_vencimiento, cantidad, stock_minimo, ubicacion)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [medicamento_id, numero_lote, vencimiento, cantidad, minimo, ubicacion]
      );
      lote = r.rows[0];
      esNuevo = true;
    }
    const mov = await registrarMovimiento(client, {
      tipo: 'entrada', medicamento_id: lote.medicamento_id, lote_id: lote.id, cantidad,
      cantidad_antes: lote.cantidad, cantidad_despues: lote.cantidad + cantidad,
      motivo, observaciones, usuario_id: req.usuario.sub, usuario_nombre: req.usuario.nombre,
      lote_numero: lote.numero_lote, medicamento_nombre: null, fecha: fechaMovimiento
    });
    const nombreMed = (await client.query('SELECT nombre FROM medicamentos WHERE id=$1', [lote.medicamento_id])).rows[0].nombre;
    await client.query('UPDATE movimientos SET medicamento_nombre = $1 WHERE id = $2', [nombreMed, mov.rows[0].id]);
    return { lote_id: lote.id, lote_numero: lote.numero_lote, cantidad, nuevo_lote: esNuevo, movimiento: mov.rows[0] };
  });
  await evaluarAlertas();
  res.status(201).json({ mensaje: `Entrada de ${cantidad} unidad(es) registrada correctamente.`, ...resultado });
}));

/* --------------------------------- Salida --------------------------------- */
router.post('/movimientos/salida', asyncRoute(async (req, res) => {
  const cantidadSolicitada = entero(req.body.cantidad, 'Cantidad', { min: 1 });
  const motivo = texto(req.body.motivo, 'Motivo', { max: 160 });
  const observaciones = texto(req.body.observaciones, 'Observaciones', { max: 500, requerido: false });
  const medicamentoId = entero(req.body.medicamento_id, 'Medicamento', { min: 1 });
  const loteId = req.body.lote_id ? entero(req.body.lote_id, 'Lote', { min: 1 }) : null;
  const fechaMovimiento = req.body.fecha ? fecha(req.body.fecha, 'Fecha') : null;
  const hoy = hoyISO();

  const resultado = await withTransaction(async (client) => {
    const med = await client.query('SELECT id, nombre FROM medicamentos WHERE id = $1 AND activo = TRUE', [medicamentoId]);
    if (!med.rowCount) throw Object.assign(new Error('El medicamento no existe o está desactivado.'), { status: 400 });
    let candidatos;
    if (loteId) {
      const r = await client.query('SELECT * FROM lotes WHERE id = $1 AND medicamento_id = $2 AND activo = TRUE', [loteId, medicamentoId]);
      if (!r.rowCount) throw Object.assign(new Error('El lote no pertenece al medicamento o está inactivo.'), { status: 400 });
      candidatos = r.rows;
    } else {
      const r = await client.query(
        'SELECT * FROM lotes WHERE medicamento_id = $1 AND activo = TRUE AND cantidad > 0 ORDER BY fecha_vencimiento ASC, id ASC',
        [medicamentoId]
      );
      candidatos = r.rows;
    }
    if (!candidatos.length) throw Object.assign(new Error('No hay lotes con existencias para este medicamento.'), { status: 400 });

    // Un lote vencido nunca se dispensa. Si se seleccionó explícitamente, se bloquea la operación.
    if (loteId && ymd(candidatos[0].fecha_vencimiento) < hoy) {
      throw Object.assign(new Error(
        `El lote ${candidatos[0].numero_lote} venció el ${ymd(candidatos[0].fecha_vencimiento)}. No se permite la salida de medicamentos vencidos; registre primero un ajuste de baja.`
      ), { status: 400 });
    }

    const vigentes = candidatos.filter((l) => ymd(l.fecha_vencimiento) >= hoy);
    const disponible = vigentes.reduce((s, l) => s + Number(l.cantidad), 0);
    const vencidas = candidatos.reduce((s, l) => s + (ymd(l.fecha_vencimiento) < hoy ? Number(l.cantidad) : 0), 0);
    if (disponible < cantidadSolicitada) {
      throw Object.assign(new Error(
        `Existencias vigentes insuficientes. Disponible: ${disponible} unidad(es)${vencidas ? ` (${vencidas} unidad(es) vencidas no son dispensables)` : ''}.`
      ), { status: 400 });
    }

    // FEFO: se recorren los lotes por fecha de vencimiento ascendente y se omiten los vencidos.
    let restante = cantidadSolicitada;
    const usados = [];
    for (const lote of candidatos) {
      if (restante <= 0) break;
      if (ymd(lote.fecha_vencimiento) < hoy) continue;
      const tomar = Math.min(Number(lote.cantidad), restante);
      if (tomar <= 0) continue;
      await client.query('UPDATE lotes SET cantidad = cantidad - $1, updated_at = now() WHERE id = $2', [tomar, lote.id]);
      const mov = await registrarMovimiento(client, {
        tipo: 'salida', medicamento_id: medicamentoId, lote_id: lote.id, cantidad: tomar,
        cantidad_antes: Number(lote.cantidad), cantidad_despues: Number(lote.cantidad) - tomar,
        motivo, observaciones, usuario_id: req.usuario.sub, usuario_nombre: req.usuario.nombre,
        lote_numero: lote.numero_lote, medicamento_nombre: med.rows[0].nombre, fecha: fechaMovimiento
      });
      usados.push({ lote_id: lote.id, numero_lote: lote.numero_lote, fecha_vencimiento: lote.fecha_vencimiento, cantidad: tomar, movimiento_id: mov.rows[0].id });
      restante -= tomar;
    }
    if (restante > 0) throw Object.assign(new Error('No fue posible completar la salida con lotes vigentes.'), { status: 400 });
    return { medicamento: med.rows[0].nombre, solicitada: cantidadSolicitada, lotes_usados: usados };
  });
  await evaluarAlertas();
  res.status(201).json({ mensaje: `Salida de ${cantidadSolicitada} unidad(es) registrada (FEFO).`, ...resultado });
}));

/* --------------------------------- Ajuste --------------------------------- */
router.post('/movimientos/ajuste', asyncRoute(async (req, res) => {
  const loteId = entero(req.body.lote_id, 'Lote', { min: 1 });
  const nueva = entero(req.body.cantidad_nueva, 'Cantidad nueva', { min: 0 });
  const motivo = texto(req.body.motivo, 'Motivo', { max: 160 });
  const observaciones = texto(req.body.observaciones, 'Observaciones', { max: 500, requerido: false });

  const resultado = await withTransaction(async (client) => {
    const r = await client.query(
      `SELECT l.*, m.nombre AS medicamento_nombre FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id WHERE l.id = $1`,
      [loteId]
    );
    if (!r.rowCount) throw Object.assign(new Error('Lote no encontrado.'), { status: 404 });
    const lote = r.rows[0];
    const anterior = Number(lote.cantidad);
    const diferencia = nueva - anterior;
    if (diferencia === 0) throw Object.assign(new Error('La cantidad nueva es igual a la actual; no hay nada que ajustar.'), { status: 400 });
    await client.query('UPDATE lotes SET cantidad = $1, updated_at = now() WHERE id = $2', [nueva, loteId]);
    const mov = await registrarMovimiento(client, {
      tipo: 'ajuste', medicamento_id: lote.medicamento_id, lote_id: loteId,
      cantidad: Math.abs(diferencia), cantidad_antes: anterior, cantidad_despues: nueva,
      motivo: `${diferencia < 0 ? 'Baja' : 'Incremento'} — ${motivo}`, observaciones,
      usuario_id: req.usuario.sub, usuario_nombre: req.usuario.nombre,
      lote_numero: lote.numero_lote, medicamento_nombre: lote.medicamento_nombre
    });
    return { lote_id: loteId, numero_lote: lote.numero_lote, anterior, nueva, movimiento: mov.rows[0] };
  });
  await evaluarAlertas();
  res.status(201).json({ mensaje: 'Ajuste de inventario registrado correctamente.', ...resultado });
}));

module.exports = router;
