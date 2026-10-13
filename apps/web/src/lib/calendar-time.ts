/** Helpers for calendar compose inputs (mobile-safe date/datetime values). */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` for `<input type="date">`. */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** `YYYY-MM-DDTHH:mm` for `<input type="datetime-local">`. */
export function toDateTimeLocalValue(d: Date): string {
  return `${toDateInputValue(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Parse compose start into epoch ms.
 * - allDay + date → local midnight
 * - timed + datetime-local → that instant
 * Returns null when invalid.
 */
export function parseEventStartMs(raw: string, allDay: boolean): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (allDay) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const day = Number(m[3]);
    const d = new Date(y, mo, day);
    if (Number.isNaN(d.getTime())) return null;
    return d.getTime();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}
