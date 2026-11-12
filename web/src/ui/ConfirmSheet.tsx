import { useRef } from "react";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";

export interface ConfirmSheetProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * In-app confirmation for a destructive action.
 *
 * The native `window.confirm` is not used anywhere in this app. On a phone,
 * inside an installed app, the browser can swallow that dialog, and the tap
 * then looks like nothing happened at all. A sheet in the app's own style
 * always shows, always reads the same way, and can say what will be lost.
 */
export function ConfirmSheet({
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEscape(onCancel);
  useDialog(sheetRef);

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={sheetRef}
        className="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="confirm-title">
            {title}
          </h2>
          <button className="btn ghost" onClick={onCancel} aria-label="Cancel">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <p id="confirm-body" className="small" style={{ margin: 0 }}>
            {body}
          </p>
        </div>
        <div className="sheet-foot">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
