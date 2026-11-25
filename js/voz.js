/* ==========================================================================
   BLOOMCARE — Asistente de voz para el inventario
   Usa la Web Speech API (reconocimiento) y Speech Synthesis (respuesta.
   ========================================================================== */

const BloomVoz = (function () {
  let reconocimiento = null;
  let activo = false;
  let escuchando = false;
  let oyente = null;
  let manejadorVoz = null;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const iniciar = () => {
    if (activo) return;
    if (!SpeechRecognition) { window.dispatchEvent(new CustomEvent("bloomvoz:error", { detail: { mensaje: "El navegador no soporta reconocimiento de voz." } })); return; }
    activo = true;
    const rec = new SpeechRecognition();
    rec.lang = "es-PE";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    rec.onresult = (evento) => {
      const texto = evento.results?.[0]?.[0]?.transcript || "";
      activo = false;
      escuchando = false;
      window.dispatchEvent(new CustomEvent("bloomvoz:codigo", { detail: { texto } }));
    };
    rec.onerror = () => { activo = false; escuchando = false; };
    rec.onend = () => { escuchando = false; activo = false; };
    reconocimiento = rec;
    rec.start();
    escuchando = true;
  };

  const detener = () => {
    if (reconocimiento) { try { reconocimiento.stop(); } catch (e) { /* noop */ } }
    activo = false;
    escuchando = false;
  };

  const hablar = (texto) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "es-PE";
    utterance.rate = 1.02;
    window.speechSynthesis.speak(utterance);
  };

  const responder = (texto) => {
    const consulta = (texto || "").toLowerCase();
    const medicamentos = Store?.medicamentos?.() || [];
    const nombre = medicamentos.find((m) => consulta.includes((m.nombre || "").toLowerCase()));
    let respuesta = "No encontré información sobre ese medicamento.";
    if (/stock bajo|bajo stock/.test(consulta)) {
      const bajos = medicamentos.filter((m) => (Number(m.stock) || 0) > 0 && (Number(m.stock) || 0) <= (Number(m.minStock) || 0));
      respuesta = bajos.length ? `Hay ${bajos.length} medicamentos con stock bajo: ${bajos.slice(0, 3).map((m) => m.nombre).join(", ")}.` : "No hay medicamentos con stock bajo.";
    } else if (/vencid/.test(consulta)) {
      const hoy = new Date().toISOString().slice(0, 10);
      const vencidos = medicamentos.filter((m) => m.fechaVencimiento && m.fechaVencimiento < hoy);
      respuesta = vencidos.length ? `Hay ${vencidos.length} medicamentos vencidos.` : "No hay medicamentos vencidos.";
    } else if (/proximo|próximo|vencer/.test(consulta)) {
      const hoy = new Date();
      const fin = new Date(); fin.setDate(hoy.getDate() + 30);
      const a = hoy.toISOString().slice(0, 10); const b = fin.toISOString().slice(0, 10);
      const prox = medicamentos.filter((m) => m.fechaVencimiento && m.fechaVencimiento >= a && m.fechaVencimiento <= b);
      respuesta = prox.length ? `Hay ${prox.length} medicamentos próximos a vencer.` : "No hay medicamentos próximos a vencer.";
    } else if (nombre) {
      respuesta = `El medicamento ${nombre.nombre} registra ${nombre.stock || 0} unidades disponibles, con lote ${nombre.lote || "sin asignar"} y fecha de vencimiento ${nombre.fechaVencimiento || "sin registrar"}.`;
    }
    hablar(respuesta);
    return respuesta;
  };

  const iniciarAsistente = (callback) => {
    if (manejadorVoz) { window.removeEventListener("bloomvoz:codigo", manejadorVoz); }
    const handler = (evento) => {
      const detalle = evento.detail || {};
      if (typeof callback === "function") callback(detalle.texto);
    };
    manejadorVoz = handler;
    window.addEventListener("bloomvoz:codigo", handler);
    iniciar();
    return () => window.removeEventListener("bloomvoz:codigo", handler);
  };

  return { iniciar, detener, hablar, responder, iniciarAsistente, escuchando: () => escuchando };
})();
