/**
 * Settings and its sub-pages: on desktop a 224px sub-menu sits on the left (DESIGN.md, Layout; board HSettings)
 * and the pages use the rest of the width, like every other page (issue #156; wide screens: SettingsColumns).
 */
export function SettingsGrid({ menu, children }: { menu: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[224px_minmax(0,1fr)] md:items-start md:gap-9">
      <nav aria-label="Settings" className="hidden md:sticky md:top-7 md:block md:pt-14">
        {menu}
      </nav>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </div>
  );
}
