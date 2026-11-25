/* TÓPICO SMART QR — API Express ejecutada como Netlify Function */
const serverless = require('serverless-http');
const { initDB } = require('../../database/init');
const { crearApp } = require('../../server');

let manejadorPromise = null;

async function obtenerManejador() {
  if (!manejadorPromise) {
    manejadorPromise = (async () => {
      await initDB();
      const app = crearApp();
      return serverless(app, {
        binary: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]
      });
    })().catch((error) => {
      manejadorPromise = null;
      throw error;
    });
  }
  return manejadorPromise;
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const manejador = await obtenerManejador();
  return manejador(event, context);
};
