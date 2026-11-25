/* TÓPICO SMART QR — Utilidades de interfaz */
const UI = (function () {
  const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const sumarDias = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const diasHasta = (fecha) => {
    if (!fecha) return null;
    return Math.round((new Date(`${String(fecha).slice(0, 10)}T12:00:00`) - new Date(`${hoyISO()}T12:00:00`)) / 86400000);
  };

  const fechaLarga = (valor) => {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fechaHora = (valor) => {
    if (!valor) return '—';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const badgeVencimiento = (fecha) => {
    if (!fecha) return '<span class="badge badge--gray">Sin fecha</span>';
    const dias = diasHasta(fecha);
    if (dias < 0) return `<span class="badge badge--red">Vencido</span>`;
    if (dias <= 7) return `<span class="badge badge--red">Vence en ${dias} d</span>`;
    if (dias <= 30) return `<span class="badge badge--amber">Vence en ${dias} d</span>`;
    if (dias <= 90) return `<span class="badge badge--violet">Vence en ${dias} d</span>`;
    return '<span class="badge badge--green">Vigente</span>';
  };

  const badgeStock = (cantidad, minimo) => {
    const c = Number(cantidad) || 0;
    const m = Number(minimo) || 0;
    if (c === 0) return '<span class="badge badge--red">Agotado</span>';
    if (c <= m) return '<span class="badge badge--amber">Stock bajo</span>';
    return '<span class="badge badge--green">Normal</span>';
  };

  const badgeTipo = (tipo) => {
    const mapa = { entrada: 'green', salida: 'blue', ajuste: 'violet' };
    const etiqueta = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste' };
    return `<span class="badge badge--${mapa[tipo] || 'gray'}"><i class="bi bi-${tipo === 'entrada' ? 'arrow-down-left' : tipo === 'salida' ? 'arrow-up-right' : 'sliders'}"></i> ${etiqueta[tipo] || esc(tipo)}</span>`;
  };

  const badgeNivel = (nivel) => {
    const mapa = { critico: ['red', 'Crítico'], advertencia: ['amber', 'Advertencia'], info: ['blue', 'Información'] };
    const [color, texto] = mapa[nivel] || mapa.info;
    return `<span class="badge badge--${color}">${texto}</span>`;
  };

  const empty = (titulo, descripcion, icono = 'bi-inbox') => `
    <div class="empty"><div class="empty__icon"><i class="bi ${icono}"></i></div>
      <div class="empty__title">${esc(titulo)}</div><div class="empty__desc">${esc(descripcion)}</div></div>`;

  function toast(mensaje, tipo = 'success', titulo = '') {
    const stack = document.querySelector('#toast-stack');
    if (!stack) return;
    const color = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', warn: 'bi-exclamation-triangle-fill' }[tipo] || 'bi-info-circle-fill';
    const el = document.createElement('div');
    el.className = `toast toast--${tipo} fade-in`;
    el.innerHTML = `<i class="bi ${color}" style="color:${tipo === 'error' ? '#b0503f' : tipo === 'warn' ? '#a06f1f' : '#237a5e'};font-size:18px"></i>
      <div><div class="toast__title">${esc(titulo || (tipo === 'error' ? 'Error' : tipo === 'warn' ? 'Atención' : 'Listo'))}</div>
      <div class="toast__msg">${esc(mensaje)}</div></div>`;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4200);
  }

  async function confirmar({ titulo, texto, icono = 'question', confirmText = 'Sí, continuar', danger = false }) {
    const result = await Swal.fire({
      title: titulo, text: texto, icon: icono, showCancelButton: true,
      confirmButtonText: confirmText, cancelButtonText: 'Cancelar',
      confirmButtonColor: danger ? '#cf6a5e' : '#5f93c6',
      cancelButtonColor: '#8fa2b8', reverseButtons: true
    });
    return result.isConfirmed;
  }

  function modal({ titulo, subtitulo = '', contenido = '', footer = '', ancho = 640, printable = false }) {
    const root = document.querySelector('#modal-root');
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay${printable ? ' printable' : ''}`;
    overlay.innerHTML = `
      <div class="modal" style="width:min(${ancho}px,100%)" role="dialog" aria-modal="true">
        <div class="modal__header no-print"><div><div class="modal__title">${esc(titulo)}</div>
        ${subtitulo ? `<div class="card__subtitle">${esc(subtitulo)}</div>` : ''}</div>
        <button class="modal__close" type="button" data-cerrar-modal aria-label="Cerrar"><i class="bi bi-x-lg"></i></button></div>
        <div class="modal__body">${contenido}</div>
        ${footer ? `<div class="modal__footer no-print">${footer}</div>` : ''}
      </div>`;
    root.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.closest('[data-cerrar-modal]')) cerrar(overlay); });
    return overlay;
  }

  function cerrar(elemento) {
    if (!elemento) return;
    elemento.style.opacity = '0';
    elemento.style.transition = 'opacity .18s';
    setTimeout(() => elemento.remove(), 180);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const abiertos = document.querySelectorAll('#modal-root .modal-overlay');
      if (abiertos.length) cerrar(abiertos[abiertos.length - 1]);
    }
  });

  return { esc, hoyISO, sumarDias, diasHasta, fechaLarga, fechaHora, badgeVencimiento, badgeStock, badgeTipo, badgeNivel,
    empty, toast, confirmar, modal, cerrar };
})();
