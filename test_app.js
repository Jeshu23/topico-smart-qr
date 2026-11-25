const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\LAB02_PC05\\Desktop\\alvarado\\Descargas\\TRABAJOMILA\\index.html', 'utf8');
const app = fs.readFileSync('C:\\Users\\LAB02_PC05\\Desktop\\alvarado\\Descargas\\TRABAJOMILA\\js\\app.js', 'utf8');
const store = fs.readFileSync('C:\\Users\\LAB02_PC05\\Desktop\\alvarado\\Descargas\\TRABAJOMILA\\js\\store.js', 'utf8');
const views = fs.readFileSync('C:\\Users\\LAB02_PC05\\Desktop\\alvarado\\Descargas\\TRABAJOMILA\\js\\views.js', 'utf8');

const checks = [
  ['HTML has vista-contenido', html.includes('id="vista-contenido"')],
  ['HTML has css', html.includes('css/styles.css')],
  ['app.js has init', app.includes('const init')],
  ['app.js calls render', app.includes('render(')],
  ['app.js has DOMContentLoaded', app.includes('DOMContentLoaded')],
  ['store.js has cargar', store.includes('const cargar')],
  ['store.js has semilla', store.includes('const semilla')],
  ['views.js has render', views.includes('const render')],
  ['Scripts in correct order', html.indexOf('js/store.js') < html.indexOf('js/ui.js') && html.indexOf('js/ui.js') < html.indexOf('js/charts.js')],
];

checks.forEach(([name, result]) => {
  console.log((result ? 'OK' : 'FAIL') + ': ' + name);
});