// Servidor estático simple (Node) para BloomCare — puertos 8000 y 8001.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { existsSync, statSync } from "node:fs";

const ROOT = "C:\\Users\\LAB02_PC05\\Desktop\\alvarado\\Descargas\\TRABAJOMILA";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".map": "application/json" };

const servir = (port) =>
  http.createServer((req, res) => {
    const responder = async () => {
      const url = new URL(req.url || "/", "http://localhost");
      let pathname = url.pathname.slice(1) || "index.html";
      const safe = normalize(join(ROOT, pathname));
      const archivo = safe.startsWith(ROOT) && existsSync(safe) && statSync(safe).isFile() ? safe : join(ROOT, "index.html");
      const buf = await readFile(archivo);
      res.writeHead(200, { "Content-Type": TYPES[extname(archivo)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    };
    responder().catch((e) => {
      try {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
      } catch (e2) {}
    });
  }).listen(port, "127.0.0.1", () => console.log(`BloomCare servidor: http://127.0.0.1:${port}`));

servir(8004);
servir(8005);
