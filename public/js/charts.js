/* TÓPICO SMART QR — Gráficas con Chart.js */
const Charts = (function () {
  const instancias = {};
  const destruir = (id) => { if (instancias[id]) { instancias[id].destroy(); delete instancias[id]; } };

  function linea(id, etiquetas, series) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destruir(id);
    const colores = ['#5f93c6', '#cf6a5e', '#2f9e7d', '#6d5aa8'];
    instancias[id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: series.map((s, i) => ({
          label: s.label, data: s.data, borderColor: s.color || colores[i % colores.length],
          backgroundColor: `${s.color || colores[i % colores.length]}22`, borderWidth: 2.5,
          tension: 0.35, fill: true, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: '#fff',
          pointBorderWidth: 2
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { family: 'Inter', size: 12 } } },
          tooltip: { backgroundColor: '#123c5e', padding: 10, cornerRadius: 8 } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0, color: '#5f7290' }, grid: { color: 'rgba(120,169,212,.14)' } },
          x: { ticks: { color: '#5f7290' }, grid: { display: false } }
        }
      }
    });
  }

  function dona(id, etiquetas, datos) {
    const canvas = document.getElementById(id);
    if (!canvas || typeof Chart === 'undefined') return;
    destruir(id);
    const valores = datos.length ? datos : [1];
    const nombres = etiquetas.length ? etiquetas : ['Sin datos'];
    instancias[id] = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: nombres, datasets: [{ data: valores,
        backgroundColor: ['#78a9d4', '#3d6791', '#a8c4dd', '#6d5aa8', '#2f9e7d', '#d9a441', '#cf6a5e'],
        borderWidth: 3, borderColor: '#fff', hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { family: 'Inter', size: 11.5 } } },
          tooltip: { backgroundColor: '#123c5e', padding: 10, cornerRadius: 8 } }
      }
    });
  }

  return { linea, dona, destruir };
})();
