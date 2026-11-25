/* TÓPICO SMART QR — Vistas de la aplicación (generadas con datos reales del API) */
const Views = (function () {
  const e = UI.esc;
  const badgeV = UI.badgeVencimiento;
  const badgeS = UI.badgeStock;

  const pagina = (titulo, subtitulo, acciones = '') => `
    <div class="row row--between row--wrap mb-3">
      <div><h2 style="font-size:22px">${e(titulo)}</h2><p class="muted small mb-0">${e(subtitulo)}</p></div>
      <div class="row row--wrap">${acciones}</div>
    </div>`;

  const tablaVacia = (cols, mensaje) => `<tr><td colspan="${cols}" class="center muted" style="padding:28px">${e(mensaje)}</td></tr>`;

  /* ============================== DASHBOARD ============================== */
  async function dashboard() {
    const d = await API.get('/inventario/dashboard');
    const s = d.stats;
    const nombre = (App.usuario?.nombre || 'Usuario').split(' ')[0];
    const tarjetas = [
      { label: 'Medicamentos', valor: s.total_medicamentos, icono: 'bi-capsule-pill', tono: '', hint: 'En el catálogo activo', vista: 'medicamentos' },
      { label: 'Unidades disponibles', valor: s.unidades, icono: 'bi-box-seam', tono: '', hint: 'Suma de lotes activos', vista: 'inventario' },
      { label: 'Stock bajo', valor: s.stock_bajo, icono: 'bi-exclamation-triangle', tono: '--amber', hint: 'Lotes en nivel mínimo', vista: 'alertas' },
      { label: 'Próximos a vencer', valor: s.proximos_vencer, icono: 'bi-hourglass-split', tono: '--violet', hint: 'Dentro de 90 días', vista: 'alertas' },
      { label: 'Vencidos', valor: s.vencidos, icono: 'bi-calendar2-x', tono: '--red', hint: 'Con existencias', vista: 'alertas' }
    ];
    const html = `
      <section class="view">
        <div class="welcome">
          <div class="welcome__inner">
            <div class="welcome__text">
              <h2 class="welcome__greeting">Bienvenido, ${e(nombre)}</h2>
              <div class="welcome__date"><i class="bi bi-calendar3"></i> ${e(new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</div>
              <p class="welcome__desc">Supervise existencias, lotes y vencimientos de su tópico en tiempo real.</p>
            </div>
            <div class="welcome__actions">
              <button class="btn btn--primary" data-nav="medicamentos"><i class="bi bi-plus-lg"></i> Registrar medicamento</button>
              <button class="btn btn--light" data-nav="inventario"><i class="bi bi-arrow-left-right"></i> Registrar movimiento</button>
            </div>
          </div>
        </div>

        <div class="grid grid--stats mt-16 stats-5">
          ${tarjetas.map((t) => `<article class="stat-card clickable" data-nav="${t.vista}">
            <div class="stat-card__top"><span class="stat-card__label">${e(t.label)}</span>
              <span class="stat-card__icon ${t.tono ? `stat-card__icon${t.tono}` : ''}"><i class="bi ${t.icono}"></i></span></div>
            <div class="stat-card__value">${Number(t.valor).toLocaleString('es-PE')}</div>
            <span class="stat-card__hint">${e(t.hint)}</span></article>`).join('')}
        </div>

        <div class="grid grid--dashboard mt-16">
          <div class="stack">
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Movimientos de los últimos 6 meses</h3>
                <p class="card__subtitle">Entradas y salidas registradas en la base de datos</p></div></div>
              <div class="chart-box"><canvas id="chart-movimientos"></canvas></div>
            </div>
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Últimos movimientos</h3>
                <p class="card__subtitle">Operaciones más recientes del inventario</p></div>
                <div class="card__actions"><button class="btn btn--soft btn--sm" data-nav="movimientos">Ver historial <i class="bi bi-arrow-right"></i></button></div></div>
              <div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Medicamento</th><th>Lote</th><th class="num">Cant.</th><th>Usuario</th></tr></thead>
                <tbody>${d.movimientos.length ? d.movimientos.map((m) => `<tr>
                  <td class="small">${e(UI.fechaHora(m.fecha))}</td><td>${UI.badgeTipo(m.tipo)}</td>
                  <td>${e(m.medicamento_nombre || '—')}</td><td class="mono">${e(m.numero_lote || '—')}</td>
                  <td class="num"><strong>${m.cantidad}</strong></td><td class="small">${e(m.usuario_nombre)}</td></tr>`).join('') : tablaVacia(6, 'Aún no hay movimientos registrados.')}</tbody></table></div>
            </div>
          </div>
          <div class="stack">
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Unidades por categoría</h3>
                <p class="card__subtitle">Distribución del inventario activo</p></div></div>
              <div class="chart-box"><canvas id="chart-categorias"></canvas></div>
            </div>
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Alertas recientes</h3>
                <p class="card__subtitle">${d.resumenAlertas.activas} activa(s) · ${d.resumenAlertas.criticas} crítica(s)</p></div>
                <div class="card__actions"><button class="btn btn--soft btn--sm" data-nav="alertas">Ver todas</button></div></div>
              <div class="alert-list">
                ${d.alertas.length ? d.alertas.map((a) => `<div class="alert-item ${a.nivel === 'critico' ? 'alert-item--danger' : a.nivel === 'advertencia' ? 'alert-item--warn' : 'alert-item--ok'}">
                  <div class="alert-item__icon ${a.nivel === 'critico' ? 'alert-item__icon--danger' : a.nivel === 'advertencia' ? 'alert-item__icon--warn' : 'alert-item__icon--info'}"><i class="bi ${a.tipo === 'vencido' ? 'bi-calendar2-x' : a.tipo.includes('vencimiento') ? 'bi-hourglass' : 'bi-exclamation'}"></i></div>
                  <div><div class="alert-item__title">${e(a.titulo)}</div><div class="alert-item__desc">${e(a.mensaje)}</div></div></div>`).join('')
                  : UI.empty('Sin alertas activas', 'El inventario se encuentra en buen estado.', 'bi-shield-check')}
              </div>
            </div>
          </div>
        </div>
      </section>`;
    return {
      html,
      montar() {
        const meses = [];
        for (let i = 5; i >= 0; i--) {
          const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - i);
          meses.push({ key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, label: dt.toLocaleDateString('es-PE', { month: 'short' }) });
        }
        Charts.linea('chart-movimientos', meses.map((m) => m.label), [
          { label: 'Entradas', data: meses.map((m) => d.graficas.porMes.find((x) => x.mes === m.key)?.entradas || 0), color: '#5f93c6' },
          { label: 'Salidas', data: meses.map((m) => d.graficas.porMes.find((x) => x.mes === m.key)?.salidas || 0), color: '#cf6a5e' }
        ]);
        Charts.dona('chart-categorias', d.graficas.porCategoria.map((c) => c.nombre), d.graficas.porCategoria.map((c) => c.unidades));
      }
    };
  }

  /* ============================ MEDICAMENTOS ============================= */
  async function medicamentos() {
    const f = App.filtros.medicamentos;
    const qs = new URLSearchParams({ q: f.q || '', categoria: f.categoria || '', estado: f.estado || 'activos' });
    const [meds, cats] = await Promise.all([API.get(`/catalogo/medicamentos?${qs}`), API.get('/catalogo/categorias')]);
    App.catalogo.categorias = cats;
    const html = `
      <section class="view">
        ${pagina('Medicamentos', 'Catálogo de medicamentos del tópico institucional', `
          <button class="btn btn--soft" data-action="ver-inactivos"><i class="bi bi-archive"></i> ${f.estado === 'inactivos' ? 'Ver activos' : 'Ver inactivos'}</button>
          <button class="btn btn--primary" data-action="nuevo-med"><i class="bi bi-plus-lg"></i> Nuevo medicamento</button>`)}
        <div class="card">
          <div class="toolbar">
            <div class="search"><i class="bi bi-search"></i><input class="input" data-filtro="medicamentos:q" data-debounce="300" placeholder="Buscar por nombre, código o laboratorio…" value="${e(f.q || '')}"></div>
            <select class="select" data-filtro="medicamentos:categoria"><option value="">Todas las categorías</option>
              ${cats.map((c) => `<option value="${c.id}" ${String(f.categoria) === String(c.id) ? 'selected' : ''}>${e(c.nombre)}</option>`).join('')}</select>
            <span class="muted small">${meds.length} registro(s)</span>
          </div>
          <div class="table-wrap"><table class="table"><thead><tr>
            <th>Código</th><th>Medicamento</th><th>Categoría</th><th>Concentración</th><th>Presentación</th>
            <th>Laboratorio</th><th class="num">Stock</th><th class="num">Lotes</th><th>Estado</th><th></th>
          </tr></thead><tbody>
            ${meds.length ? meds.map((m) => `<tr>
              <td class="mono">${e(m.codigo)}</td>
              <td><strong>${e(m.nombre)}</strong>${m.descripcion ? `<div class="small muted">${e(m.descripcion)}</div>` : ''}</td>
              <td>${e(m.categoria_nombre || '—')}</td><td>${e(m.concentracion || '—')}</td><td>${e(m.presentacion || '—')}</td>
              <td>${e(m.laboratorio || '—')}</td>
              <td class="num"><strong>${m.stock_total}</strong>${badgeS(m.stock_total, 0)}</td>
              <td class="num">${m.total_lotes}</td>
              <td>${m.activo ? '<span class="badge badge--green">Activo</span>' : '<span class="badge badge--gray">Inactivo</span>'}</td>
              <td><div class="row-actions">
                <button class="icon-btn" title="Ver detalle" data-action="detalle-med" data-id="${m.id}"><i class="bi bi-eye"></i></button>
                <button class="icon-btn" title="Editar" data-action="editar-med" data-id="${m.id}"><i class="bi bi-pencil"></i></button>
                <button class="icon-btn" title="Nuevo lote" data-action="nuevo-lote" data-id="${m.id}"><i class="bi bi-layer-forward"></i></button>
                ${App.esAdmin() ? `<button class="icon-btn ${m.activo ? 'icon-btn--danger' : ''}" title="${m.activo ? 'Desactivar' : 'Activar'}" data-action="toggle-med" data-id="${m.id}"><i class="bi ${m.activo ? 'bi-x-circle' : 'bi-check-circle'}"></i></button>` : ''}
              </div></td></tr>`).join('') : tablaVacia(10, 'No se encontraron medicamentos con los filtros seleccionados.')}
          </tbody></table></div>
        </div>
      </section>`;
    return { html };
  }

  /* ================================ LOTES ================================ */
  async function lotes() {
    const f = App.filtros.lotes;
    const qs = new URLSearchParams({ estado: f.estado || 'activos' });
    const lotes = await API.get(`/catalogo/lotes?${qs}`);
    const filtrados = lotes.filter((l) => `${l.numero_lote} ${l.medicamento_nombre}`.toLowerCase().includes((f.q || '').toLowerCase()));
    const html = `
      <section class="view">
        ${pagina('Lotes', 'Control individual de lotes, vencimientos y códigos QR', `
          <button class="btn btn--soft" data-action="toggle-lotes-estado"><i class="bi bi-archive"></i> ${f.estado === 'inactivos' ? 'Ver activos' : 'Ver inactivos'}</button>
          <button class="btn btn--soft" data-action="abrir-escaner"><i class="bi bi-qr-code-scan"></i> Escanear QR</button>
          <button class="btn btn--primary" data-action="nuevo-lote"><i class="bi bi-plus-lg"></i> Nuevo lote</button>`)}
        <div class="card">
          <div class="toolbar">
            <div class="search"><i class="bi bi-search"></i><input class="input" data-filtro="lotes:q" data-debounce="200" placeholder="Buscar lote o medicamento…" value="${e(f.q || '')}"></div>
            <span class="muted small">${filtrados.length} lote(s)</span>
          </div>
          <div class="table-wrap"><table class="table"><thead><tr>
            <th>Lote</th><th>Medicamento</th><th>Vencimiento</th><th class="num">Cantidad</th><th class="num">Mínimo</th>
            <th>Ubicación</th><th>QR</th><th>Estado</th><th></th>
          </tr></thead><tbody>
            ${filtrados.length ? filtrados.map((l) => `<tr>
              <td class="mono">${e(l.numero_lote)}</td>
              <td><strong>${e(l.medicamento_nombre)}</strong><div class="small muted">${e(l.medicamento_codigo)}</div></td>
              <td>${e(UI.fechaLarga(l.fecha_vencimiento))}<div>${badgeV(l.fecha_vencimiento)}</div></td>
              <td class="num"><strong>${l.cantidad}</strong></td><td class="num">${l.stock_minimo}</td>
              <td>${e(l.ubicacion || '—')}</td>
              <td><button class="icon-btn" title="Ver código QR" data-action="ver-qr" data-id="${l.id}"><i class="bi bi-qr-code"></i></button></td>
              <td>${l.activo ? '<span class="badge badge--green">Activo</span>' : '<span class="badge badge--gray">Inactivo</span>'}</td>
              <td><div class="row-actions">
                <button class="icon-btn" title="Detalle" data-action="detalle-lote" data-id="${l.id}"><i class="bi bi-eye"></i></button>
                <button class="icon-btn" title="Editar" data-action="editar-lote" data-id="${l.id}"><i class="bi bi-pencil"></i></button>
                ${App.esAdmin() ? `<button class="icon-btn" title="${l.activo ? 'Desactivar' : 'Activar'}" data-action="toggle-lote" data-id="${l.id}"><i class="bi ${l.activo ? 'bi-x-circle' : 'bi-check-circle'}"></i></button>` : ''}
              </div></td></tr>`).join('') : tablaVacia(9, 'No hay lotes que coincidan con la búsqueda.')}
          </tbody></table></div>
        </div>
      </section>`;
    return { html };
  }

  /* ============================== INVENTARIO ============================= */
  async function inventario() {
    const lotes = await API.get('/catalogo/lotes?estado=activos');
    const total = lotes.reduce((s, l) => s + Number(l.cantidad), 0);
    const html = `
      <section class="view">
        ${pagina('Inventario', 'Entradas, salidas FEFO y ajustes de existencias', `
          <button class="btn btn--soft" data-action="abrir-escaner"><i class="bi bi-qr-code-scan"></i> Escanear</button>`)}
        <div class="grid grid--3">
          <article class="stat-card clickable" data-action="abrir-entrada"><div class="stat-card__top"><span class="stat-card__label">Registrar entrada</span><span class="stat-card__icon"><i class="bi bi-arrow-down-left-circle"></i></span></div><div class="stat-card__hint">Incrementa existencias de un lote o crea uno nuevo.</div></article>
          <article class="stat-card clickable" data-action="abrir-salida"><div class="stat-card__top"><span class="stat-card__label">Registrar salida</span><span class="stat-card__icon stat-card__icon--red"><i class="bi bi-arrow-up-right-circle"></i></span></div><div class="stat-card__hint">Descarga automáticamente con criterio FEFO.</div></article>
          <article class="stat-card clickable" data-action="abrir-ajuste"><div class="stat-card__top"><span class="stat-card__label">Ajustar existencias</span><span class="stat-card__icon stat-card__icon--amber"><i class="bi bi-sliders2"></i></span></div><div class="stat-card__hint">Corrige cantidades por baja o inventario físico.</div></article>
        </div>
        <div class="help-box mt-16"><i class="bi bi-info-circle"></i> <strong>FEFO:</strong> en cada salida se descarga primero el lote con fecha de vencimiento más próxima. El sistema bloquea la salida de lotes vencidos y nunca permite cantidades negativas.</div>
        <div class="card mt-16">
          <div class="card__header"><div><h3 class="card__title">Existencias por lote</h3><p class="card__subtitle">${lotes.length} lote(s) activos · ${total.toLocaleString('es-PE')} unidades</p></div></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Medicamento</th><th>Lote</th><th>Vencimiento</th><th class="num">Disponible</th><th class="num">Mínimo</th><th>Ubicación</th><th>Situación</th><th></th></tr></thead><tbody>
            ${lotes.length ? lotes.map((l) => `<tr>
              <td>${e(l.medicamento_nombre)}</td><td class="mono">${e(l.numero_lote)}</td><td>${badgeV(l.fecha_vencimiento)}</td>
              <td class="num"><strong>${l.cantidad}</strong></td><td class="num">${l.stock_minimo}</td><td>${e(l.ubicacion || '—')}</td>
              <td>${badgeS(l.cantidad, l.stock_minimo)}</td>
              <td><div class="row-actions">
                <button class="icon-btn" title="Entrada" data-action="entrada-lote" data-id="${l.id}"><i class="bi bi-plus-circle"></i></button>
                <button class="icon-btn" title="Salida" data-action="salida-lote" data-id="${l.id}"><i class="bi bi-dash-circle"></i></button>
                <button class="icon-btn" title="Ajustar" data-action="ajuste-lote" data-id="${l.id}"><i class="bi bi-sliders"></i></button>
              </div></td></tr>`).join('') : tablaVacia(8, 'No hay lotes activos. Registre uno para comenzar.')}
          </tbody></table></div>
        </div>
      </section>`;
    return { html };
  }

  /* ============================== MOVIMIENTOS ============================ */
  async function movimientos() {
    const f = App.filtros.movimientos;
    const qs = new URLSearchParams({ q: f.q || '', tipo: f.tipo || '', desde: f.desde || '', hasta: f.hasta || '' });
    const movs = await API.get(`/inventario/movimientos?${qs}`);
    const total = movs.reduce((s, m) => s + Number(m.cantidad), 0);
    const html = `
      <section class="view">
        ${pagina('Movimientos', 'Historial de entradas, salidas y ajustes', `
          <button class="btn btn--soft" data-action="exportar" data-reporte="movimientos" data-formato="excel"><i class="bi bi-file-excel"></i> Exportar</button>`)}
        <div class="card">
          <div class="toolbar">
            <div class="search"><i class="bi bi-search"></i><input class="input" data-filtro="movimientos:q" data-debounce="300" placeholder="Buscar medicamento, lote, motivo o usuario…" value="${e(f.q || '')}"></div>
            <select class="select" data-filtro="movimientos:tipo"><option value="">Todos los tipos</option>
              ${['entrada', 'salida', 'ajuste'].map((t) => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>
            <input class="input" type="date" data-filtro="movimientos:desde" value="${e(f.desde || '')}" title="Desde">
            <input class="input" type="date" data-filtro="movimientos:hasta" value="${e(f.hasta || '')}" title="Hasta">
            <span class="muted small">${movs.length} registro(s) · ${total.toLocaleString('es-PE')} unidades movidas</span>
          </div>
          <div class="table-wrap"><table class="table"><thead><tr>
            <th>Fecha</th><th>Tipo</th><th>Medicamento</th><th>Lote</th><th class="num">Cantidad</th>
            <th class="num">Stock antes → después</th><th>Motivo</th><th>Usuario</th>
          </tr></thead><tbody>
            ${movs.length ? movs.map((m) => `<tr>
              <td class="small">${e(UI.fechaHora(m.fecha))}</td><td>${UI.badgeTipo(m.tipo)}</td>
              <td>${e(m.medicamento_nombre || '—')}</td><td class="mono">${e(m.lote_numero || '—')}</td>
              <td class="num"><strong>${m.cantidad}</strong></td>
              <td class="num small">${m.cantidad_antes} → ${m.cantidad_despues}</td>
              <td>${e(m.motivo)}${m.observaciones ? `<div class="small muted">${e(m.observaciones)}</div>` : ''}</td>
              <td class="small">${e(m.usuario_nombre)}</td></tr>`).join('') : tablaVacia(8, 'No hay movimientos con estos filtros.')}
          </tbody></table></div>
        </div>
      </section>`;
    return { html };
  }

  /* ================================ ALERTAS ============================== */
  async function alertas() {
    const historial = !!App.filtros.alertas.historial;
    const d = await API.get(`/alertas?historial=${historial ? 1 : 0}`);
    const r = d.resumen;
    const iconos = { vencido: 'bi-calendar2-x', vencimiento_7: 'bi-hourglass', vencimiento_30: 'bi-clock', vencimiento_90: 'bi-calendar3', stock_bajo: 'bi-exclamation-triangle', agotado: 'bi-box' };
    const html = `
      <section class="view">
        ${pagina('Alertas inteligentes', 'Vigilancia automática de stock y vencimientos', `
          ${App.esAdmin() ? '<button class="btn btn--soft" data-action="reevaluar"><i class="bi bi-arrow-clockwise"></i> Actualizar</button>' : ''}
          <button class="btn btn--soft" data-action="toggle-historial"><i class="bi bi-clock-history"></i> ${historial ? 'Ver activas' : 'Ver historial'}</button>
          ${!historial ? '<button class="btn btn--primary" data-action="leer-alertas"><i class="bi bi-check2-all"></i> Marcar leídas</button>' : ''}`)}
        <div class="grid grid--stats stats-5">
          <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Activas</span><span class="stat-card__icon"><i class="bi bi-bell"></i></span></div><div class="stat-card__value">${r.activas}</div></article>
          <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Críticas</span><span class="stat-card__icon stat-card__icon--red"><i class="bi bi-exclamation-octagon"></i></span></div><div class="stat-card__value">${r.criticas}</div></article>
          <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Advertencias</span><span class="stat-card__icon stat-card__icon--amber"><i class="bi bi-exclamation-triangle"></i></span></div><div class="stat-card__value">${r.advertencias}</div></article>
          <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Informativas</span><span class="stat-card__icon stat-card__icon--violet"><i class="bi bi-info-circle"></i></span></div><div class="stat-card__value">${r.informativas}</div></article>
          <article class="stat-card"><div class="stat-card__top"><span class="stat-card__label">Historial</span><span class="stat-card__icon"><i class="bi bi-archive"></i></span></div><div class="stat-card__value">${r.historial}</div></article>
        </div>
        <div class="card mt-16">
          <div class="card__header"><div><h3 class="card__title">${historial ? 'Historial de alertas' : 'Alertas activas'}</h3>
            <p class="card__subtitle">${historial ? 'Todas las alertas generadas, incluidas las resueltas' : 'Se actualizan automáticamente tras cada movimiento'}</p></div></div>
          <div class="alert-list">
            ${d.alertas.length ? d.alertas.map((a) => `
              <div class="alert-item ${a.nivel === 'critico' ? 'alert-item--danger' : a.nivel === 'advertencia' ? 'alert-item--warn' : 'alert-item--ok'}">
                <div class="alert-item__icon alert-item__icon--${a.nivel === 'critico' ? 'danger' : a.nivel === 'advertencia' ? 'warn' : 'info'}"><i class="bi ${iconos[a.tipo] || 'bi-bell'}"></i></div>
                <div><div class="alert-item__title">${e(a.titulo)} ${UI.badgeNivel(a.nivel)} ${a.resuelta ? '<span class="badge badge--gray">Resuelta</span>' : a.leida ? '' : '<span class="badge badge--blue">Nueva</span>'}</div>
                  <div class="alert-item__desc">${e(a.mensaje)}</div>
                  <div class="small muted mt-1"><i class="bi bi-clock"></i> ${e(UI.fechaHora(a.created_at))}${a.resuelta_at ? ` · Resuelta ${e(UI.fechaHora(a.resuelta_at))}` : ''}</div>
                  ${a.lote_id ? `<div class="alert-item__actions"><button class="btn btn--ghost btn--sm" data-action="detalle-lote" data-id="${a.lote_id}"><i class="bi bi-eye"></i> Ver lote</button></div>` : ''}
                </div>
                <div class="alert-item__meta">${!a.resuelta && !a.leida ? `<button class="btn btn--soft btn--sm" data-action="leer-alerta" data-id="${a.id}"><i class="bi bi-check"></i> Marcar leída</button>` : ''}</div>
              </div>`).join('') : UI.empty(historial ? 'Sin historial' : 'Sin alertas activas', historial ? 'Todavía no se han generado alertas.' : 'El inventario se encuentra en buen estado.', 'bi-shield-check')}
          </div>
        </div>
      </section>`;
    return { html };
  }

  /* ================================ REPORTES ============================= */
  async function reportes() {
    const f = App.filtros.reportes;
    const qs = new URLSearchParams({ formato: 'json' });
    if (f.desde) qs.set('desde', f.desde);
    if (f.hasta) qs.set('hasta', f.hasta);
    if (f.tipo) qs.set('tipo', f.tipo);
    const datos = await API.get(`/reportes/${f.reporte || 'inventario'}?${qs}`);
    const tarjetas = [
      { id: 'inventario', titulo: 'Inventario general', desc: 'Catálogo completo con existencias, lotes y laboratorios.', icono: 'bi-boxes' },
      { id: 'stock-bajo', titulo: 'Stock bajo', desc: 'Lotes en nivel mínimo, agotados y sin existencias.', icono: 'bi-exclamation-triangle' },
      { id: 'vencimientos', titulo: 'Vencimientos', desc: 'Lotes vencidos y con vencimiento hasta 90 días.', icono: 'bi-calendar2-x' },
      { id: 'movimientos', titulo: 'Entradas y salidas', desc: 'Trazabilidad completa de movimientos por fecha y tipo.', icono: 'bi-arrow-left-right' }
    ];
    const columnas = datos.columnas || [];
    const html = `
      <section class="view">
        ${pagina('Reportes', 'Consulte y exporte información real del inventario')}
        <div class="grid grid--2">
          ${tarjetas.map((t) => `<div class="card ${f.reporte === t.id ? 'reporte-activo' : ''}">
            <div class="card__header"><span class="stat-card__icon"><i class="bi ${t.icono}"></i></span>
              <div style="margin-left:12px"><h3 class="card__title">${e(t.titulo)}</h3><p class="card__subtitle">${e(t.desc)}</p></div></div>
            <div class="row row--wrap">
              <button class="btn btn--soft btn--sm" data-action="elegir-reporte" data-id="${t.id}"><i class="bi bi-eye"></i> Previsualizar</button>
              <button class="btn btn--ghost btn--sm" data-action="exportar" data-reporte="${t.id}" data-formato="pdf"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
              <button class="btn btn--ghost btn--sm" data-action="exportar" data-reporte="${t.id}" data-formato="excel"><i class="bi bi-file-earmark-excel"></i> Excel</button>
            </div>
          </div>`).join('')}
        </div>
        <div class="card mt-16">
          <div class="card__header"><div><h3 class="card__title">Vista previa · ${e(datos.titulo)}</h3><p class="card__subtitle">${datos.total} registro(s) · datos obtenidos directamente de la base de datos</p></div></div>
          ${columnas.length ? `<div class="table-wrap"><table class="table"><thead><tr>${columnas.map((c) => `<th>${e(c.header)}</th>`).join('')}</tr></thead><tbody>
            ${datos.filas.length ? datos.filas.slice(0, 100).map((fila) => `<tr>${columnas.map((c) => `<td>${e(fila[c.key] ?? '—')}</td>`).join('')}</tr>`).join('') : tablaVacia(columnas.length, 'No hay datos para este reporte.')}
          </tbody></table></div>${datos.filas.length > 100 ? '<p class="muted small mt-2">Se muestran los primeros 100 registros. Exporte el reporte para ver el completo.</p>' : ''}`
            : UI.empty('Sin datos', 'No hay registros para mostrar.')}
        </div>
      </section>`;
    return { html };
  }

  /* ================================ USUARIOS ============================= */
  async function usuarios() {
    const lista = await API.get('/usuarios');
    const html = `
      <section class="view">
        ${pagina('Usuarios', 'Cuentas y permisos del sistema', `<button class="btn btn--primary" data-action="nuevo-usuario"><i class="bi bi-person-plus"></i> Nuevo usuario</button>`)}
        <div class="help-box mb-3"><i class="bi bi-shield-lock"></i> <strong>Administrador:</strong> acceso total. <strong>Personal:</strong> puede gestionar medicamentos, lotes, inventario y consultar reportes; no administra usuarios ni desactiva registros.</div>
        <div class="card"><div class="table-wrap"><table class="table"><thead><tr>
          <th>Usuario</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th>
        </tr></thead><tbody>
          ${lista.length ? lista.map((u) => `<tr>
            <td class="mono">${e(u.username)}</td><td>${e(u.nombre)}</td><td>${e(u.email || '—')}</td>
            <td>${u.rol === 'admin' ? '<span class="badge badge--violet">Administrador</span>' : '<span class="badge badge--blue">Personal</span>'}</td>
            <td>${u.activo ? '<span class="badge badge--green">Activo</span>' : '<span class="badge badge--gray">Inactivo</span>'}</td>
            <td class="small">${e(UI.fechaHora(u.last_login))}</td>
            <td><div class="row-actions">
              <button class="icon-btn" title="Editar" data-action="editar-usuario" data-id="${u.id}"><i class="bi bi-pencil"></i></button>
              <button class="icon-btn" title="Restablecer contraseña" data-action="reset-password" data-id="${u.id}"><i class="bi bi-key"></i></button>
              ${u.id !== App.usuario.id ? `<button class="icon-btn icon-btn--danger" title="Eliminar" data-action="eliminar-usuario" data-id="${u.id}"><i class="bi bi-trash"></i></button>` : ''}
            </div></td></tr>`).join('') : tablaVacia(7, 'No hay usuarios registrados.')}
        </tbody></table></div></div>
      </section>`;
    return { html };
  }

  /* ================================= PERFIL ============================= */
  function perfil() {
    const u = App.usuario;
    const html = `
      <section class="view">
        ${pagina('Mi cuenta', 'Información de la sesión actual')}
        <div class="grid grid--2">
          <div class="card">
            <div class="card__header"><div><h3 class="card__title">Datos de la cuenta</h3><p class="card__subtitle">Sesión iniciada en el tópico</p></div></div>
            <div class="kv kv--single">
              <div class="kv__item"><div class="kv__label">Nombre</div><div class="kv__value">${e(u.nombre)}</div></div>
              <div class="kv__item"><div class="kv__label">Usuario</div><div class="kv__value mono">${e(u.username)}</div></div>
              <div class="kv__item"><div class="kv__label">Rol</div><div class="kv__value">${u.rol === 'admin' ? 'Administrador' : 'Personal del tópico'}</div></div>
              <div class="kv__item"><div class="kv__label">Correo</div><div class="kv__value">${e(u.email || '—')}</div></div>
            </div>
          </div>
          <div class="card">
            <div class="card__header"><div><h3 class="card__title">Cambiar contraseña</h3><p class="card__subtitle">Mínimo 8 caracteres</p></div></div>
            <form id="form-password" class="stack">
              <div class="field"><label class="field__label" for="pass-actual">Contraseña actual</label><input class="input" id="pass-actual" name="actual" type="password" required></div>
              <div class="field"><label class="field__label" for="pass-nueva">Nueva contraseña</label><input class="input" id="pass-nueva" name="nueva" type="password" minlength="8" required></div>
              <div class="field"><label class="field__label" for="pass-confirmar">Confirmar contraseña</label><input class="input" id="pass-confirmar" name="confirmar" type="password" minlength="8" required></div>
              <div class="form-actions"><button class="btn btn--primary" type="submit"><i class="bi bi-shield-check"></i> Actualizar</button></div>
            </form>
          </div>
        </div>
      </section>`;
    return { html };
  }

  /* ================================ ESCÁNER ============================== */
  function escaner() {
    const html = `
      <section class="view">
        ${pagina('Escanear código QR', 'Consulte la información de un medicamento con su cámara')}
        <div class="grid grid--dashboard">
          <div class="card">
            <div class="card__header"><div><h3 class="card__title">Cámara</h3><p class="card__subtitle">Apunte al código QR impreso en el lote</p></div></div>
            <div id="qr-reader" class="scanner" style="display:none"></div>
            <div id="qr-placeholder" class="center" style="padding:36px;background:var(--blue-050);border-radius:14px">
              <i class="bi bi-qr-code-scan" style="font-size:48px;color:var(--blue-500)"></i>
              <p class="muted mt-2 mb-0">Presione «Iniciar cámara» para comenzar a escanear.</p>
            </div>
            <div class="scanner-actions">
              <button class="btn btn--primary" data-action="iniciar-camara"><i class="bi bi-camera"></i> Iniciar cámara</button>
              <button class="btn btn--soft" data-action="detener-camara"><i class="bi bi-camera-video-off"></i> Detener</button>
            </div>
          </div>
          <div class="stack">
            <div class="card">
              <div class="card__header"><div><h3 class="card__title">Consulta manual</h3><p class="card__subtitle">Si no puede usar la cámara, ingrese el código del QR</p></div></div>
              <form id="form-token" class="stack">
                <div class="field"><label class="field__label" for="token-qr">Token del QR</label>
                  <input class="input mono" id="token-qr" name="token" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required></div>
                <button class="btn btn--primary" type="submit"><i class="bi bi-search"></i> Consultar</button>
              </form>
            </div>
            <div class="help-box"><i class="bi bi-info-circle"></i> Cada lote tiene un QR único e inmutable. Al escanearlo se muestra el medicamento, el lote, su vencimiento, la existencia y su ubicación.</div>
          </div>
        </div>
      </section>`;
    return { html };
  }

  /* ================================ FORMULARIOS ========================== */
  function formMedicamento(m = null, cats = []) {
    m = m || {};
    return `<form id="form-med" class="stack">
      <div class="form-grid">
        <div class="field"><label class="field__label" for="med-codigo">Código <span class="req">*</span></label><input class="input" id="med-codigo" name="codigo" value="${e(m.codigo || '')}" placeholder="MED-007" required></div>
        <div class="field"><label class="field__label" for="med-categoria">Categoría</label><select class="select" id="med-categoria" name="categoria_id"><option value="">Sin categoría</option>
          ${cats.map((c) => `<option value="${c.id}" ${Number(m.categoria_id) === c.id ? 'selected' : ''}>${e(c.nombre)}</option>`).join('')}</select></div>
        <div class="field full"><label class="field__label" for="med-nombre">Nombre del medicamento <span class="req">*</span></label><input class="input" id="med-nombre" name="nombre" value="${e(m.nombre || '')}" placeholder="Ej. Paracetamol" required></div>
        <div class="field"><label class="field__label" for="med-concentracion">Concentración</label><input class="input" id="med-concentracion" name="concentracion" value="${e(m.concentracion || '')}" placeholder="500 mg"></div>
        <div class="field"><label class="field__label" for="med-presentacion">Presentación</label><input class="input" id="med-presentacion" name="presentacion" value="${e(m.presentacion || '')}" placeholder="Tabletas"></div>
        <div class="field full"><label class="field__label" for="med-laboratorio">Laboratorio</label><input class="input" id="med-laboratorio" name="laboratorio" value="${e(m.laboratorio || '')}" placeholder="Nombre del laboratorio"></div>
        <div class="field full"><label class="field__label" for="med-descripcion">Descripción</label><textarea class="textarea" id="med-descripcion" name="descripcion" rows="2" placeholder="Información adicional">${e(m.descripcion || '')}</textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-check2"></i> ${m.id ? 'Guardar cambios' : 'Registrar'}</button></div>
    </form>`;
  }

  function formLote(lote = null, meds = [], medicamentoId = null) {
    lote = lote || {};
    const idMed = medicamentoId || lote.medicamento_id || '';
    return `<form id="form-lote" class="stack">
      <div class="form-grid">
        <div class="field full"><label for="lote-med" class="field__label">Medicamento <span class="req">*</span></label>
          <select class="select" id="lote-med" name="medicamento_id" ${lote.id ? 'disabled' : ''} required>
            <option value="">Seleccione un medicamento</option>
            ${meds.filter((m) => m.activo || Number(m.id) === Number(idMed)).map((m) => `<option value="${m.id}" ${Number(idMed) === Number(m.id) ? 'selected' : ''}>${e(m.codigo)} · ${e(m.nombre)}</option>`).join('')}
          </select>${lote.id ? '<input type="hidden" name="medicamento_id" value="' + e(lote.medicamento_id) + '">' : ''}</div>
        <div class="field"><label for="lote-num" class="field__label">Número de lote <span class="req">*</span></label><input class="input" id="lote-num" name="numero_lote" value="${e(lote.numero_lote || '')}" placeholder="L-2026-01" required></div>
        <div class="field"><label for="lote-vence" class="field__label">Fecha de vencimiento <span class="req">*</span></label><input class="input" id="lote-vence" name="fecha_vencimiento" type="date" value="${e(lote.fecha_vencimiento || '')}" required></div>
        ${lote.id ? '' : `<div class="field"><label for="lote-cant" class="field__label">Cantidad inicial <span class="req">*</span></label><input class="input" id="lote-cant" name="cantidad" type="number" min="0" value="${e(lote.cantidad ?? 0)}" required></div>`}
        <div class="field"><label for="lote-min" class="field__label">Stock mínimo</label><input class="input" id="lote-min" name="stock_minimo" type="number" min="0" value="${e(lote.stock_minimo ?? 0)}" required></div>
        <div class="field"><label for="lote-ub" class="field__label">Ubicación</label><input class="input" id="lote-ub" name="ubicacion" value="${e(lote.ubicacion || '')}" placeholder="Ej. A-01"></div>
      </div>
      ${lote.id ? '<div class="help-box mt-3"><i class="bi bi-info-circle"></i> Para modificar la existencia utilice <strong>Ajustar existencias</strong> en el módulo Inventario.</div>' : ''}
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-check2"></i> ${lote.id ? 'Guardar cambios' : 'Registrar lote'}</button></div>
    </form>`;
  }

  function formEntrada(lotes, meds, loteId = null) {
    return `<form id="form-entrada" class="stack">
      <div class="field"><label for="ent-lote" class="field__label">Lote destino</label>
        <select class="select" id="ent-lote" name="lote_id">
          <option value="">➕ Crear un lote nuevo</option>
          ${lotes.map((l) => `<option value="${l.id}" ${Number(loteId) === Number(l.id) ? 'selected' : ''}>${e(l.medicamento_nombre)} · ${e(l.numero_lote)} (${l.cantidad} und.)</option>`).join('')}
        </select></div>
      <div id="ent-nuevo" style="display:${loteId ? 'none' : 'block'}">
        <div class="form-grid">
          <div class="field full"><label for="ent-med" class="field__label">Medicamento</label><select class="select" id="ent-med" name="medicamento_id">
            <option value="">Seleccione…</option>${meds.filter((m) => m.activo).map((m) => `<option value="${m.id}">${e(m.codigo)} · ${e(m.nombre)}</option>`).join('')}</select></div>
          <div class="field"><label for="ent-num" class="field__label">Número de lote</label><input class="input" id="ent-num" name="numero_lote" placeholder="L-2026-01"></div>
          <div class="field"><label for="ent-vence" class="field__label">Vencimiento</label><input class="input" id="ent-vence" name="fecha_vencimiento" type="date"></div>
          <div class="field"><label for="ent-min" class="field__label">Stock mínimo</label><input class="input" id="ent-min" name="stock_minimo" type="number" min="0" value="0"></div>
          <div class="field"><label for="ent-ub" class="field__label">Ubicación</label><input class="input" id="ent-ub" name="ubicacion" placeholder="A-01"></div>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label for="ent-cant" class="field__label">Cantidad a ingresar <span class="req">*</span></label><input class="input" id="ent-cant" name="cantidad" type="number" min="1" required></div>
        <div class="field"><label for="ent-motivo" class="field__label">Motivo <span class="req">*</span></label><select class="select" id="ent-motivo" name="motivo">
          <option>Reposición de stock</option><option>Compra / adquisición</option><option>Donación</option><option>Devolución</option><option>Otro</option></select></div>
        <div class="field full"><label for="ent-obs" class="field__label">Observaciones</label><textarea class="textarea" id="ent-obs" name="observaciones" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-arrow-down-left"></i> Registrar entrada</button></div>
    </form>`;
  }

  function formSalida(meds, loteId = null) {
    const lotes = App.catalogo.lotes || [];
    const medSeleccionado = loteId ? lotes.find((l) => Number(l.id) === Number(loteId))?.medicamento_id : null;
    return `<form id="form-salida" class="stack">
      <div class="help-box"><i class="bi bi-arrow-up-right-circle"></i> El sistema aplica <strong>FEFO</strong>: descarga primero el lote que vence antes. Deje «Automático (FEFO)» para que el sistema elija, o seleccione un lote específico.</div>
      <div class="form-grid">
        <div class="field full"><label for="sal-med" class="field__label">Medicamento <span class="req">*</span></label>
          <select class="select" id="sal-med" name="medicamento_id" required><option value="">Seleccione…</option>
            ${meds.filter((m) => m.activo && m.stock_total > 0).map((m) => `<option value="${m.id}" ${Number(medSeleccionado) === Number(m.id) ? 'selected' : ''}>${e(m.codigo)} · ${e(m.nombre)} (${m.stock_total} und.)</option>`).join('')}
          </select></div>
        <div class="field full"><label for="sal-lote" class="field__label">Lote</label><select class="select" id="sal-lote" name="lote_id"><option value="">Automático (FEFO)</option></select></div>
        <div class="field"><label for="sal-cant" class="field__label">Cantidad a dispensar <span class="req">*</span></label><input class="input" id="sal-cant" name="cantidad" type="number" min="1" required></div>
        <div class="field"><label for="sal-motivo" class="field__label">Motivo <span class="req">*</span></label><select class="select" id="sal-motivo" name="motivo">
          <option>Dispensación</option><option>Uso interno del tópico</option><option>Pérdida / deterioro</option><option>Otro</option></select></div>
        <div class="field full"><label for="sal-obs" class="field__label">Observaciones</label><textarea class="textarea" id="sal-obs" name="observaciones" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-arrow-up-right"></i> Registrar salida</button></div>
    </form>`;
  }

  function formAjuste(lotes, loteId = null) {
    const seleccionado = lotes.find((l) => Number(l.id) === Number(loteId));
    return `<form id="form-ajuste" class="stack">
      <div class="field"><label for="aj-lote" class="field__label">Lote <span class="req">*</span></label>
        <select class="select" id="aj-lote" name="lote_id" required><option value="">Seleccione…</option>
          ${lotes.map((l) => `<option value="${l.id}" ${Number(loteId) === Number(l.id) ? 'selected' : ''}>${e(l.medicamento_nombre)} · ${e(l.numero_lote)} (${l.cantidad} und.)</option>`).join('')}</select></div>
      <div class="field"><label for="aj-cant" class="field__label">Cantidad real en inventario <span class="req">*</span></label>
        <input class="input" id="aj-cant" name="cantidad_nueva" type="number" min="0" value="${e(seleccionado?.cantidad ?? 0)}" required></div>
      <div class="help-box" id="aj-info">${seleccionado ? `Existencia actual: <strong>${seleccionado.cantidad}</strong> unidades.` : 'Seleccione un lote para ver su existencia actual.'}</div>
      <div class="form-grid">
        <div class="field full"><label for="aj-motivo" class="field__label">Motivo del ajuste <span class="req">*</span></label>
          <select class="select" id="aj-motivo" name="motivo"><option>Inventario físico</option><option>Baja por vencimiento</option><option>Baja por deterioro</option><option>Corrección de error</option><option>Otro</option></select></div>
        <div class="field full"><label for="aj-obs" class="field__label">Observaciones</label><textarea class="textarea" id="aj-obs" name="observaciones" rows="2"></textarea></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-check2"></i> Aplicar ajuste</button></div>
    </form>`;
  }

  function formUsuario(u = null) {
    u = u || {};
    return `<form id="form-usuario" class="stack">
      <div class="form-grid">
        <div class="field"><label for="usu-nombre" class="field__label">Nombre completo <span class="req">*</span></label><input class="input" id="usu-nombre" name="nombre" value="${e(u.nombre || '')}" required></div>
        <div class="field"><label for="usu-user" class="field__label">Usuario <span class="req">*</span></label><input class="input" id="usu-user" name="username" value="${e(u.username || '')}" required ${u.id ? 'disabled' : ''}></div>
        <div class="field"><label for="usu-email" class="field__label">Correo</label><input class="input" id="usu-email" name="email" type="email" value="${e(u.email || '')}"></div>
        <div class="field"><label for="usu-rol" class="field__label">Rol <span class="req">*</span></label><select class="select" id="usu-rol" name="rol">
          <option value="personal" ${u.rol === 'personal' ? 'selected' : ''}>Personal del tópico</option>
          <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option></select></div>
        ${u.id ? '' : `<div class="field full"><label for="usu-pass" class="field__label">Contraseña <span class="req">*</span></label><input class="input" id="usu-pass" name="password" type="password" minlength="8" required><div class="field__hint">Mínimo 8 caracteres</div></div>`}
        <div class="field full" style="${u.id ? '' : 'display:none'}"><label class="field__label"><input type="checkbox" name="activo" ${u.activo !== false ? 'checked' : ''}> Cuenta activa</label></div>
      </div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-check2"></i> ${u.id ? 'Guardar cambios' : 'Crear usuario'}</button></div>
    </form>`;
  }

  function formResetPassword(u) {
    return `<form id="form-reset" class="stack">
      <p class="muted small mb-0">Restablecer contraseña del usuario <strong>${e(u.username)}</strong>.</p>
      <div class="field"><label for="reset-pass" class="field__label">Nueva contraseña</label><input class="input" id="reset-pass" name="password" type="password" minlength="8" required></div>
      <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
        <button type="submit" class="btn btn--primary"><i class="bi bi-key"></i> Restablecer</button></div>
    </form>`;
  }

  /* ================================ DETALLES ============================= */
  function detalleMedicamento(m) {
    return `<div class="stack">
      <div class="kv">
        <div class="kv__item"><div class="kv__label">Código</div><div class="kv__value mono">${e(m.codigo)}</div></div>
        <div class="kv__item"><div class="kv__label">Categoría</div><div class="kv__value">${e(m.categoria_nombre || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Concentración</div><div class="kv__value">${e(m.concentracion || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Presentación</div><div class="kv__value">${e(m.presentacion || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Laboratorio</div><div class="kv__value">${e(m.laboratorio || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Existencia total</div><div class="kv__value">${m.stock_total} unidades (${m.total_lotes} lotes)</div></div>
      </div>
      ${m.descripcion ? `<div class="help-box">${e(m.descripcion)}</div>` : ''}
      <div><div class="section-title"><i class="bi bi-layer-forward"></i> Lotes del medicamento</div>
        <div class="table-wrap"><table class="table"><thead><tr><th>Lote</th><th>Vence</th><th class="num">Cantidad</th><th>Ubicación</th><th></th></tr></thead><tbody>
          ${m.lotes.length ? m.lotes.map((l) => `<tr><td class="mono">${e(l.numero_lote)}</td><td>${badgeV(l.fecha_vencimiento)}</td>
            <td class="num">${l.cantidad}</td><td>${e(l.ubicacion || '—')}</td>
            <td><button class="icon-btn" data-action="detalle-lote" data-id="${l.id}" title="Ver lote"><i class="bi bi-eye"></i></button></td></tr>`).join('') : tablaVacia(5, 'Este medicamento no tiene lotes registrados.')}
        </tbody></table></div></div>
    </div>`;
  }

  function detalleLote(l) {
    return `<div class="stack">
      <div class="kv">
        <div class="kv__item"><div class="kv__label">Medicamento</div><div class="kv__value">${e(l.medicamento_nombre || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Lote</div><div class="kv__value mono">${e(l.numero_lote)}</div></div>
        <div class="kv__item"><div class="kv__label">Vencimiento</div><div class="kv__value">${badgeV(l.fecha_vencimiento)}</div></div>
        <div class="kv__item"><div class="kv__label">Existencia</div><div class="kv__value">${l.cantidad} unidades ${badgeS(l.cantidad, l.stock_minimo)}</div></div>
        <div class="kv__item"><div class="kv__label">Stock mínimo</div><div class="kv__value">${l.stock_minimo}</div></div>
        <div class="kv__item"><div class="kv__label">Ubicación</div><div class="kv__value">${e(l.ubicacion || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Categoría</div><div class="kv__value">${e(l.categoria_nombre || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Laboratorio</div><div class="kv__value">${e(l.laboratorio || '—')}</div></div>
      </div>
      <div class="row row--wrap">
        <button class="btn btn--soft btn--sm" data-action="ver-qr" data-id="${l.id}"><i class="bi bi-qr-code"></i> Ver código QR</button>
        <button class="btn btn--soft btn--sm" data-action="entrada-lote" data-id="${l.id}"><i class="bi bi-plus-circle"></i> Entrada</button>
        <button class="btn btn--soft btn--sm" data-action="salida-lote" data-id="${l.id}"><i class="bi bi-dash-circle"></i> Salida</button>
        <button class="btn btn--soft btn--sm" data-action="ajuste-lote" data-id="${l.id}"><i class="bi bi-sliders"></i> Ajustar</button>
      </div>
    </div>`;
  }

  function detalleQR(d) {
    return `<div class="stack">
      <div class="kv">
        <div class="kv__item"><div class="kv__label">Medicamento</div><div class="kv__value">${e(d.nombre)}</div></div>
        <div class="kv__item"><div class="kv__label">Código</div><div class="kv__value mono">${e(d.codigo)}</div></div>
        <div class="kv__item"><div class="kv__label">Lote</div><div class="kv__value mono">${e(d.numero_lote)}</div></div>
        <div class="kv__item"><div class="kv__label">Categoría</div><div class="kv__value">${e(d.categoria || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Concentración / Presentación</div><div class="kv__value">${e(d.concentracion || '—')} · ${e(d.presentacion || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Laboratorio</div><div class="kv__value">${e(d.laboratorio || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Vencimiento</div><div class="kv__value">${badgeV(d.fecha_vencimiento)} <div class="small muted">${e(UI.fechaLarga(d.fecha_vencimiento))}</div></div></div>
        <div class="kv__item"><div class="kv__label">Existencia</div><div class="kv__value">${d.cantidad} unidades ${badgeS(d.cantidad, d.stock_minimo)}</div></div>
        <div class="kv__item"><div class="kv__label">Ubicación</div><div class="kv__value">${e(d.ubicacion || '—')}</div></div>
        <div class="kv__item"><div class="kv__label">Estado del QR</div><div class="kv__value">${e(d.estado_vencimiento)} · ${d.dias_para_vencer} día(s)</div></div>
      </div>
    </div>`;
  }

  return { dashboard, medicamentos, lotes, inventario, movimientos, alertas, reportes, usuarios, perfil, escaner,
    formMedicamento, formLote, formEntrada, formSalida, formAjuste, formUsuario, formResetPassword,
    detalleMedicamento, detalleLote, detalleQR, tablaVacia, pagina };
})();
