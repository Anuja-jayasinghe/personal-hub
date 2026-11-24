import type { ReactNode } from "react";
import { SriLankaPlate } from "@/components/vehicles/sl-plate";
import { VehicleCover } from "@/components/vehicles/vehicle-cover";
import type { Vehicle } from "@/db/schema";

/**
 * The hero at the top of a vehicle's page (issue #237): the plate, the name in Oxanium, the make / model / year
 * line and the page's buttons on the left; the cover photo on the right as a tall panel that fades into the card
 * (on a phone the photo comes first, at 5:4, with the plate and a bottom scrim, and the name below it). With no
 * photo the same panel holds the drawing on its stage, so the card still looks finished. The panel's box is sized
 * by the card, never by the image, so a slow photo cannot move anything (the photo loads eagerly: it is the
 * page's main image). The photos are portrait phone photos, so the crop favours the lower middle, where the
 * vehicle is. Pure markup: the buttons arrive as `children`, already built (and access-checked) by the page.
 */
export function VehicleHero({
  vehicle,
  subtitle,
  typeLabel,
  children,
}: {
  vehicle: Pick<Vehicle, "id" | "nickname" | "registrationNumber" | "fuelType" | "vehicleType" | "make" | "model" | "coverAttachmentId" | "archivedAt">;
  /** Make, model and year, already worded. */
  subtitle: string;
  typeLabel: string | undefined;
  /** The Add and Manage buttons. */
  children: ReactNode;
}) {
  const hasPhoto = vehicle.coverAttachmentId !== null;
  const eyebrow = [typeLabel, vehicle.fuelType, vehicle.archivedAt ? "archived" : null].filter(Boolean).join(" · ");
  return (
    <section
      aria-label={vehicle.nickname}
      className={`relative isolate grid overflow-hidden rounded-3xl border border-border bg-deepest dark:border-raised md:grid-cols-[minmax(0,1fr)_minmax(0,46%)] ${hasPhoto ? "md:min-h-[440px] xl:min-h-[480px]" : "md:min-h-[360px] xl:min-h-[400px]"}`}
    >
      {/* The left side's floor: a 14 px dot grid fading to the right and a faint blue glow low on the left (DESIGN.md, Elevation). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-[radial-gradient(60%_70%_at_12%_100%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_70%)] md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden [mask-image:linear-gradient(to_right,black,transparent_58%)] [background-image:radial-gradient(color-mix(in_oklab,var(--border)_85%,transparent)_1px,transparent_1.5px)] [background-size:14px_14px] md:block"
      />

      {/* The panel: a tall photo (46% of the card) or, with no photo, the drawing on its stage (a wider panel, so the vehicle is drawn big). */}
      <div
        className={`relative order-1 md:absolute md:inset-y-0 md:right-0 md:order-none md:aspect-auto ${
          hasPhoto ? "aspect-[5/4] md:w-[46%]" : "aspect-[16/10] md:w-[60%]"
        }`}
      >
        {/* On a wide screen the picture dissolves into the card on its left edge (a mask, so no colour edge shows). */}
        <div className="absolute inset-0 bg-raised/40 md:[mask-image:linear-gradient(to_right,transparent,rgba(0,0,0,0.55)_14%,black_38%)]">
          <VehicleCover vehicle={vehicle} alt={`${vehicle.nickname} photo`} priority position="50% 55%" className="size-full" />
        </div>
        {hasPhoto ? <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-deepest via-deepest/70 to-transparent md:hidden" /> : null}
        {vehicle.registrationNumber ? (
          <div className={`absolute md:hidden ${hasPhoto ? "right-3 bottom-3" : "top-3 left-3"}`}>
            <SriLankaPlate registration={vehicle.registrationNumber} size="md" />
          </div>
        ) : null}
      </div>

      <div className={`relative z-10 order-2 flex flex-col gap-5 p-4 md:justify-between md:gap-8 md:p-8 ${hasPhoto ? "-mt-12 md:mt-0" : "md:mt-0"}`}>
        {vehicle.registrationNumber ? (
          <div className="hidden md:block">
            <SriLankaPlate registration={vehicle.registrationNumber} size="lg" />
          </div>
        ) : (
          <span className="hidden md:block" />
        )}
        <div className="flex flex-col gap-2 md:max-w-[88%]">
          {eyebrow ? <p className="font-mono text-[10.5px] tracking-[0.14em] text-label uppercase md:text-[11px]">{eyebrow}</p> : null}
          <h1 className="font-display text-4xl leading-[0.95] font-semibold tracking-tight text-balance break-words md:text-5xl xl:text-6xl">{vehicle.nickname}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2.5">{children}</div>
      </div>
    </section>
  );
}
