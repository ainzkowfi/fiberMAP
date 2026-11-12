import type { LineStatus } from "../domain/models";
import { LINE_STATUS_TITLE } from "../domain/models";

export interface LineBubbleData {
  id: string;
  name: string;
  status: LineStatus;
  /** Chainage of the whole route, e.g. "0+541 m". */
  lengthLabel: string;
  cores: number;
  pins: number;
  openCuts: number;
  repairs: number;
}

/**
 * The mini bubble that opens when a crew taps one of their own lines on the
 * map. It answers the two questions that come up in the field: what is this
 * line, and is it in trouble.
 */
export function LineBubble({
  data,
  onOpen,
}: {
  data: LineBubbleData;
  onOpen: () => void;
}) {
  const statusClass =
    data.status === "DAMAGED" ? " cut" : data.status === "PLANNED" ? " planned" : "";

  return (
    <div className="bubble" aria-label={`${data.name}, ${LINE_STATUS_TITLE[data.status]}`}>
      <div className="row between" style={{ gap: 8 }}>
        <strong className="grow" style={{ fontSize: 13, lineHeight: 1.25 }}>
          {data.name}
        </strong>
        <span className={`tag${statusClass}`}>{LINE_STATUS_TITLE[data.status]}</span>
      </div>

      <div className="small muted" style={{ marginTop: 2 }}>
        {data.lengthLabel} · {data.cores} cores
      </div>

      <div className="row small" style={{ gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        <span>{data.pins} pins</span>
        <span>{data.repairs} repairs</span>
        {data.openCuts > 0 && <span className="tag cut">{data.openCuts} open</span>}
      </div>

      <button className="btn" style={{ marginTop: 8, width: "100%" }} onClick={onOpen}>
        Open details
      </button>
    </div>
  );
}
