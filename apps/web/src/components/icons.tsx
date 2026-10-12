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

/** Classic corner handset — place / outbound call. */
export function IconPhone(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"
      />
    </Svg>
  );
}

/** Incoming accept — same handset; button color carries the meaning. */
export function IconPhoneAccept(props: IconProps) {
  return <IconPhone {...props} />;
}

/** End call — classic downward receiver (filled; readable on the red button). */
export function IconPhoneHangup(props: IconProps) {
  return (
    <Svg {...props}>
      {/* Scale/center Material call_end so earpieces read at button size */}
      <g transform="translate(12 12) scale(1.15) translate(-12 -11.2)">
        <path
          fill="currentColor"
          d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08A.996.996 0 0 1 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"
        />
      </g>
    </Svg>
  );
}

export function IconVideo(props: IconProps) {
  return (
    <Svg {...props}>
      <rect {...stroke} x="2.5" y="6.5" width="13.5" height="11" rx="2" />
      <path
        {...stroke}
        d="m16 10.2 4.4-2.75a.6.6 0 0 1 .9.52v8.06a.6.6 0 0 1-.9.52L16 13.8"
      />
    </Svg>
  );
}

export function IconVideoOff(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        {...stroke}
        d="M10.66 6.5H16a2 2 0 0 1 2 2v.34"
      />
      <path
        {...stroke}
        d="M16 10.2v3.6l4.4 2.75a.6.6 0 0 0 .9-.52V7.97a.6.6 0 0 0-.9-.52L16 10.2z"
      />
      <path
        {...stroke}
        d="M2.5 8.5v7a2 2 0 0 0 2 2H14"
      />
      <path {...stroke} d="m3 4 17 14" />
    </Svg>
  );
}

/** Soft smile for emoji picker trigger. */
export function IconEmoji(props: IconProps) {
  return (
    <Svg {...props}>
      <circle {...stroke} cx="12" cy="12" r="8.5" />
      <path {...stroke} d="M8.5 14s1.4 2 3.5 2 3.5-2 3.5-2" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
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
        d="m16.5 7-7.6 7.6a2.1 2.1 0 0 0 3 3l7.5-7.5a3.7 3.7 0 0 0-5.2-5.2l-7.6 7.6a5.2 5.2 0 0 0 7.4 7.4l6.4-6.4"
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
      <path {...stroke} d="m15 6-6 6 6 6" />
    </Svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function IconSend(props: IconProps) {
  return (
    <Svg {...props}>
      <path {...stroke} d="m22 2-7 20-4-9-9-4Z" />
      <path {...stroke} d="M22 2 11 13" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Svg {...props}>
      <circle {...stroke} cx="11" cy="11" r="6.25" />
      <path {...stroke} d="m16.5 16.5 4 4" />
    </Svg>
  );
}
