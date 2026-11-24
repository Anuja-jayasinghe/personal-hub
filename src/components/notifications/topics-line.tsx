import type { Topic } from "@/features/notifications/topics";

/**
 * What a person will be told about (Notifications N.5, DECISIONS C144), read-only: one node per section
 * they can see (DESIGN.md: node-and-line), the section's name and the one thing that triggers a push.
 * It only draws; the page works the topics out from the person's grants.
 */
export function TopicsLine({ topics, paused }: { topics: readonly Topic[]; paused: boolean }) {
  if (topics.length === 0) {
    return (
      <p className="rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">
        Nothing yet. Once the owner gives you a section, what comes due in it will reach you here.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="relative flex flex-col gap-4 rounded-2xl border bg-card px-4 py-4">
        <span aria-hidden className="absolute top-6 bottom-6 left-[1.4rem] w-0.5 bg-border" />
        {topics.map((t) => (
          <li key={t.key} className="relative flex gap-3.5">
            <span aria-hidden className={`relative mt-1 size-3 shrink-0 rounded-full border-2 border-card ${paused ? "bg-quiet" : "bg-primary"}`} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{t.label}</span>
              <span className="text-[12.5px] text-muted-foreground">{t.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      {paused ? (
        <p role="status" className="text-xs text-status-soon">
          Paused by the owner: nothing is sent to you for now.
        </p>
      ) : null}
    </div>
  );
}
