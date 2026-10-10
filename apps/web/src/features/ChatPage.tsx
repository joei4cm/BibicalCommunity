import { useTranslation } from "react-i18next";
import { ChatPanel } from "./ChatPanel";

/** Standalone messaging surface — kept separate from church/community home. */
export function ChatPage() {
  const { t } = useTranslation();
  return (
    <section className="fade-up chat-page app-folio" data-testid="chat-page">
      <h1 className="page-title">{t("nav.chat")}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {t("chat.inboxHint")}
      </p>
      <ChatPanel />
    </section>
  );
}
