/* ==========================================================================
   BLOOMCARE — Controlador principal: shell, navegacion, modulos y graficas
   ========================================================================== */

const BloomApp = (function () {
  const MENU = [
    { id: "dashboard", label: "Inicio", icono: "fa-house", seccion: "General" },
    { id: "medicamentos", label: "Medicamentos", icono: "fa-pill", seccion: "Inventario" },
    { id: "inventario", label: "Inventario", icono: "fa-box", seccion: "Inventario" },
    { id: "lotes", label: "Lotes", icono: "fa-layer-group", seccion: "Inventario" },
    { id: "alertas", label: "Alertas", icono: "fa-triangle-exclamation", seccion: "Salud" },
    { id: "historial", label: "Historial", icono: "fa-history", seccion: "Operaciones" },
    { id: "reportes", label: "Reportes", icono: "fa-chart-column", seccion: "Operaciones" },
  ];

  const TITULOS = {
    dashboard: { titulo: "BloomCare", subtitulo: "Panel principal del inventario" },
    medicamentos: { titulo: "Medicamentos", subtitulo: "Catalogo y gestion de medicamentos" },
    inventario: { titulo: "Inventario", subtitulo: "Existencias y control de stock" },
    lotes: { titulo: "Lotes", subtitulo: "Control de lotes y caducidad" },
    alertas: { titulo: "Alertas", subtitulo: "Prioridades del inventario" },
    historial: { titulo: "Historial", subtitulo: "Movimientos de inventario" },
    reportes: { titulo: "Reportes", subtitulo: "Estadisticas y graficas" },
  };

  let vistaActual = "dashboard";
  let modalMed = null;
  let modalLote = null;
  let modalCantidad = null;
  let modalDetalle = null;
  let modoFormularioMed = "crear";
  let idMedicamentoEditando = null;

  const $ = (sel) => document.querySelector(sel);
  const esc = (v) => (BloomUI && BloomUI.escapar ? BloomUI.escapar(v) : String(v ?? ""));
  const normalizar = (v) => (Store && Store.normalizar ? Store.normalizar(v) : String(v ?? "").trim());

  const construirMenu = () => {
    const nav = $("#menu-navegacion");
    if (!nav) return;
    let seccion = null;
    nav.innerHTML = MENU.map((item) => {
      const separador = item.seccion && item.seccion !== seccion ? `<div class="sidebar__section">${item.seccion}</div>` : "";
      seccion = item.seccion;
      return `${separador}<a class="nav-item ${vistaActual === item.id ? "is-active" : ""}" href="#/${item.id}" data-nav="${item.id}"><i class="${item.icono}"></i> ${item.label}</a>`;
    }).join("");
  };

  const render = (id) => {
    const area = $("#vista-contenido");
    if (!area) return;
    vistaActual = id;
    BloomViews.render(id);
    if (id === "dashboard") actualizarGraficaMovimientos();
    if (id === "reportes") actualizarGraficasReportes();
    const t = TITULOS[id] || TITULOS.dashboard;
    $("#topbar-titulo").textContent = t.titulo;
    $("#topbar-subtitulo").textContent = t.subtitulo;
    document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("is-active", el.dataset.nav === id));
    window.scrollTo({ top: 0 });
  };

  const navegar = (id) => { window.location.hash = `#/${id}`; };

  const actualizarFecha = () => {
    const el = $("#topbar-fecha");
    if (!el) return;
    el.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
  };

  const actualizarAlertasTop = () => {
    const cont = $("#contador-alertas");
    const n = Store.alertas().length;
    if (cont) {
      cont.textContent = String(n);
      cont.style.display = n ? "inline-flex" : "none";
    }
  };

  /* ------------------------------ GRAFICAS ------------------------------ */
  const actualizarGraficaMovimientos = () => {
    const canvas = $("#chart-movimientos");
    if (!canvas || typeof window.Chart === "undefined") return;
    const movimientos = Store.movimientos();
    const ahora = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      meses.push({ label: d.toLocaleDateString("es-PE", { month: "short" }), key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
    }
    const datos = meses.map((m) => movimientos.filter((mv) => String(mv.fecha || "").slice(0, 7) === m.key).length);
    BloomCharts.lineal("chart-movimientos", meses.map((m) => m.label), datos, "Movimientos");
  };

  const actualizarGraficasReportes = () => {
    const c1 = $("#chart-categorias");
    const c2 = $("#chart-tipos");
    if (typeof window.Chart === "undefined") return;
    const datos = Store.resumen().porCategoria || [];
    const top = datos.slice(0, 6);
    BloomCharts.barras("chart-categorias", top.map((c) => c.nombre), top.map((c) => Number(c.unidades) || 0), "Unidades");
    const movimientos = Store.movimientos();
    const porTipo = {};
    movimientos.forEach((m) => { const k = m.tipo || "otro"; porTipo[k] = (porTipo[k] || 0) + 1; });
    const tipos = Object.keys(porTipo);
    BloomCharts.barras("chart-tipos", tipos.map((t) => t.replace(/_/g, " ")), tipos.map((t) => Number(porTipo[t]) || 0), "Movimientos");
  };

  /* --------------------------- MEDICAMENTOS ----------------------------- */
  const cerrarModalMedicamento = () => { if (modalMed) { modalMed.remove(); modalMed = null; } };

  const abrirFormularioMedicamento = (edicion) => {
    const m = edicion ? Store.medicamentos().find((x) => x.id === edicion) || null : null;
    idMedicamentoEditando = edicion || null;
    modoFormularioMed = edicion ? "editar" : "crear";
    const overlay = BloomUI.abrirModal({
      titulo: edicion ? "Editar medicamento" : "Registrar medicamento",
      contenido: BloomViews.formularioMedicamento(m),
      acciones: [],
    });
    modalMed = overlay;
    const form = overlay.querySelector("#form-med");
    overlay.querySelector("[data-cerrar-form]")?.addEventListener("click", () => cerrarModalMedicamento());
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const datos = Object.fromEntries(new FormData(form));
        const payload = {
          codigo: normalizar(datos.codigo),
          nombre: normalizar(datos.nombre),
          categoria: normalizar(datos.categoria) || null,
          principioActivo: normalizar(datos.principioActivo),
          concentracion: normalizar(datos.concentracion),
          presentacion: normalizar(datos.presentacion),
          lote: normalizar(datos.lote),
          fechaVencimiento: normalizar(datos.fechaVencimiento) || null,
          stock: Math.max(0, Number(datos.stock) || 0),
          minStock: Math.max(0, Number(datos.minStock) || 0),
          precio: Math.max(0, Number(datos.precio) || 0),
          unidad: normalizar(datos.unidad),
          imagen: normalizar(datos.imagen),
          activo: true,
        };
        if (modoFormularioMed === "editar") Store.guardarMedicamento({ ...payload, id: idMedicamentoEditando });
        else Store.guardarMedicamento(payload);
        BloomUI.notificacion(modoFormularioMed === "editar" ? "Medicamento actualizado correctamente." : "Medicamento registrado correctamente.", "success");
        cerrarModalMedicamento();
        render(vistaActual);
        actualizarAlertasTop();
      });
    }
  };

  const verDetalleMedicamento = (id) => {
    const m = Store.medicamentos().find((x) => String(x.id) === String(id));
    if (!m) return;
    const cat = (Store.categorias().find((c) => String(c.id) === String(m.categoria) || c.nombre === m.categoria) || {}).nombre || m.categoria || "Sin categoría";
    const img = m.imagen ? `<img src="${esc(m.imagen)}" alt="${esc(m.nombre)}" style="width:96px;height:96px;object-fit:cover;border-radius:16px;border:1px solid var(--line-soft);background:var(--blue-050)" onerror="this.style.display='none'">` : `<div style="width:96px;height:96px;border-radius:16px;display:grid;place-items:center;background:var(--blue-050);border:1px solid var(--line-soft);color:var(--blue-600);font-size:28px"><i class="fa-solid fa-pills"></i></div>`;
    const overlay = BloomUI.abrirModal({
      titulo: "Detalle del medicamento",
      contenido: `
        <div class="stack">
          <div class="row" style="align-items:flex-start;gap:14px">${img}<div class="grow"><div class="row row--between"><h3 class="mt-0 mb-0">${esc(m.nombre)}</h3><span class="badge badge--blue mono">${esc(m.codigo)}</span></div><p class="muted small mb-0">${esc(m.principioActivo || "")} ${esc(m.concentracion || "")} · ${esc(m.presentacion || "")}</p><p class="muted small mb-0">Categoría: ${esc(cat)}</p></div></div>
          <div class="grid grid--2" style="gap:12px">
            <div class="card" style="box-shadow:none"><div class="small muted">Lote</div><div class="mt-0" style="font-weight:700">${esc(m.lote || "Sin lote")}</div></div>
            <div class="card" style="box-shadow:none"><div class="small muted">Vencimiento</div><div class="mt-0" style="font-weight:700">${BloomUI.formatearFecha(m.fechaVencimiento)}</div></div>
            <div class="card" style="box-shadow:none"><div class="small muted">Stock actual</div><div class="mt-0" style="font-weight:700">${Number(m.stock) || 0} ${esc(m.unidad || "")}</div></div>
            <div class="card" style="box-shadow:none"><div class="small muted">Stock minimo</div><div class="mt-0" style="font-weight:700">${Number(m.minStock) || 0}</div></div>
          </div>
        </div>`,
      acciones: [{ etiqueta: "Cerrar", clase: "btn btn--soft" }],
    });
    modalDetalle = overlay;
    overlay.querySelector("[data-accion='Cerrar']")?.addEventListener("click", () => { if (modalDetalle) { modalDetalle.remove(); modalDetalle = null; } });
  };

  const confirmarEliminarMedicamento = (id) => {
    const overlay = BloomUI.abrirModal({
      titulo: "Eliminar medicamento",
      contenido: `<p class="muted">¿Estás seguro de eliminar este medicamento del inventario? Esta acción no se puede deshacer.</p>`,
      acciones: [
        { etiqueta: "Cancelar", clase: "btn btn--ghost" },
        { etiqueta: "Eliminar", clase: "btn btn--danger" },
      ],
    });
    overlay.querySelectorAll("[data-accion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.etiqueta === "Eliminar") {
          Store.eliminarMedicamento(id);
          BloomUI.notificacion("Medicamento eliminado correctamente.", "info");
          render(vistaActual);
          actualizarAlertasTop();
        }
        if (overlay.parentNode) overlay.remove();
      });
    });
  };

  /* ------------------------------- LOTES -------------------------------- */
  const cerrarModalLote = () => { if (modalLote) { modalLote.remove(); modalLote = null; } };

  const abrirFormularioLote = () => {
    const overlay = BloomUI.abrirModal({
      titulo: "Registrar lote",
      contenido: `
        <form id="form-lote" novalidate>
          <div class="field"><label class="field__label">Numero de lote</label><input class="input" name="numeroLote" required placeholder="LOTE-2026-002"></div>
          <div class="field mt-16"><label class="field__label">Medicamento</label><select class="select" name="medicamentoId" required><option value="">Selecciona un medicamento</option>${Store.medicamentos().map((m) => `<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join("")}</select></div>
          <div class="field mt-16"><label class="field__label">Fecha de vencimiento</label><input class="input" type="date" name="fechaVencimiento" required></div>
          <div class="field mt-16"><label class="field__label">Cantidad</label><input class="input" type="number" min="1" name="cantidad" value="1" required></div>
          <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-form-lote>Cancelar</button><button type="submit" class="btn btn--primary">Guardar lote</button></div>
        </form>`,
      acciones: [],
    });
    modalLote = overlay;
    overlay.querySelector("[data-cerrar-form-lote]")?.addEventListener("click", () => cerrarModalLote());
    const form = overlay.querySelector("#form-lote");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const datos = Object.fromEntries(new FormData(form));
        Store.guardarLote({
          numeroLote: normalizar(datos.numeroLote),
          medicamentoId: normalizar(datos.medicamentoId) || null,
          fechaVencimiento: normalizar(datos.fechaVencimiento) || null,
          cantidad: Math.max(1, Number(datos.cantidad) || 1),
        });
        BloomUI.notificacion("Lote registrado correctamente.", "success");
        cerrarModalLote();
        render(vistaActual);
      });
    }
  };

  const confirmarEliminarLote = (id) => {
    const overlay = BloomUI.abrirModal({
      titulo: "Eliminar lote",
      contenido: `<p class="muted">¿Estás seguro de eliminar este lote?</p>`,
      acciones: [{ etiqueta: "Cancelar", clase: "btn btn--ghost" }, { etiqueta: "Eliminar", clase: "btn btn--danger" }],
    });
    overlay.querySelectorAll("[data-accion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.etiqueta === "Eliminar") {
          Store.eliminarLote(id);
          BloomUI.notificacion("Lote eliminado.", "info");
          render(vistaActual);
        }
        if (overlay.parentNode) overlay.remove();
      });
    });
  };

  /* ---------------------------- INVENTARIO ------------------------------ */
  const cerrarModalCantidad = () => { if (modalCantidad) { modalCantidad.remove(); modalCantidad = null; } };

  const abrirCantidad = (m, tipo) => {
    const overlay = BloomUI.abrirModal({
      titulo: tipo === "entrada" ? "Entrada de stock" : "Salida de stock",
      contenido: `
        <div class="field"><label class="field__label">Cantidad</label><input class="input" type="number" min="1" value="1" id="cantidad-modal"></div>
        <div class="form-actions"><button type="button" class="btn btn--ghost" id="cerrar-cantidad">Cancelar</button><button type="button" class="btn btn--primary" id="confirmar-cantidad">Confirmar</button></div>`,
      acciones: [],
    });
    modalCantidad = overlay;
    overlay.querySelector("#cerrar-cantidad")?.addEventListener("click", () => cerrarModalCantidad());
    overlay.querySelector("#confirmar-cantidad")?.addEventListener("click", () => {
      const input = overlay.querySelector("#cantidad-modal");
      const cantidad = Math.max(1, Number(input?.value) || 1);
      Store.registrarMovimiento({ medicamentoId: m.id, tipo, cantidad, lote: m.lote, observacion: tipo === "entrada" ? "Entrada de stock" : "Salida de stock" });
      BloomUI.notificacion(tipo === "entrada" ? "Entrada de stock registrada." : "Salida de stock registrada.", "success");
      cerrarModalCantidad();
      render(vistaActual);
      actualizarAlertasTop();
    });
  };

  /* -------------------------------- QR --------------------------------- */
  const cerrarQrPanel = () => { const el = $("#qr-panel"); if (el) el.style.display = "none"; };

  const generarQr = async () => {
    const sel = $("#qr-med");
    const img = $("#qr-imagen");
    const descargar = $("#qr-descargar");
    const m = Store.medicamentos().find((x) => String(x.id) === String(sel?.value));
    if (!m) { BloomUI.notificacion("Selecciona un medicamento para generar el codigo QR.", "warn"); return; }
    const res = await BloomQR.generar(`${m.nombre}|${m.codigo}|${m.lote || ""}`);
    if (!res.ok) { BloomUI.notificacion("No fue posible generar el codigo QR.", "error"); return; }
    img.src = res.dataUrl;
    if (descargar) descargar.disabled = false;
    if (descargar) descargar.onclick = () => { const a = document.createElement("a"); a.href = res.dataUrl; a.download = `bloomcare_${m.codigo || "med"}.png`; a.click(); };
  };

  /* ------------------------------- VOZ ---------------------------------- */
  const abrirPanelVoz = () => {
    const panel = $("#voice-panel");
    if (!panel) return;
    panel.style.display = "block";
    const log = $("#voice-log");
    if (log && !log.children.length) {
      log.innerHTML = `<div class="voice-msg">Asistente listo. Puedes preguntar por medicamentos, stock bajo, vencidos o próximos a vencer.</div>`;
    }
    if (!BloomVoz.iniciar) return;
    const agregar = (texto, clase = "") => {
      const el = document.createElement("div");
      el.className = `voice-msg ${clase}`.trim();
      el.textContent = texto;
      log?.appendChild(el);
      if (log) log.scrollTop = log.scrollHeight;
    };
    const manejador = (e) => {
      const texto = e.detail?.texto || "";
      if (texto) agregar(texto, "voice-msg--user");
      const respuesta = BloomVoz.responder ? BloomVoz.responder(texto) : "";
      if (respuesta) agregar(respuesta);
    };
    window.removeEventListener("bloomvoz:codigo", window.__bloomVozHandler || (() => {}));
    window.__bloomVozHandler = manejador;
    window.addEventListener("bloomvoz:codigo", manejador);
    BloomVoz.iniciar();
  };

  /* ------------------------------- INIT --------------------------------- */
  const init = () => {
    construirMenu();
    const h = window.location.hash.replace(/^#\//, "");
    render(Object.keys(TITULOS).includes(h) ? h : "dashboard");
    actualizarFecha();
    actualizarAlertasTop();
    document.addEventListener("hashchange", () => {
      const h = window.location.hash.replace(/^#\//, "");
      if (Object.keys(TITULOS).includes(h)) render(h);
      else render("dashboard");
    });
    document.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-nav]");
      if (nav) { e.preventDefault(); navegar(nav.dataset.nav); document.querySelector("#sidebar")?.classList.remove("is-open"); return; }
      const abrirMenu = e.target.closest("#abrir-menu");
      if (abrirMenu) { document.querySelector("#sidebar")?.classList.add("is-open"); return; }
      const cerrarMenu = e.target.closest("#scrim");
      if (cerrarMenu) { document.querySelector("#sidebar")?.classList.remove("is-open"); return; }
      const abrirMed = e.target.closest("[data-abrir-form-med]");
      if (abrirMed) { abrirFormularioMedicamento(null); return; }
      const editar = e.target.closest("[data-edit-med]");
      if (editar) { abrirFormularioMedicamento(editar.dataset.editMed); return; }
      const ver = e.target.closest("[data-ver-med]");
      if (ver) { verDetalleMedicamento(ver.dataset.verMed); return; }
      const eliminar = e.target.closest("[data-eliminar-med]");
      if (eliminar) { confirmarEliminarMedicamento(eliminar.dataset.eliminarMed); return; }
      const entrada = e.target.closest("[data-entrada-med]");
      if (entrada) { const m = Store.medicamentos().find((x) => String(x.id) === String(entrada.dataset.entradaMed)); if (m) abrirCantidad(m, "entrada"); return; }
      const salida = e.target.closest("[data-salida-med]");
      if (salida) { const m = Store.medicamentos().find((x) => String(x.id) === String(salida.dataset.salidaMed)); if (m) abrirCantidad(m, "salida"); return; }
      const abrirLote = e.target.closest("[data-abrir-form-lote]");
      if (abrirLote) { abrirFormularioLote(); return; }
      const eliminarLoteBtn = e.target.closest("[data-eliminar-lote]");
      if (eliminarLoteBtn) { confirmarEliminarLote(eliminarLoteBtn.dataset.eliminarLote); return; }
      const abrirQr = e.target.closest("#abrir-qr");
      if (abrirQr) { const el = $("#qr-panel"); if (el) el.style.display = "block"; llenarSelectQr(); return; }
      const escanearBtn = e.target.closest("#qr-escanear");
      if (escanearBtn) { escanearQr(); return; }
      const cerrarQr = e.target.closest("#cerrar-qr-panel");
      if (cerrarQr) { cerrarQrPanel(); return; }
      const activarVoz = e.target.closest("#activar-voz");
      if (activarVoz) { abrirPanelVoz(); return; }
      const cerrarVoz = e.target.closest("#cerrar-voz");
      if (cerrarVoz) { const panel = $("#voice-panel"); if (panel) panel.style.display = "none"; return; }
      const abrirVozTop = e.target.closest("#abrir-voz");
      if (abrirVozTop) { abrirPanelVoz(); return; }
      const fabVoz = e.target.closest("#fab-voz");
      if (fabVoz) { abrirPanelVoz(); return; }
      const verAlertasTop = e.target.closest("#abrir-alertas-top");
      if (verAlertasTop) { navegar("alertas"); return; }
      const salir = e.target.closest("#salir");
      if (salir) { Store.usuario({ nombre: "Dra. Solís", rol: "Farmacéutico responsable" }); BloomUI.notificacion("Sesion finalizada.", "info"); navegar("dashboard"); return; }
      const imprimir = e.target.closest("[data-imprimir]");
      if (imprimir) { window.print(); return; }
    });
    document.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "buscador-med") { BloomViews.tablaMedicamentos(); }
      if (t.id === "filtro-categoria" || t.id === "filtro-estado") { BloomViews.tablaMedicamentos(); }
      if (t.id === "buscador-inventario") { /* se puede extender */ }
    });
    window.addEventListener("bloomqr:error", (e) => { BloomUI.notificacion(e.detail?.mensaje || "Error al acceder a la cámara.", "error"); if (modalCantidad) cerrarModalCantidad(); });
  };

  const escanearQr = () => {
    const contenedor = $("#bloom-qr-region");
    if (contenedor) {
      contenedor.style.display = "block";
      contenedor.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    BloomQR.escanear((texto) => {
      const partes = String(texto || "").split("|");
      const codigo = (partes[1] || "").trim();
      const nombre = (partes[0] || "").trim();
      const m = Store.medicamentos().find((x) => x.codigo === codigo || x.nombre === nombre);
      if (contenedor) contenedor.style.display = "none";
      if (m) BloomUI.notificacion(`Medicamento identificado: ${m.nombre}`, "success");
      else BloomUI.notificacion("No se encontro el medicamento en el catalogo.", "warn");
    });
  };

  const llenarSelectQr = () => {
    const sel = $("#qr-med");
    if (!sel) return;
    sel.innerHTML = Store.medicamentos().map((m) => `<option value="${m.id}">${m.nombre} (${m.codigo})</option>`).join("") || `<option value="">Sin medicamentos</option>`;
    if (sel.value) generarQr();
  };

  return { render, navegar, init, llenarSelectQr };
})();

// Inicializacion de la shell
document.addEventListener("DOMContentLoaded", () => {
  BloomApp.init();
});
