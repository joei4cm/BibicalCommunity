import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { listDevotionMaterials, listStudyMaterials, parsePlanCsv } from "@logoshome/bible";
import { api, apiOptional, getToken } from "../lib/api";
import { humanizeStatus } from "../lib/status";
import {
  DEVOTION_STEPS,
  devotionProgress,
  nextStep,
  type DevotionStep,
} from "./devotion";

type Plan = {
  id: string;
  title: string;
  description?: string | null;
  visibility: string;
  days: unknown[];
};

type PublicPlan = { id: string; title: string; description?: string | null };
type PlanDay = { day: number; ref: string; title?: string; note?: string };

type Subscription = {
  id?: string;
  subscriptionId?: string;
  planId: string;
  title?: string;
  progressDay: number;
  devotionStep?: DevotionStep;
  devotionMaterialId?: string | null;
  days?: PlanDay[];
};

type PlanVisibility = "private" | "church" | "public";
type PlansTab = "mine" | "discover" | "done";

function isSubscriptionComplete(sub: Subscription): boolean {
  const total = sub.days?.length ?? 0;
  if (total <= 0) return false;
  return (sub.progressDay ?? 0) >= total;
}

export function PlansPage() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<PlansTab>("mine");
  const [csv, setCsv] = useState("day,ref,title,note\n1,John.1,Word,Begin\n2,John.2,Wedding,");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createVisibility, setCreateVisibility] = useState<PlanVisibility>("private");
  const [createDaysText, setCreateDaysText] = useState("1,John.1,Begin\n2,John.2,Wedding");
  const [message, setMessage] = useState<string | null>(null);
  const [step, setStep] = useState<DevotionStep>("pause");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [daysJson, setDaysJson] = useState("[]");
  const [subscribeId, setSubscribeId] = useState("");
  const [publicPlans, setPublicPlans] = useState<PublicPlan[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [activeSubPlanId, setActiveSubPlanId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState("morning-examen");
  const progress = devotionProgress(step);

  const lang = i18n.language.startsWith("zh") ? "zh" : i18n.language.startsWith("ja") ? "ja" : "en";
  const studyMaterials = useMemo(() => listStudyMaterials({ language: lang }), [lang]);
  const devotionMaterials = useMemo(() => listDevotionMaterials(), []);
  const localeKey = (i18n.language || "zh-CN") as "zh-CN" | "en" | "ja";
  const activeSubs = useMemo(
    () => (subscriptions ?? []).filter((s) => !isSubscriptionComplete(s)),
    [subscriptions],
  );
  const doneSubs = useMemo(
    () => (subscriptions ?? []).filter((s) => isSubscriptionComplete(s)),
    [subscriptions],
  );
  const activeSub =
    activeSubs.find((s) => s.planId === activeSubPlanId) ?? activeSubs[0] ?? null;
  const activeMaterial =
    devotionMaterials.find((m) => m.id === materialId) ?? devotionMaterials[0] ?? null;
  const todayDayNum = activeSub ? (activeSub.progressDay ?? 0) + 1 : null;
  const todayDay =
    activeSub && todayDayNum != null
      ? (activeSub.days ?? []).find((d) => d.day === todayDayNum) ?? null
      : null;
  const stepGuide = activeMaterial?.steps ?? DEVOTION_STEPS;
  const selected = plans.find((p) => p.id === selectedId) ?? null;

  const refreshPlans = useCallback(async () => {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const res = await api<{ plans: Plan[] }>("/v1/plans");
    setPlans(res.plans);
    setMessage(null);
    setSelectedId((prev) => {
      if (prev) return prev;
      const first = res.plans[0];
      if (!first) return prev;
      setDaysJson(JSON.stringify(first.days, null, 2));
      return first.id;
    });
  }, []);

  const refreshPublicAndSubs = useCallback(async () => {
    if (!getToken()) return;
    const pub = await apiOptional<{ plans: PublicPlan[] }>("/v1/plans/public");
    setPublicPlans(pub?.plans ?? null);
    const subs = await apiOptional<{ subscriptions: Subscription[] }>("/v1/plans/subscriptions");
    setSubscriptions(subs?.subscriptions ?? null);
  }, []);

  useEffect(() => {
    void refreshPlans().catch((e) => setMessage(e instanceof Error ? e.message : "error"));
  }, [refreshPlans]);

  useEffect(() => {
    void refreshPublicAndSubs();
  }, [refreshPublicAndSubs]);

  useEffect(() => {
    const sub =
      activeSubs.find((s) => s.planId === activeSubPlanId) ?? activeSubs[0];
    if (!sub) return;
    if (sub.devotionStep && DEVOTION_STEPS.includes(sub.devotionStep)) {
      setStep(sub.devotionStep);
    }
    if (sub.devotionMaterialId) {
      setMaterialId(sub.devotionMaterialId);
    }
  }, [activeSubs, activeSubPlanId]);

  async function persistDevotion(nextStepValue: DevotionStep, nextMaterialId?: string) {
    const planId = activeSub?.planId;
    if (!planId || !getToken()) {
      setStep(nextStepValue);
      if (nextMaterialId) setMaterialId(nextMaterialId);
      return;
    }
    setStep(nextStepValue);
    if (nextMaterialId) setMaterialId(nextMaterialId);
    try {
      await api(`/v1/plans/${encodeURIComponent(planId)}/devotion`, {
        method: "POST",
        body: JSON.stringify({
          step: nextStepValue,
          materialId: nextMaterialId ?? materialId,
        }),
      });
      setSubscriptions((prev) =>
        (prev ?? []).map((s) =>
          s.planId === planId
            ? {
                ...s,
                devotionStep: nextStepValue,
                devotionMaterialId: nextMaterialId ?? materialId,
              }
            : s,
        ),
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "error");
    }
  }

  function selectPlan(id: string) {
    setSelectedId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setDaysJson(JSON.stringify(plan.days, null, 2));
  }

  async function createPlan() {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const title = createTitle.trim();
    if (!title) {
      setMessage("title_required");
      return;
    }
    let days: ReturnType<typeof parsePlanCsv>;
    try {
      days = parsePlanCsv(`day,ref,title,note\n${createDaysText}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "invalid_days");
      return;
    }
    if (days.length === 0) {
      setMessage("days_required");
      return;
    }
    const res = await api<{ id: string }>("/v1/plans", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: createDescription.trim() || undefined,
        visibility: createVisibility,
        days,
      }),
    });
    setMessage("created:ok");
    setCreateTitle("");
    setCreateDescription("");
    await refreshPlans();
    setSelectedId(res.id);
  }

  async function importCsv() {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const days = parsePlanCsv(csv);
    await api<{ id: string }>("/v1/plans", {
      method: "POST",
      body: JSON.stringify({
        title: t("plans.untitled"),
        visibility: "private",
        days,
      }),
    });
    setMessage("created:ok");
    await refreshPlans();
  }

  async function saveDays() {
    if (!getToken() || !selectedId) {
      setMessage("login_required");
      return;
    }
    let days: unknown[];
    try {
      days = JSON.parse(daysJson) as unknown[];
      if (!Array.isArray(days)) throw new Error("invalid");
    } catch {
      setMessage("invalid_json");
      return;
    }
    await api(`/v1/plans/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      body: JSON.stringify({ days }),
    });
    setMessage("saved");
    await refreshPlans();
  }

  async function subscribe(idOverride?: string) {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const id = (idOverride ?? subscribeId).trim();
    if (!id) return;
    await api<{ id: string }>(`/v1/plans/${encodeURIComponent(id)}/subscribe`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setMessage("subscribed:ok");
    setSubscribeId("");
    await refreshPublicAndSubs();
    setTab("mine");
  }

  async function advancePlanDay(planId: string, currentDay: number) {
    if (!getToken()) {
      setMessage("login_required");
      return;
    }
    const next = currentDay + 1;
    await api(`/v1/plans/${encodeURIComponent(planId)}/progress`, {
      method: "POST",
      body: JSON.stringify({ day: next }),
    });
    setMessage("progress:ok");
    await refreshPublicAndSubs();
  }

  function advance() {
    const next = nextStep(step);
    if (next) void persistDevotion(next);
  }

  function resetSteps() {
    void persistDevotion("pause");
  }

  const tabs: { id: PlansTab; label: string }[] = [
    { id: "mine", label: t("plans.tabMine") },
    { id: "discover", label: t("plans.tabDiscover") },
    { id: "done", label: t("plans.tabDone") },
  ];

  const loggedIn = Boolean(getToken());

  return (
    <section className="fade-up plans-page app-folio" data-testid="plans-page">
      <h1 className="page-title">{t("nav.plans")}</h1>
      {message && <p className="muted">{humanizeStatus(t, message)}</p>}

      {!loggedIn && (
        <div className="panel folio-gate" data-testid="plans-login-gate">
          <p className="muted" style={{ marginTop: 0 }}>
            {t("plans.gateHint")}
          </p>
          <Link className="btn" to="/app/me" data-testid="plans-go-login">
            {t("plans.goLogin")}
          </Link>
        </div>
      )}

      <div className="plans-tabs" role="tablist" aria-label={t("nav.plans")} data-testid="plans-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`plans-tab${tab === item.id ? " is-active" : ""}`}
            data-testid={`plans-tab-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <div className="plans-tab-panel" data-testid="plans-panel-mine" role="tabpanel">
          {activeSubs.length > 0 ? (
            <div className="panel" data-testid="plans-devotion-today">
              <h2>{t("plans.devotionToday")}</h2>
              <div className="field">
                <label>{t("plans.devotionPlan")}</label>
                <select
                  value={activeSub?.planId ?? ""}
                  onChange={(e) => setActiveSubPlanId(e.target.value)}
                >
                  {activeSubs.map((s) => (
                    <option key={s.planId} value={s.planId}>
                      {s.title ?? t("plans.untitled")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("plans.devotionMaterial")}</label>
                <select
                  value={activeMaterial?.id ?? ""}
                  onChange={(e) => void persistDevotion(step, e.target.value)}
                >
                  {devotionMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title[localeKey] ?? m.title.en}
                    </option>
                  ))}
                </select>
              </div>
              {todayDay && (
                <p className="muted">
                  {t("plans.todayReading")}: <strong>{todayDay.ref}</strong>
                  {todayDay.title ? ` · ${todayDay.title}` : ""}
                </p>
              )}
              {activeMaterial && (
                <p className="muted">{activeMaterial.body[localeKey] ?? activeMaterial.body.en}</p>
              )}
              <p className="muted">
                {progress.done
                  ? t("plans.stepDone")
                  : t("plans.stepProgress", {
                      current: progress.index + 1,
                      total: progress.total,
                    })}
              </p>
              <div className="step-track" role="list">
                {stepGuide.map((s, i) => {
                  const state = i < progress.index ? "done" : i === progress.index ? "current" : "todo";
                  return (
                    <button
                      key={s}
                      type="button"
                      role="listitem"
                      className={`step-chip step-${state}`}
                      onClick={() => void persistDevotion(s)}
                    >
                      <span className="step-index">{i + 1}</span>
                      {t(`devotion.${s}`)}
                    </button>
                  );
                })}
              </div>
              <div className="toolbar">
                <button type="button" className="btn" onClick={advance} disabled={progress.done}>
                  {progress.done ? t("plans.stepDone") : t("plans.nextStep")}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={!activeSub}
                  onClick={() => {
                    if (!activeSub) return;
                    void advancePlanDay(activeSub.planId, activeSub.progressDay);
                  }}
                >
                  {t("plans.advanceDay")}
                </button>
                <button type="button" className="btn ghost" onClick={resetSteps}>
                  {t("plans.resetSteps")}
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" data-testid="plans-empty-mine">
              <p className="muted" style={{ marginTop: 0 }}>
                {t("plans.emptyMine")}
              </p>
              <button type="button" className="btn" onClick={() => setTab("discover")}>
                {t("plans.openDiscover")}
              </button>
            </div>
          )}

          {activeSubs.length > 0 && (
            <div className="panel">
              <h2>{t("plans.subscriptions")}</h2>
              <ul className="list">
                {activeSubs.map((s) => {
                  const total = s.days?.length ?? 0;
                  return (
                    <li key={s.subscriptionId ?? s.id ?? s.planId}>
                      <button
                        type="button"
                        className="linkish"
                        onClick={() => setActiveSubPlanId(s.planId)}
                      >
                        <strong>{s.title ?? t("plans.untitled")}</strong>
                      </button>
                      <div className="muted">
                        {t("plans.inProgress")}
                        {total > 0
                          ? ` · ${t("plans.dayOf", { day: Math.min((s.progressDay ?? 0) + 1, total) })} / ${total}`
                          : ` · ${t("plans.dayOf", { day: s.progressDay ?? 0 })}`}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <details className="panel plans-advanced" data-testid="plans-add-by-id">
            <summary>{t("plans.manageAdvanced")}</summary>
            <h3>{t("plans.addById")}</h3>
            <p className="muted">{t("plans.addByIdHint")}</p>
            <div className="field">
              <label htmlFor="plan-subscribe-id">{t("plans.subscribeId")}</label>
              <input
                id="plan-subscribe-id"
                data-testid="plans-subscribe-id"
                value={subscribeId}
                onChange={(e) => setSubscribeId(e.target.value)}
                placeholder={t("plans.subscribeId")}
              />
            </div>
            <button type="button" className="btn" data-testid="plans-subscribe-submit" onClick={() => void subscribe()}>
              {t("plans.subscribe")}
            </button>

            <h3>{t("plans.create")}</h3>
            <div className="field">
              <label htmlFor="plan-title">{t("plans.title")}</label>
              <input
                id="plan-title"
                data-testid="plans-create-title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-description">{t("plans.description")}</label>
              <input
                id="plan-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="plan-visibility">{t("plans.visibility")}</label>
              <select
                id="plan-visibility"
                value={createVisibility}
                onChange={(e) => setCreateVisibility(e.target.value as PlanVisibility)}
              >
                <option value="private">{t("plans.visibilityPrivate")}</option>
                <option value="church">{t("plans.visibilityChurch")}</option>
                <option value="public">{t("plans.visibilityPublic")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="plan-days">{t("plans.daysHint")}</label>
              <textarea
                id="plan-days"
                rows={4}
                value={createDaysText}
                onChange={(e) => setCreateDaysText(e.target.value)}
              />
            </div>
            <button type="button" className="btn" data-testid="plans-create-submit" onClick={() => void createPlan()}>
              {t("plans.create")}
            </button>

            <h3>{t("plans.owned")}</h3>
            <ul className="list">
              {plans.length === 0 && <li className="muted">{t("plans.emptyOwned")}</li>}
              {plans.map((p) => (
                <li key={p.id}>
                  <button type="button" className="linkish" onClick={() => selectPlan(p.id)}>
                    <strong>{p.title}</strong>
                  </button>
                  <div className="muted">
                    {p.visibility === "church"
                      ? t("plans.visibilityChurch")
                      : p.visibility === "public"
                        ? t("plans.visibilityPublic")
                        : t("plans.visibilityPrivate")}
                    {" · "}
                    {t("plans.daysCount", { count: p.days.length })}
                    {selectedId === p.id ? ` · ${t("plans.selected")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
            {selected && (
              <>
                <div className="field" style={{ marginTop: "1rem" }}>
                  <label>{t("plans.editDays")}</label>
                  <textarea rows={8} value={daysJson} onChange={(e) => setDaysJson(e.target.value)} />
                </div>
                <button type="button" className="btn" onClick={() => void saveDays()}>
                  {t("plans.save")}
                </button>
              </>
            )}

            <h3>{t("plans.importCsv")}</h3>
            <div className="field">
              <textarea rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} />
            </div>
            <button type="button" className="btn" onClick={() => void importCsv()}>
              {t("plans.importCsv")}
            </button>
          </details>
        </div>
      )}

      {tab === "discover" && (
        <div className="plans-tab-panel" data-testid="plans-panel-discover" role="tabpanel">
          <div className="panel">
            <h2>{t("plans.public")}</h2>
            <p className="muted">{t("plans.discoverHint")}</p>
            <ul className="list">
              {(publicPlans ?? []).length === 0 && <li className="muted">{t("plans.emptyDiscover")}</li>}
              {(publicPlans ?? []).map((p) => {
                const desc = (p.description ?? "").trim();
                const showDesc =
                  desc.length > 0 &&
                  !/smoke|fixture|demo|test|样例|テスト/i.test(desc);
                return (
                  <li key={p.id}>
                    <strong>{p.title}</strong>
                    {showDesc ? <div className="muted">{desc}</div> : null}
                    <button
                      type="button"
                      className="btn ghost"
                      data-testid={`plans-discover-join-${p.id}`}
                      onClick={() => void subscribe(p.id)}
                    >
                      {t("plans.subscribe")}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="panel">
            <h2>{t("plans.materials")}</h2>
            <ul className="list">
              {devotionMaterials.map((m) => (
                <li key={m.id}>
                  <strong>{m.title[localeKey] ?? m.title.en}</strong>
                  <div className="muted">{m.body[localeKey] ?? m.body.en}</div>
                </li>
              ))}
              {studyMaterials.map((m) => (
                <li key={m.id}>
                  <a href={m.url} target="_blank" rel="noreferrer">
                    {m.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "done" && (
        <div className="plans-tab-panel" data-testid="plans-panel-done" role="tabpanel">
          <div className="panel">
            <h2>{t("plans.tabDone")}</h2>
            <p className="muted">{t("plans.doneHint")}</p>
            <ul className="list">
              {doneSubs.length === 0 && <li className="muted">{t("plans.emptyDone")}</li>}
              {doneSubs.map((s) => {
                const total = s.days?.length ?? 0;
                return (
                  <li key={s.subscriptionId ?? s.id ?? s.planId} data-testid={`plans-done-${s.planId}`}>
                    <strong>{s.title ?? t("plans.untitled")}</strong>
                    <div className="muted">
                      {t("plans.completedBadge")}
                      {total > 0 ? ` · ${t("plans.daysCount", { count: total })}` : ""}
                      {` · ${t("plans.dayOf", { day: s.progressDay ?? 0 })}`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
