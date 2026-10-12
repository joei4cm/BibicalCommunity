/** Stroke icon set for chat / calls chrome (no emoji glyphs). */
import type { ReactNode } from "react";

type IconProps = {
  className?: string;
  title?: string;
};

function Svg({
  className,
  title,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={`ui-icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Classic handset — outbound / place call. */
export function IconPhone(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M6.2 4.8c.5-.5 1.3-.6 1.9-.3l2.1 1.1c.6.3.9 1 .7 1.7l-.5 1.8c-.1.5 0 1 .4 1.3 1.1.9 2.4 2.1 3.4 3.2.4.4.9.5 1.4.4l1.8-.5c.7-.2 1.4.1 1.7.7l1.1 2.1c.3.6.2 1.4-.3 1.9l-1.1 1.1c-.6.6-1.5.9-2.4.7-2.3-.4-5.1-2.3-7.8-5-2.7-2.7-4.6-5.5-5-7.8-.2-.9.1-1.8.7-2.4l1.1-1.1z"
      />
    </Svg>
  );
}

/** Incoming accept — handset with upward hint. */
export function IconPhoneAccept(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M7 15.5c2.8 1.4 5.7 2.3 8.5 2.5.7 0 1.3-.4 1.6-1l.7-1.5c.2-.5 0-1.1-.4-1.4l-1.6-1.1c-.4-.3-1-.2-1.3.1l-.7.7c-.3.3-.7.4-1.1.3-1.2-.4-2.3-1.1-3.2-2-.9-.9-1.6-2-2-3.2-.1-.4 0-.8.3-1.1l.7-.7c.3-.3.4-.9.1-1.3L7.1 4.6c-.3-.4-.9-.6-1.4-.4L4.2 4.9c-.6.3-1 1-1 1.6.2 2.8 1.1 5.7 2.5 8.5l1.3.5z"
      />
      <path {...stroke} d="M15 4.5v4.5h4.5" />
      <path {...stroke} d="M15 9 20 4" />
    </Svg>
  );
}

/** End call — handset rotated down. */
export function IconPhoneHangup(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M5.5 11.2c2.8-1.2 5.7-1.8 8.6-1.8s5.8.6 8.6 1.8c.5.2.8.7.8 1.2v1.4c0 .7-.6 1.2-1.3 1.1l-2.2-.3c-.5-.1-.9-.4-1.1-.9l-.5-1.2c-.1-.3-.4-.5-.7-.5-1.2.1-2.4.1-3.6 0-.3 0-.6.2-.7.5l-.5 1.2c-.2.5-.6.8-1.1.9l-2.2.3c-.7.1-1.3-.4-1.3-1.1v-1.4c0-.5.3-1 .8-1.2z"
      />
    </Svg>
  );
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect {...stroke} x="3.5" y="7" width="11.5" height="10" rx="2" />
      <path {...stroke} d="M15 10.5 20.5 7.5v9L15 13.5" />
    </Svg>
  );
}

export function IconVideoOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M3.5 8.5V15a2 2 0 0 0 2 2h7.2" />
      <path {...stroke} d="M15 13.2v1.3L20.5 17V8.5L15 11" />
      <path {...stroke} d="M4 5.5 19.5 18.5" />
      <path {...stroke} d="M9.2 7h3.8a2 2 0 0 1 2 2v.4" />
    </Svg>
  );
}

/** Soft smile for emoji picker trigger. */
export function IconEmoji(props: IconProps) {
  return (
    <Svg {...props}>
      <circle {...stroke} cx="12" cy="12" r="8.25" />
      <path {...stroke} d="M8.4 13.6c.9 1.3 2.1 1.95 3.6 1.95s2.7-.65 3.6-1.95" />
      <path {...stroke} d="M9 9.6h.01M15 9.6h.01" strokeWidth={2.4} />
    </Svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function IconPaperclip(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M8.5 12.5v4.2a3.5 3.5 0 0 0 7 0V8.2a2.4 2.4 0 0 0-4.8 0v7.6a1.3 1.3 0 0 0 2.6 0V9.5"
      />
    </Svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="12" r="1.35" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" />
      <circle cx="18" cy="12" r="1.35" fill="currentColor" />
    </Svg>
  );
}

export function IconChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M14.5 5.5 8 12l6.5 6.5" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M9.5 5.5 16 12l-6.5 6.5" />
    </Svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="M4.5 11.2 19 5.5 13.2 19.5l-1.8-6.1-6.9-2.2z" />
      <path {...stroke} d="M11.4 13.4 19 5.5" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle {...stroke} cx="11" cy="11" r="6.25" />
      <path {...stroke} d="M16.2 16.2 20 20" />
    </Svg>
  );
}
