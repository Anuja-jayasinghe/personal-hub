import { HUB_MARK_PATH, HUB_MARK_VIEWBOX } from "./hub-mark-path";

/** Width-to-height ratio of the mark's box. */
const RATIO = 472 / 604;

/**
 * The hub J monogram (C90). It takes the current text colour, so colour it with a class:
 * `text-primary` (blue) in headers, `text-quiet` where access is refused or offline.
 * Brand rules (DESIGN.md): never add glow, shadow, gradient or outline, never rotate or animate it,
 * and keep at least one node's width of space around it.
 */
export function HubMark({
  size = 32,
  title = "hub",
  className,
}: {
  /** Height in pixels; the width follows the mark's proportions. */
  size?: number;
  /** Accessible name. Pass an empty string when text next to the mark already says "hub". */
  title?: string;
  className?: string;
}) {
  const decorative = title === "";
  return (
    <svg
      viewBox={HUB_MARK_VIEWBOX}
      width={Math.round(size * RATIO * 10) / 10}
      height={size}
      className={className}
      fill="currentColor"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
      focusable="false"
    >
      <path d={HUB_MARK_PATH} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}
