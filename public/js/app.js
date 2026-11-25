/* TÓPICO SMART QR — Controlador principal: sesión, navegación, eventos y acciones */
const App = (function () {
  const MENU = [
    { id: 'dashboard', label: 'Panel principal', icono: 'bi-grid-1x2', seccion: 'General', titulo: 'Panel principal', sub: 'Resumen del inventario' },
    { id: 'medicamentos', label: 'Medicamentos', icono: 'bi-capsule-pill', seccion: 'Inventario', titulo: 'Medicamentos', sub: 'Catálogo y gestión' },
    { id: 'lotes', label: 'Lotes y QR', icono: 'bi-layer-forward', seccion: 'Inventario', titulo: 'Lotes y códigos QR', sub: 'Trazabilidad por lote' },
    { id: 'inventario', label: 'Inventario', icono: 'bi-box-seam', seccion: 'Inventario', titulo: 'Inventario', sub: 'Entradas, salidas y ajustes' },
    { id: 'movimientos', label: 'Movimientos', icono: 'bi-arrow-left-right', seccion: 'Operaciones', titulo: 'Movimientos', sub: 'Historial de operaciones' },
    { id: 'alertas', label: 'Alertas', icono: 'bi-bell', seccion: 'Operaciones', titulo: 'Alertas inteligentes', sub: 'Stock y vencimientos' },
    { id: 'reportes', label: 'Reportes', icono: 'bi-file-bar-graph', seccion: 'Operaciones', titulo: 'Reportes', sub: 'Consulta y exportación' },
    { id: 'escaner', label: 'Escanear QR', icono: 'bi-qr-code-scan', seccion: 'Operaciones', titulo: 'Escáner QR', sub: 'Consulta con cámara' },
    { id: 'usuarios', label: 'Usuarios', icono: 'bi-people', seccion: 'Sistema', titulo: 'Usuarios', sub: 'Cuentas y permisos', admin: true },
    { id: 'perfil', label: 'Mi cuenta', icono: 'bi-person-circle', seccion: 'Sistema', titulo: 'Mi cuenta', sub: 'Datos y contraseña' }
  ];

  const estado = {
    usuario: null,
    vista: 'dashboard',
    filtros: {
      medicamentos: { q: '', categoria: '', estado: 'activos' },
      lotes: { q: '', estado: 'activos' },
      movimientos: { q: '', tipo: '', desde: '', hasta: '' },
      alertas: { historial: false },
      reportes: { reporte: 'inventario', tipo: '', desde: '', hasta: '' }
    },
    catalogo: { categorias: [], medicamentos: [], lotes: [] }
  };

  const $ = (sel) => document.querySelector(sel);
  const esAdmin = () => estado.usuario?.rol === 'admin';
  const vistaActual = () => {
    const hash = location.hash.replace(/^#\/?/, '');
    return MENU.some((m) => m.id === hash) ? hash : 'dashboard';
  };

  /* ------------------------------- SESIÓN -------------------------------- */
  function mostrarLogin() {
    $('#app-shell').style.display = 'none';
    $('#vista-publica').style.display = 'none';
    $('#login-screen').style.display = 'grid';
    setTimeout(() => $('#login-usuario')?.focus(), 50);
  }

  function mostrarShell() {
    $('#login-screen').style.display = 'none';
    $('#vista-publica').style.display = 'none';
    $('#app-shell').style.display = 'grid';
    construirMenu();
    const u = estado.usuario;
    $('#sidebar-usuario').innerHTML = `<strong>${UI.esc(u.nombre)}</strong><div class="small">${u.rol === 'admin' ? 'Administrador' : 'Personal del tópico'}</div>`;
    $('#topbar-fecha').innerHTML = `<i class="bi bi-calendar3"></i> ${new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
  }

  function construirMenu() {
    const nav = $('#menu-navegacion');
    if (!nav) return;
    let seccion = null;
    nav.innerHTML = MENU.filter((m) => !m.admin || esAdmin()).map((m) => {
      const sep = m.seccion !== seccion ? `<div class="sidebar__section">${m.seccion}</div>` : '';
      seccion = m.seccion;
      return `${sep}<a class="nav-item" href="#/${m.id}" data-nav="${m.id}"><i class="bi ${m.icono}"></i> ${m.label}</a>`;
    }).join('');
  }

  async function iniciarSesion(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Ingresando…'; }
    try {
      const datos = await API.post('/auth/login', {
        username: $('#login-usuario').value, password: $('#login-password').value
      });
      API.guardarToken(datos.token);
      estado.usuario = await API.get('/auth/me');
      e.target.reset();
      mostrarShell();
      await cargarCatalogo();
      ir(vistaActual());
      if (!location.hash) location.hash = '#/dashboard';
      await render();
      UI.toast(`Bienvenido, ${estado.usuario.nombre}.`, 'success', 'Sesión iniciada');
    } catch (err) {
      UI.toast(err.message, 'error', 'No se pudo ingresar');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión'; }
    }
  }

  function cerrarSesion() {
    QR.detener();
    API.limpiarToken();
    estado.usuario = null;
    mostrarLogin();
    UI.toast('La sesión se ha cerrado correctamente.', 'success');
  }

  /* ----------------------------- NAVEGACIÓN ------------------------------ */
  function ir(id) { if (location.hash !== `#/${id}`) location.hash = `#/${id}`; else render(); }

  let renderSesion = 0;
  async function render() {
    if (!estado.usuario) return;
    const id = vistaActual();
    if (id === 'usuarios' && !esAdmin()) { ir('dashboard'); return; }
    estado.vista = id;
    const tokenRender = ++renderSesion;
    const area = $('#vista-contenido');
    area.innerHTML = '<div class="center muted" style="padding:60px"><span class="spinner" style="border-color:#78a9d4;border-top-color:#5f93c6"></span><p class="mt-2">Cargando información…</p></div>';
    try {
      const vista = await Views[id]();
      if (tokenRender !== renderSesion) return;
      area.innerHTML = vista.html;
      if (vista.montar) vista.montar();
      const meta = MENU.find((m) => m.id === id) || MENU[0];
      $('#topbar-titulo').textContent = meta.titulo;
      $('#topbar-subtitulo').textContent = meta.sub;
      document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('is-active', el.dataset.nav === id));
      window.scrollTo({ top: 0, behavior: 'smooth' });
      actualizarContadorAlertas();
    } catch (err) {
      area.innerHTML = `<div class="card">${UI.empty('No se pudo cargar la vista', err.message, 'bi-wifi-off')}</div>`;
      UI.toast(err.message, 'error');
    }
  }

  const recargar = () => render();

  async function actualizarContadorAlertas() {
    try {
      const r = await API.get('/alertas/resumen');
      const el = $('#contador-alertas');
      if (!el) return;
      el.textContent = r.activas > 99 ? '99+' : String(r.activas);
      el.style.display = r.activas ? 'grid' : 'none';
    } catch (_) { /* sesión expirada u otro error */ }
  }

  async function cargarCatalogo() {
    try {
      const [categorias, medicamentos, lotes] = await Promise.all([
        API.get('/catalogo/categorias'), API.get('/catalogo/medicamentos?estado=todos'), API.get('/catalogo/lotes')
      ]);
      estado.catalogo = { categorias, medicamentos, lotes };
    } catch (e) { console.warn('No se pudo precargar catálogo:', e.message); }
  }

  /* --------------------------- MODALES / FORMAS -------------------------- */
  const abrirModal = (opciones) => UI.modal(opciones);

  async function abrirFormMedicamento(id = null) {
    await cargarCatalogo();
    let med = null;
    if (id) med = await API.get(`/catalogo/medicamentos/${id}`);
    const modal = abrirModal({ titulo: med ? 'Editar medicamento' : 'Nuevo medicamento', subtitulo: 'Datos del catálogo institucional', ancho: 720, contenido: Views.formMedicamento(med, estado.catalogo.categorias) });
    const form = modal.querySelector('#form-med');
    if (form) form.dataset.id = id || '';
  }

  async function abrirFormLote(id = null, medicamentoId = null) {
    await cargarCatalogo();
    let lote = null;
    if (id) lote = await API.get(`/catalogo/lotes/${id}`);
    const modal = abrirModal({ titulo: lote ? 'Editar lote' : 'Nuevo lote', subtitulo: 'Cada lote genera automáticamente un QR único', ancho: 720, contenido: Views.formLote(lote, estado.catalogo.medicamentos, medicamentoId) });
    const form = modal.querySelector('#form-lote');
    if (form) form.dataset.id = id || '';
  }

  async function abrirFormMovimiento(tipo, loteId = null) {
    await cargarCatalogo();
    const lotes = estado.catalogo.lotes.filter((l) => l.activo);
    const meds = estado.catalogo.medicamentos;
    if (tipo === 'entrada') {
      abrirModal({ titulo: 'Registrar entrada', subtitulo: 'Aumenta las existencias de un lote', ancho: 720, contenido: Views.formEntrada(lotes, meds, loteId) });
    } else if (tipo === 'salida') {
      abrirModal({ titulo: 'Registrar salida', subtitulo: 'Descarga FEFO automática', ancho: 720, contenido: Views.formSalida(meds, loteId) });
    } else {
      abrirModal({ titulo: 'Ajustar existencias', subtitulo: 'Corrige la cantidad real de un lote', ancho: 680, contenido: Views.formAjuste(lotes, loteId) });
    }
  }

  async function abrirFormUsuario(id = null) {
    let u = null;
    if (id) u = (await API.get('/usuarios')).find((x) => Number(x.id) === Number(id));
    const modal = abrirModal({ titulo: u ? 'Editar usuario' : 'Nuevo usuario', subtitulo: 'Cuentas de acceso al sistema', ancho: 680, contenido: Views.formUsuario(u) });
    const form = modal.querySelector('#form-usuario');
    if (form) form.dataset.id = id || '';
  }

  async function ejecutarAccion(accion, el) {
    const id = el.dataset.id;
    switch (accion) {
      case 'nuevo-med': return abrirFormMedicamento();
      case 'editar-med': return abrirFormMedicamento(id);
      case 'detalle-med': {
        const m = await API.get(`/catalogo/medicamentos/${id}`);
        return abrirModal({ titulo: m.nombre, subtitulo: `Código ${m.codigo}`, ancho: 820, contenido: Views.detalleMedicamento(m) });
      }
      case 'toggle-med': {
        const m = await API.get(`/catalogo/medicamentos/${id}`);
        const ok = await UI.confirmar({ titulo: m.activo ? '¿Desactivar medicamento?' : '¿Activar medicamento?', texto: m.activo ? 'El medicamento dejará de estar disponible en el catálogo.' : 'El medicamento volverá a estar disponible.', danger: m.activo });
        if (!ok) return;
        await API.patch(`/catalogo/medicamentos/${id}/estado`, { activo: !m.activo });
        UI.toast('Estado del medicamento actualizado.');
        return recargar();
      }
      case 'ver-inactivos':
        estado.filtros.medicamentos.estado = estado.filtros.medicamentos.estado === 'inactivos' ? 'activos' : 'inactivos';
        return recargar();
      case 'nuevo-lote': return abrirFormLote(null, id || null);
      case 'editar-lote': return abrirFormLote(id);
      case 'detalle-lote': {
        const l = await API.get(`/catalogo/lotes/${id}`);
        return abrirModal({ titulo: `Lote ${l.numero_lote}`, subtitulo: l.medicamento_nombre, ancho: 720, contenido: Views.detalleLote(l) });
      }
      case 'toggle-lote': {
        const l = await API.get(`/catalogo/lotes/${id}`);
        const ok = await UI.confirmar({ titulo: l.activo ? '¿Desactivar lote?' : '¿Activar lote?', texto: 'Esta acción afecta la visibilidad del lote en el inventario.', danger: l.activo });
        if (!ok) return;
        await API.patch(`/catalogo/lotes/${id}/estado`, { activo: !l.activo });
        UI.toast('Estado del lote actualizado.');
        return recargar();
      }
      case 'toggle-lotes-estado':
        estado.filtros.lotes.estado = estado.filtros.lotes.estado === 'inactivos' ? 'activos' : 'inactivos';
        return recargar();
      case 'ver-qr': return QR.mostrar(id);
      case 'verificar-qr': return QR.consultarToken(el.dataset.token);
      case 'imprimir-qr': return QR.imprimir(el.dataset.imagen, el.dataset.lote);
      case 'abrir-entrada': return abrirFormMovimiento('entrada');
      case 'abrir-salida': return abrirFormMovimiento('salida');
      case 'abrir-ajuste': return abrirFormMovimiento('ajuste');
      case 'entrada-lote': return abrirFormMovimiento('entrada', id);
      case 'salida-lote': return abrirFormMovimiento('salida', id);
      case 'ajuste-lote': return abrirFormMovimiento('ajuste', id);
      case 'abrir-escaner':
        if (estado.vista === 'escaner') {
          document.querySelector('[data-action="iniciar-camara"]')?.click();
        } else return QR.abrirEscaner();
        return;
      case 'iniciar-camara': {
        const reader = $('#qr-reader');
        if (reader) reader.style.display = 'block';
        const placeholder = $('#qr-placeholder');
        if (placeholder) placeholder.style.display = 'none';
        try {
          await QR.iniciar('qr-reader', async (texto) => {
            await QR.detener();
            try { await QR.consultarToken(texto); }
            catch (err) { UI.toast(err.message, 'error'); }
          });
        } catch (err) {
          if (reader) reader.style.display = 'none';
          if (placeholder) placeholder.style.display = 'block';
          UI.toast(err.message, 'error');
        }
        return;
      }
      case 'detener-camara':
        await QR.detener();
        {
          const reader = $('#qr-reader');
          const placeholder = $('#qr-placeholder');
          if (reader) reader.style.display = 'none';
          if (placeholder) placeholder.style.display = 'block';
          const modal = document.querySelector('#modal-root .modal-overlay');
          if (modal) UI.cerrar(modal);
        }
        return;
      case 'consultar-manual': {
        UI.cerrar(document.querySelector('#modal-root .modal-overlay'));
        abrirModal({ titulo: 'Consulta manual', subtitulo: 'Ingrese el token del código QR', ancho: 520,
          contenido: `<form id="form-token-manual" class="stack"><div class="field"><label class="field__label" for="token-manual">Token</label>
            <input class="input mono" id="token-manual" name="token" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required></div>
            <div class="form-actions"><button type="button" class="btn btn--ghost" data-cerrar-modal>Cancelar</button>
            <button type="submit" class="btn btn--primary"><i class="bi bi-search"></i> Consultar</button></div></form>` });
        return;
      }
      case 'toggle-historial':
        estado.filtros.alertas.historial = !estado.filtros.alertas.historial;
        return recargar();
      case 'leer-alertas':
        await API.patch('/alertas/leer-todas', {});
        UI.toast('Alertas marcadas como leídas.');
        return recargar();
      case 'leer-alerta':
        await API.patch(`/alertas/${id}/leida`, {});
        UI.toast('Alerta marcada como leída.');
        return recargar();
      case 'reevaluar': {
        const r = await API.post('/alertas/reevaluar', {});
        UI.toast(r.mensaje);
        return recargar();
      }
      case 'elegir-reporte':
        estado.filtros.reportes.reporte = id;
        return recargar();
      case 'exportar': {
        const nombre = el.dataset.reporte;
        const formato = el.dataset.formato;
        UI.toast('Generando archivo…', 'warn', 'Exportación');
        try {
          const blob = await API.descargar(`/reportes/${nombre}?formato=${formato}`);
          API.guardarBlob(blob, `topico_qr_${nombre}_${new Date().toISOString().slice(0, 10)}.${formato === 'excel' ? 'xlsx' : 'pdf'}`);
          UI.toast('Archivo descargado correctamente.');
        } catch (err) { UI.toast(err.message, 'error'); }
        return;
      }
      case 'nuevo-usuario': return abrirFormUsuario();
      case 'editar-usuario': return abrirFormUsuario(id);
      case 'reset-password': {
        const u = (await API.get('/usuarios')).find((x) => Number(x.id) === Number(id));
        const modal = abrirModal({ titulo: 'Restablecer contraseña', ancho: 520, contenido: Views.formResetPassword(u) });
        const form = modal.querySelector('#form-reset');
        if (form) form.dataset.id = id;
        return modal;
      }
      case 'eliminar-usuario': {
        const ok = await UI.confirmar({ titulo: '¿Eliminar usuario?', texto: 'El usuario perderá el acceso al sistema.', danger: true, confirmText: 'Eliminar' });
        if (!ok) return;
        await API.del(`/usuarios/${id}`);
        UI.toast('Usuario eliminado.');
        return recargar();
      }
      default: return;
    }
  }

  /* -------------------------------- FORMULARIOS -------------------------- */
  const datosForm = (form) => Object.fromEntries(new FormData(form));

  async function handleSubmit(e) {
    const form = e.target;
    if (!form.id || !form.id.startsWith('form-')) return;
    e.preventDefault();
    const id = form.id;
    const datos = datosForm(form);
    const boton = form.querySelector('button[type=submit]');
    if (boton) { boton.disabled = true; boton.innerHTML = '<span class="spinner"></span> Guardando…'; }
    try {
      if (id === 'form-login') return await iniciarSesion(e);
      if (id === 'form-med') {
        const payload = { codigo: datos.codigo, nombre: datos.nombre, categoria_id: datos.categoria_id || null, concentracion: datos.concentracion, presentacion: datos.presentacion, laboratorio: datos.laboratorio, descripcion: datos.descripcion };
        const editando = !!form.dataset.id;
        if (editando) await API.put(`/catalogo/medicamentos/${form.dataset.id}`, payload);
        else await API.post('/catalogo/medicamentos', payload);
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(editando ? 'Medicamento actualizado.' : 'Medicamento registrado correctamente.');
        await cargarCatalogo(); return recargar();
      }
      if (id === 'form-lote') {
        const payload = { medicamento_id: datos.medicamento_id, numero_lote: datos.numero_lote, fecha_vencimiento: datos.fecha_vencimiento, stock_minimo: datos.stock_minimo || 0, ubicacion: datos.ubicacion };
        const editando = !!form.dataset.id;
        if (editando) {
          await API.put(`/catalogo/lotes/${form.dataset.id}`, payload);
        } else {
          payload.cantidad = datos.cantidad;
          await API.post('/catalogo/lotes', payload);
        }
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(editando ? 'Lote actualizado.' : 'Lote registrado y QR generado automáticamente.');
        await cargarCatalogo(); return recargar();
      }
      if (id === 'form-entrada') {
        const payload = { cantidad: datos.cantidad, motivo: datos.motivo, observaciones: datos.observaciones };
        if (datos.lote_id) payload.lote_id = datos.lote_id;
        else {
          if (!datos.medicamento_id || !datos.numero_lote || !datos.fecha_vencimiento) throw new Error('Complete el medicamento, número de lote y vencimiento para el lote nuevo.');
          Object.assign(payload, { medicamento_id: datos.medicamento_id, numero_lote: datos.numero_lote, fecha_vencimiento: datos.fecha_vencimiento, stock_minimo: datos.stock_minimo || 0, ubicacion: datos.ubicacion });
        }
        const r = await API.post('/inventario/movimientos/entrada', payload);
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(r.mensaje);
        await cargarCatalogo(); return recargar();
      }
      if (id === 'form-salida') {
        const r = await API.post('/inventario/movimientos/salida', { medicamento_id: datos.medicamento_id, lote_id: datos.lote_id || null, cantidad: datos.cantidad, motivo: datos.motivo, observaciones: datos.observaciones });
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(r.mensaje);
        await cargarCatalogo(); return recargar();
      }
      if (id === 'form-ajuste') {
        const r = await API.post('/inventario/movimientos/ajuste', { lote_id: datos.lote_id, cantidad_nueva: datos.cantidad_nueva, motivo: datos.motivo, observaciones: datos.observaciones });
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(r.mensaje);
        await cargarCatalogo(); return recargar();
      }
      if (id === 'form-usuario') {
        const editando = !!form.dataset.id;
        if (editando) {
          await API.put(`/usuarios/${form.dataset.id}`, { nombre: datos.nombre, email: datos.email, rol: datos.rol, activo: datos.activo === 'on' });
        } else {
          await API.post('/usuarios', { nombre: datos.nombre, username: datos.username, email: datos.email, rol: datos.rol, password: datos.password });
        }
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(editando ? 'Usuario actualizado.' : 'Usuario creado correctamente.');
        return recargar();
      }
      if (id === 'form-reset') {
        await API.post(`/usuarios/${form.dataset.id}/password`, { password: datos.password });
        UI.cerrar(form.closest('.modal-overlay'));
        UI.toast('Contraseña restablecida.');
        return;
      }
      if (id === 'form-password') {
        if (datos.nueva !== datos.confirmar) throw new Error('La confirmación de contraseña no coincide.');
        const r = await API.post('/auth/cambiar-password', { actual: datos.actual, nueva: datos.nueva });
        form.reset();
        UI.toast(r.mensaje);
        return;
      }
      if (id === 'form-token' || id === 'form-token-manual') {
        const dato = await QR.consultarToken(datos.token);
        if (id === 'form-token-manual') UI.cerrar(form.closest('.modal-overlay'));
        UI.toast(`Lote ${dato.numero_lote} identificado.`, 'success', 'QR leído');
        return;
      }
    } catch (err) {
      UI.toast(err.message, 'error');
    } finally {
      if (boton) { boton.disabled = false; boton.innerHTML = boton.dataset.original || 'Guardar'; }
    }
  }

  /* ------------------------------- EVENTOS ------------------------------- */
  function enlazarEventos() {
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'form-login') { e.preventDefault(); iniciarSesion(e); }
      else handleSubmit(e);
    });

    document.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); ir(nav.dataset.nav); return; }
      const accion = e.target.closest('[data-action]');
      if (accion) {
        e.preventDefault();
        ejecutarAccion(accion.dataset.action, accion).catch((err) => UI.toast(err.message, 'error'));
      }
    });

    document.addEventListener('input', (e) => {
      const filtro = e.target.closest('[data-filtro]');
      if (!filtro) return;
      procesarFiltro(filtro, Number(filtro.dataset.debounce || 0));
    });
    document.addEventListener('change', (e) => {
      const filtro = e.target.closest('[data-filtro]');
      if (filtro) { procesarFiltro(filtro, 0); return; }
      if (e.target.id === 'ent-lote') {
        const nuevo = document.querySelector('#ent-nuevo');
        if (nuevo) nuevo.style.display = e.target.value ? 'none' : 'block';
      }
      if (e.target.id === 'sal-med') actualizarLotesSalida(e.target.value);
      if (e.target.id === 'aj-lote') {
        const l = estado.catalogo.lotes.find((x) => Number(x.id) === Number(e.target.value));
        const info = document.querySelector('#aj-info');
        if (info && l) info.innerHTML = `Existencia actual: <strong>${l.cantidad}</strong> unidades.`;
      }
    });

    window.addEventListener('hashchange', () => render());
    window.addEventListener('sesion:expirada', () => {
      if (estado.usuario) { estado.usuario = null; mostrarLogin(); UI.toast('Su sesión expiró. Inicie sesión nuevamente.', 'warn', 'Sesión finalizada'); }
    });

    $('#btn-salir')?.addEventListener('click', cerrarSesion);
    $('#btn-perfil')?.addEventListener('click', () => ir('perfil'));
    $('#btn-alertas')?.addEventListener('click', () => ir('alertas'));
    $('#btn-escanear')?.addEventListener('click', () => ir('escaner'));
    $('#abrir-menu')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.add('abierto');
      document.querySelector('.sidebar__scrim')?.classList.add('visible');
    });
    $('#scrim')?.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.remove('abierto');
      document.querySelector('.sidebar__scrim')?.classList.remove('visible');
    });
  }

  function actualizarLotesSalida(medicamentoId) {
    const select = document.querySelector('#sal-lote');
    if (!select) return;
    const lotes = estado.catalogo.lotes.filter((l) => l.activo && Number(l.medicamento_id) === Number(medicamentoId) && Number(l.cantidad) > 0)
      .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)));
    select.innerHTML = '<option value="">Automático (FEFO)</option>' + lotes.map((l) => `<option value="${l.id}">${UI.esc(l.numero_lote)} · vence ${UI.fechaLarga(l.fecha_vencimiento)} · ${l.cantidad} und.</option>`).join('');
  }

  let temporizadorFiltro = null;
  function procesarFiltro(elemento, espera) {
    const [vista, campo] = elemento.dataset.filtro.split(':');
    if (!estado.filtros[vista]) return;
    estado.filtros[vista][campo] = elemento.value;
    clearTimeout(temporizadorFiltro);
    const selector = `[data-filtro="${vista}:${campo}"]`;
    const aplicar = async () => {
      await render();
      const siguiente = document.querySelector(selector);
      if (siguiente && elemento.type === 'text') {
        siguiente.focus();
        siguiente.setSelectionRange(siguiente.value.length, siguiente.value.length);
      }
    };
    if (espera) temporizadorFiltro = setTimeout(aplicar, espera);
    else aplicar();
  }

  /* ------------------------- VISTA PÚBLICA DEL QR ------------------------ */
  function mostrarPublico(dato) {
    $('#login-screen').style.display = 'none';
    $('#app-shell').style.display = 'none';
    const area = $('#vista-publica');
    area.style.display = 'block';
    area.innerHTML = `<div class="public-card">
      <div class="public-card__head"><div class="row"><span class="brand-icon" style="background:rgba(255,255,255,.2)"><i class="bi bi-qr-code-scan"></i></span>
        <div><h2>TÓPICO SMART QR</h2><div class="small">Consulta pública del código QR</div></div></div></div>
      <div class="public-card__body">${Views.detalleQR(dato)}</div>
      <div class="public-card__foot"><a class="btn btn--primary" href="/"><i class="bi bi-box-arrow-in-right"></i> Ingresar al sistema</a>
        <span class="muted small">Consultado ${UI.fechaHora(dato.consultado_en)}</span></div>
    </div>`;
  }

  async function verificarQrEnURL() {
    const params = new URLSearchParams(location.search);
    const token = params.get('t');
    if (!token) return false;
    try {
      const dato = await API.get(`/public/qr/${encodeURIComponent(token)}`);
      mostrarPublico(dato);
      return true;
    } catch (err) {
      UI.toast(err.message, 'error', 'Código QR');
      return false;
    }
  }

  /* --------------------------------- INIT -------------------------------- */
  async function init() {
    enlazarEventos();
    if (await verificarQrEnURL()) return;
    if (API.token()) {
      try {
        estado.usuario = await API.get('/auth/me');
        mostrarShell();
        await cargarCatalogo();
        await render();
        return;
      } catch (e) { API.limpiarToken(); }
    }
    mostrarLogin();
  }

  document.addEventListener('DOMContentLoaded', () => { init().catch((e) => { console.error(e); mostrarLogin(); UI.toast(e.message, 'error'); }); });

  return {
    get usuario() { return estado.usuario; },
    filtros: estado.filtros,
    get catalogo() { return estado.catalogo; },
    esAdmin, ir, render, recargar, mostrarPublico, cargarCatalogo, abrirFormMovimiento
  };
})();
