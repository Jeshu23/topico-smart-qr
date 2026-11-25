/* TÓPICO SMART QR — Exportación de reportes a PDF y Excel */
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function limpio(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toLocaleString('es-PE');
  return String(valor);
}

async function exportarExcel(res, { titulo, columnas, filas, nombre }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TÓPICO SMART QR';
  workbook.created = new Date();
  const hoja = workbook.addWorksheet('Reporte', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = columnas.map((c) => ({ header: c.header, key: c.key, width: c.ancho || 20 }));
  const cabecera = hoja.getRow(1);
  cabecera.height = 26;
  cabecera.eachCell((celda) => {
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123C5E' } };
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    celda.alignment = { vertical: 'middle', horizontal: 'center' };
    celda.border = { bottom: { style: 'thin', color: { argb: 'FF78A9D4' } } };
  });
  filas.forEach((fila, i) => {
    const filaExcel = hoja.addRow(fila);
    filaExcel.eachCell((celda) => {
      celda.alignment = { vertical: 'middle', wrapText: false };
      celda.border = { bottom: { style: 'hair', color: { argb: 'FFDCEBFA' } } };
      if (i % 2 === 1) celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F8FD' } };
    });
  });
  hoja.autoFilter = { from: 'A1', to: `${hoja.getColumn(columnas.length).letter}1` };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

async function exportarPDF(res, { titulo, columnas, filas, nombre }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36, info: { Title: titulo, Author: 'TÓPICO SMART QR' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}.pdf"`);
  doc.pipe(res);

  const anchoUtil = doc.page.width - 72;
  const anchos = columnas.map((c) => Math.round((c.ancho / columnas.reduce((s, x) => s + (x.ancho || 20), 0)) * anchoUtil));

  const dibujarCabecera = () => {
    const y = doc.y;
    doc.rect(36, y, anchoUtil, 24).fill('#123C5E');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
    let x = 36;
    columnas.forEach((c, i) => {
      doc.text(limpio(c.header).toUpperCase(), x + 4, y + 7, { width: anchos[i] - 8, height: 12, ellipsis: true, lineBreak: false });
      x += anchos[i];
    });
    doc.y = y + 28;
    doc.fillColor('#34445A').font('Helvetica');
  };

  doc.fillColor('#123C5E').font('Helvetica-Bold').fontSize(18).text(titulo, { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#5F7290')
    .text(`Generado: ${new Date().toLocaleString('es-PE')} · TÓPICO SMART QR · ${filas.length} registro(s)`, { align: 'left' });
  doc.moveDown(0.6);

  dibujarCabecera();
  filas.forEach((fila, idx) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      dibujarCabecera();
    }
    const y = doc.y;
    if (idx % 2 === 1) doc.rect(36, y - 2, anchoUtil, 18).fill('#F3F8FD').fillOpacity(1);
    doc.fillColor('#34445A').fontSize(8.5).font('Helvetica');
    let x = 36;
    columnas.forEach((c, i) => {
      doc.text(limpio(fila[c.key]), x + 4, y, { width: anchos[i] - 8, height: 16, ellipsis: true, lineBreak: false });
      x += anchos[i];
    });
    doc.y = y + 18;
  });
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#8FA2B8').text('Documento generado automáticamente desde la base de datos del sistema.', { align: 'center' });
  doc.end();
}

async function enviarReporte(res, config) {
  const formato = String(config.formato || 'json').toLowerCase();
  if (formato === 'excel') return exportarExcel(res, config);
  if (formato === 'pdf') return exportarPDF(res, config);
  return res.json({ titulo: config.titulo, columnas: config.columnas, filas: config.filas, total: config.filas.length });
}

module.exports = { enviarReporte };
