"use client";

import { useState, useCallback } from "react";
import { slipVerify } from "promptparse/validate";
import imageCompression from "browser-image-compression";

type SlipData = {
  transRef: string;
  sendingBank: string;
};

type SlipScanOutput = {
  slipData: SlipData | null;
  slipImage: string; // compressed base64 data URL
};

type SlipScanResult =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "success"; data: SlipData }
  | { status: "no-qr" }
  | { status: "error"; message: string };

/**
 * Hook that extracts slip verification data from a payment slip image.
 *
 * Pipeline: compress image → BarcodeDetector (QR extraction) → promptparse slipVerify()
 * Returns { slipData, slipImage } — slipData has { transRef, sendingBank } if QR found,
 * slipImage is always the compressed base64 for the host to view.
 */
export function useSlipScanner() {
  const [result, setResult] = useState<SlipScanResult>({ status: "idle" });

  const scanSlip = useCallback(async (file: File): Promise<SlipScanOutput | null> => {
    setResult({ status: "scanning" });

    try {
      // Compress the image before processing
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      });

      // Convert compressed image to base64 data URL
      const slipImage = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressed);
      });

      // Create an ImageBitmap from the compressed file for BarcodeDetector
      const bitmap = await createImageBitmap(compressed);

      // Use BarcodeDetector API (with polyfill fallback)
      let BarcodeDetectorImpl: typeof BarcodeDetector;

      if ("BarcodeDetector" in globalThis) {
        BarcodeDetectorImpl = globalThis.BarcodeDetector;
      } else {
        const { BarcodeDetector: Polyfill } = await import("barcode-detector");
        BarcodeDetectorImpl = Polyfill as unknown as typeof BarcodeDetector;
      }

      const detector = new BarcodeDetectorImpl({ formats: ["qr_code"] });
      const barcodes = await detector.detect(bitmap);
      bitmap.close();

      // Try each detected QR code — find the first valid slip QR
      for (const barcode of barcodes) {
        const parsed = slipVerify(barcode.rawValue, true);
        if (parsed) {
          const data: SlipData = {
            transRef: parsed.transRef,
            sendingBank: parsed.sendingBank,
          };
          setResult({ status: "success", data });
          return { slipData: data, slipImage };
        }
      }

      // No valid slip QR found — still return the image so host can view it
      setResult({ status: "no-qr" });
      return { slipData: null, slipImage };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to scan slip";
      setResult({ status: "error", message });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  return { result, scanSlip, reset };
}
