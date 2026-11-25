/* ==========================================================================
   BLOOMCARE — Capa de datos
   Estado real del inventario: medicamentos, categorias, lotes y movimientos.
   Persistencia en localStorage (adaptable a backend REST).
   ========================================================================== */

const Store = (function () {
  const CLAVE = "bloomcare_estado_v1";

  const estado = {
    medicamentos: [],
    categorias: [],
    lotes: [],
    movimientos: [],
    usuario: { nombre: "Dra. Solís", rol: "Farmacéutico responsable" },
  };

  const hoyISO = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dia}`;
  };

  const hoy = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dia}`;
  };

  const isoFecha = (fecha) => {
    if (!fecha) return "";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return "";
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${dia}`;
  };

  const normalizar = (s) => (s == null ? "" : String(s).trim());

  const nuevoId = () => `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(estado));
    } catch (e) {
      console.error("BloomCare: no fue posible persistir el estado", e);
    }
  };

  const normalizarIds = () => {
    estado.medicamentos = estado.medicamentos.map((m) => ({ ...m, id: String(m.id ?? nuevoId()) }));
    estado.categorias = estado.categorias.map((c) => ({ ...c, id: String(c.id ?? nuevoId()) }));
    estado.lotes = estado.lotes.map((l) => ({ ...l, id: String(l.id ?? nuevoId()), medicamentoId: l.medicamentoId != null ? String(l.medicamentoId) : l.medicamentoId }));
    estado.movimientos = estado.movimientos.map((m) => ({ ...m, id: String(m.id ?? nuevoId()), medicamentoId: m.medicamentoId != null ? String(m.medicamentoId) : m.medicamentoId }));
  };

  const semilla = () => {
    estado.categorias = [
      { id: "cat_analgesicos", nombre: "Analgésicos" },
      { id: "cat_antibioticos", nombre: "Antibióticos" },
      { id: "cat_vitaminas", nombre: "Vitaminas" },
      { id: "cat_respiratorio", nombre: "Respiratorio" },
    ];
    estado.medicamentos = [
      { id: "med_1", codigo: "MED-001", nombre: "Paracetamol", categoria: "cat_analgesicos", principioActivo: "Paracetamol", concentracion: "500 mg", presentacion: "Tabletas", lote: "L2026-01", fechaVencimiento: "2027-03-15", stock: 120, minStock: 30, precio: 0.5, unidad: "tabletas", imagen: "assets/meds/med1.svg", activo: true },
      { id: "med_2", codigo: "MED-002", nombre: "Amoxicilina", categoria: "cat_antibioticos", principioActivo: "Amoxicilina", concentracion: "500 mg", presentacion: "Cápsulas", lote: "L2026-02", fechaVencimiento: "2026-12-10", stock: 18, minStock: 25, precio: 1.2, unidad: "cápsulas", imagen: "assets/meds/med2.svg", activo: true },
      { id: "med_3", codigo: "MED-003", nombre: "Vitamina C", categoria: "cat_vitaminas", principioActivo: "Ácido ascórbico", concentracion: "1 g", presentacion: "Efervescente", lote: "L2026-03", fechaVencimiento: "2026-06-30", stock: 45, minStock: 20, precio: 0.8, unidad: "sobres", imagen: "assets/meds/med3.svg", activo: true },
      { id: "med_4", codigo: "MED-004", nombre: "Ibuprofeno", categoria: "cat_analgesicos", principioActivo: "Ibuprofeno", concentracion: "400 mg", presentacion: "Tabletas", lote: "L2025-11", fechaVencimiento: "2026-05-20", stock: 8, minStock: 20, precio: 0.7, unidad: "tabletas", imagen: "assets/meds/med4.svg", activo: true },
      { id: "med_5", codigo: "MED-005", nombre: "Salbutamol", categoria: "cat_respiratorio", principioActivo: "Salbutamol", concentracion: "100 mcg", presentacion: "Inhalador", lote: "L2025-09", fechaVencimiento: "2026-04-15", stock: 0, minStock: 10, precio: 12.5, unidad: "unidades", imagen: "assets/meds/med5.svg", activo: true },
    ];
    estado.lotes = [
      { id: "lot_1", numeroLote: "L2026-01", medicamentoId: "med_1", fechaVencimiento: "2027-03-15", cantidad: 120 },
      { id: "lot_2", numeroLote: "L2026-02", medicamentoId: "med_2", fechaVencimiento: "2026-12-10", cantidad: 18 },
      { id: "lot_3", numeroLote: "L2025-09", medicamentoId: "med_5", fechaVencimiento: "2026-04-15", cantidad: 0 },
    ];
    estado.movimientos = [
      { id: "mov_1", fecha: new Date(Date.now() - 86400000 * 2).toISOString(), usuario: estado.usuario.nombre, medicamentoId: "med_1", tipo: "entrada", cantidad: 50, lote: "L2026-01", stockAnterior: 70, stockNuevo: 120, observacion: "Reposición" },
      { id: "mov_2", fecha: new Date(Date.now() - 86400000).toISOString(), usuario: estado.usuario.nombre, medicamentoId: "med_2", tipo: "salida", cantidad: 7, lote: "L2026-02", stockAnterior: 25, stockNuevo: 18, observacion: "Dispensación" },
    ];
  };

  const cargar = () => {
    try {
      const crudo = localStorage.getItem(CLAVE);
      if (crudo) {
        const datos = JSON.parse(crudo);
        estado.medicamentos = Array.isArray(datos.medicamentos) ? datos.medicamentos : [];
        estado.categorias = Array.isArray(datos.categorias) ? datos.categorias : [];
        estado.lotes = Array.isArray(datos.lotes) ? datos.lotes : [];
        estado.movimientos = Array.isArray(datos.movimientos) ? datos.movimientos : [];
        if (datos.usuario) estado.usuario = { ...estado.usuario, ...datos.usuario };
        normalizarIds();
      } else {
        semilla();
        guardar();
      }
    } catch (e) {
      console.error("BloomCare: estado local corrupto, se reinicia", e);
    }
  };

  const resetear = () => {
    estado.medicamentos = [];
    estado.categorias = [];
    estado.lotes = [];
    estado.movimientos = [];
    guardar();
  };

  /* ------------------------------ Medicamentos ----------------------------- */
  const guardarMedicamento = (datos) => {
    const payload = { ...datos };
    const id = payload.id != null && payload.id !== "" ? String(payload.id) : nuevoId();
    payload.id = id;
    const existente = estado.medicamentos.find((m) => String(m.id) === id);
    if (existente) Object.assign(existente, payload);
    else estado.medicamentos.push(payload);
    guardar();
    return existente || payload;
  };

  const eliminarMedicamento = (id) => {
    const sid = String(id);
    const antes = estado.medicamentos.length;
    estado.medicamentos = estado.medicamentos.filter((m) => String(m.id) !== sid);
    estado.lotes = estado.lotes.filter((l) => String(l.medicamentoId) !== sid);
    estado.movimientos = estado.movimientos.filter((m) => String(m.medicamentoId) !== sid);
    if (estado.medicamentos.length === antes) return false;
    guardar();
    return true;
  };

  /* ------------------------------- Lotes ---------------------------------- */
  const guardarLote = (datos) => {
    const payload = { ...datos };
    const id = payload.id != null && payload.id !== "" ? String(payload.id) : nuevoId();
    payload.id = id;
    if (payload.medicamentoId != null) payload.medicamentoId = String(payload.medicamentoId);
    const existente = estado.lotes.find((l) => String(l.id) === id);
    if (existente) Object.assign(existente, payload);
    else estado.lotes.push(payload);
    guardar();
    return existente || payload;
  };

  const eliminarLote = (id) => {
    const sid = String(id);
    const antes = estado.lotes.length;
    estado.lotes = estado.lotes.filter((l) => String(l.id) !== sid);
    if (estado.lotes.length === antes) return false;
    guardar();
    return true;
  };

  /* ---------------------------- Movimientos ------------------------------- */
  const registrarMovimiento = (datos) => {
    const cantidad = Math.max(0, Number(datos.cantidad) || 0);
    const tipo = normalizar(datos.tipo) || "ajuste";
    const movimiento = {
      id: nuevoId(),
      fecha: new Date().toISOString(),
      usuario: estado.usuario.nombre,
      ...datos,
      tipo,
      cantidad,
    };
    const med = estado.medicamentos.find((m) => String(m.id) === String(datos.medicamentoId));
    if (med) {
      const anterior = Number(med.stock) || 0;
      const delta = tipo === "salida" ? -cantidad : cantidad;
      const nuevo = Math.max(0, anterior + delta);
      med.stock = nuevo;
      movimiento.stockAnterior = anterior;
      movimiento.stockNuevo = nuevo;
      if (tipo === "entrada" && datos.lote) med.lote = datos.lote;
    }
    estado.movimientos.unshift(movimiento);
    guardar();
    return movimiento;
  };

  /* ------------------------------- Estadisticas ---------------------------- */
  const resumen = () => {
    const total = estado.medicamentos.length;
    const disponibles = estado.medicamentos.filter((m) => (Number(m.stock) || 0) > 0).length;
    const agotados = estado.medicamentos.filter((m) => (Number(m.stock) || 0) <= 0).length;
    const conStockBajo = estado.medicamentos.filter((m) => (Number(m.stock) || 0) > 0 && (Number(m.stock) || 0) <= (Number(m.minStock) || 0)).length;
    const criticos = estado.medicamentos.filter((m) => (Number(m.stock) || 0) <= (Number(m.minStock) || 0)).length;
    const proximosVencer = estado.medicamentos.filter((m) => {
      const v = isoFecha(m.fechaVencimiento);
      if (!v) return false;
      const hoyD = hoy();
      const limite = new Date();
      limite.setDate(limite.getDate() + 30);
      const fin = isoFecha(limite.toISOString());
      return v >= hoyD && v <= fin;
    }).length;
    const vencidos = estado.medicamentos.filter((m) => {
      const v = isoFecha(m.fechaVencimiento);
      return v && v < hoy();
    }).length;

    const porCategoria = estado.categorias.map((cat) => {
      const meds = estado.medicamentos.filter((m) => m.categoria === cat.id || m.categoria === cat.nombre);
      const unidades = meds.reduce((acc, m) => acc + (Number(m.stock) || 0), 0);
      const registrados = meds.length;
      return { id: cat.id, nombre: cat.nombre, medicamentos: registrados, unidades };
    });
    const sinCategoria = estado.medicamentos
      .filter((m) => !estado.categorias.some((c) => c.id === m.categoria || c.nombre === m.categoria))
      .map((m) => ({ id: m.id, nombre: m.categoria || "Sin categoría", medicamentos: 1, unidades: Number(m.stock) || 0 }));

    return {
      total,
      disponibles,
      agotados,
      conStockBajo,
      criticos,
      proximosVencer,
      vencidos,
      lotesActivos: estado.lotes.length,
      movimientos: estado.movimientos.length,
      porCategoria: [...porCategoria, ...sinCategoria],
    };
  };

  const alertas = () => {
    const hoyD = hoy();
    const items = [];
    estado.medicamentos.forEach((m) => {
      const stock = Number(m.stock) || 0;
      const min = Number(m.minStock) || 0;
      const v = isoFecha(m.fechaVencimiento);
      const vencido = !!v && v < hoyD;
      const proxima = v && v >= hoyD && v <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      if (vencido) {
        items.push({
          id: `venc_${m.id}`,
          severidad: "danger",
          tipo: "vencido",
          titulo: `Medicamento vencido: ${m.nombre}`,
          descripcion: `El lote ${m.lote || "sin lote"} llegó a fecha de caducidad (${v}). Se recomienda retirar del almacén.`,
          medicamentoId: m.id,
          prioridad: 3,
          fecha: v,
          stock,
        });
      }
      if (stock <= 0) {
        items.push({
          id: `agot_${m.id}`,
          severidad: "danger",
          tipo: "agotado",
          titulo: `Stock agotado: ${m.nombre}`,
          descripcion: `No hay unidades disponibles en el almacén (mínimo ${min}).`,
          medicamentoId: m.id,
          prioridad: 3,
          stock,
        });
      } else if (stock > 0 && stock <= min) {
        items.push({
          id: `bajo_${m.id}`,
          severidad: "warn",
          tipo: "stock_bajo",
          titulo: `Stock bajo: ${m.nombre}`,
          descripcion: `Quedan ${stock} ${m.unidad || "unidades"} disponibles (mínimo recomendado: ${min}).`,
          medicamentoId: m.id,
          prioridad: 2,
          stock,
        });
      }
      if (proxima) {
        items.push({
          id: `prox_${m.id}`,
          severidad: "info",
          tipo: "proximo_vencer",
          titulo: `Próximo a vencer: ${m.nombre}`,
          descripcion: `El lote ${m.lote || "sin lote"} vence el ${v}. Se recomienda revisar el despacho.`,
          medicamentoId: m.id,
          prioridad: 1,
          stock,
        });
      }
    });
    return items.sort((a, b) => b.prioridad - a.prioridad);
  };

  const usuario = (datos) => {
    if (datos) Object.assign(estado.usuario, datos);
    return estado.usuario;
  };

  const historial = () => [...estado.movimientos].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const buscar = (texto, campo = "nombre") => {
    const t = normalizar(texto).toLowerCase();
    if (!t) return [];
    return estado.medicamentos.filter((m) => Object.values(m).join(" ").toLowerCase().includes(t));
  };

  return {
    clave: CLAVE,
    cargar,
    guardar,
    resetear,
    medicamentos: () => estado.medicamentos,
    categorias: () => estado.categorias,
    lotes: () => estado.lotes,
    movimientos: () => estado.movimientos,
    usuario,
    guardarMedicamento,
    eliminarMedicamento,
    guardarLote,
    eliminarLote,
    registrarMovimiento,
    resumen,
    alertas,
    historial,
    buscar,
    normalizar,
  };
})();

// Inicializacion
Store.cargar();
