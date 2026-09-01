import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

type Props = {
  url: string;
  size?: number;
};

export function QRCode({ url, size = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && url) {
      QRCodeLib.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: { dark: "#ffffff", light: "#1a1a2e" },
      });
    }
  }, [url, size]);

  return <canvas ref={canvasRef} style={{ borderRadius: 8 }} />;
}
