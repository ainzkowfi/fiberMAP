import { useRef, useState } from "react";
import { useEscape } from "./useEscape";
import { useDialog } from "./useDialog";
import { useEnter } from "./useEnter";

export interface PlaceLabelSheetProps {
  name: string;
  lat: number;
  lon: number;
  isNew: boolean;
  onSave: (name: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Naming a place on the map. The crew writes the name, the app keeps it with
 * the coordinates, and the name comes back on the map everywhere.
 *
 * A name that already exists opens read-only, so looking at a place never
 * risks overwriting it by accident.
 */
export function PlaceLabelSheet({
  name,
  lat,
  lon,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: PlaceLabelSheetProps) {
  const [editing, setEditing] = useState(isNew);
  const [text, setText] = useState(name);
  const sheetRef = useRef<HTMLDivElement>(null);

  const save = () => {
    if (text.trim()) onSave(text.trim());
  };

  useEscape(onCancel);
  useDialog(sheetRef);
  useEnter(() => {
    if (editing) save();
  });

  return (
    <div className="scrim" onClick={onCancel}>
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-label-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 className="grow" id="place-label-title">
            {isNew ? "Name this place" : "Place name"}
          </h2>
          <button className="btn ghost" onClick={onCancel} aria-label="Cancel">
            ✕
          </button>
        </div>

        {editing ? (
          <>
            <div className="sheet-body">
              <div className="field">
                <label htmlFor="place-name">Place or area name</label>
                <input
                  id="place-name"
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Purok 7, Sta. Maria NAP"
                />
              </div>
              <div className="small muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
              </div>
            </div>

            <div className="sheet-foot">
              {!isNew && (
                <button className="btn danger" onClick={onDelete}>
                  Remove
                </button>
              )}
              <button className="btn" onClick={() => (isNew ? onCancel() : setEditing(false))}>
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={!text.trim()}
                onClick={() => onSave(text.trim())}
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sheet-body">
              <div>
                <h3 className="detail-title">{name || "Unnamed place"}</h3>
                <div className="small muted">Named by the crew</div>
              </div>
              <div className="detail-group">
                <div className="kv">
                  <span className="muted">Coordinates</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {lat.toFixed(5)}°N, {lon.toFixed(5)}°E
                  </span>
                </div>
              </div>
            </div>
            <div className="sheet-foot">
              <button className="btn danger" onClick={onDelete}>
                Remove
              </button>
              <button className="btn primary" onClick={() => setEditing(true)}>
                Rename
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
