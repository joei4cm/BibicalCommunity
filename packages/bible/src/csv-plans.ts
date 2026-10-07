export interface PlanDayRow {
  day: number;
  ref: string;
  title?: string;
  note?: string;
}

/** Parse reading-plan CSV: day,ref,title,note */
export function parsePlanCsv(csv: string): PlanDayRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const start = lines[0]?.toLowerCase().startsWith("day,") ? 1 : 0;
  const rows: PlanDayRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = splitCsvLine(line);
    const day = Number(cols[0]);
    const ref = cols[1]?.trim();
    if (!Number.isFinite(day) || !ref) {
      throw new Error(`Invalid CSV row ${i + 1}: ${line}`);
    }
    rows.push({
      day,
      ref,
      title: cols[2]?.trim() || undefined,
      note: cols[3]?.trim() || undefined,
    });
  }
  return rows;
}

export function serializePlanCsv(rows: PlanDayRow[]): string {
  const header = "day,ref,title,note";
  const body = rows.map((r) =>
    [r.day, escape(r.ref), escape(r.title ?? ""), escape(r.note ?? "")].join(","),
  );
  return [header, ...body].join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function escape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
