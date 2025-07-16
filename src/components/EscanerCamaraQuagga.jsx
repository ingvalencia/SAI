import { useEffect, useRef } from "react";
import Quagga from "quagga"; 


export default function EscanerCamaraQuagga({ onScanSuccess, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: containerRef.current,
          constraints: {
            facingMode: "environment",
            width: { min: 640, ideal: 1280 },
            height: { min: 480, ideal: 720 },
          },
        },
        decoder: {
          readers: [
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "code_128_reader",
            "code_39_reader",
          ],
        },
        locate: true,
        frequency: 2, // reduce consumo CPU
      },
      function (err) {
        if (err) {
          console.error("Error al iniciar Quagga:", err);
          onClose();
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((data) => {
      if (data?.codeResult?.code) {
        Quagga.stop();
        onScanSuccess(data.codeResult.code);
      }
    });

    return () => {
      Quagga.stop();
      Quagga.offDetected();
    };
  }, [onScanSuccess, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm border border-green-400 rounded-lg bg-black p-2">
        <div
          ref={containerRef}
          className="w-full h-[300px] bg-black rounded overflow-hidden"
        />
        <p className="text-green-400 text-center mt-2 font-mono animate-pulse">
          📷 Escaneando...
        </p>
        <button
          onClick={() => {
            Quagga.stop();
            onClose();
          }}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded shadow-md"
        >
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
}
