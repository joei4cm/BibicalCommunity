import { Link } from "react-router-dom";
import { splitVerseCites } from "@logoshome/bible";

/** Render chat plain text with `#约一1:2`-style cites as reader deep links. */
export function ChatVerseText({
  text,
  translationId = "cuvs",
  className = "chat-bubble-text",
}: {
  text: string;
  translationId?: string;
  className?: string;
}) {
  const parts = splitVerseCites(text, translationId);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.type === "cite" ? (
          <Link
            key={`${part.value}-${i}`}
            className="chat-verse-cite"
            to={part.href}
            data-testid="chat-verse-cite"
            title={part.href}
          >
            {part.value}
          </Link>
        ) : (
          <span key={`t-${i}`}>{part.value}</span>
        ),
      )}
    </p>
  );
}
