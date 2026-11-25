/* TÓPICO SMART QR — Servidor Express + PostgreSQL */
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const { initDB } = require('./database/init');
const { errorHandler } = require('./src/middleware');
const { evaluarAlertas } = require('./src/services/alertas');

const app = express();
const RAIZ = __dirname;

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* Archivos estáticos: se reutilizan los estilos y recursos existentes del proyecto */
app.use('/css', express.static(path.join(RAIZ, 'css'), { fallthrough: true }));
app.use('/assets', express.static(path.join(RAIZ, 'assets'), { fallthrough: true }));
app.use('/js', express.static(path.join(RAIZ, 'public', 'js'), { fallthrough: true }));
app.use('/vendor', express.static(path.join(RAIZ, 'public', 'vendor'), { fallthrough: true }));

/* API */
app.use('/api/public', require('./src/routes/public'));
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/catalogo', require('./src/routes/catalogo'));
app.use('/api/inventario', require('./src/routes/inventario'));
app.use('/api/alertas', require('./src/routes/alertas'));
app.use('/api/usuarios', require('./src/routes/usuarios'));
app.use('/api/reportes', require('./src/routes/reportes'));

/* Aplicación (SPA) */
app.use(express.static(path.join(RAIZ, 'public'), { index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ruta de API no encontrada.' });
  res.sendFile(path.join(RAIZ, 'public', 'index.html'), (err) => (err ? next(err) : undefined));
});

app.use(errorHandler);

async function arrancar() {
  await initDB();
  const puerto = Number(process.env.PORT || 3000);
  const servidor = app.listen(puerto, '0.0.0.0', () => {
    console.log(`\n  TÓPICO SMART QR listo`);
    console.log(`  Abre: http://127.0.0.1:${puerto}\n`);
  });

  // Las alertas se recalculan automáticamente cada 10 minutos.
  const temporizador = setInterval(() => {
    evaluarAlertas().catch((e) => console.error('[Alertas] Error al reevaluar:', e.message));
  }, 10 * 60 * 1000);

  const cerrar = () => {
    clearInterval(temporizador);
    servidor.close(() => process.exit(0));
  };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

arrancar().catch((error) => {
  console.error('No fue posible iniciar el servidor:', error);
  process.exit(1);
});

module.exports = app;
