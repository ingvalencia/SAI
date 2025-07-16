import { useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function LectorCodigoPorFoto({ onCodigoDetectado, onCerrar }) {
  const [mensaje, setMensaje] = useState("📷 Toma una foto del código");

  const manejarImagen = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMensaje("🔄 Procesando imagen...");

    try {
      const imageDataUrl = await readFileAsDataURL(file);
      const image = new Image();
      image.src = imageDataUrl;

      image.onload = async () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);

        const codeReader = new BrowserMultiFormatReader();
        const luminanceSource = codeReader.createBinaryBitmapFromCanvas(canvas);
        const result = await codeReader.decodeBitmap(luminanceSource);

        setMensaje("✅ Código detectado");
        onCodigoDetectado(result.getText());
      };
    } catch (error) {
      console.error(error);
      setMensaje("❌ No se pudo leer el código. Intenta otra foto.");
    }
  };

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center text-white px-4 text-center">
      <p className="mb-4 text-sm text-yellow-300">{mensaje}</p>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={manejarImagen}
        style={{
          padding: "1rem",
          background: "#fff",
          color: "#000",
          fontWeight: "bold",
          borderRadius: "8px",
          cursor: "pointer",
        }}
      />

      <button
        onClick={onCerrar}
        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-full font-bold"
      >
        Cancelar
      </button>
    </div>
  );
}
