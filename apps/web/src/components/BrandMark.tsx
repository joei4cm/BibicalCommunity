/** Inline brand mark — open book under a roof (home + scripture). */
export function BrandMark({
  className,
  title = "圣言家",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      className={`brand-mark${className ? ` ${className}` : ""}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      fill="none"
      role="img"
      aria-label={title}
    >
      <rect className="bm-field" width="128" height="128" rx="30" />
      <circle className="bm-glow" cx="64" cy="70" r="42" />
      <path
        className="bm-paper-stroke"
        d="M28 58 L64 28 L100 58"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        className="bm-paper"
        d="M36 62 C48 58 56 58 64 64 C72 58 80 58 92 62 L92 96 C80 90 72 90 64 96 C56 90 48 90 36 96 Z"
      />
      <path
        className="bm-field-stroke"
        d="M64 64 V96"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        className="bm-field-stroke"
        d="M44 74 H56 M44 82 H54"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        className="bm-field-stroke"
        d="M72 74 H84 M74 82 H84"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
