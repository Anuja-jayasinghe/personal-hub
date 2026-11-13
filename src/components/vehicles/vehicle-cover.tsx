import { Car } from "lucide-react";

/** The vehicle's cover photo (through the signed-link route), or a car icon when there is none. */
export function VehicleCover({
  coverAttachmentId,
  alt,
  className = "",
}: {
  coverAttachmentId: string | null;
  alt: string;
  className?: string;
}) {
  if (!coverAttachmentId) {
    return (
      <div className={`flex items-center justify-center bg-muted text-muted-foreground ${className}`} aria-hidden>
        <Car className="size-8" />
      </div>
    );
  }
  // A plain <img>: /files/<id> redirects to a short-lived signed link, which Next's image optimiser can't follow.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/files/${coverAttachmentId}`} alt={alt} loading="lazy" className={`object-cover ${className}`} />;
}
