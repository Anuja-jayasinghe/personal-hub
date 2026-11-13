import Image from "next/image";
import { appConfig } from "@/config/app.config";

/**
 * Logo shown in the header/sidebar. Reads everything from app.config.ts: a real image when
 * `logo.src` is set, otherwise a text mark in the primary colour.
 */
export function Logo({ size = 32 }: { size?: number }) {
  const { src, mark, alt } = appConfig.logo;

  if (src) {
    return <Image src={src} alt={alt} width={size} height={size} priority />;
  }

  return (
    <span
      aria-label={alt}
      role="img"
      className="inline-flex items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {mark}
    </span>
  );
}
