import { plateParts } from "@/features/vehicles/plate";

/**
 * A Sri Lankan number plate (S.6, C112; design board "Vehicles"): black on white like the front plate,
 * a heavy border, the registration in Oxanium, and the small province code on the left only when the
 * registration has one (new registrations dropped it).
 */
export function SriLankaPlate({ registration, size = "md", className = "" }: { registration: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const { province, main } = plateParts(registration);
  const box = { sm: "h-7 rounded-[4px] shadow-[inset_0_0_0_2px_#0d1118]", md: "h-9 rounded-[5px] shadow-[inset_0_0_0_2px_#0d1118]", lg: "h-12 rounded-[7px] shadow-[inset_0_0_0_3px_#0d1118]" }[size];
  const text = { sm: "text-[15px] px-2", md: "text-xl px-2.5", lg: "text-[28px] px-3.5" }[size];
  const prov = { sm: "text-[8.5px] pl-2", md: "text-[10px] pl-2.5", lg: "text-[13px] pl-3.5" }[size];
  return (
    <span
      role="img"
      aria-label={`Plate ${registration}`}
      className={`inline-flex shrink-0 items-stretch bg-[#f7f7f2] font-display leading-none font-extrabold whitespace-nowrap text-[#0d1118] ${box} ${className}`}
    >
      {province ? <span className={`flex items-center ${prov}`}>{province}</span> : null}
      <span className={`flex items-center tracking-[0.04em] ${text} ${province ? "pl-1.5" : ""}`}>{main}</span>
    </span>
  );
}
