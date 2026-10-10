import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";

type CalEvent = {
  id: string;
  title: string;
  notes: string | null;
  startAt: number;
  endAt: number | null;
  allDay: boolean;
  source: "local" | "invited";
  inviteStatus: string | null;
  inviteId: string | null;
  mine: boolean;
};

type ViewMode = "month" | "week" | "day";
type WeekMode = "work" | "natural";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarPanel() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>("month");
  const [weekMode, setWeekMode] = useState<WeekMode>("natural");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [startLocal, setStartLocal] = useState("");

  const range = useMemo(() => {
    if (view === "day") {
      const from = startOfDay(cursor).getTime();
      return { from, to: from + 86400000 - 1 };
    }
    if (view === "week") {
      const day = cursor.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const weekStart = addDays(startOfDay(cursor), mondayOffset);
      const days = weekMode === "work" ? 5 : 7;
      const from = weekStart.getTime();
      return { from, to: from + days * 86400000 - 1, weekStart, days };
    }
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from: monthStart.getTime(), to: monthEnd.getTime() };
  }, [cursor, view, weekMode]);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ events: CalEvent[] }>(
      `/v1/calendar/events?from=${range.from}&to=${range.to}`,
    );
    setEvents(res.events);
    setNote(null);
  }, [range.from, range.to]);

  useEffect(() => {
    void refresh().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [refresh]);

  const dayEvents = useMemo(
    () => events.filter((e) => sameDay(new Date(e.startAt), cursor)),
    [events, cursor],
  );

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < startPad; i++) {
      cells.push({ date: addDays(first, i - startPad), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ date: addDays(cells[cells.length - 1]!.date, 1), inMonth: false });
    }
    return cells;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const day = cursor.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const weekStart = addDays(startOfDay(cursor), mondayOffset);
    const count = weekMode === "work" ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDays(weekStart, i));
  }, [cursor, weekMode]);

  async function createEvent() {
    if (!title.trim() || !startLocal) return;
    setBusy(true);
    try {
      const startAt = new Date(startLocal).getTime();
      await api("/v1/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          startAt,
          allDay,
        }),
      });
      setComposeOpen(false);
      setTitle("");
      setNotes("");
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function respondInvite(inviteId: string, accept: boolean) {
    setBusy(true);
    try {
      await api(`/v1/calendar/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });
      await refresh();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function shift(delta: number) {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    } else if (view === "week") {
      setCursor(addDays(cursor, delta * 7));
    } else {
      setCursor(addDays(cursor, delta));
    }
  }

  return (
    <div className="calendar-panel" data-testid="comms-calendar">
      <div className="chat-home-header">
        <div>
          <h2 style={{ marginBottom: "0.2rem" }}>{t("comms.calendar")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t("comms.calendarHint")}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setComposeOpen(true)}>
          + {t("comms.newEvent")}
        </button>
      </div>

      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      <div className="manage-subtabs" role="tablist">
        {(
          [
            ["month", "comms.viewMonth"],
            ["week", "comms.viewWeek"],
            ["day", "comms.viewDay"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            className={`manage-subtab${view === id ? " is-active" : ""}`}
            data-testid={`calendar-view-${id}`}
            onClick={() => setView(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {view === "week" && (
        <div className="toolbar" style={{ marginBottom: "0.65rem" }}>
          <button
            type="button"
            className={`btn ghost${weekMode === "natural" ? "" : ""}`}
            aria-pressed={weekMode === "natural"}
            onClick={() => setWeekMode("natural")}
          >
            {t("comms.weekNatural")}
          </button>
          <button
            type="button"
            className="btn ghost"
            aria-pressed={weekMode === "work"}
            onClick={() => setWeekMode("work")}
          >
            {t("comms.weekWork")}
          </button>
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
        <button type="button" className="btn ghost" onClick={() => shift(-1)}>
          ←
        </button>
        <strong>
          {view === "month"
            ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
            : cursor.toLocaleDateString()}
        </strong>
        <button type="button" className="btn ghost" onClick={() => shift(1)}>
          →
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => setCursor(startOfDay(new Date()))}
        >
          {t("comms.today")}
        </button>
      </div>

      {view === "month" && (
        <div className="cal-month" data-testid="calendar-month">
          {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
            <div key={d} className="cal-weekday muted">
              {d}
            </div>
          ))}
          {monthCells.map((cell) => {
            const count = events.filter((e) => sameDay(new Date(e.startAt), cell.date)).length;
            const selected = sameDay(cell.date, cursor);
            return (
              <button
                key={cell.date.toISOString()}
                type="button"
                className={`cal-cell${cell.inMonth ? "" : " is-muted"}${selected ? " is-selected" : ""}`}
                onClick={() => {
                  setCursor(startOfDay(cell.date));
                  setView("day");
                }}
              >
                <span>{cell.date.getDate()}</span>
                {count > 0 && <span className="cal-dot">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {view === "week" && (
        <div className="cal-week" data-testid="calendar-week">
          {weekDays.map((d) => {
            const list = events.filter((e) => sameDay(new Date(e.startAt), d));
            return (
              <button
                key={d.toISOString()}
                type="button"
                className={`cal-week-day${sameDay(d, cursor) ? " is-selected" : ""}`}
                onClick={() => {
                  setCursor(startOfDay(d));
                  setView("day");
                }}
              >
                <strong>
                  {d.getMonth() + 1}/{d.getDate()}
                </strong>
                <ul>
                  {list.slice(0, 3).map((e) => (
                    <li key={e.id}>{e.title}</li>
                  ))}
                  {list.length === 0 && <li className="muted">—</li>}
                </ul>
              </button>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <ul className="list" data-testid="calendar-day-list">
          {dayEvents.length === 0 && <li className="muted">{t("comms.noEvents")}</li>}
          {dayEvents.map((e) => (
            <li key={e.id}>
              <div className="convo-row" style={{ cursor: "default" }}>
                <strong>{e.title}</strong>
                <div className="muted">
                  {e.allDay
                    ? t("comms.allDay")
                    : new Date(e.startAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  {" · "}
                  {e.source === "invited" ? t("comms.invitedEvent") : t("comms.localEvent")}
                  {e.inviteStatus ? ` · ${e.inviteStatus}` : ""}
                </div>
                {e.notes ? <div className="muted">{e.notes}</div> : null}
                {e.source === "invited" && e.inviteStatus === "pending" && e.inviteId && (
                  <div className="toolbar" style={{ marginTop: "0.4rem" }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void respondInvite(e.inviteId!, true)}
                    >
                      {t("comms.accept")}
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={busy}
                      onClick={() => void respondInvite(e.inviteId!, false)}
                    >
                      {t("comms.decline")}
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {composeOpen && (
        <div className="chat-sheet-backdrop" role="presentation" onClick={() => setComposeOpen(false)}>
          <div
            className="chat-sheet"
            role="dialog"
            aria-modal="true"
            data-testid="calendar-compose"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="chat-sheet-head">
              <h3 style={{ margin: 0 }}>{t("comms.newEvent")}</h3>
              <button type="button" className="btn ghost" onClick={() => setComposeOpen(false)}>
                ✕
              </button>
            </div>
            <div className="field">
              <label>{t("comms.eventTitle")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("comms.eventStart")}</label>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>
            <label className="muted" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              {t("comms.allDay")}
            </label>
            <div className="field">
              <label>{t("comms.eventNotes")}</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <button
              type="button"
              className="btn"
              disabled={busy || !title.trim() || !startLocal}
              onClick={() => void createEvent()}
            >
              {t("comms.saveEvent")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
