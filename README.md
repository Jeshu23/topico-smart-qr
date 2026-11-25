# TÓPICO SMART QR

Sistema web completo para la gestión del inventario de medicamentos de un tópico institucional.
Implementado con **Node.js + Express + PostgreSQL**, interfaz en español con Bootstrap 5, Chart.js,
SweetAlert2, QR reales por lote y escaneo con cámara.

## Inicio rápido

```powershell
# Desde la carpeta del proyecto
npm install
npm start
```

Abrir en el navegador: **http://127.0.0.1:3100**

> Alternativa: ejecutar `scripts\iniciar.cmd` con doble clic.

### Credenciales iniciales

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123!` | Administrador (acceso total) |
| `personal` | `Personal123!` | Personal del tópico |

Cámbielas después del primer ingreso desde **Mi cuenta → Cambiar contraseña**, o edite
`SEED_ADMIN_PASSWORD` / `SEED_STAFF_PASSWORD` en `.env` antes de la primera ejecución.

## Base de datos

El proyecto detectó PostgreSQL 15 instalado y creó su **propio clúster persistente** en
`data\pgdata` (no modifica el clúster del sistema).

- Motor: PostgreSQL 15
- Host/puerto: `127.0.0.1:55432`
- Base de datos: `topico_smart_qr`
- Usuario: `topico` (trust local)

Si el clúster no está activo (por ejemplo, tras reiniciar la computadora), `npm start` lo inicia
automáticamente con `pg_ctl.exe`. La ruta se configura en `.env` (`PG_BIN`, `PG_DATA`).
Para reinicializar el esquema y los datos base: `npm run db:init`.

## Módulos

- **Panel principal:** estadísticas calculadas desde la base de datos, gráficas de movimientos
  y categorías, últimos movimientos y alertas recientes.
- **Medicamentos:** alta, edición, consulta, desactivación y búsqueda/filtros.
- **Lotes:** varios por medicamento, vencimiento, stock mínimo, ubicación y QR único por lote.
- **Códigos QR:** generación real (paquete `qrcode`), descarga PNG, impresión, lectura por cámara
  (`html5-qrcode`) y consulta manual por token. Al abrir un QR desde el celular se muestra una ficha pública.
- **Inventario:** entradas, salidas FEFO (primero vence el lote que sale), ajustes, bloqueo de lotes
  vencidos y prevención de cantidades negativas. Todas las operaciones usan transacciones.
- **Alertas inteligentes:** stock mínimo/agotado y vencimientos a 90, 30 y 7 días; se recalculan
  automáticamente tras cada movimiento y cada 10 minutos, conservando el historial (nunca se borran).
- **Movimientos:** historial con usuario, lote, motivo, fecha y existencias antes/después.
- **Reportes:** inventario general, stock bajo, vencimientos y entradas/salidas; exportación PDF y Excel.
- **Usuarios:** administrador y personal, permisos por rol, contraseñas cifradas con bcrypt y JWT.

## Pruebas automatizadas ejecutadas

```powershell
npm test                 # 31 verificaciones de API, base de datos, QR, FEFO, alertas y reportes
node tests/browser.test.js  # 23 verificaciones en Chrome headless (páginas, botones y formularios)
```

Los datos creados por las pruebas se eliminan automáticamente al finalizar.

## Notas

- La cámara para escanear QR requiere acceder desde `127.0.0.1` o HTTPS (política del navegador).
- Las librerías de frontend están incluidas en `public\vendor`, por lo que no se depende de CDNs.
- Los archivos originales del proyecto (`index.html`, `js/`, `css/styles.css`, `server.mjs`) se
  conservaron. La aplicación nueva se sirve desde `public/` con Express.
- En producción cambie `JWT_SECRET` en `.env` por una clave larga y aleatoria.
