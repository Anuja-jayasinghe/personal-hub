import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // A slow light passing over the block (DESIGN.md, Motion: 1.6 s shimmer), instead of a pulse.
      className={cn(
        "relative overflow-hidden rounded-md bg-muted after:absolute after:inset-0 after:animate-[hub-shimmer_1.6s_ease-in-out_infinite] after:bg-linear-to-r after:from-transparent after:via-foreground/6 after:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
