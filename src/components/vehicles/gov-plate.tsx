import { plateLayout } from "@/features/vehicles/plate";

/**
 * The government-issued Sri Lankan number plate (C130, issue #165), on the vehicle card only: the white
 * front plate, black on white with the black border line set in from the edge, like the real plate, the national emblem with the province code
 * under it, then the series, a solid dash and the digits in a narrow FE-style face (Saira Semi
 * Condensed). The hologram, 2D code and serial of the real plate are left out: at card size they are
 * only noise. Everything is sized in em from `height`, so the plate scales as one piece.
 */
export function GovPlate({ registration, height = 44, className = "" }: { registration: string; height?: number; className?: string }) {
  const { province, series, digits } = plateLayout(registration);
  return (
    <span
      role="img"
      aria-label={`Plate ${registration}`}
      className={`isolate inline-flex shrink-0 rounded-[0.1em] bg-[#f7f7f2] p-[0.04em] leading-none shadow-[0_0.04em_0.14em_rgba(0,0,0,0.45)] ${className}`}
      style={{ fontSize: height, height }}
    >
      <span className="flex h-full items-center rounded-[0.07em] border-[length:0.05em] border-[#111316] pr-[0.18em] pl-[0.08em] font-plate font-semibold whitespace-nowrap text-[#111316]">
        <span className={`mr-[0.12em] flex h-full flex-col items-start py-[0.05em] ${province ? "justify-between" : "justify-center"}`}>
          {/* A plain <img>: a small static SVG from public/ (the image optimiser does not resize SVGs),
              printed dark like the line art on the real plate. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/plate/sri-lanka-emblem.svg"
            alt=""
            className="block w-auto brightness-[0.55] contrast-150 grayscale mix-blend-multiply"
            style={{ height: province ? "0.34em" : "0.62em" }}
          />
          {province ? <span className="text-[0.42em] leading-[0.8] tracking-[0.06em]">{province}</span> : null}
        </span>
        <span className="flex items-center text-[0.86em] tracking-[0.01em]">
          <span>{series}</span>
          {digits ? (
            <>
              <span aria-hidden className="mx-[0.11em] inline-block h-[0.085em] w-[0.3em] rounded-[0.01em] bg-current" />
              <span>{digits}</span>
            </>
          ) : null}
        </span>
      </span>
    </span>
  );
}
