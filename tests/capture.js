const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
(async () => {
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new', args: ['--no-sandbox']
  });
  const pg = await b.newPage();
  await pg.setViewport({ width: 1440, height: 980, deviceScaleFactor: 1 });
  await pg.goto('http://127.0.0.1:3100', { waitUntil: 'networkidle0' });
  await pg.type('#login-usuario', 'admin');
  await pg.type('#login-password', 'Admin123!');
  await pg.click('#form-login button[type=submit]');
  await pg.waitForSelector('#vista-contenido .stat-card', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 700));
  await pg.screenshot({ path: path.join(__dirname, '..', 'docs', 'dashboard.png'), fullPage: true });
  await b.close();
  console.log('Captura guardada.');
})();
