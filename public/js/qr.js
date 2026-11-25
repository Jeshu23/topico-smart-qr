/* TÓPICO SMART QR — Generación, descarga, impresión y lectura de QR */
const QR = (function () {
  let escaner = null;
  let activo = false;
  let modalActual = null;

  function extraerToken(texto) {
    const valor = String(texto || '').trim();
    try {
      const url = new URL(valor);
      const t = url.searchParams.get('t');
      if (t) return t;
    } catch (_) { /* no es URL */ }
    return valor;
  }

  async function mostrar(loteId) {
    const datos = await API.get(`/catalogo/lotes/${loteId}/qr`);
    const modal = UI.modal({
      titulo: 'Código QR del lote',
      subtitulo: `${datos.numero_lote} · código único e inmutable`,
      ancho: 520,
      contenido: `
        <div class="qr-card">
          <img id="qr-img" class="qr-big" src="${datos.imagen}" alt="Código QR del lote ${UI.esc(datos.numero_lote)}">
          <div class="muted small center">${UI.esc(datos.contenido)}</div>
          <div class="row row--wrap" style="justify-content:center">
            <a class="btn btn--primary" href="${datos.imagen}" download="qr_${UI.esc(datos.numero_lote)}.png"><i class="bi bi-download"></i> Descargar PNG</a>
            <button class="btn btn--soft" data-action="imprimir-qr" data-imagen="${datos.imagen}" data-lote="${UI.esc(datos.numero_lote)}"><i class="bi bi-printer"></i> Imprimir</button>
            <button class="btn btn--ghost" data-action="verificar-qr" data-token="${datos.token}"><i class="bi bi-search"></i> Verificar lectura</button>
          </div>
        </div>`
    });
    return modal;
  }

  function imprimir(imagen, lote) {
    const ventana = window.open('', '_blank', 'width=640,height=760');
    if (!ventana) { UI.toast('El navegador bloqueó la ventana de impresión.', 'error'); return; }
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR ${UI.esc(lote)}</title>
      <style>body{font-family:Arial,sans-serif;text-align:center;padding:30px;color:#123c5e}h1{font-size:20px}p{color:#5f7290}
      img{width:330px;height:330px}@media print{@page{margin:15mm}}</style></head><body>
      <h1>TÓPICO SMART QR</h1><p>Lote ${UI.esc(lote)} — escanee para consultar la ficha del medicamento</p>
      <img src="${imagen}" alt="QR ${UI.esc(lote)}"><script>window.onload=function(){window.print()}<\/script>
      </body></html>`);
    ventana.document.close();
  }

  async function consultarToken(token) {
    const dato = await API.get(`/public/qr/${encodeURIComponent(extraerToken(token))}`);
    if (App && App.usuario) {
      UI.modal({ titulo: 'Medicamento identificado', subtitulo: 'Información leída desde el código QR', ancho: 760, contenido: Views.detalleQR(dato) });
    } else {
      App.mostrarPublico(dato);
    }
    return dato;
  }

  async function abrirEscaner() {
    detener();
    modalActual = UI.modal({
      titulo: 'Escanear código QR', subtitulo: 'Escanee el código impreso en el lote', ancho: 720,
      contenido: `<div id="qr-reader-modal" class="scanner"><div class="scanner__overlay"></div><div class="scanner__hint">Alinee el código QR dentro del marco</div></div>
        <div class="scanner-actions"><button class="btn btn--soft btn--sm" data-action="detener-camara"><i class="bi bi-camera-video-off"></i> Detener cámara</button>
        <button class="btn btn--ghost btn--sm" data-action="consultar-manual"><i class="bi bi-keyboard"></i> Ingresar código manualmente</button></div>`
    });
    await iniciar('qr-reader-modal', async (texto) => {
      detener();
      if (modalActual) { UI.cerrar(modalActual); modalActual = null; }
      try { await consultarToken(texto); }
      catch (err) { UI.toast(err.message, 'error'); }
    });
  }

  async function iniciar(contenedorId, alLeer) {
    if (activo) return;
    if (typeof Html5Qrcode === 'undefined') throw new Error('La librería de escaneo no está disponible.');
    const contenedor = document.getElementById(contenedorId);
    if (!contenedor) return;
    escaner = new Html5Qrcode(contenedorId, { verbose: false });
    try {
      await escaner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 260 } }, async (texto) => {
        if (alLeer) await alLeer(texto);
      }, () => { /* fotogramas sin QR */ });
      activo = true;
    } catch (err) {
      activo = false;
      throw new Error('No se pudo acceder a la cámara: ' + (err.message || 'verifique los permisos del navegador.'));
    }
  }

  async function detener() {
    if (escaner && activo) {
      try { await escaner.stop(); escaner.clear(); } catch (_) { /* ya detenido */ }
    }
    escaner = null;
    activo = false;
  }

  return { mostrar, imprimir, consultarToken, abrirEscaner, iniciar, detener, activo: () => activo, extraerToken };
})();
