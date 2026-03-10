import { useEffect, useRef } from "react";
import Quagga from "@ericblade/quagga2";
import Swal from "sweetalert2";
import Tesseract from "tesseract.js";

export default function EscanerCamaraQuagga({ modo = "barra", onScanSuccess, onClose }) {

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const bufferRef = useRef([]);
  const cooldownRef = useRef(false);
  const lecturasNativasRef = useRef([]);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const detectorIntervalRef = useRef(null);
  const barcodeDetectorRef = useRef(null);

  const normalizarLectura = (valor) => {
    return String(valor || "")
      .trim()
      .toLowerCase()
      .replace(/[\s\r\n-]+/g, "");
  };

  const lecturaConfiable = (data) => {
    const code = data?.codeResult?.code;
    const errores = data?.codeResult?.decodedCodes;

    if (!code || !errores) return false;

    const promedio =
      errores
        .filter(e => e.error !== undefined)
        .reduce((a, b) => a + b.error, 0) / errores.length;

    if (promedio > 0.30) return false;

    if (code.length < 6) return false;

    return true;
  };

  const confirmarLecturaNativa = (codigo) => {
    const limpio = normalizarLectura(codigo);
    if (!limpio) return null;

    lecturasNativasRef.current.push(limpio);

    if (lecturasNativasRef.current.length > 6) {
      lecturasNativasRef.current.shift();
    }

    const repeticiones = lecturasNativasRef.current.filter((x) => x === limpio).length;

    if (repeticiones >= 3) {
      lecturasNativasRef.current = [];
      return limpio;
    }

    return null;
  };

  useEffect(() => {

    const iniciarBarcodeDetector = async () => {
      try {
        if (!("BarcodeDetector" in window)) return false;

        const formatosSoportados = await window.BarcodeDetector.getSupportedFormats();
        const formatosDeseados = [
          "code_39",
          "code_128",
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "codabar"
        ];
        const formatosFinales = formatosDeseados.filter((f) =>
          formatosSoportados.includes(f)
        );

        if (formatosFinales.length === 0) return false;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        streamRef.current = stream;

        const video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", true);
        video.setAttribute("webkit-playsinline", true);

        await video.play();

        videoRef.current = video;

        if (containerRef.current) {
          containerRef.current.innerHTML = "";
          containerRef.current.appendChild(video);
        }

        barcodeDetectorRef.current = new window.BarcodeDetector({
          formats: formatosFinales,
        });

        detectorIntervalRef.current = setInterval(async () => {
          if (cooldownRef.current) return;
          if (!videoRef.current || videoRef.current.readyState < 2) return;

          try {
            const barcodes = await barcodeDetectorRef.current.detect(videoRef.current);
            if (!barcodes || !barcodes.length) return;

            const code = barcodes[0]?.rawValue;
            if (!code) return;

            const confirmado = confirmarLecturaNativa(code);
            if (!confirmado) return;

            cooldownRef.current = true;
            navigator.vibrate?.(80);
            onScanSuccess(confirmado);

            setTimeout(() => {
              cooldownRef.current = false;
            }, 900);
          } catch (err) {
            console.error("BarcodeDetector error:", err);
          }
        }, 120);

        return true;
      } catch (err) {
        console.error("No se pudo iniciar BarcodeDetector:", err);
        return false;
      }
    };

    const iniciarCamaraOCR = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      await video.play();

      videoRef.current = video;

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(video);
      }
    } catch {
      Swal.fire({
        icon: "warning",
        title: "Permiso de cámara requerido",
        text: "Debes habilitar la cámara para usar el escáner",
      });

      onClose();
    }
  };

    const iniciarQuagga = () => {
      Quagga.init(
        {
          inputStream: {
            type: "LiveStream",
            target: containerRef.current,
            constraints: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            area: {
              top: "15%",
              right: "2%",
              left: "2%",
              bottom: "15%",
            },
          },
          locator: {
            patchSize: "x-large",
            halfSample: false,
          },
          decoder: {
            multiple: false,
          readers: [
            "code_39_reader",
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "codabar_reader"
          ]
        },
          locate: true,
          frequency: isIOS ? 12 : 45,
          numOfWorkers: isIOS ? 0 : Math.min(4, navigator.hardwareConcurrency || 4),
        },
        (err) => {
          if (err) {
            console.error("Error inicializando Quagga:", err);
            onClose();
            return;
          }

          Quagga.start();
        }
      );

      const onDetected = (data) => {
        if (cooldownRef.current) return;

        if (!lecturaConfiable(data)) return;

        const code = data?.codeResult?.code?.trim();
        if (!code) return;

        bufferRef.current.push(code);

        if (bufferRef.current.length > 6) {
          bufferRef.current.shift();
        }

        const iguales = bufferRef.current.filter((c) => c === code).length;

        if (iguales >= 3) {
          cooldownRef.current = true;
          navigator.vibrate?.(80);
          onScanSuccess(code);

          setTimeout(() => {
            cooldownRef.current = false;
            bufferRef.current = [];
          }, 900);
        }
      };

      const onProcessed = (result) => {
        const ctx = Quagga?.canvas?.ctx?.overlay;
        const canvas = Quagga?.canvas?.dom?.overlay;

        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result?.box) {
          Quagga.ImageDebug.drawPath(
            result.box,
            { x: 0, y: 1 },
            ctx,
            { color: "#00FFFF", lineWidth: 4 }
          );
        }
      };

      Quagga.offDetected?.();
      Quagga.offProcessed?.();

      Quagga.onDetected(onDetected);
      Quagga.onProcessed(onProcessed);
    };

    const iniciar = async () => {
      if (modo === "barra") {
        const usoDetectorNativo = await iniciarBarcodeDetector();
        if (!usoDetectorNativo) {
          iniciarQuagga();
        }
      }

      if (modo === "ocr") {
        iniciarCamaraOCR();
      }
    };

    iniciar();

    return () => {
      try {
        Quagga.offDetected?.();
        Quagga.offProcessed?.();
        Quagga.stop();
      } catch {}

      bufferRef.current = [];
      lecturasNativasRef.current = [];
      cooldownRef.current = false;

      if (detectorIntervalRef.current) {
        clearInterval(detectorIntervalRef.current);
        detectorIntervalRef.current = null;
      }

      barcodeDetectorRef.current = null;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };

  }, [modo]);



  const obtenerZonaGuia = (w, h) => {
    const guiaX = Math.floor(w * 0.12);
    const guiaY = Math.floor(h * 0.22);
    const guiaW = Math.floor(w * 0.76);
    const guiaH = Math.floor(h * 0.42);

    return { guiaX, guiaY, guiaW, guiaH };
  };

const leerOCR = async () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      await Swal.fire("Cámara no lista", "No se pudo obtener imagen de la cámara.", "warning");
      return;
    }

    const w = video.videoWidth;
    const h = video.videoHeight;

    const { guiaX, guiaY, guiaW, guiaH } = obtenerZonaGuia(w, h);

    const zonas = [
      {
        sx: guiaX,
        sy: guiaY + Math.floor(guiaH * 0.58),
        sw: guiaW,
        sh: Math.floor(guiaH * 0.18),
      },
      {
        sx: guiaX,
        sy: guiaY + Math.floor(guiaH * 0.62),
        sw: guiaW,
        sh: Math.floor(guiaH * 0.22),
      },
      {
        sx: guiaX,
        sy: guiaY + Math.floor(guiaH * 0.66),
        sw: guiaW,
        sh: Math.floor(guiaH * 0.24),
      },
    ];

    const procesarCanvas = (canvas, threshold = null) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return canvas;

      if (threshold === null) return canvas;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gris = Math.round((data[i] + data[i + 1] + data[i + 2]) / 3);
        const binario = gris > threshold ? 255 : 0;
        data[i] = binario;
        data[i + 1] = binario;
        data[i + 2] = binario;
      }

      ctx.putImageData(imageData, 0, 0);
      return canvas;
    };

    const crearCanvasZona = ({ sx, sy, sw, sh }, escala = 2) => {
      const canvas = document.createElement("canvas");
      canvas.width = sw * escala;
      canvas.height = sh * escala;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(
        video,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return canvas;
    };

    const intentarOCR = async (canvas) => {
      const resultado = await Tesseract.recognize(canvas, "eng", {
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: 7,
      });

      const textoLimpio = String(resultado?.data?.text || "")
        .replace(/[^\d]/g, "")
        .trim();

      const match = textoLimpio.match(/\d{6,18}/);
      return match ? match[0] : null;
    };

    Swal.fire({
      title: "Leyendo número...",
      text: "Procesando número impreso",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      for (const zona of zonas) {
        const baseCanvas = crearCanvasZona(zona, 2.2);
        if (!baseCanvas) continue;

        const variantes = [
          baseCanvas,
          procesarCanvas(crearCanvasZona(zona, 2.2), 160),
          procesarCanvas(crearCanvasZona(zona, 2.2), 180),
        ].filter(Boolean);

        for (const canvas of variantes) {
          const codigo = await intentarOCR(canvas);
          if (codigo) {
            Swal.close();
            navigator.vibrate?.(80);
            onScanSuccess(codigo);
            return;
          }
        }
      }

      Swal.close();
      await Swal.fire(
        "No se pudo leer",
        "Alinea el número con la línea amarilla y acércalo un poco más.",
        "warning"
      );
    } catch (error) {
      Swal.close();
      console.error("Error OCR:", error);

      await Swal.fire(
        "Error de lectura",
        "No se pudo procesar el número impreso.",
        "error"
      );
    }
  };


  return (

    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">

      <div className="w-full max-w-sm border border-green-400 rounded-lg bg-black p-2">

        <div className="relative w-full h-[320px] bg-black rounded overflow-hidden">
          <div
            ref={containerRef}
            className="absolute inset-0"
          />

          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-[76%] h-[42%] border-2 border-green-400 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]">
              <div className="absolute inset-x-0 top-[62%] border-t-2 border-dashed border-yellow-300" />
            </div>
          </div>
        </div>

        <div className="text-center mt-2">
          <p className="text-green-400 font-mono animate-pulse">
            📷 Escaneando
          </p>
        </div>

        {modo === "ocr" && (

          <button
            onClick={leerOCR}
            className="mt-3 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded shadow-md"
          >
            Leer número impreso
          </button>

        )}

        <button
          onClick={onClose}
          className="mt-3 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-md"
        >
          Cancelar
        </button>

      </div>

    </div>

  );

}
