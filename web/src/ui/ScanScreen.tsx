import { useEffect, useRef, useState } from "react";
import {
  FrameCollector,
  parseFrameEnvelope,
  reassembleFrames,
} from "../core/qr";

export interface ScanScreenProps {
  /** The frames are all in and the payload checks out. */
  onComplete: (payload: string) => void;
  onCancel: () => void;
}

/**
 * Scans technician QR frames with the phone's rear camera.
 *
 * The frames can arrive in any order and the same frame can be scanned twice,
 * so they are collected by their number and the transfer only finishes when
 * every one of them is in and every checksum matches. A frame from another
 * transfer starts the collection over, because two transfers cannot be mixed.
 */
export function ScanScreen({ onComplete, onCancel }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const collectorRef = useRef(new FrameCollector());
  const [progress, setProgress] = useState({ count: 0, expected: 0 });
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const start = async () => {
      if (!window.isSecureContext) {
        setError(
          "The camera needs a secure connection. Open the app over https to scan, or paste the frames instead.",
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open a camera. Paste the frames instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (err) {
        const name = (err as Error).name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError(
            "The camera permission was declined. Allow it in the browser settings, or paste the frames instead.",
          );
          return;
        }
        if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError(
            "This phone has no camera the browser can use. Paste the frames instead.",
          );
          return;
        }
        setError(`The camera did not open: ${(err as Error).message}`);
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;

      // BarcodeDetector is the fast path. jsQR is the fallback for the
      // browsers that do not have it.
      const detector =
        "BarcodeDetector" in window
          ? new (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (d: ImageData) => Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector(
              { formats: ["qr_code"] },
            )
          : null;
      const jsQr = detector ? null : (await import("jsqr")).default;

      const scan = async () => {
        if (stopped) return;
        if (video.videoWidth > 0) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          let text: string | null = null;
          if (detector) {
            const codes = await detector.detect(image);
            text = codes[0]?.rawValue ?? null;
          } else if (jsQr) {
            text = jsQr(image.data, image.width, image.height, {
              inversionAttempts: "dontInvert",
            })?.data ?? null;
          }
          if (text) {
            const envelope = parseFrameEnvelope(text);
            if (envelope) {
              const result = collectorRef.current.add(envelope);
              setProgress({ count: result.count, expected: result.expected });
              if (result.restarted) {
                setNote(
                  "Another transfer started, so the frames of the first one were dropped.",
                );
              }
            } else {
              setNote("That code is not a fiberMAP frame.");
            }
          }
        }
        raf = requestAnimationFrame(() => void scan());
      };
      raf = requestAnimationFrame(() => void scan());
    };

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const collector = collectorRef.current;
    if (!collector.complete) return;
    let alive = true;
    void reassembleFrames(collector.frames()).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setError(result.error ?? "The frames did not add up.");
        return;
      }
      onComplete(result.payload);
    });
    return () => {
      alive = false;
    };
  }, [progress, onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "#071016",
        color: "#eef1f3",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: "calc(env(safe-area-inset-top) + 12px) 14px 12px",
          background:
            "linear-gradient(rgba(7,16,22,.85), rgba(7,16,22,0))",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="grow">
          <strong style={{ fontSize: 15 }}>
            {progress.expected
              ? `Frame ${progress.count} of ${progress.expected}`
              : "Looking for a frame"}
          </strong>
          <div className="small" style={{ opacity: 0.75 }}>
            {error ?? note ?? "Point the camera at the QR code on the other phone."}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="btn ghost"
            onClick={() => {
              collectorRef.current.reset();
              setProgress({ count: 0, expected: 0 });
              setNote("Cleared. Scan the frames again.");
              setError(null);
            }}
            style={{ background: "rgba(238,241,243,.14)", color: "#eef1f3" }}
          >
            Reset
          </button>
          <button
            className="btn ghost"
            onClick={onCancel}
            style={{ background: "rgba(238,241,243,.14)", color: "#eef1f3" }}
          >
            Cancel
          </button>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          top: "38%",
          bottom: "38%",
          border: "2px solid rgba(238,241,243,.85)",
          borderRadius: 12,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
