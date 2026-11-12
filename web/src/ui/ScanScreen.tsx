import { useEffect, useRef, useState } from "react";
import {
  parseFrameEnvelope,
  reassembleFrames,
  type FrameEnvelope,
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
 * every one of them is in and every checksum matches.
 */
export function ScanScreen({ onComplete, onCancel }: ScanScreenProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [frames, setFrames] = useState<Map<number, FrameEnvelope>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const total = frames.values().next().value?.totalCount ?? 0;

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
              setFrames((current) => {
                if (current.has(envelope.index)) return current;
                const next = new Map(current);
                next.set(envelope.index, envelope);
                return next;
              });
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
    if (!total || frames.size < total) return;
    let alive = true;
    void reassembleFrames([...frames.values()]).then((result) => {
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
  }, [frames, total, onComplete]);

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
            {total ? `Frame ${frames.size} of ${total}` : "Looking for a frame"}
          </strong>
          <div className="small" style={{ opacity: 0.75 }}>
            {error ?? note ?? "Point the camera at the QR code on the other phone."}
          </div>
        </div>
        <button
          className="btn ghost"
          onClick={onCancel}
          style={{ background: "rgba(238,241,243,.14)", color: "#eef1f3" }}
        >
          Cancel
        </button>
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
