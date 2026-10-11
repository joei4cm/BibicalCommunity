import { useMemo, useRef, useState } from "react";

const PAGES: string[][] = [
  [
    "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆",
    "😉", "😊", "😋", "😎", "😍", "😘", "🥰", "😗",
    "😙", "😚", "🙂", "🤗", "🤩", "🤔", "🤨", "😐",
    "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐",
  ],
  [
    "😯", "😪", "😫", "🥱", "😴", "😌", "😛", "😜",
    "😝", "🤤", "😒", "😓", "😔", "😕", "🙃", "🤑",
    "😲", "☹️", "🙁", "😖", "😞", "😟", "😤", "😢",
    "😭", "😦", "😧", "😨", "😩", "🤯", "😬", "😰",
  ],
  [
    "😱", "🥵", "🥶", "😳", "🤪", "😵", "😡", "😠",
    "🤬", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "😇",
    "🥳", "🥸", "😈", "👿", "💀", "☠️", "💩", "🤡",
    "👹", "👺", "👻", "👽", "👾", "🤖", "🎃", "😺",
  ],
  [
    "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏",
    "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆",
    "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
    "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪",
  ],
  [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖",
    "💘", "💝", "💟", "☮️", "✝️", "☪️", "🕉️", "☸️",
    "✡️", "🔯", "🕎", "☯️", "☦️", "🛐", "⛎", "♈",
  ],
  [
    "✨", "⭐", "🌟", "💫", "🔥", "💥", "💢", "💦",
    "💨", "🕊️", "🏠", "🏡", "⛪", "📖", "✝️", "🙏",
    "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🎯", "✅",
    "❌", "❓", "❗", "💯", "🔔", "📌", "📝", "🗓️",
  ],
  [
    "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐",
    "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆",
    "🥑", "🥦", "🥬", "🥒", "🌶️", "🫑", "🌽", "🥕",
    "🫒", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞",
  ],
  [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
    "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵",
    "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤",
    "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗",
  ],
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);
  const pages = useMemo(() => PAGES, []);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    setPage(Math.round(el.scrollLeft / w));
  }

  function goTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setPage(i);
  }

  return (
    <div className="im-emoji-picker" data-testid="chat-emoji-panel">
      <div
        ref={scrollerRef}
        className="im-emoji-scroller"
        onScroll={onScroll}
        aria-label="emoji pages"
      >
        {pages.map((emojis, i) => (
          <div key={i} className="im-emoji-page" role="listbox">
            {emojis.map((emoji) => (
              <button
                key={`${i}-${emoji}`}
                type="button"
                className="im-emoji-btn"
                onClick={() => onPick(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="im-emoji-dots" role="tablist">
        {pages.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`im-emoji-dot${page === i ? " is-active" : ""}`}
            aria-label={`page ${i + 1}`}
            aria-selected={page === i}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
