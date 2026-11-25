/* ==========================================================================
   BLOOMCARE — Utilidades de interfaz (toasts, modales, badges, formatos)
   ========================================================================== */

const BloomUI = (function () {
  const colas = { success: [], error: [], info: [], warn: [] };
  let contador = 0;

  const escapar = (valor) =>
    String(valor ?? "")
      .replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[c]));

  const formatearFecha = (iso) => {
    if (!iso) return "—";
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatearFechaHora = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const formatoMoneda = (valor) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", maximumFractionDigits: 2 }).format(Number(valor) || 0);

  const badge = (tipo, texto) => {
    const clase = String(tipo || "").startsWith("badge--") ? String(tipo) : `badge--${tipo}`;
    return `<span class="${clase}">${escapar(texto)}</span>`;
  };

  const notificacion = (mensaje, tipo = "info") => {
    const id = ++contador;
    const toast = document.createElement("div");
    toast.className = `toast toast--${tipo}`;
    toast.innerHTML = `<div class="row" style="align-items:flex-start"><div class="grow"><div class="toast__title">${escapar(mensaje)}</div><div class="toast__msg">Aviso del sistema BloomCare</div></div><button class="icon-btn" style="width:26px;height:26px;border:none;background:transparent" data-close-toast="${id}">&times;</button></div>`;
    colas[tipo].push({ id, el: toast });
    const stack = document.querySelector(".toast-stack");
    if (stack) {
      stack.appendChild(toast);
      setTimeout(() => toast.remove(), 5200);
    } else {
      return;
    }
    setTimeout(() => {
      const item = colas[tipo].find((x) => x.id === id);
      if (item && item.el && item.el.parentNode) item.el.remove();
      colas[tipo] = colas[tipo].filter((x) => x.id !== id);
    }, 5600);
    document.addEventListener("click", (e) => {
      const cerrar = e.target.closest("[data-close-toast]");
      if (!cerrar) return;
      const toastEl = cerrar.closest(".toast");
      if (toastEl) toastEl.remove();
      colas[tipo] = colas[tipo].filter((x) => x.id !== Number(cerrar.dataset.closeToast));
    });
  };

  const abrirModal = ({ titulo = "Detalle", contenido = "", acciones = [] } = {}) => {
    const anterior = document.querySelector(".modal-overlay");
    if (anterior) anterior.remove();
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="bloom-modal-titulo">
        <div class="modal__header">
          <h3 class="modal__title" id="bloom-modal-titulo">${escapar(titulo)}</h3>
          <button class="modal__close" type="button" data-close-modal aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal__body">${contenido}</div>
        ${acciones.length ? `<div class="modal__footer">${acciones.map((a) => `<button type="button" class="${a.clase || "btn"}" data-accion="${escapar(a.etiqueta || a.label || "")}">${escapar(a.label || a.etiqueta || "")}</button>`).join("")}</div>` : ""}
      </div>`;
    document.body.appendChild(overlay);
    const cerrar = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });
    overlay.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });
    overlay.querySelector("[data-close-modal]")?.addEventListener("click", cerrar);
    acciones.forEach((a) => {
      overlay.querySelector(`[data-accion="${a.etiqueta}"]`)?.addEventListener("click", () => {
        cerrar();
        if (typeof a.accion === "function") a.accion();
      });
    });
    return overlay;
  };

  const cerrarModal = () => document.querySelector(".modal-overlay")?.remove();

  const vacio = (icono = "🧪", titulo = "Sin registros", descripcion = "Todavía no hay información registrada para mostrar.") =>
    `<div class="empty"><div class="empty__icon">${icono}</div><div class="empty__title">${escapar(titulo)}</div><div class="empty__desc">${escapar(descripcion)}</div></div>`;

  return { escapar, formatearFecha, formatearFechaHora, formatoMoneda, badge, notificacion, abrirModal, cerrarModal, vacio };
})();
