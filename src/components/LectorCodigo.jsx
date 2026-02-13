import { useEffect, useRef } from "react";

export default function LectorCodigo({ onCodigoDetectado }) {
  const bufferRef = useRef("");
  const timerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= 4) {
          console.log(">>> disparando onCodigoDetectado:", code);
          onCodigoDetectado(code);
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;


        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          const code = bufferRef.current.trim();
          bufferRef.current = "";
          if (code.length >= 4) {
            console.log(">>> disparando (timeout) onCodigoDetectado:", code);
            onCodigoDetectado(code);
          }
        }, 200);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCodigoDetectado]);

  return null;
}
