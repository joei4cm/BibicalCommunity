import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ForumPostKind } from "@logoshome/shared";
import { api, apiUrl, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import { ExternalMedia } from "./media";
import { SheetPortal } from "../components/SheetPortal";

type Board = "notice" | "general" | "group";
type BoardInfo = { id: Board; postCount: number; latestAt: number | null };

type ForumPost = {
  id: string;
  churchId: string;
  groupId?: string | null;
  authorId: string;
  board: Board;
  kind: ForumPostKind;
  title: string;
  body: string;
  externalMediaUrl?: string | null;
  mediaKey?: string | null;
  payload: Record<string, unknown>;
  pinned?: boolean;
  readonly?: boolean;
  expiresAt?: number | null;
  expired?: boolean;
  createdAt: number;
};

type PostDetail = {
  post: ForumPost;
  stats: Record<string, unknown>;
  canModerate: boolean;
};

const BOARDS: Board[] = ["notice", "general", "group"];
const COMPOSE_KINDS: ForumPostKind[] = ["text", "poll", "chain", "survey", "riddle", "timed"];

type Props = {
  churchId: string | null;
  churches: Array<{ id: string; name: string }>;
  onSelectChurch: (id: string) => void;
  membershipGroups: string[];
  onNeedHome: () => void;
};

export function DadaoPanel({
  churchId,
  churches,
  onSelectChurch,
  membershipGroups,
  onNeedHome,
}: Props) {
  const { t } = useTranslation();
  const [board, setBoard] = useState<Board | null>(null);
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<ForumPostKind>("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [composeGroupId, setComposeGroupId] = useState("");
  const [pollOptions, setPollOptions] = useState("是\n否");
  const [surveyQ, setSurveyQ] = useState("你的想法？");
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleHint, setRiddleHint] = useState("");
  const [expiresHours, setExpiresHours] = useState(24);
  const [chainText, setChainText] = useState("");
  const [riddleGuess, setRiddleGuess] = useState("");
  const [surveyAnswer, setSurveyAnswer] = useState("");

  const loadBoards = useCallback(async () => {
    if (!getToken() || !churchId) {
      setBoards([]);
      return;
    }
    const r = await api<{ boards: BoardInfo[] }>(
      `/v1/home/${encodeURIComponent(churchId)}/boards`,
    );
    setBoards(r.boards ?? []);
  }, [churchId]);

  const loadPosts = useCallback(async () => {
    if (!getToken() || !churchId || !board) {
      setPosts([]);
      return;
    }
    const r = await api<{ posts: ForumPost[] }>(
      `/v1/home/${encodeURIComponent(churchId)}/posts?board=${encodeURIComponent(board)}`,
    );
    setPosts(r.posts ?? []);
  }, [churchId, board]);

  const loadDetail = useCallback(async () => {
    if (!getToken() || !activePostId) {
      setDetail(null);
      return;
    }
    const r = await api<PostDetail>(`/v1/home/posts/${encodeURIComponent(activePostId)}`);
    setDetail(r);
  }, [activePostId]);

  useEffect(() => {
    void loadBoards().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadBoards]);

  useEffect(() => {
    void loadPosts().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadPosts]);

  useEffect(() => {
    void loadDetail().catch((e) => setNote(e instanceof Error ? e.message : "error"));
  }, [loadDetail]);

  async function openAttachment(key: string) {
    try {
      const res = await fetch(apiUrl(`/v1/media/${encodeURIComponent(key)}`), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("media_fetch_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    }
  }

  async function uploadAttachment(file: File) {
    setBusy(true);
    try {
      const minted = await api<{ key: string; putUrl: string }>("/v1/media/upload-url", {
        method: "POST",
      });
      const putRes = await fetch(apiUrl(minted.putUrl), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!putRes.ok) throw new Error("media_upload_failed");
      setMediaKey(minted.key);
      setNote("saved");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  function resetCompose() {
    setKind("text");
    setTitle("");
    setBody("");
    setMediaUrl("");
    setMediaKey(null);
    setPollOptions("是\n否");
    setSurveyQ("你的想法？");
    setRiddleAnswer("");
    setRiddleHint("");
    setExpiresHours(24);
  }

  async function composePost() {
    if (!churchId || !board || !title.trim()) {
      setNote("home.postTitle");
      return;
    }
    if (board === "group" && !composeGroupId) {
      setNote("group_membership_required");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const payload: Record<string, unknown> = {};
      let expiresAt: number | undefined;
      if (kind === "poll") {
        payload.options = pollOptions
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (kind === "chain") {
        payload.prompt = body.trim() || undefined;
      } else if (kind === "survey") {
        payload.questions = [
          { id: "q1", text: surveyQ.trim() || t("home.postBody"), type: "text" },
        ];
      } else if (kind === "riddle") {
        payload.answer = riddleAnswer.trim();
        if (riddleHint.trim()) payload.hint = riddleHint.trim();
      } else if (kind === "timed") {
        expiresAt = Date.now() + Math.max(1, expiresHours) * 3600_000;
        payload.expiresAt = expiresAt;
      }

      await api("/v1/home/posts", {
        method: "POST",
        body: JSON.stringify({
          churchId,
          board,
          groupId: board === "group" ? composeGroupId : undefined,
          kind,
          title: title.trim(),
          body: body.trim(),
          externalMediaUrl: mediaUrl.trim() || undefined,
          mediaKey: mediaKey || undefined,
          payload,
          expiresAt,
        }),
      });
      resetCompose();
      setComposeOpen(false);
      setNote("home.postedOk");
      await loadPosts();
      await loadBoards();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function respond(action: string, payload: Record<string, unknown>) {
    if (!activePostId) return;
    setBusy(true);
    try {
      await api(`/v1/home/posts/${encodeURIComponent(activePostId)}/respond`, {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      });
      setNote("saved");
      setChainText("");
      setRiddleGuess("");
      await loadDetail();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function moderate(patch: Record<string, unknown>) {
    if (!activePostId) return;
    setBusy(true);
    try {
      await api(`/v1/home/posts/${encodeURIComponent(activePostId)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setNote("saved");
      if (patch.deleted) {
        setActivePostId(null);
        setDetail(null);
        await loadPosts();
      } else {
        await loadDetail();
        await loadPosts();
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  async function exportStats() {
    if (!activePostId) return;
    setBusy(true);
    try {
      const r = await api<Record<string, unknown>>(
        `/v1/home/posts/${encodeURIComponent(activePostId)}/export`,
      );
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dadao-${activePostId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("home.exportOk");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "error");
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (k: string) => t(`home.kindPost.${k}`);

  const feed = useMemo(
    () =>
      posts.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className={`dadao-feed-card${p.pinned ? " is-pinned" : ""}`}
            onClick={() => setActivePostId(p.id)}
            data-testid={`dadao-post-${p.id}`}
          >
            <div className="dadao-feed-meta">
              {p.pinned ? <span className="dadao-chip">{t("home.pinned")}</span> : null}
              <span className="dadao-chip muted-chip">{kindLabel(p.kind)}</span>
              {p.expired ? <span className="dadao-chip">{t("home.expired")}</span> : null}
            </div>
            <div className="dadao-feed-title">{p.title}</div>
            {p.body ? <p className="dadao-feed-body">{p.body}</p> : null}
            <div className="muted dadao-feed-time">
              {t("home.postedAt")} · {new Date(p.createdAt).toLocaleString()}
            </div>
          </button>
        </li>
      )),
    [posts, t],
  );

  if (!churchId) {
    return (
      <div className="panel" data-testid="home-forum-empty">
        <p className="muted" style={{ marginTop: 0 }}>
          {t("home.forumNeedHome")}
        </p>
        <button type="button" className="btn" onClick={onNeedHome}>
          {t("home.goHome")}
        </button>
      </div>
    );
  }

  return (
    <div className="dadao-panel" data-testid="home-forum-panel">
      {note && <p className="muted">{humanizeStatus(t, note)}</p>}

      {churches.length > 1 && !board && !activePostId && (
        <div className="field">
          <label>{t("home.pickHome")}</label>
          <select
            value={churchId}
            onChange={(e) => {
              onSelectChurch(e.target.value);
              setBoard(null);
              setActivePostId(null);
            }}
            data-testid="home-forum-church-select"
          >
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* L1 boards */}
      {!board && !activePostId && (
        <div className="panel">
          <h2>{t("home.tabForum")}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {t("home.boardsHint")}
          </p>
          <ul className="board-card-list" data-testid="home-board-list">
            {BOARDS.map((b) => {
              const info = boards.find((x) => x.id === b);
              return (
                <li key={b}>
                  <button
                    type="button"
                    className="board-card"
                    onClick={() => setBoard(b)}
                    data-testid={`home-board-${b}`}
                  >
                    <div className="board-card-title">{t(`home.board.${b}`)}</div>
                    <div className="muted">
                      {t("home.boardPostCount", { count: info?.postCount ?? 0 })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* L2 feed */}
      {board && !activePostId && (
        <div className="panel dadao-feed-panel">
          <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setBoard(null)}
              data-testid="dadao-back-boards"
            >
              {t("home.backBoards")}
            </button>
          </div>
          <h2>{t(`home.board.${board}`)}</h2>
          <ul className="dadao-feed" data-testid="dadao-feed">
            {posts.length === 0 && <li className="muted">{t("home.noPosts")}</li>}
            {feed}
          </ul>
        </div>
      )}

      {/* L3 detail */}
      {activePostId && detail && (
        <div className="panel dadao-detail" data-testid="dadao-detail">
          <div className="toolbar" style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setActivePostId(null);
                setDetail(null);
              }}
            >
              {t("home.backFeed")}
            </button>
          </div>
          <div className="dadao-feed-meta">
            {detail.post.pinned ? <span className="dadao-chip">{t("home.pinned")}</span> : null}
            <span className="dadao-chip muted-chip">{kindLabel(detail.post.kind)}</span>
            {detail.post.readonly ? <span className="dadao-chip">{t("home.readonly")}</span> : null}
          </div>
          <h2 style={{ marginBottom: "0.35rem" }}>{detail.post.title}</h2>
          {detail.post.body ? <p className="dadao-feed-body">{detail.post.body}</p> : null}
          <p className="muted" style={{ fontSize: "0.82rem" }}>
            {t("home.postedAt")} · {new Date(detail.post.createdAt).toLocaleString()}
          </p>
          {detail.post.externalMediaUrl ? (
            <ExternalMedia url={detail.post.externalMediaUrl} />
          ) : null}
          {detail.post.mediaKey ? (
            <button
              type="button"
              className="linkish"
              onClick={() => void openAttachment(detail.post.mediaKey!)}
            >
              {t("home.attachment")}
            </button>
          ) : null}

          {/* Interactions */}
          {detail.post.kind === "poll" && (
            <div className="dadao-interact" data-testid="dadao-poll">
              <h3>{t("home.kindPost.poll")}</h3>
              {((detail.post.payload.options as string[]) ?? []).map((opt, i) => {
                const counts = (detail.stats.voteCounts as Record<string, number>) ?? {};
                const n = counts[String(i)] ?? 0;
                return (
                  <button
                    key={opt}
                    type="button"
                    className="btn ghost dadao-option"
                    disabled={busy || detail.post.readonly || detail.post.expired}
                    onClick={() => void respond("vote", { optionIndex: i })}
                  >
                    {opt} · {n}
                  </button>
                );
              })}
            </div>
          )}

          {detail.post.kind === "chain" && (
            <div className="dadao-interact" data-testid="dadao-chain">
              <h3>{t("home.kindPost.chain")}</h3>
              <ol className="dadao-chain-list">
                {((detail.stats.entries as Array<{ id: string; text: string }>) ?? []).map(
                  (e, idx) => (
                    <li key={e.id}>
                      <span className="muted">{idx + 1}.</span> {e.text}
                    </li>
                  ),
                )}
              </ol>
              {!detail.post.readonly && !detail.post.expired && (
                <div className="toolbar" style={{ marginTop: "0.65rem" }}>
                  <input
                    value={chainText}
                    onChange={(e) => setChainText(e.target.value)}
                    placeholder={t("home.chainPlaceholder")}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={busy || !chainText.trim()}
                    onClick={() => void respond("chain", { text: chainText.trim() })}
                  >
                    {t("home.chainJoin")}
                  </button>
                </div>
              )}
            </div>
          )}

          {detail.post.kind === "survey" && (
            <div className="dadao-interact" data-testid="dadao-survey">
              <h3>{t("home.kindPost.survey")}</h3>
              {((detail.post.payload.questions as Array<{ id: string; text: string }>) ?? []).map(
                (q) => (
                  <p key={q.id}>{q.text}</p>
                ),
              )}
              {detail.stats.submitted ? (
                <p className="muted">{t("home.surveySubmitted")}</p>
              ) : (
                !detail.post.readonly &&
                !detail.post.expired && (
                  <div className="toolbar">
                    <input
                      value={surveyAnswer}
                      onChange={(e) => setSurveyAnswer(e.target.value)}
                      placeholder={t("home.surveyAnswer")}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !surveyAnswer.trim()}
                      onClick={() =>
                        void respond("survey", { answers: { q1: surveyAnswer.trim() } })
                      }
                    >
                      {t("home.surveySubmit")}
                    </button>
                  </div>
                )
              )}
              <p className="muted">
                {t("home.surveyCount", { count: Number(detail.stats.submissionCount ?? 0) })}
              </p>
            </div>
          )}

          {detail.post.kind === "riddle" && (
            <div className="dadao-interact" data-testid="dadao-riddle">
              <h3>{t("home.kindPost.riddle")}</h3>
              {detail.post.payload.hint ? (
                <p className="muted">
                  {t("home.riddleHint")}: {String(detail.post.payload.hint)}
                </p>
              ) : null}
              {detail.stats.iSolved ? (
                <p>{t("home.riddleSolved")}</p>
              ) : (
                !detail.post.readonly &&
                !detail.post.expired && (
                  <div className="toolbar">
                    <input
                      value={riddleGuess}
                      onChange={(e) => setRiddleGuess(e.target.value)}
                      placeholder={t("home.riddleGuess")}
                    />
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || !riddleGuess.trim()}
                      onClick={() => void respond("riddle", { guess: riddleGuess.trim() })}
                    >
                      {t("home.riddleSubmit")}
                    </button>
                  </div>
                )
              )}
            </div>
          )}

          {detail.canModerate && (
            <div className="dadao-moderate" data-testid="dadao-moderate">
              <h3>{t("home.moderate")}</h3>
              <div className="toolbar">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => void moderate({ pinned: !detail.post.pinned })}
                >
                  {detail.post.pinned ? t("home.unpin") : t("home.pin")}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() => void moderate({ readonly: !detail.post.readonly })}
                >
                  {detail.post.readonly ? t("home.unlock") : t("home.lockReadonly")}
                </button>
                {["poll", "chain", "survey"].includes(detail.post.kind) && (
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => void exportStats()}
                  >
                    {t("home.exportStats")}
                  </button>
                )}
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t("home.deletePostConfirm"))) {
                      void moderate({ deleted: true });
                    }
                  }}
                >
                  {t("home.deletePost")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      {board && (
        <button
          type="button"
          className="dadao-fab"
          aria-label={t("home.compose")}
          data-testid="dadao-fab"
          onClick={() => setComposeOpen(true)}
        >
          +
        </button>
      )}

      {/* Compose sheet — viewport bottom sheet via portal */}
      {composeOpen && board && (
        <SheetPortal>
        <div className="sheet-backdrop" role="presentation" onClick={() => setComposeOpen(false)}>
          <div
            className="sheet-panel dadao-compose-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={t("home.compose")}
            data-testid="dadao-compose"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" aria-hidden />
            <div className="chat-sheet-head">
              <h3 style={{ margin: 0 }}>{t("home.compose")}</h3>
              <button type="button" className="btn ghost" onClick={() => setComposeOpen(false)}>
                ✕
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              {t(`home.board.${board}`)}
            </p>
            <div className="field">
              <label>{t("home.postKind")}</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as ForumPostKind)}
                data-testid="dadao-kind"
              >
                {COMPOSE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {kindLabel(k)}
                  </option>
                ))}
              </select>
            </div>
            {board === "group" && (
              <div className="field">
                <label>{t("home.board.group")}</label>
                <select
                  value={composeGroupId}
                  onChange={(e) => setComposeGroupId(e.target.value)}
                >
                  <option value="">{t("home.selectGroup")}</option>
                  {membershipGroups.map((gid) => (
                    <option key={gid} value={gid}>
                      {gid}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label>{t("home.postTitle")}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>{t("home.postBody")}</label>
              <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            {kind === "poll" && (
              <div className="field">
                <label>{t("home.pollOptions")}</label>
                <textarea
                  rows={3}
                  value={pollOptions}
                  onChange={(e) => setPollOptions(e.target.value)}
                  placeholder={t("home.pollOptionsHint")}
                />
              </div>
            )}
            {kind === "survey" && (
              <div className="field">
                <label>{t("home.surveyQuestion")}</label>
                <input value={surveyQ} onChange={(e) => setSurveyQ(e.target.value)} />
              </div>
            )}
            {kind === "riddle" && (
              <>
                <div className="field">
                  <label>{t("home.riddleAnswer")}</label>
                  <input value={riddleAnswer} onChange={(e) => setRiddleAnswer(e.target.value)} />
                </div>
                <div className="field">
                  <label>{t("home.riddleHint")}</label>
                  <input value={riddleHint} onChange={(e) => setRiddleHint(e.target.value)} />
                </div>
              </>
            )}
            {kind === "timed" && (
              <div className="field">
                <label>{t("home.expiresHours")}</label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={expiresHours}
                  onChange={(e) => setExpiresHours(Number(e.target.value) || 24)}
                />
              </div>
            )}
            <details className="plans-advanced">
              <summary>{t("home.mediaUrl")}</summary>
              <div className="field" style={{ marginTop: "0.65rem" }}>
                <label>{t("home.mediaUrl")}</label>
                <input
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
              </div>
              <div className="field">
                <label>{t("home.attachment")}</label>
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAttachment(f);
                  }}
                />
                {mediaKey ? <p className="muted">{mediaKey}</p> : null}
              </div>
            </details>
            <div className="sheet-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                data-testid="dadao-publish"
                onClick={() => void composePost()}
              >
                {t("home.post")}
              </button>
            </div>
          </div>
        </div>
        </SheetPortal>
      )}

    </div>
  );
}
