import { useEffect, useRef } from "react";

export default function LectorCodigo({ onCodigoDetectado }) {
  const inputRef = useRef(null);
  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!esMovil && inputRef.current) {
      inputRef.current.focus();

      const interval = setInterval(() => {
        if (document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [esMovil]);

  const manejarCambio = (e) => {
    const input = e.target;

    // Limpia cualquier timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Espera 100ms antes de leer el valor, para dar tiempo al lector
    timeoutRef.current = setTimeout(() => {
      const codigo = input.value.trim();
      if (codigo.length >= 4) {
        onCodigoDetectado(codigo);
      }
      input.value = ""; // limpia después
    }, 100);
  };

  return (
    <>
      {!esMovil && (
        <div className="fixed bottom-0 left-0 w-0 h-0 overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            onChange={manejarCambio}
            className="opacity-0 absolute"
            autoFocus
          />
        </div>
      )}

      {esMovil && (
        <button
          onClick={() => alert("Aquí se abrirá el escáner de cámara (html5-qrcode)")}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded shadow"
        >
          📷 Escanear código con cámara
        </button>
      )}
    </>
  );
}
