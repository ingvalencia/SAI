import { useEffect, useRef } from "react";
import Quagga from "quagga";
import Swal from "sweetalert2";
import Tesseract from "tesseract.js";

export default function EscanerCamaraQuagga({ modo = "barra", onScanSuccess, onClose }) {

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const bufferRef = useRef([]);
  const cooldownRef = useRef(false);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {

    const iniciarCamaraOCR = async () => {

      try {

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });

        streamRef.current = stream;

        const video = document.createElement("video");
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute("playsinline", true);
        video.setAttribute("webkit-playsinline", true);

        videoRef.current = video;

        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(video);

      } catch {

        Swal.fire({
          icon: "warning",
          title: "Permiso de cámara requerido",
          text: "Debes habilitar la cámara para usar el escáner"
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
              width: { ideal: 1280 },
              height: { ideal: 720 }
            },
            area: {
              top: "20%",
              right: "10%",
              left: "10%",
              bottom: "20%"
            }
          },
          locator: {
            patchSize: "large",
            halfSample: true
          },
          decoder: {
            readers: [
              {
                format: "code_39_reader",
                config: {
                  checksum: false,
                  extended: true
                }
              },
              "ean_reader",
              "ean_8_reader",
              "upc_reader"
            ]
          },
          locate: true,
          frequency: isIOS ? 6 : 18,
          numOfWorkers: isIOS ? 0 : navigator.hardwareConcurrency || 4
        },
        (err) => {

          if (err) {
            console.error(err);
            onClose();
            return;
          }

          Quagga.start();

        }
      );

      Quagga.onDetected((data) => {

        if (cooldownRef.current) return;

        const code = data?.codeResult?.code;
        if (!code) return;

        bufferRef.current.push(code);

        if (bufferRef.current.length > 5)
          bufferRef.current.shift();

        const iguales = bufferRef.current.filter(c => c === code).length;

        if (iguales >= 3) {

          cooldownRef.current = true;

          navigator.vibrate?.(80);

          onScanSuccess(code.trim());

          setTimeout(() => {

            cooldownRef.current = false;
            bufferRef.current = [];

          }, 900);

        }

      });

      Quagga.onProcessed((result) => {

        const ctx = Quagga.canvas.ctx.overlay;
        const canvas = Quagga.canvas.dom.overlay;

        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (result && result.box) {

          Quagga.ImageDebug.drawPath(
            result.box,
            { x: 0, y: 1 },
            ctx,
            { color: "#00FFFF", lineWidth: 4 }
          );

        }

      });

    };

    if (modo === "barra") iniciarQuagga();
    if (modo === "ocr") iniciarCamaraOCR();

    return () => {

      try { Quagga.stop(); } catch {}

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

    };

  }, [modo]);



  const leerOCR = async () => {

    const video = videoRef.current;

    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");

    const w = video.videoWidth;
    const h = video.videoHeight;

    canvas.width = w;
    canvas.height = h * 0.25;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      h * 0.35,
      w,
      h * 0.25,
      0,
      0,
      w,
      h * 0.25
    );

    Swal.fire({
      title: "Leyendo número...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const { data } = await Tesseract.recognize(canvas, "eng", {
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: 7
    });

    Swal.close();

    const texto = data.text.replace(/\s/g, "");

    const match = texto.match(/\d{8,14}/);

    if (match) {

      navigator.vibrate?.(80);

      onScanSuccess(match[0]);

    } else {

      Swal.fire(
        "No se pudo leer",
        "Acerca la cámara al número impreso",
        "warning"
      );

    }

  };


  return (

    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">

      <div className="w-full max-w-sm border border-green-400 rounded-lg bg-black p-2">

        <div
          ref={containerRef}
          className="w-full h-[320px] bg-black rounded overflow-hidden"
        />

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
