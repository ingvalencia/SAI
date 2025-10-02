import { useEffect, useRef } from "react";
import Quagga from "quagga";
import Swal from "sweetalert2";

export default function EscanerCamaraQuagga({ onScanSuccess, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    // 1. Probar acceso real a cámara
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        // cerrar stream de prueba
        stream.getTracks().forEach((track) => track.stop());

        // 2. Iniciar Quagga si hay permiso
        Quagga.init(
          {
            inputStream: {
              type: "LiveStream",
              target: containerRef.current,
              constraints: {
                facingMode: { exact: "environment" }, // fuerza cámara trasera
                width: { min: 640, ideal: 1280 },
                height: { min: 480, ideal: 720 },
                focusMode: "continuous",
                advanced: [{ torch: false }], // flash apagado
              },
              area: { top: "20%", right: "15%", left: "15%", bottom: "20%" },
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
            frequency: 2,
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

        const onDetect = (data) => {
          if (data?.codeResult?.code) {
            Quagga.stop();
            onScanSuccess(data.codeResult.code.trim());
          }
        };

        Quagga.onDetected(onDetect);

        // limpiar al desmontar
        return () => {
          try {
            Quagga.offDetected(onDetect);
          } catch {}
          try {
            Quagga.stop();
          } catch {}
        };
      })
      .catch(() => {
        // 3. Si no hay permiso, mostrar alerta
        Swal.fire({
          icon: "warning",
          title: "Permiso de cámara requerido",
          html: `
            <div style="text-align:left; font-size:14px;">
              <p>Debes habilitar la cámara para usar el escáner.</p>
              <p><strong>En Android:</strong></p>
              <ol>
                <li>Ve a <b>Ajustes → Aplicaciones</b>.</li>
                <li>Busca <b>Diniz Inventarios</b>.</li>
                <li>Entra en <b>Permisos</b> y activa <b>Cámara</b>.</li>
              </ol>
              <p>O en Chrome: Menú (⋮) → <b>Información del sitio</b> → <b>Permisos</b> → <b>Cámara</b> → Permitir.</p>
              <p><strong>En iOS:</strong> Ajustes → Safari/Chrome → Cámara → Permitir.</p>
            </div>
          `,
          confirmButtonText: "Entendido",
        });
        onClose();
      });
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
