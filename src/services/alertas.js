/* TÓPICO SMART QR — Evaluación automática e histórica de alertas */
const { query, withTransaction } = require('../../database/db');

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymd(fecha) {
  if (fecha instanceof Date) {
    return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
  }
  return String(fecha).slice(0, 10);
}

function diasHasta(fecha, hoy) {
  const a = new Date(`${hoy}T12:00:00`);
  const b = new Date(`${ymd(fecha)}T12:00:00`);
  if (Number.isNaN(b.getTime())) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86400000);
}

/**
 * Recalcula todas las alertas activas. Las alertas que ya no aplican se marcan
 * como resueltas (historial), nunca se eliminan.
 */
async function evaluarAlertas() {
  return withTransaction(async (client) => {
    const hoy = hoyISO();
    const actuales = [];

    const { rows: lotes } = await client.query(`
      SELECT l.id, l.numero_lote, l.fecha_vencimiento, l.cantidad, l.stock_minimo,
             m.id AS medicamento_id, m.nombre AS medicamento, m.codigo
      FROM lotes l JOIN medicamentos m ON m.id = l.medicamento_id
      WHERE l.activo = TRUE AND m.activo = TRUE
      ORDER BY l.fecha_vencimiento
    `);

    for (const l of lotes) {
      const cantidad = Number(l.cantidad);
      const minimo = Number(l.stock_minimo);
      const etiqueta = `${l.medicamento} · Lote ${l.numero_lote}`;
      const base = { medicamento_id: l.medicamento_id, lote_id: l.id };

      if (cantidad > 0) {
        const dias = diasHasta(l.fecha_vencimiento, hoy);
        if (dias < 0) {
          actuales.push({
            clave: `vencido:${l.id}`, tipo: 'vencido', nivel: 'critico',
            titulo: 'Medicamento vencido',
            mensaje: `${etiqueta} venció hace ${Math.abs(dias)} día(s) y aún tiene ${cantidad} unidad(es). No se puede dispensar.`,
            ...base
          });
        } else {
          let tipo = null;
          let nivel = null;
          let titulo = null;
          if (dias <= 7) { tipo = 'vencimiento_7'; nivel = 'critico'; titulo = 'Vence en 7 días o menos'; }
          else if (dias <= 30) { tipo = 'vencimiento_30'; nivel = 'advertencia'; titulo = 'Vence en 30 días o menos'; }
          else if (dias <= 90) { tipo = 'vencimiento_90'; nivel = 'info'; titulo = 'Vence en 90 días'; }
          if (tipo) {
            actuales.push({
              clave: `${tipo}:${l.id}`, tipo, nivel, titulo,
              mensaje: `${etiqueta} vence el ${ymd(l.fecha_vencimiento)} (${dias} día(s)). Quedan ${cantidad} unidad(es).`,
              ...base
            });
          }
        }

        if (cantidad <= minimo) {
          actuales.push({
            clave: `stock_bajo:${l.id}`, tipo: 'stock_bajo', nivel: minimo === 0 ? 'info' : 'advertencia',
            titulo: cantidad === 0 ? 'Lote agotado' : 'Stock en nivel mínimo',
            mensaje: `${etiqueta} tiene ${cantidad} unidad(es); el stock mínimo es ${minimo}.`,
            ...base
          });
        }
      }
    }

    const { rows: agotados } = await client.query(`
      SELECT m.id, m.nombre, m.codigo FROM medicamentos m
      WHERE m.activo = TRUE
        AND COALESCE((SELECT SUM(cantidad) FROM lotes WHERE medicamento_id = m.id AND activo = TRUE), 0) = 0
        AND EXISTS (SELECT 1 FROM lotes WHERE medicamento_id = m.id AND activo = TRUE)
    `);
    for (const m of agotados) {
      actuales.push({
        clave: `agotado:${m.id}`, tipo: 'agotado', nivel: 'advertencia',
        titulo: 'Medicamento sin existencias',
        mensaje: `${m.nombre} (${m.codigo}) no tiene unidades disponibles.`,
        medicamento_id: m.id, lote_id: null
      });
    }

    const claves = actuales.map((a) => a.clave);
    for (const a of actuales) {
      await client.query(
        `INSERT INTO alertas (clave, tipo, nivel, titulo, mensaje, medicamento_id, lote_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (clave) WHERE resuelta = FALSE DO NOTHING`,
        [a.clave, a.tipo, a.nivel, a.titulo, a.mensaje, a.medicamento_id, a.lote_id]
      );
    }
    await client.query(
      `UPDATE alertas SET resuelta = TRUE, resuelta_at = now()
       WHERE resuelta = FALSE AND NOT (clave = ANY($1::text[]))`,
      [claves]
    );
    return actuales.length;
  });
}

async function listarAlertas({ activas = true, limite = 100 } = {}) {
  const { rows } = await query(
    `SELECT a.*, m.nombre AS medicamento_nombre, l.numero_lote
     FROM alertas a
     LEFT JOIN medicamentos m ON m.id = a.medicamento_id
     LEFT JOIN lotes l ON l.id = a.lote_id
     WHERE CASE WHEN $1 THEN a.resuelta = FALSE ELSE TRUE END
     ORDER BY a.resuelta ASC,
       CASE a.nivel WHEN 'critico' THEN 0 WHEN 'advertencia' THEN 1 ELSE 2 END,
       a.created_at DESC
     LIMIT $2`,
    [activas, limite]
  );
  return rows;
}

async function resumenAlertas() {
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE resuelta = FALSE)::int AS activas,
            COUNT(*) FILTER (WHERE resuelta = FALSE AND nivel = 'critico')::int AS criticas,
            COUNT(*) FILTER (WHERE resuelta = FALSE AND nivel = 'advertencia')::int AS advertencias,
            COUNT(*) FILTER (WHERE resuelta = FALSE AND nivel = 'info')::int AS informativas,
            COUNT(*)::int AS historial
     FROM alertas`
  );
  return rows[0];
}

module.exports = { evaluarAlertas, listarAlertas, resumenAlertas };
