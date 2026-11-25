/* ==========================================================================
   BLOOMCARE — Gráficas estadísticas (Chart.js, paleta Blue Aesthetic)
   ========================================================================== */

const BloomCharts = (function () {
  const COLORES = {
    primary: "#78a9d4",
    secundario: "#a8c4dd",
    oscuro: "#3d6791",
    claro: "#dcebfa",
    lavanda: "#8f7cc4",
    borde: "#eef5fb",
  };

  const opcionesBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { boxWidth: 10, boxHeight: 10, borderRadius: 3, color: "#5f7290", font: { size: 12 } } },
      tooltip: { backgroundColor: "#2f5175", padding: 10, cornerRadius: 8, titleFont: { size: 12 }, bodyFont: { size: 12 } },
    },
  };

  const crear = (canvas, tipo, datos, opciones = {}) => {
    if (!canvas || typeof window === "undefined" || typeof window.Chart === "undefined") return null;
    const previo = window.Chart.getChart ? window.Chart.getChart(canvas) : null;
    if (previo) previo.destroy();
    const ctx = canvas.getContext("2d");
    const config = {
      type,
      data: {
        labels: datos.labels || [],
        datasets: [
          {
            label: datos.label || "Datos",
            data: datos.datos || [],
            backgroundColor: tipo === "line" ? "rgba(120,169,212,0.18)" : COLORES.primary,
            borderColor: COLORES.primary,
            borderWidth: 2,
            borderRadius: tipo === "bar" ? 6 : undefined,
            fill: tipo === "line",
            tension: 0.35,
            pointRadius: tipo === "line" ? 3 : 0,
          },
        ],
      },
      options: {
        ...opcionesBase,
        ...opciones,
        scales: { ...(opciones.scales || {}) },
      },
    };
    return new window.Chart(ctx, config);
  };

  const lineal = (canvasId, labels, valores, label = "Consultas") =>
    crear(document.getElementById(canvasId), "line", { labels, datos: valores, label }, {
      scales: { x: { grid: { display: false }, ticks: { color: "#5f7290", font: { size: 11 } } }, y: { beginAtZero: true, grid: { color: "rgba(120,169,212,0.15)" }, ticks: { color: "#5f7290", font: { size: 11 } } },
      },
    });

  const barras = (canvasId, labels, valores, label = "Unidades") =>
    crear(document.getElementById(canvasId), "bar", { labels: labels, datos: valores, label: label }, {
      scales: {
        x: { grid: { display: false }, ticks: { color: "#5f7290", font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: "rgba(120,169,212,0.15)" }, ticks: { color: "#5f7290", font: { size: 11 } } },
      },
    });

  const circulo = (canvasId, labels, valores, label = "Participación") =>
    crear(document.getElementById(canvasId), "doughnut", { labels, datos: valores, label }, {
      cutout: "62%",
      plugins: { ...opcionesBase.plugins, legend: { position: "right", labels: { boxWidth: 10, boxHeight: 10, borderRadius: 3, color: "#5f7290", font: { size: 12 } } } },
    });

  return { crear, lineal, barras, circulo, COLORES };
})();
