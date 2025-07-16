import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

export default function EscanerCamaraZxing({ onScanSuccess, onClose }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    const iniciarEscaneo = async () => {
      try {
        const constraints = {
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ torch: false }],
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const [track] = stream.getVideoTracks();
        trackRef.current = track;

        const capabilities = track.getCapabilities();
        if (capabilities.torch) {
          setTorchSupported(true);
        }

        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader();
        }

        readerRef.current.decodeFromVideoDevice(
          null,
          videoRef.current,
          (result, err) => {
            if (result) {
              detenerEscaneo();
              onScanSuccess(result.getText());
            }
          }
        );
      } catch (error) {
        console.error("Error al iniciar la cámara:", error);
        onClose();
      }
    };

    const detenerEscaneo = async () => {
      try {
        if (readerRef.current && typeof readerRef.current.reset === "function") {
          readerRef.current.reset();
        }

        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach((track) => track.stop());
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      } catch (error) {
        console.warn("Error al detener el escáner:", error);
      }
    };

    iniciarEscaneo();
    return () => {
      detenerEscaneo();
    };
  }, [onScanSuccess, onClose]);

  const toggleTorch = async () => {
    try {
      if (!trackRef.current) return;
      await trackRef.current.applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (error) {
      console.error("No se pudo cambiar la linterna:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm bg-black border border-green-400 rounded-lg p-2">
        <video
          ref={videoRef}
          className="w-full rounded border-2 border-green-500"
          style={{
            filter: "contrast(120%) brightness(110%)",
            objectFit: "cover"
          }}
          muted
          playsInline
          autoFocus
        />
        <p className="text-green-400 text-center mt-2 font-mono animate-pulse">📷 Escaneando...</p>

        {torchSupported && (
          <button
            onClick={toggleTorch}
            className={`mt-4 px-4 py-2 ${
              torchOn ? "bg-yellow-500 hover:bg-yellow-600" : "bg-gray-700 hover:bg-gray-800"
            } text-white font-bold rounded shadow-md`}
          >
            {torchOn ? "💡 Apagar Linterna" : "🔦 Encender Linterna"}
          </button>
        )}

        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-md"
        >
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
}
