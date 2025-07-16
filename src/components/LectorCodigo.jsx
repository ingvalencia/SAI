import { useEffect, useRef } from "react";

export default function LectorCodigo({ onCodigoDetectado, lectorActivo }) {
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (lectorActivo && inputRef.current) {
      inputRef.current.focus();

      const interval = setInterval(() => {
        if (
          lectorActivo &&
          document.activeElement !== inputRef.current
        ) {
          inputRef.current.focus();
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [lectorActivo]);

  const manejarCambio = (e) => {
    const input = e.target;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const codigo = input.value.trim();
      if (codigo.length >= 4) {
        onCodigoDetectado(codigo);
      }
      input.value = "";
    }, 100);
  };

  return (
    <div className="fixed bottom-0 left-0 w-0 h-0 overflow-hidden">
      <input
        ref={inputRef}
        type="text"
        onChange={manejarCambio}
        className="opacity-0 absolute"
        autoFocus
      />
    </div>
  );
}
