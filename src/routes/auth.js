/* TÓPICO SMART QR — Autenticación y sesión */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../../database/db');
const { generarToken, autenticar, asyncRoute, texto } = require('../middleware');

const router = express.Router();

router.post('/login', asyncRoute(async (req, res) => {
  const username = texto(req.body.username, 'Usuario', { max: 60 }).toLowerCase();
  const password = texto(req.body.password, 'Contraseña', { max: 200 });
  const { rows } = await query('SELECT * FROM usuarios WHERE lower(username) = $1', [username]);
  const usuario = rows[0];
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }
  const ok = await bcrypt.compare(password, usuario.password_hash);
  if (!ok) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });

  await query('UPDATE usuarios SET last_login = now() WHERE id = $1', [usuario.id]);
  const publico = { id: usuario.id, nombre: usuario.nombre, username: usuario.username, rol: usuario.rol, email: usuario.email };
  res.json({ token: generarToken(usuario), usuario: publico });
}));

router.get('/me', autenticar, asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT id, nombre, username, email, rol, activo, created_at, last_login FROM usuarios WHERE id = $1', [req.usuario.sub]);
  if (!rows[0] || !rows[0].activo) return res.status(401).json({ error: 'Usuario inactivo.' });
  res.json(rows[0]);
}));

router.post('/cambiar-password', autenticar, asyncRoute(async (req, res) => {
  const actual = texto(req.body.actual, 'Contraseña actual', { max: 200 });
  const nueva = texto(req.body.nueva, 'Nueva contraseña', { max: 200 });
  if (nueva.length < 8) throw Object.assign(new Error('La nueva contraseña debe tener al menos 8 caracteres.'), { status: 400 });
  const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [req.usuario.sub]);
  if (!rows[0] || !(await bcrypt.compare(actual, rows[0].password_hash))) {
    throw Object.assign(new Error('La contraseña actual no es correcta.'), { status: 400 });
  }
  await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(nueva, 10), req.usuario.sub]);
  res.json({ mensaje: 'Contraseña actualizada correctamente.' });
}));

module.exports = router;
