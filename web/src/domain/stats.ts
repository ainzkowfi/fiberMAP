import type {
  FiberLine,
  FiberPin,
  LineWithStats,
  PinEvent,
  PinState,
} from "./models";

/**
 * The condition of one line: how many cuts it has had, how many are still
 * open, and how much cable it needs.
 *
 * Only what the line record shows. Average repair time, cuts per kilometre and
 * the date of the last repair were on the old screen and were removed: the
 * repair log already carries the history, and a crew reading a line record
 * needs the condition now, not a trend.
 */
export function calculateLineStats(
  line: FiberLine,
  pins: FiberPin[],
  events: PinEvent[],
): LineWithStats {
  const linePins = pins.filter((p) => p.lineId === line.id && p.deletedAt === null);
  const eventsByPinId = new Map<string, PinEvent[]>();
  for (const ev of events) {
    if (ev.deletedAt !== null) continue;
    const list = eventsByPinId.get(ev.pinId);
    if (list) list.push(ev);
    else eventsByPinId.set(ev.pinId, [ev]);
  }

  let cutCount = 0;
  let repairCount = 0;
  let openCount = 0;

  for (const pin of linePins) {
    const pinEvents = eventsByPinId.get(pin.id) ?? [];
    const hasCutEvent =
      pinEvents.some((e) => e.kind === "cut") || pin.type === "CUT_REPAIR";
    const hasRepairEvent =
      pinEvents.some((e) => e.kind === "repaired") || pin.state === ("REPAIRED" as PinState);

    if (hasCutEvent) cutCount++;
    if (pin.state === "OPEN") openCount++;
    if (hasRepairEvent) repairCount++;
  }

  const totalSlackCoilsM = linePins
    .filter((p) => p.type === "SLACK_COIL")
    .reduce((s, p) => s + p.coilLengthM, 0);

  const cableLengthM =
    line.lengthMapM * (1 + line.slackPercent / 100) + totalSlackCoilsM;

  return {
    line,
    totalCuts: cutCount,
    totalRepairs: repairCount,
    openCuts: openCount,
    totalPinsCount: linePins.length,
    totalCableLengthM: cableLengthM,
  };
}
