/* TÓPICO SMART QR — Gestión de usuarios y permisos */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../../database/db');
const { autenticar, permitir, asyncRoute, texto, opcion } = require('../middleware');

const router = express.Router();
router.use(autenticar, permitir('admin'));

router.get('/', asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT id, nombre, username, email, rol, activo, created_at, last_login FROM usuarios ORDER BY id');
  res.json(rows);
}));

router.post('/', asyncRoute(async (req, res) => {
  const nombre = texto(req.body.nombre, 'Nombre', { max: 120 });
  const username = texto(req.body.username, 'Usuario', { max: 60 }).toLowerCase();
  const email = texto(req.body.email, 'Correo', { max: 160, requerido: false }).toLowerCase() || null;
  const rol = opcion(req.body.rol, ['admin', 'personal'], 'Rol');
  const password = texto(req.body.password, 'Contraseña', { max: 200 });
  if (password.length < 8) throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { status: 400 });
  try {
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, username, email, password_hash, rol)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nombre, username, email, rol, activo, created_at`,
      [nombre, username, email, await bcrypt.hash(password, 10), rol]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('El usuario o correo ya está registrado.'), { status: 400 });
    throw e;
  }
}));

router.put('/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (id === Number(req.usuario.sub) && req.body.activo === false) {
    throw Object.assign(new Error('No puede desactivar su propio usuario.'), { status: 400 });
  }
  const nombre = texto(req.body.nombre, 'Nombre', { max: 120 });
  const email = texto(req.body.email, 'Correo', { max: 160, requerido: false }).toLowerCase() || null;
  const rol = opcion(req.body.rol, ['admin', 'personal'], 'Rol');
  const activo = req.body.activo === undefined ? true : Boolean(req.body.activo);
  try {
    const { rows } = await query(
      'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4 WHERE id=$5 RETURNING id, nombre, username, email, rol, activo, created_at, last_login',
      [nombre, email, rol, activo, id]
    );
    if (!rows[0]) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') throw Object.assign(new Error('El correo ya está registrado.'), { status: 400 });
    throw e;
  }
}));

router.post('/:id/password', asyncRoute(async (req, res) => {
  const password = texto(req.body.password, 'Contraseña', { max: 200 });
  if (password.length < 8) throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { status: 400 });
  const { rowCount } = await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(password, 10), Number(req.params.id)]);
  if (!rowCount) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  res.json({ mensaje: 'Contraseña restablecida correctamente.' });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (id === Number(req.usuario.sub)) throw Object.assign(new Error('No puede eliminar su propio usuario.'), { status: 400 });
  const { rowCount } = await query('DELETE FROM usuarios WHERE id = $1', [id]);
  if (!rowCount) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  res.json({ mensaje: 'Usuario eliminado.' });
}));

module.exports = router;
