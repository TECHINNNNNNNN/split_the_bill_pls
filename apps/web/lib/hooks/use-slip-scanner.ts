"use client";

import { useState, useCallback } from "react";
import { slipVerify } from "promptparse/validate";

type SlipData = {
  transRef: string;
  sendingBank: string;
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
 * Pipeline: image → BarcodeDetector (QR extraction) → promptparse slipVerify()
 * Returns { transRef, sendingBank } which can be sent to the server for verification.
 */
export function useSlipScanner() {
  const [result, setResult] = useState<SlipScanResult>({ status: "idle" });

  const scanSlip = useCallback(async (file: File) => {
    setResult({ status: "scanning" });

    try {
      // Create an ImageBitmap from the file for BarcodeDetector
      const bitmap = await createImageBitmap(file);

      // Use BarcodeDetector API (with polyfill fallback)
      let BarcodeDetectorImpl: typeof BarcodeDetector;

      if ("BarcodeDetector" in globalThis) {
        BarcodeDetectorImpl = globalThis.BarcodeDetector;
      } else {
        // Load polyfill dynamically
        const { BarcodeDetector: Polyfill } = await import("barcode-detector");
        BarcodeDetectorImpl = Polyfill as unknown as typeof BarcodeDetector;
      }

      const detector = new BarcodeDetectorImpl({ formats: ["qr_code"] });
      const barcodes = await detector.detect(bitmap);
      bitmap.close();

      if (barcodes.length === 0) {
        setResult({ status: "no-qr" });
        return null;
      }

      // Try each detected QR code — find the first valid slip QR
      for (const barcode of barcodes) {
        const parsed = slipVerify(barcode.rawValue, true);
        if (parsed) {
          const data: SlipData = {
            transRef: parsed.transRef,
            sendingBank: parsed.sendingBank,
          };
          setResult({ status: "success", data });
          return data;
        }
      }

      // QR codes found but none are valid slip QR
      setResult({ status: "no-qr" });
      return null;
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
