import { useMemo, useState } from "react";
import type { LineWithStats } from "../domain/models";
import { LINE_STATUS_TITLE } from "../domain/models";
import { getFiberColor } from "../data/reference";
import { formatChainage } from "../core/geometry";

type Filter = "ALL" | "ACTIVE" | "DAMAGED" | "PLANNED";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "DAMAGED", label: "Damaged" },
  { key: "PLANNED", label: "Planned" },
];

export interface LinesListProps {
  lines: LineWithStats[];
  chainageStyle: boolean;
  onLineClick: (stats: LineWithStats) => void;
  onSnapToMap: (stats: LineWithStats) => void;
  onDeleteLine: (stats: LineWithStats) => void;
}

const TRASH_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="17"
    height="17"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
  </svg>
);

export function LinesList({
  lines,
  chainageStyle,
  onLineClick,
  onSnapToMap,
  onDeleteLine,
}: LinesListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((s) => {
      if (filter !== "ALL" && s.line.status !== filter) return false;
      if (!q) return true;
      return (
        s.line.name.toLowerCase().includes(q) ||
        (s.line.coreCount?.toString() ?? "").includes(q) ||
        s.line.notes.toLowerCase().includes(q)
      );
    });
  }, [lines, query, filter]);

  return (
    <div className="scroll" style={{ padding: 14 }}>
      <div className="stack">

        <input
          type="search"
          placeholder="Search by line name, core count, notes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search lines"
        />

        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className="chip"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {f.key === "ALL" ? ` (${lines.length})` : ""}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            {lines.length === 0
              ? "No fiber lines yet. Draw one on the map to get started."
              : "No lines match this filter."}
          </div>
        ) : (
          filtered.map((s) => (
            <div key={s.line.id} className="row" style={{ gap: 8 }}>
              <button
                className="list-item grow"
                onClick={() => onLineClick(s)}
                aria-label={`Open ${s.line.name}`}
              >
                <span
                  className="swatch"
                  style={{ background: getFiberColor(s.line.colorKey) }}
                />
                <span className="grow">
                  <span className="row between">
                    <strong>{s.line.name}</strong>
                    <span className="tag">{LINE_STATUS_TITLE[s.line.status]}</span>
                  </span>
                  <span className="row small muted" style={{ gap: 12, marginTop: 4 }}>
                    <span>{formatChainage(s.line.lengthMapM, chainageStyle)}</span>
                    <span>{s.line.coreCount ?? 0}F</span>
                    <span>{s.totalPinsCount} pins</span>
                    {s.openCuts > 0 && (
                      <span className="tag cut">{s.openCuts} open</span>
                    )}
                  </span>
                </span>
              </button>
              <button
                className="btn"
                onClick={() => onSnapToMap(s)}
                aria-label={`Show ${s.line.name} on map`}
                title="Show on map"
              >
                ◎
              </button>
              <button
                className="btn danger"
                onClick={() => onDeleteLine(s)}
                aria-label={`Delete ${s.line.name}`}
                title="Delete line"
              >
                {TRASH_ICON}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
