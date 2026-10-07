import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DevSignalStub } from "@logoshome/crypto";
import { api, getToken } from "../lib/api";
import { openSignalingChannel } from "../lib/webrtc";

type Conversation = {
  id: string;
  kind: "dm" | "group";
  title: string | null;
  disappearingTtlSec: number | null;
  createdBy: string;
  createdAt: number;
  membership: { id: string; role: string; archived: boolean };
};

type ChatMessage = {
  id: string;
  senderDeviceId: string;
  ratchetHeader: string;
  ciphertext: string;
  contentType: string;
  createdAt: number;
  expiresAt: number | null;
};

const TTL_OPTIONS = [
  { labelKey: "chat.ttlOff", value: null as number | null },
  { labelKey: "chat.ttl1h", value: 3600 },
  { labelKey: "chat.ttl1d", value: 86400 },
  { labelKey: "chat.ttl7d", value: 604800 },
];

const stub = new DevSignalStub();

export function ChatPanel() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [kind, setKind] = useState<"dm" | "group">("dm");
  const [title, setTitle] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [callNote, setCallNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const refreshConversations = useCallback(async () => {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    const res = await api<{ conversations: Conversation[] }>("/v1/chat/conversations");
    setConversations(res.conversations);
    setNote(null);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await api<{ messages: ChatMessage[] }>(
      `/v1/chat/conversations/${conversationId}/messages`,
    );
    setMessages(res.messages);
  }, []);

  useEffect(() => {
    void refreshConversations().catch((e) =>
      setNote(e instanceof Error ? e.message : "error"),
    );
  }, [refreshConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((e) =>
      setNote(e instanceof Error ? e.message : "error"),
    );
  }, [selectedId, loadMessages]);

  async function createConversation() {
    if (!getToken()) {
      setNote("login_required");
      return;
    }
    setBusy(true);
    try {
      const ids = memberIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        setNote("members_required");
        return;
      }
      const res = await api<{ id: string }>("/v1/chat/conversations", {
        method: "POST",
        body: JSON.stringify({
          kind,
          title: kind === "group" ? title || undefined : undefined,
          memberIds: ids,
        }),
      });
      setMemberIds("");
      setTitle("");
      await refreshConversations();
      setSelectedId(res.id);
      setNote(null);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    setBusy(true);
    try {
      const session = await stub.establishSession("dev-local", {
        identityKeyPub: "peer",
        signedPrekeyPub: "spk",
        signedPrekeySig: "sig",
        signedPrekeyId: 1,
        registrationId: 1,
      });
      const expiresAt = selected?.disappearingTtlSec
        ? Date.now() + selected.disappearingTtlSec * 1000
        : undefined;
      const enc = await stub.encrypt(session, draft.trim(), expiresAt);
      await api(`/v1/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          ratchetHeader: enc.ratchetHeader,
          ciphertext: enc.ciphertext,
          contentType: enc.contentType,
          expiresAt: enc.expiresAt,
        }),
      });
      setDraft("");
      await loadMessages(selectedId);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function patchTtl(ttl: number | null) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await api(`/v1/chat/conversations/${selectedId}`, {
        method: "PATCH",
        body: JSON.stringify({ disappearingTtlSec: ttl }),
      });
      await refreshConversations();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function startCall() {
    if (!selectedId) return;
    setBusy(true);
    setCallNote(null);
    try {
      const res = await api<{
        callId: string;
        signalingPath: string;
        note?: string;
      }>("/v1/chat/calls", {
        method: "POST",
        body: JSON.stringify({ conversationId: selectedId }),
      });
      // Dev: no absolute WS URL from the API response; use mock EventTarget channel.
      const channel = openSignalingChannel(null);
      setCallNote(
        `${t("chat.callStarted")}: ${res.callId} · ${res.signalingPath}` +
          (res.note ? ` · ${res.note}` : "") +
          ` · signaling=${channel instanceof WebSocket ? "ws" : "mock"}`,
      );
      if (!(channel instanceof WebSocket)) {
        channel.close();
      }
    } catch (e) {
      setCallNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("home.messages")}</h2>
      <p className="muted">
        E2EE DM / groups · {t("chat.disappearing")} · {t("chat.call")}
      </p>
      {note && <p className="muted">{note}</p>}

      <div className="field">
        <label>{t("chat.newConversation")}</label>
        <div className="toolbar">
          <select value={kind} onChange={(e) => setKind(e.target.value as "dm" | "group")}>
            <option value="dm">{t("chat.dm")}</option>
            <option value="group">{t("chat.group")}</option>
          </select>
        </div>
      </div>
      {kind === "group" && (
        <div className="field">
          <label>{t("chat.title")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>{t("chat.members")}</label>
        <input
          value={memberIds}
          onChange={(e) => setMemberIds(e.target.value)}
          placeholder="user_…"
        />
      </div>
      <button type="button" className="btn" disabled={busy} onClick={() => void createConversation()}>
        {t("chat.create")}
      </button>

      <ul className="list" style={{ marginTop: "1rem" }}>
        {conversations.length === 0 && <li className="muted">{t("chat.empty")}</li>}
        {conversations.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="btn ghost"
              style={{ width: "100%", textAlign: "start" }}
              onClick={() => setSelectedId(c.id)}
            >
              <strong>{c.title || c.kind}</strong>
              <div className="muted">
                {c.id}
                {c.disappearingTtlSec ? ` · TTL ${c.disappearingTtlSec}s` : ""}
                {selectedId === c.id ? ` · ${t("chat.selected")}` : ""}
              </div>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <>
          <div className="field" style={{ marginTop: "1rem" }}>
            <label>{t("chat.disappearing")}</label>
            <select
              value={selected.disappearingTtlSec ?? ""}
              disabled={busy || selected.membership.role !== "owner"}
              onChange={(e) => {
                const raw = e.target.value;
                void patchTtl(raw === "" ? null : Number(raw));
              }}
            >
              {TTL_OPTIONS.map((opt) => (
                <option key={String(opt.value)} value={opt.value ?? ""}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar">
            <button type="button" className="btn ghost" disabled={busy} onClick={() => void startCall()}>
              {t("chat.call")}
            </button>
            <button type="button" className="btn ghost" disabled>
              {t("chat.screenShare")}
            </button>
          </div>
          {callNote && <p className="muted">{callNote}</p>}

          <ul className="list">
            {messages.length === 0 && <li className="muted">{t("chat.noMessages")}</li>}
            {messages.map((m) => (
              <li key={m.id}>
                <code className="muted">{m.ciphertext.slice(0, 48)}…</code>
                <div className="muted">
                  {new Date(m.createdAt).toLocaleString()}
                  {m.expiresAt ? ` · exp ${new Date(m.expiresAt).toLocaleString()}` : ""}
                </div>
              </li>
            ))}
          </ul>

          <div className="field">
            <label>{t("chat.message")}</label>
            <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} />
          </div>
          <button type="button" className="btn" disabled={busy} onClick={() => void sendMessage()}>
            {t("chat.send")}
          </button>
        </>
      )}
    </div>
  );
}
