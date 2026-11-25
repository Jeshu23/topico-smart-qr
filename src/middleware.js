/* TÓPICO SMART QR — Autenticación, permisos, validación y errores */
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'clave-de-desarrollo-cambiar-en-produccion';

function generarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, username: usuario.username, rol: usuario.rol, nombre: usuario.nombre },
    SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '12h' }
  );
}

function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Debe iniciar sesión para continuar.' });
  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'La sesión venció o no es válida. Inicie sesión nuevamente.' });
  }
}

function permitir(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado.' });
    if (roles.length && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' });
    }
    next();
  };
}

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function errorHandler(error, req, res, next) {
  console.error('[ERROR]', req.method, req.originalUrl, error.message);
  if (res.headersSent) return next(error);
  const estado = Number(error.status) || 500;
  res.status(estado).json({
    error: estado === 500 ? 'Ocurrió un error interno. Revise los registros del servidor.' : error.message
  });
}

/* ------------------------- Validadores de entrada ------------------------- */
function texto(valor, nombre, { max = 160, requerido = true } = {}) {
  const v = String(valor ?? '').trim();
  if (requerido && !v) throw Object.assign(new Error(`El campo ${nombre} es obligatorio.`), { status: 400 });
  if (v.length > max) throw Object.assign(new Error(`El campo ${nombre} no puede superar ${max} caracteres.`), { status: 400 });
  return v;
}

function entero(valor, nombre, { min = 0, requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw Object.assign(new Error(`El campo ${nombre} es obligatorio.`), { status: 400 });
    return min;
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min) {
    throw Object.assign(new Error(`${nombre} debe ser un número entero ≥ ${min}.`), { status: 400 });
  }
  return n;
}

function fecha(valor, nombre, { requerido = true } = {}) {
  const v = String(valor ?? '').trim();
  if (!v) {
    if (requerido) throw Object.assign(new Error(`El campo ${nombre} es obligatorio.`), { status: 400 });
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T12:00:00`).getTime())) {
    throw Object.assign(new Error(`${nombre} debe tener formato AAAA-MM-DD.`), { status: 400 });
  }
  return v;
}

function opcion(valor, permitidos, nombre) {
  const v = String(valor ?? '').trim();
  if (!permitidos.includes(v)) throw Object.assign(new Error(`${nombre} no es válido.`), { status: 400 });
  return v;
}

module.exports = { generarToken, autenticar, permitir, asyncRoute, errorHandler, texto, entero, fecha, opcion };
