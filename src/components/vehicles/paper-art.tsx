import type { CSSProperties } from "react";
import type { DocKind } from "@/features/vehicles/doc-names";

/**
 * A small drawing of a vehicle paper, in CSS only (issue #187, C138; design canvas "Documents by
 * category"): a pink registration book, a round lavender revenue license with its month, a green emission
 * certificate with a barcode, a blue insurance card, a plain sheet for anything else. It is a picture of
 * the kind of paper, not the owner's own scan (real first-page previews are a later idea), so it is
 * hidden from screen readers. Colours come from the paper tokens in src/theme/theme.css.
 */

export type PaperArtSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<DocKind, Record<PaperArtSize, [number, number]>> = {
  book: { xs: [26, 36], sm: [34, 48], md: [56, 78], lg: [108, 150] },
  license: { xs: [34, 34], sm: [46, 46], md: [94, 94], lg: [150, 150] },
  emission: { xs: [40, 28], sm: [70, 46], md: [112, 76], lg: [210, 142] },
  insurance: { xs: [40, 26], sm: [74, 48], md: [148, 94], lg: [230, 146] },
  other: { xs: [28, 36], sm: [36, 48], md: [64, 84], lg: [112, 150] },
};

/** A bar of ink at `alpha` strength, placed in percentages of the paper so it scales with it. */
function bar(ink: string, alpha: number, style: CSSProperties): CSSProperties {
  return { position: "absolute", borderRadius: 2, background: `color-mix(in srgb, var(${ink}) ${alpha}%, transparent)`, ...style };
}

export function PaperArt({ kind, size, month, faded = false }: { kind: DocKind; size: PaperArtSize; month?: string | null; faded?: boolean }) {
  const [w, h] = SIZES[kind][size];
  const detailed = size === "md" || size === "lg";
  const shadow = size === "xs" ? "inset 0 0 0 1px rgb(0 0 0 / 0.15)" : size === "sm" ? "0 4px 12px rgb(0 0 0 / 0.35)" : "0 8px 22px rgb(0 0 0 / 0.4)";
  const base: CSSProperties = { position: "relative", width: w, height: h, flexShrink: 0, overflow: "hidden", boxShadow: shadow, opacity: faded ? 0.75 : 1 };
  const line = Math.max(2, Math.round(h * 0.045));

  if (kind === "book") {
    return (
      <span aria-hidden style={{ ...base, display: "block", borderRadius: size === "lg" ? 5 : 3, background: "var(--paper-book)" }}>
        {size !== "xs" ? <span style={bar("--paper-book-ink", 45, { left: "11%", right: "11%", top: "10%", height: line + 1 })} /> : null}
        {(detailed ? [18, 23, 15, 26, 20, 24] : size === "sm" ? [20, 30] : []).map((r, i) => (
          <span key={i} style={bar("--paper-book-ink", 30, { left: "11%", right: `${r}%`, top: `${23 + i * 10}%`, height: line })} />
        ))}
      </span>
    );
  }

  if (kind === "license") {
    return (
      <span aria-hidden style={{ ...base, display: "block", borderRadius: size === "lg" ? 8 : 5, background: "var(--paper-license)" }}>
        {size !== "xs" ? <span style={{ position: "absolute", inset: "10%", borderRadius: "50%", border: `${detailed ? (size === "lg" ? 3 : 2) : 1.5}px solid color-mix(in srgb, var(--paper-license-ink) 80%, transparent)` }} /> : null}
        {detailed && month ? (
          <span className="font-mono font-semibold" style={{ position: "absolute", left: 0, right: 0, top: "32%", textAlign: "center", fontSize: size === "lg" ? 18 : 12, color: "var(--paper-license-ink)" }}>
            {month}
          </span>
        ) : null}
        {detailed ? (
          <>
            <span style={bar("--paper-license-ink", 40, { left: "26%", right: "26%", top: "56%", height: line })} />
            <span style={bar("--paper-license-ink", 40, { left: "32%", right: "32%", top: "65%", height: line })} />
          </>
        ) : null}
      </span>
    );
  }

  if (kind === "emission") {
    return (
      <span aria-hidden style={{ ...base, display: "block", borderRadius: size === "lg" ? 8 : 4, background: "var(--paper-emission)" }}>
        <span style={{ position: "absolute", left: 0, right: 0, top: 0, height: "16%", background: "var(--paper-emission-band)" }} />
        {size !== "xs" ? (
          <>
            <span style={bar("--paper-emission-ink", 35, { left: "7%", width: "54%", top: "27%", height: line })} />
            <span style={bar("--paper-emission-ink", 35, { left: "7%", width: "44%", top: "39%", height: line })} />
          </>
        ) : null}
        {detailed ? (
          <>
            <span style={{ position: "absolute", left: "7%", bottom: "10%", width: "20%", height: "29%", background: "repeating-linear-gradient(90deg, var(--paper-emission-ink) 0 3px, transparent 3px 5px)" }} />
            <span className="font-mono font-bold" style={{ position: "absolute", right: "7%", bottom: "13%", fontSize: size === "lg" ? 16 : 10, color: "var(--paper-emission-ink)" }}>
              PASS
            </span>
          </>
        ) : null}
      </span>
    );
  }

  if (kind === "insurance") {
    return (
      <span aria-hidden style={{ ...base, display: "block", borderRadius: size === "xs" ? 5 : size === "sm" ? 7 : 12, background: "linear-gradient(135deg, var(--paper-insurance), var(--paper-insurance-deep))" }}>
        {size !== "xs" ? <span style={{ position: "absolute", left: "7%", top: "11%", width: "43%", height: Math.max(3, Math.round(h * 0.075)), borderRadius: 3, background: "var(--paper-insurance-ink)" }} /> : null}
        {detailed
          ? [74, 62, 68].map((wd, i) => <span key={i} style={bar("--paper-other-ink", 35, { left: "7%", width: `${wd}%`, top: `${30 + i * 11}%`, height: line })} />)
          : size === "sm"
            ? <span style={bar("--paper-other-ink", 35, { left: "7%", width: "60%", top: "42%", height: line })} />
            : null}
      </span>
    );
  }

  // Other: a plain sheet with a folded corner.
  return (
    <span aria-hidden style={{ ...base, display: "block", borderRadius: "3px 10px 3px 3px", background: "var(--paper-other)" }}>
      <span style={{ position: "absolute", right: 0, top: 0, width: "22%", aspectRatio: "1", background: "color-mix(in srgb, var(--paper-other-ink) 22%, var(--paper-other))", borderBottomLeftRadius: 3 }} />
      {(detailed ? [30, 18, 26, 12, 34] : size === "sm" ? [30, 20] : []).map((r, i) => (
        <span key={i} style={bar("--paper-other-ink", 30, { left: "12%", right: `${r}%`, top: `${26 + i * 12}%`, height: line })} />
      ))}
    </span>
  );
}
