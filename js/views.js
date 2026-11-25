/* ==========================================================================
   BLOOMCARE — Vistas de la aplicacion (dashboard, medicamentos, lotes, etc.)
   ========================================================================== */

const BloomViews = (function () {
  const contenido = () => document.querySelector("#vista-contenido");
  const nombreCategoria = (id) => {
    const c = Store.categorias().find((x) => String(x.id) === String(id) || x.nombre === id);
    return c ? c.nombre : (id || "Sin categoría");
  };
  const imgMed = (m, cls = "med-thumb") => m.imagen
    ? `<img class="${cls}" src="${esc(m.imagen)}" alt="${esc(m.nombre)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="${cls} ${cls}--placeholder" style="display:none"><i class="fa-solid fa-pills"></i></div>`
    : `<div class="${cls} ${cls}--placeholder"><i class="fa-solid fa-pills"></i></div>`;
  const esc = BloomUI.escapar;
  const hoyIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const estadoLote = (fechaV) => {
    const f = String(fechaV || "").slice(0, 10);
    if (!f) return { clave: "sin_fecha", etiqueta: "Sin fecha", clase: "badge--gray" };
    if (f < hoyIso()) return { clave: "vencido", etiqueta: "Vencido", clase: "badge--red" };
    const fin = new Date(); fin.setDate(fin.getDate() + 30);
    const hasta = `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, "0")}-${String(fin.getDate()).padStart(2, "0")}`;
    if (f > hasta) return { clave: "vigente", etiqueta: "Vigente", clase: "badge--green" };
    return { clave: "proximo", etiqueta: "Proximo a vencer", clase: "badge--amber" };
  };

  const barraStock = (stock, min) => {
    const total = Number(min) || 1;
    const actual = Number(stock) || 0;
    const pct = Math.max(0, Math.min(100, (actual / total) * 100));
    const clase = actual <= 0 ? "stock-bar__fill--out" : actual <= (Number(min) || 0) ? "stock-bar__fill--low" : "";
    return `<div class="stock-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><div class="stock-bar__fill ${clase}" style="width:${pct}%"></div></div>`;
  };

  const iconoAlerta = (severidad) =>
    severidad === "danger" ? "fa-circle-exclamation" : severidad === "warn" ? "fa-triangle-exclamation" : "fa-circle-info";

  /* ------------------------------ DASHBOARD ------------------------------ */
  const vistaDashboard = () => {
    const datos = Store.resumen();
    const medicamentos = Store.medicamentos();
    const alertas = Store.alertas();
    const usuario = Store.usuario();
    const primerNombre = (usuario.nombre || "Equipo").split(" ")[0];
    const recientes = [...medicamentos].sort((a, b) => String(b.fechaVencimiento || "").localeCompare(String(a.fechaVencimiento || ""))).slice(0, 5);

    return `
      <section class="view" id="vista-dashboard">
        <div class="welcome">
          <div class="welcome__inner">
            <div class="welcome__text">
              <h2 class="welcome__greeting">Bienvenido, ${esc(primerNombre)}</h2>
              <div class="welcome__date"><svg class="welcome__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h-5v4h4v-4Zm0-7h-4v4h4V7Z" fill="#fff"/></svg> ${esc(new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</div>
              <p class="welcome__desc">Gestiona el inventario farmaceutico institucional con seguimiento de stock, lotes y vencimientos.</p>
              <div class="welcome__decor" aria-hidden="true"><svg viewBox="0 0 100 100" width="80"><path d="M18 18L82 82" stroke="#fff" stroke-width="4" opacity="0.5"/><circle cx="58" cy="42" r="14" fill="#fff" fill-opacity="0.25"/><circle cx="30" cy="68" r="10" fill="#fff" fill-opacity="0.35"/></svg></div>
            </div>
            <div class="welcome__actions">
              <button class="btn btn--primary" data-nav="medicamentos"><i class="fa-solid fa-plus"></i> Registrar medicamento</button>
              <button class="btn btn--light" data-nav="alertas"><i class="fa-solid fa-triangle-exclamation"></i> Ver alertas</button>
            </div>
          </div>
        </div>

        <div class="grid grid--stats mt-16">
          <article class="stat-card">
            <div class="stat-card__top"><span class="stat-card__label">Medicamentos registrados</span><span class="stat-card__icon"><i class="fa-solid fa-pill"></i></span></div>
            <div class="stat-card__value">${datos.total}</div>
            <span class="stat-card__hint">En el catalogo institucional</span>
          </article>
          <article class="stat-card">
            <div class="stat-card__top"><span class="stat-card__label">Disponibles</span><span class="stat-card__icon"><i class="fa-solid fa-box-open"></i></span></div>
            <div class="stat-card__value">${datos.disponibles}</div>
            <span class="stat-card__hint">Con stock mayor a cero</span>
          </article>
          <article class="stat-card">
            <div class="stat-card__top"><span class="stat-card__label">Stock bajo</span><span class="stat-card__icon stat-card__icon--amber"><i class="fa-solid fa-triangle-exclamation"></i></span></div>
            <div class="stat-card__value">${datos.conStockBajo}</div>
            <span class="stat-card__hint">Minimo de reabastecimiento</span>
          </article>
          <article class="stat-card">
            <div class="stat-card__top"><span class="stat-card__label">Proximos a vencer</span><span class="stat-card__icon stat-card__icon--violet"><i class="fa-solid fa-clock"></i></span></div>
            <div class="stat-card__value">${datos.proximosVencer}</div>
            <span class="stat-card__hint">Vencen en los proximos 30 dias</span>
          </article>
          <article class="stat-card">
            <div class="stat-card__top"><span class="stat-card__label">Vencidos</span><span class="stat-card__icon stat-card__icon--red"><i class="fa-solid fa-circle-exclamation"></i></span></div>
            <div class="stat-card__value">${datos.vencidos}</div>
            <span class="stat-card__hint">Por caducidad</span>
          </article>
        </div>

        <div class="grid grid--dashboard mt-16">
          <div class="stack">
            <div class="card">
              <div class="card__header">
                <div><h3 class="card__title">Movimientos recientes</h3><p class="card__subtitle">Consultas y entradas de los ultimos movimientos registrados</p></div>
                <div class="card__actions"><button class="btn btn--soft btn--sm" data-nav="historial">Ver historial</button></div>
              </div>
              <div class="chart-box"><canvas id="chart-movimientos"></canvas></div>
            </div>
            <div class="card">
              <div class="card__header">
                <div><h3 class="card__title">Medicamentos recientes</h3><p class="card__subtitle">Ultimos registros con indicadores de stock</p></div>
                <div class="card__actions"><button class="btn btn--soft btn--sm" data-nav="medicamentos">Gestionar</button></div>
              </div>
              <div class="table-wrap"><table class="table">
                <thead><tr><th>Medicamento</th><th>Lote</th><th>Vencimiento</th><th>Stock</th><th>Estado</th></tr></thead>
                <tbody>${recientes.map((m) => { const st = estadoLote(m.fechaVencimiento); return `
                    <tr>
                      <td><div class="med-cell">${imgMed(m)}<div><strong>${esc(m.nombre)}</strong><div class="small muted">${esc(m.codigo)}</div></div></div></td>
                      <td>${esc(m.lote || "—")}</td>
                      <td>${BloomUI.formatearFecha(m.fechaVencimiento)}</td>
                      <td class="num"><span class="med-row__qty">${Number(m.stock) || 0}</span> ${esc(m.unidad || "")}</td>
                      <td>${BloomUI.badge(st.clase, st.etiqueta)}</td>
                    </tr>`; }).join("") || `<tr><td colspan="5"><div class="empty"><div class="empty__icon">🌿</div><div class="empty__title">Sin medicamentos</div><div class="empty__desc">Registra el primer medicamento para comenzar el control de inventario.</div></div></td></tr>`}</tbody>
              </table></div>
            </div>
          </div>
          <div class="stack">
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Alertas prioritarias</h3><p class="card__subtitle">Vencimientos, stock bajo y agotes</p></div><div class="card__actions"><button class="btn btn--soft btn--sm" data-nav="alertas">Todas</button></div></div>
              <div class="alert-list">
                ${alertas.slice(0, 4).map((a) => `
                  <div class="alert-item alert-item--${a.severidad}">
                    <div class="alert-item__icon alert-item__icon--${a.severidad}"><i class="fa-solid ${iconoAlerta(a.severidad)}"></i></div>
                    <div class="grow"><div class="alert-item__title">${esc(a.titulo)}</div><div class="alert-item__desc">${esc(a.descripcion)}</div></div>
                    <div class="alert-item__meta"><span class="badge badge--${a.severidad}">${esc(a.tipo.replace(/_/g, " "))}</span></div>
                  </div>`).join("") || `<div class="empty"><div class="empty__icon">🌿</div><div class="empty__title">Sin alertas activas</div><div class="empty__desc">El inventario se encuentra en condiciones normales.</div></div>`}
              </div>
            </div>
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Resumen por categoria</h3><p class="card__subtitle">Medicamentos y unidades en stock</p></div></div>
              <div class="stack" style="gap:12px">${(datos.porCategoria || []).map((c) => `
                <div key="${c.id}">
                  <div class="row row--between"><span class="small" style="font-weight:650">${esc(c.nombre)}</span><span class="small muted">${c.medicamentos} medicamentos · ${c.unidades} unidades</span></div>
                  <div class="stock-bar mt-16"><div class="stock-bar__fill" style="width:${Math.min(100, (c.unidades / Math.max(1, datos.total || 1)) * 100)}%"></div></div>
                </div>`).join("") || `<p class="muted small mb-0">Sin categorias registradas.</p>`}</div>
            </div>
          </div>
        </div>
      </section>`;
  };

  /* ----------------------------- MEDICAMENTOS ---------------------------- */
  const vistaMedicamentos = () => {
    const medicamentos = [...Store.medicamentos()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    return `
      <div class="toolbar no-print">
        <div class="search"><i class="fa-solid fa-magnifying-glass"></i><input class="input" id="buscador-med" placeholder="Buscar por nombre, codigo o principio activo..."></div>
        <select class="select" id="filtro-categoria"><option value="">Todas las categorias</option>${Store.categorias().map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select>
        <select class="select" id="filtro-estado"><option value="">Todos los estados</option><option value="vigente">Vigente</option><option value="proximo">Proximo a vencer</option><option value="vencido">Vencido</option><option value="agotado">Agotado</option></select>
        <button class="btn btn--primary" id="abrir-form-med" data-abrir-form-med><i class="fa-solid fa-plus"></i> Registrar medicamento</button>
      </div>
      <div class="card">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Codigo</th><th>Medicamento</th><th>Categoria</th><th>Lote</th><th>Vencimiento</th><th>Stock</th><th>Estado</th><th></th></tr></thead>
          <tbody id="tabla-med">${medicamentos.map((m) => {
            const st = estadoLote(m.fechaVencimiento);
            const stock = Number(m.stock) || 0;
            const min = Number(m.minStock) || 0;
            const clase = stock <= 0 ? "badge--red" : stock <= min ? "badge--amber" : "badge--green";
            const etiqueta = stock <= 0 ? "Agotado" : stock <= min ? "Stock bajo" : "Disponible";
            return `<tr>
              <td class="mono">${esc(m.codigo)}</td>
              <td><div class="med-cell">${imgMed(m)}<div><strong>${esc(m.nombre)}</strong><div class="small muted">${esc(m.principioActivo || "")} ${esc(m.concentracion || "")}</div></div></td>
              <td>${esc(nombreCategoria(m.categoria))}</td>
              <td>${esc(m.lote || "—")}</td>
              <td>${BloomUI.formatearFecha(m.fechaVencimiento)}</td>
              <td class="num"><span class="med-row__qty">${stock}</span> ${esc(m.unidad || "")}</td>
              <td><span class="badge ${clase}">${etiqueta}</span></td>
              <td><div class="row-actions">
                <button class="icon-btn" data-ver-med="${m.id}" title="Ver detalle" aria-label="Ver detalle"><i class="fa-solid fa-eye"></i></button>
                <button class="icon-btn" data-edit-med="${m.id}" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="icon-btn icon-btn--danger" data-eliminar-med="${m.id}" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
              </div></td>
            </tr>`;
          }).join("") || `<tr><td colspan="8"><div class="empty"><div class="empty__icon">🌿</div><div class="empty__title">Sin medicamentos</div><div class="empty__desc">Registra el primer medicamento para comenzar el control de inventario.</div></div></td></tr>`}</tbody>
        </table></div>
      </div>`;
  };

  /* --------------------------- FORMULARIO ------------------------------- */
  const formularioMedicamento = (edicion) => {
    const m = edicion;
    const valor = (v) => (m ? esc(m[v] ?? "") : "");
    return `
      <form id="form-med" novalidate>
        <div class="form-grid">
          <div class="field"><label class="field__label">Codigo <span class="req">*</span></label><input class="input" name="codigo" value="${valor("codigo")}" required></div>
          <div class="field"><label class="field__label">Nombre comercial <span class="req">*</span></label><input class="input" name="nombre" value="${valor("nombre")}" required></div>
          <div class="field"><label class="field__label">Categoria</label><select class="select" name="categoria"><option value="">Sin categoria</option>${Store.categorias().map((c) => `<option value="${esc(c.id)}" ${m?.categoria === c.id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></div>
          <div class="field"><label class="field__label">Principio activo</label><input class="input" name="principioActivo" value="${valor("principioActivo")}"></div>
          <div class="field"><label class="field__label">Concentracion</label><input class="input" name="concentracion" value="${valor("concentracion")}"></div>
          <div class="field"><label class="field__label">Presentacion</label><input class="input" name="presentacion" value="${valor("presentacion")}"></div>
          <div class="field"><label class="field__label">Lote</label><input class="input" name="lote" value="${valor("lote")}"></div>
          <div class="field"><label class="field__label">Fecha de vencimiento</label><input class="input" type="date" name="fechaVencimiento" value="${valor("fechaVencimiento")}"></div>
          <div class="field"><label class="field__label">Stock actual</label><input class="input" type="number" min="0" name="stock" value="${m ? Number(m.stock) || 0 : 0}"></div>
          <div class="field"><label class="field__label">Stock minimo</label><input class="input" type="number" min="0" name="minStock" value="${m ? Number(m.minStock) || 0 : 5}"></div>
          <div class="field"><label class="field__label">Precio (PEN)</label><input class="input" type="number" min="0" step="0.01" name="precio" value="${m ? Number(m.precio) || 0 : 0}"></div>
          <div class="field"><label class="field__label">Unidad</label><input class="input" name="unidad" value="${valor("unidad")}"></div>
          <div class="field full"><label class="field__label">URL de imagen</label><input class="input" name="imagen" value="${valor("imagen")}" placeholder="https://..."></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" data-cerrar-form>Cancelar</button>
          <button type="submit" class="btn btn--primary">Guardar medicamento</button>
        </div>
      </form>`;

  };

  /* ------------------------------ INVENTARIO ----------------------------- */
  const vistaInventario = () => {
    const medicamentos = Store.medicamentos();
    const unidades = medicamentos.reduce((acc, m) => acc + (Number(m.stock) || 0), 0);
    const valor = medicamentos.reduce((acc, m) => acc + (Number(m.stock) || 0) * (Number(m.precio) || 0), 0);
    const agotados = medicamentos.filter((m) => (Number(m.stock) || 0) <= 0).length;
    const filas = medicamentos.map((m) => {
      const stock = Number(m.stock) || 0;
      const min = Number(m.minStock) || 0;
      const clase = stock <= 0 ? "badge--red" : stock <= min ? "badge--amber" : "badge--green";
      const etiqueta = stock <= 0 ? "Agotado" : stock <= min ? "Stock bajo" : "Disponible";
      return `<tr>
        <td><strong>${esc(m.nombre)}</strong><div class="small muted mono">${esc(m.codigo)}</div></td>
        <td class="num"><span class="med-row__qty">${stock}</span> ${esc(m.unidad || "")}</td>
        <td class="num">${min}</td>
        <td>${BloomUI.badge(clase, etiqueta)}</td>
        <td><div class="row-actions">
          <button class="icon-btn" data-entrada-med="${m.id}" title="Entrada de stock" aria-label="Entrada de stock"><i class="fa-solid fa-plus"></i></button>
          <button class="icon-btn" data-salida-med="${m.id}" title="Salida de stock" aria-label="Salida de stock"><i class="fa-solid fa-minus"></i></button>
        </div></td>
      </tr>`;
    }).join("");
    return `
      <div class="grid grid--stats">
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Unidades en stock</span><span class="stat-card__icon"><i class="fa-solid fa-box"></i></span></div><div class="stat-card__value">${unidades}</div><span class="stat-card__hint">Suma de existencias</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Valor del inventario</span><span class="stat-card__icon stat-card__icon--violet"><i class="fa-solid fa-sack-dollar"></i></span></div><div class="stat-card__value">${BloomUI.formatoMoneda(valor)}</div><span class="stat-card__hint">Costo de adquisicion estimado</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Agotados</span><span class="stat-card__icon stat-card__icon--red"><i class="fa-solid fa-box"></i></span></div><div class="stat-card__value">${agotados}</div><span class="stat-card__hint">Medicamentos sin unidades</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Categorias activas</span><span class="stat-card__icon"><i class="fa-solid fa-tags"></i></span></div><div class="stat-card__value">${Store.categorias().length}</div><span class="stat-card__hint">Categorias configuradas</span></article>
      </div>
      <div class="card mt-16">
        <div class="card__header"><div><h3 class="card__title">Control de existencias</h3><p class="card__subtitle">Entradas y salidas registradas sobre el stock</p></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Medicamento</th><th>Stock actual</th><th>Minimo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody id="tabla-inventario">${filas || `<tr><td colspan="5"><div class="empty"><div class="empty__icon">📦</div><div class="empty__title">Inventario vacio</div><div class="empty__desc">Registra medicamentos para comenzar el control de existencias.</div></div></td></tr>`}</tbody></table></div>
      </div>`;
  };

  /* ------------------------------- LOTES --------------------------------- */
  const vistaLotes = () => {
    const lotes = [...Store.lotes()].sort((a, b) => String(a.fechaVencimiento || "").localeCompare(String(b.fechaVencimiento || "")));
    const filas = lotes.map((l) => {
      const st = estadoLote(l.fechaVencimiento);
      const med = Store.medicamentos().find((m) => String(m.id) === String(l.medicamentoId));
      return `<tr>
        <td class="mono">${esc(l.numeroLote || "—")}</td>
        <td><strong>${esc(med?.nombre || l.medicamento || "—")}</strong></td>
        <td>${BloomUI.formatearFecha(l.fechaVencimiento)}</td>
        <td class="num">${l.cantidad ?? 0}</td>
        <td>${BloomUI.badge(st.clase, st.etiqueta)}</td>
        <td><div class="row-actions"><button class="icon-btn icon-btn--danger" data-eliminar-lote="${l.id}" title="Eliminar lote" aria-label="Eliminar lote"><i class="fa-solid fa-trash"></i></button></div></td>
      </tr>`;
    }).join("");
    return `
      <div class="card">
        <div class="card__header"><div><h3 class="card__title">Gestion de lotes</h3><p class="card__subtitle">Control de lotes por medicamento y fecha de vencimiento</p></div><div class="card__actions"><button class="btn btn--primary btn--sm" id="abrir-form-lote" data-abrir-form-lote><i class="fa-solid fa-plus"></i> Registrar lote</button></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Medicamento</th><th>Vencimiento</th><th>Cantidad</th><th>Estado</th><th></th></tr></thead><tbody id="tabla-lotes">${filas || `<tr><td colspan="6"><div class="empty"><div class="empty__icon">🧪</div><div class="empty__title">Sin lotes registrados</div><div class="empty__desc">Registra lotes para controlar la caducidad.</div></div></td></tr>`}</tbody></table></div>
      </div>`;
  };

  /* ------------------------------- ALERTAS ------------------------------- */
  const vistaAlertas = () => {
    const alertas = Store.alertas();
    return `
      <div class="card">
        <div class="card__header"><div><h3 class="card__title">Panel de alertas</h3><p class="card__subtitle">Prioridad: vencidos, stock agotado y stock bajo · luego proximos a vencer</p></div></div>
        <div class="alert-list" id="lista-alertas">${alertas.map((a) => `
          <div class="alert-item alert-item--${a.severidad}">
            <div class="alert-item__icon alert-item__icon--${a.severidad}"><i class="fa-solid ${iconoAlerta(a.severidad)}"></i></div>
            <div class="grow"><div class="alert-item__title">${esc(a.titulo)}</div><div class="alert-item__desc">${esc(a.descripcion)}</div></div>
            <div class="alert-item__meta"><span class="badge badge--${a.severidad}">${esc(a.tipo.replace(/_/g, " "))}</span></div>
          </div>`).join("") || `<div class="empty"><div class="empty__icon">🌿</div><div class="empty__title">Sin alertas activas</div><div class="empty__desc">El inventario se encuentra en condiciones normales.</div></div>`}</div>
      </div>`;
  };

  /* ------------------------------ REPORTES ------------------------------- */
  const vistaReportes = () => {
    const datos = Store.resumen();
    const movimientos = Store.movimientos();
    const porCategoria = datos.porCategoria || [];
    const porTipo = {};
    movimientos.forEach((m) => { const k = m.tipo || "otro"; porTipo[k] = (porTipo[k] || 0) + 1; });
    const tipos = Object.keys(porTipo);
    const coloresBarras = ["#78a9d4", "#5f93c6", "#a8c4dd", "#3d6791", "#93bddd", "#b3d2ea"];
    const barrasCategorias = porCategoria.slice(0, 6);
    const datosBarras = barrasCategorias.map((c) => Number(c.unidades) || 0);
    const labelsBarras = barrasCategorias.map((c) => c.nombre);
    const datosTipos = tipos.map((t) => Number(porTipo[t]) || 0);
    const labelsTipos = tipos.map((t) => t.replace(/_/g, " "));
    return `
      <div class="grid grid--stats">
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Total medicamentos</span><span class="stat-card__icon"><i class="fa-solid fa-pill"></i></span></div><div class="stat-card__value">${datos.total}</div><span class="stat-card__hint">Registrados en el catalogo</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Unidades en stock</span><span class="stat-card__icon"><i class="fa-solid fa-box"></i></span></div><div class="stat-card__value">${porCategoria.reduce((a, c) => a + Number(c.unidades) || 0, 0)}</div><span class="stat-card__hint">Sobre todos los medicamentos</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Lotes activos</span><span class="stat-card__icon stat-card__icon--violet"><i class="fa-solid fa-layer-group"></i></span></div><div class="stat-card__value">${datos.lotesActivos}</div><span class="stat-card__hint">Lotes registrados</span></article>
        <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Movimientos</span><span class="stat-card__icon"><i class="fa-solid fa-history"></i></span></div><div class="stat-card__value">${datos.movimientos}</div><span class="stat-card__hint">Registrados en el historial</span></article>
      </div>
      <div class="grid grid--2 mt-16">
        <div class="card"><div class="card__header"><div><h3 class="card__title">Unidades por categoria</h3><p class="card__subtitle">Stock acumulado por categoria</p></div></div><div class="chart-box"><canvas id="chart-categorias"></canvas></div></div>
        <div class="card"><div class="card__header"><div><h3 class="card__title">Movimientos por tipo</h3><p class="card__subtitle">Entradas, salidas y ajustes</p></div></div><div class="chart-box"><canvas id="chart-tipos"></canvas></div></div>
      </div>`;
  };

  /* ------------------------------ HISTORIAL ------------------------------ */
  const vistaHistorial = () => {
    const movimientos = [...Store.movimientos()].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const filas = movimientos.map((m) => {
      const med = Store.medicamentos().find((x) => String(x.id) === String(m.medicamentoId));
      return `<tr>
        <td>${BloomUI.formatearFechaHora(m.fecha)}</td>
        <td><strong>${esc(med?.nombre || m.medicamento || "—")}</strong></td>
        <td><span class="badge badge--blue">${esc(m.tipo || "ajuste")}</span></td>
        <td class="num">${m.cantidad ?? 0}</td>
        <td class="num">${m.stockAnterior ?? "—"}</td>
        <td class="num">${m.stockNuevo ?? "—"}</td>
        <td>${esc(m.usuario || "—")}</td>
      </tr>`;
    }).join("");
    return `
      <div class="card">
        <div class="card__header"><div><h3 class="card__title">Historial de movimientos</h3><p class="card__subtitle">Entradas, salidas y ajustes de inventario</p></div></div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Medicamento</th><th>Tipo</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Usuario</th></tr></thead><tbody id="tabla-historial">${filas || `<tr><td colspan="7"><div class="empty"><div class="empty__icon">🕘</div><div class="empty__title">Sin movimientos</div><div class="empty__desc">Registra entradas o salidas de stock para generar historial.</div></div></td></tr>`}</tbody></table></div>
      </div>`;
  };

  /* ------------------------------ RENDERER ------------------------------- */
  const tablaMedicamentos = () => {
    const busqueda = document.querySelector("#buscador-med")?.value || "";
    const cat = document.querySelector("#filtro-categoria")?.value || "";
    const est = document.querySelector("#filtro-estado")?.value || "";
    const medicamentos = [...Store.medicamentos()].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo)));
    const filtrados = medicamentos.filter((m) => {
      const okBusqueda = !busqueda || Object.values(m).join(" ").toLowerCase().includes(busqueda.toLowerCase());
      const okCat = !cat || String(m.categoria) === cat;
      const hoyD = hoyIso();
      const v = String(m.fechaVencimiento || "").slice(0, 10);
      const hasta = new Date(); hasta.setDate(hasta.getDate() + 30);
      const fin = `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, "0")}-${String(hasta.getDate()).padStart(2, "0")}`;
      const okEstado = !est || (est === "vigente" && v && v >= hoyD && v > fin) || (est === "proximo" && v && v >= hoyD && v <= fin) || (est === "vencido" && v && v < hoyD) || (est === "agotado" && (Number(m.stock) || 0) <= 0);
      return okBusqueda && okCat && okEstado;
    });
    const celdas = filtrados.map((m) => {
      const st = estadoLote(m.fechaVencimiento);
      const stock = Number(m.stock) || 0;
      const min = Number(m.minStock) || 0;
      const clase = stock <= 0 ? "badge--red" : stock <= min ? "badge--amber" : "badge--green";
      const etiqueta = stock <= 0 ? "Agotado" : stock <= min ? "Stock bajo" : "Disponible";
      return `<tr>
        <td class="mono">${esc(m.codigo)}</td>
        <td><div class="med-cell">${imgMed(m)}<div><strong>${esc(m.nombre)}</strong><div class="small muted">${esc(m.principioActivo || "")} ${esc(m.concentracion || "")}</div></div></td>
        <td>${esc(nombreCategoria(m.categoria))}</td>
        <td>${esc(m.lote || "—")}</td>
        <td>${BloomUI.formatearFecha(m.fechaVencimiento)}</td>
        <td class="num"><span class="med-row__qty">${stock}</span> ${esc(m.unidad || "")}</td>
        <td><span class="badge ${clase}">${etiqueta}</span></td>
        <td><div class="row-actions">
          <button class="icon-btn" data-ver-med="${m.id}" title="Ver detalle" aria-label="Ver detalle"><i class="fa-solid fa-eye"></i></button>
          <button class="icon-btn" data-edit-med="${m.id}" title="Editar" aria-label="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn icon-btn--danger" data-eliminar-med="${m.id}" title="Eliminar" aria-label="Eliminar"><i class="fa-solid fa-trash"></i></button>
        </div></td>
      </tr>`;
    }).join("");
    const tbody = document.querySelector("#tabla-med");
    if (tbody) tbody.innerHTML = celdas || `<tr><td colspan="8"><div class="empty"><div class="empty__icon">🌿</div><div class="empty__title">Sin medicamentos</div><div class="empty__desc">Registra el primer medicamento para comenzar el control de inventario.</div></div></td></tr>`;
  };

  const render = (id) => {
    const area = contenido();
    if (!area) return;
    switch (id) {
      case "medicamentos": area.innerHTML = vistaMedicamentos(); break;
      case "inventario": area.innerHTML = vistaInventario(); break;
      case "lotes": area.innerHTML = vistaLotes(); break;
      case "alertas": area.innerHTML = vistaAlertas(); break;
      case "reportes": area.innerHTML = vistaReportes(); break;
      case "historial": area.innerHTML = vistaHistorial(); break;
      default: area.innerHTML = vistaDashboard();
    }
  };

  return { render, tablaMedicamentos, formularioMedicamento, vistaDashboard, vistaMedicamentos, vistaInventario, vistaLotes, vistaAlertas, vistaReportes, vistaHistorial };
})();
