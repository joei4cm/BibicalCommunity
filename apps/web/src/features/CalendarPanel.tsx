import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, getToken } from "../lib/api";
import {
  parseEventStartMs,
  toDateInputValue,
  toDateTimeLocalValue,
} from "../lib/calendar-time";
import { humanizeStatus } from "../lib/status";
import { SheetPortal } from "../components/SheetPortal";
import { IconChevronLeft, IconChevronRight } from "../components/icons";

type CalEvent = {
  id: string;
  title: string;
  notes: string | null;
  startAt: number;
  endAt: number | null;
  allDay: boolean;
  kind?: "event" | "seminar";
  source: "local" | "invited";
  inviteStatus: string | null;
  inviteId: string | null;
  mine: boolean;
};

type FriendRow = {
  user: { id: string; uid?: string | null; nickname?: string | null };
};

type EventKind = "event" | "seminar";

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

function weekStartMonday(d: Date) {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(startOfDay(d), mondayOffset);
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function eventHour(e: CalEvent) {
  return new Date(e.startAt).getHours();
}

function friendLabel(f: FriendRow): string {
  return f.user.nickname?.trim() || f.user.uid?.trim() || f.user.id.slice(0, 8);
}

function defaultStartValue(cursor: Date, allDay: boolean): string {
  if (allDay) return toDateInputValue(cursor);
  const base = startOfDay(cursor);
  const now = new Date();
  if (sameDay(base, now)) {
    const rounded = new Date(now);
    rounded.setMinutes(0, 0, 0);
    rounded.setHours(rounded.getHours() + 1);
    return toDateTimeLocalValue(rounded);
  }
  base.setHours(9, 0, 0, 0);
  return toDateTimeLocalValue(base);
}

export function CalendarPanel({
  onBadgesMaybeChanged,
}: {
  onBadgesMaybeChanged?: () => void;
} = {}) {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<ViewMode>("week");
  const [weekMode, setWeekMode] = useState<WeekMode>("natural");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(true);
  const [eventKind, setEventKind] = useState<EventKind>("event");
  const [startLocal, setStartLocal] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [inviteeIds, setInviteeIds] = useState<string[]>([]);
  const agendaScrollRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => startOfDay(new Date()), []);

  const range = useMemo(() => {
    if (view === "day") {
      const from = startOfDay(cursor).getTime();
      return { from, to: from + 86400000 - 1 };
    }
    if (view === "week") {
      const weekStart = weekStartMonday(cursor);
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

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const loadFriends = useCallback(async () => {
    if (!getToken()) return;
    try {
      const fr = await api<{ friends: FriendRow[] }>("/v1/friends");
      setFriends(fr.friends);
    } catch {
      setFriends([]);
    }
  }, []);

  function openCompose() {
    setToast(null);
    setTitle("");
    setNotes("");
    setEventKind("event");
    setAllDay(true);
    setStartLocal(defaultStartValue(cursor, true));
    setInviteeIds([]);
    setComposeOpen(true);
    void loadFriends();
  }

  function closeCompose() {
    setComposeOpen(false);
  }

  function toggleInvitee(id: string) {
    setInviteeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onAllDayChange(next: boolean) {
    setAllDay(next);
    setStartLocal((prev) => {
      const ms = parseEventStartMs(prev, allDay);
      const base = ms != null ? new Date(ms) : cursor;
      return defaultStartValue(base, next);
    });
  }

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => sameDay(new Date(e.startAt), cursor))
        .slice()
        .sort((a, b) => a.startAt - b.startAt),
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

  const stripDays = useMemo(() => {
    if (view === "day") {
      // Nearby strip: selected day ±3 for quick jumping.
      return Array.from({ length: 7 }, (_, i) => addDays(cursor, i - 3));
    }
    const weekStart = weekStartMonday(cursor);
    const count = weekMode === "work" ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDays(weekStart, i));
  }, [cursor, view, weekMode]);

  const allDayEvents = useMemo(() => dayEvents.filter((e) => e.allDay), [dayEvents]);
  const timedEvents = useMemo(() => dayEvents.filter((e) => !e.allDay), [dayEvents]);

  // Scroll agenda to first timed event, else "now" when viewing today.
  useEffect(() => {
    if (view === "month") return;
    const el = agendaScrollRef.current;
    if (!el) return;
    let hour = 8;
    if (timedEvents.length > 0) {
      hour = Math.max(0, eventHour(timedEvents[0]!) - 1);
    } else if (sameDay(cursor, today)) {
      hour = Math.max(0, new Date().getHours() - 1);
    }
    const row = el.querySelector(`[data-hour="${hour}"]`);
    if (row instanceof HTMLElement) {
      el.scrollTop = Math.max(0, row.offsetTop - 8);
    }
  }, [cursor, view, timedEvents, today]);

  // Keep selected pill visible in the horizontal strip.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const selected = strip.querySelector(".cal-date-pill.is-selected");
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [cursor, view, weekMode]);

  async function createEvent() {
    if (!title.trim()) return;
    const startAt = parseEventStartMs(startLocal, allDay);
    if (startAt == null) {
      setNote("event_start_invalid");
      return;
    }
    setBusy(true);
    try {
      await api("/v1/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          startAt,
          allDay,
          kind: eventKind,
          inviteeIds: inviteeIds.length ? inviteeIds : undefined,
        }),
      });
      closeCompose();
      setTitle("");
      setNotes("");
      setEventKind("event");
      setInviteeIds([]);
      setCursor(startOfDay(new Date(startAt)));
      setView("day");
      setToast("event_saved");
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
      onBadgesMaybeChanged?.();
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

  function weekdayLabel(d: Date) {
    return d.toLocaleDateString(i18n.language, { weekday: "short" });
  }

  function renderEventBody(e: CalEvent) {
    return (
      <>
        <strong>
          {e.kind === "seminar" ? `${t("comms.seminar")} · ` : ""}
          {e.title}
        </strong>
        <div className="muted">
          {e.allDay
            ? t("comms.allDay")
            : new Date(e.startAt).toLocaleTimeString(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
          {" · "}
          {e.kind === "seminar"
            ? t("comms.seminar")
            : e.source === "invited"
              ? t("comms.invitedEvent")
              : t("comms.localEvent")}
          {e.inviteStatus ? ` · ${e.inviteStatus}` : ""}
        </div>
        {e.notes ? <div className="muted">{e.notes}</div> : null}
        {e.source === "invited" && e.inviteStatus === "pending" && e.inviteId && (
          <div className="toolbar" style={{ marginTop: "0.35rem" }}>
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
      </>
    );
  }

  function renderDayAgenda() {
    const byHour = new Map<number, CalEvent[]>();
    for (const e of timedEvents) {
      const h = eventHour(e);
      const list = byHour.get(h) ?? [];
      list.push(e);
      byHour.set(h, list);
    }
    const nowHour = sameDay(cursor, today) ? new Date().getHours() : -1;

    return (
      <div className="cal-agenda" data-testid="calendar-day-agenda">
        {allDayEvents.length > 0 && (
          <div className="cal-agenda-allday" data-testid="calendar-allday">
            <div className="cal-agenda-allday-label muted">{t("comms.allDay")}</div>
            <ul className="cal-agenda-allday-list">
              {allDayEvents.map((e) => (
                <li key={e.id} className={`cal-agenda-chip${e.kind === "seminar" ? " is-seminar" : ""}`}>
                  {renderEventBody(e)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="cal-agenda-scroll" ref={agendaScrollRef} data-testid="calendar-day-list">
          {dayEvents.length === 0 && (
            <p className="muted cal-agenda-empty">{t("comms.noEvents")}</p>
          )}
          {Array.from({ length: 24 }, (_, hour) => {
            const list = byHour.get(hour) ?? [];
            return (
              <div
                key={hour}
                className={`cal-agenda-row${hour === nowHour ? " is-now" : ""}${list.length ? " has-events" : ""}`}
                data-hour={hour}
              >
                <div className="cal-agenda-hour muted">{formatHour(hour)}</div>
                <div className="cal-agenda-slot">
                  {list.map((e) => (
                    <div
                      key={e.id}
                      className={`cal-agenda-event${e.kind === "seminar" ? " is-seminar" : ""}`}
                    >
                      {renderEventBody(e)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDateStrip(testId: string) {
    return (
      <div className="cal-date-strip" ref={stripRef} data-testid={testId}>
        {stripDays.map((d) => {
          const count = events.filter((e) => sameDay(new Date(e.startAt), d)).length;
          const selected = sameDay(d, cursor);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              type="button"
              className={`cal-date-pill${selected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              aria-pressed={selected}
              onClick={() => setCursor(startOfDay(d))}
            >
              <span className="cal-date-pill-dow">{weekdayLabel(d)}</span>
              <span className="cal-date-pill-num">{d.getDate()}</span>
              {count > 0 ? <span className="cal-date-pill-dot" aria-hidden /> : <span className="cal-date-pill-dot is-empty" aria-hidden />}
            </button>
          );
        })}
      </div>
    );
  }

  const statusNote =
    note === "event_start_invalid"
      ? t("comms.eventStartInvalid")
      : note
        ? humanizeStatus(t, note)
        : null;

  return (
    <div className="calendar-panel" data-testid="comms-calendar">
      {toast === "event_saved" && (
        <p className="muted" data-testid="calendar-event-saved">
          {t("comms.eventSaved")}
        </p>
      )}
      {statusNote && <p className="muted">{statusNote}</p>}

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
        <div className="toolbar cal-week-modes" style={{ marginBottom: "0.55rem" }}>
          <button
            type="button"
            className={`btn ghost${weekMode === "natural" ? " is-on" : ""}`}
            aria-pressed={weekMode === "natural"}
            onClick={() => setWeekMode("natural")}
          >
            {t("comms.weekNatural")}
          </button>
          <button
            type="button"
            className={`btn ghost${weekMode === "work" ? " is-on" : ""}`}
            aria-pressed={weekMode === "work"}
            onClick={() => setWeekMode("work")}
          >
            {t("comms.weekWork")}
          </button>
        </div>
      )}

      <div className="toolbar" style={{ marginBottom: "0.55rem" }}>
        <button type="button" className="btn ghost cal-nav-btn" onClick={() => shift(-1)} aria-label="prev">
          <IconChevronLeft />
        </button>
        <strong className="cal-cursor-label">
          {view === "month"
            ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
            : cursor.toLocaleDateString(i18n.language, {
                year: "numeric",
                month: "short",
                day: "numeric",
                weekday: "short",
              })}
        </strong>
        <button type="button" className="btn ghost cal-nav-btn" onClick={() => shift(1)} aria-label="next">
          <IconChevronRight />
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
        <div className="cal-week-outlook" data-testid="calendar-week">
          {renderDateStrip("calendar-week-strip")}
          {renderDayAgenda()}
        </div>
      )}

      {view === "day" && (
        <div className="cal-day-outlook" data-testid="calendar-day">
          {renderDateStrip("calendar-day-strip")}
          {renderDayAgenda()}
        </div>
      )}

      <button
        type="button"
        className="comms-fab"
        aria-label={t("comms.newEvent")}
        data-testid="calendar-new-event"
        onClick={openCompose}
      >
        +
      </button>

      {composeOpen && (
        <SheetPortal>
          <div className="sheet-backdrop" role="presentation" onClick={closeCompose}>
            <div
              className="sheet-panel"
              role="dialog"
              aria-modal="true"
              data-testid="calendar-compose"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet-handle" aria-hidden />
              <div className="chat-sheet-head">
                <h3 style={{ margin: 0 }}>{t("comms.newEvent")}</h3>
                <button type="button" className="btn ghost" onClick={closeCompose}>
                  ✕
                </button>
              </div>
              <div className="field">
                <label>{t("comms.eventKind")}</label>
                <div className="bible-more-actions" role="group">
                  <button
                    type="button"
                    className={`bible-text-btn${eventKind === "event" ? " is-on" : ""}`}
                    onClick={() => setEventKind("event")}
                  >
                    {t("comms.eventKind.event")}
                  </button>
                  <button
                    type="button"
                    className={`bible-text-btn${eventKind === "seminar" ? " is-on" : ""}`}
                    onClick={() => setEventKind("seminar")}
                  >
                    {t("comms.seminar")}
                  </button>
                </div>
              </div>
              <div className="field">
                <label>{t("comms.eventTitle")}</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="calendar-event-title"
                />
              </div>
              <div className="field">
                <label>{t("comms.eventStart")}</label>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                  data-testid="calendar-event-start"
                />
              </div>
              <label className="muted" style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => onAllDayChange(e.target.checked)}
                  data-testid="calendar-event-allday"
                />
                {t("comms.allDay")}
              </label>
              <div className="field">
                <label>{t("comms.eventNotes")}</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="field">
                <label>{t("comms.inviteFriends")}</label>
                {friends.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {t("comms.noFriendsToInvite")}
                  </p>
                ) : (
                  <ul className="cal-invite-list" data-testid="calendar-invite-list">
                    {friends.map((f) => (
                      <li key={f.user.id}>
                        <label className="cal-invite-row">
                          <input
                            type="checkbox"
                            checked={inviteeIds.includes(f.user.id)}
                            onChange={() => toggleInvitee(f.user.id)}
                          />
                          <span>{friendLabel(f)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="btn"
                disabled={busy || !title.trim() || !startLocal}
                data-testid="calendar-publish-event"
                onClick={() => void createEvent()}
              >
                {t("comms.publishEvent")}
              </button>
            </div>
          </div>
        </SheetPortal>
      )}
    </div>
  );
}
