/* ==========================================================================
   BLOOMCARE — Generacion y lectura de codigos QR (medicina -> paciente)
   ========================================================================== */

const BloomQR = (function () {
  let stream = null;
  let detector = null;
  let activo = false;
  let timer = null;
  let callback = null;

  const soportesBarcodeDetector = () => typeof window !== "undefined" && !!window.BarcodeDetector;

  const iniciar = async () => {
    if (activo) return;
    activo = true;
    const contenedor = document.querySelector("#bloom-qr-region");
    if (!contenedor) { activo = false; return; }
    try {
      if (soportesBarcodeDetector()) {
        detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        contenedor.innerHTML = '<video id="bloom-qr-video" autoplay playsinline muted></video><div class="scanner__overlay"></div><div class="scanner__corner scanner__corner--tl"></div><div class="scanner__corner scanner__corner--tr"></div><div class="scanner__corner scanner__corner--bl"></div><div class="scanner__corner scanner__corner--br"></div><div class="scanner__hint">Alinea el codigo QR del medicamento con el marco</div>';
        const video = document.getElementById("bloom-qr-video");
        video.srcObject = stream;
        await video.play();
        const canvas = document.createElement("canvas");
        const loop = async () => {
          if (!activo) return;
          try {
            const c = canvas;
            c.width = video.videoWidth || 640;
            c.height = video.videoHeight || 480;
            const cx = c.getContext("2d");
            cx.drawImage(video, 0, 0, c.width, c.height);
            const resultados = await detector.detect(c);
            if (resultados && resultados.length) {
              const texto = resultados[0].rawValue;
              detener();
              if (callback) callback(texto);
              return;
            }
          } catch (e) { /* reintento en el siguiente tick */ }
          timer = setTimeout(loop, 350);
        };
        loop();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/dist/html5-qrcode.min.js";
        script.onload = async () => {
          const Html5Qrcode = window.Html5Qrcode;
          if (!Html5Qrcode) return;
          const escáner = new Html5Qrcode("bloom-qr-region");
          await escáner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, (codigo) => { detener(); if (callback) callback(codigo); }, () => {});
        };
        document.body.appendChild(script);
      }
    } catch (e) {
      activo = false;
      window.dispatchEvent(new CustomEvent("bloomqr:error", { detail: { mensaje: (e && e.message) || "No fue posible acceder a la cámara." } }));
    }
  };

  const detener = () => {
    activo = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    const contenedor = document.querySelector("#bloom-qr-region");
    if (contenedor) contenedor.innerHTML = '<div class="scanner__overlay"></div>';
  };

  const escanear = (cb) => { callback = cb; return iniciar(); };

  const generar = async (texto) => {
    if (typeof window === "undefined" || typeof window.QRCode === "undefined") return { ok: false, error: "qrcode_lib_no_cargada" };
    const datos = await window.QRCode.toDataURL(texto, { width: 512, margin: 2, errorCorrectionLevel: "M", color: { dark: "#2f5175", light: "#ffffff" } });
    return { ok: true, dataUrl: datos };
  };

  return { escanear, detener, generar, activo: () => activo };
})();
