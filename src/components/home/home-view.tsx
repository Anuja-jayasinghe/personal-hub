import { AddBothReadingsButton } from "@/components/electricity/popover-button";
import { AreaGlances } from "@/components/home/area-glances";
import { ElectricitySummary } from "@/components/home/electricity-summary";
import { HomeHero } from "@/components/home/home-hero";
import { NeedsPanel } from "@/components/home/needs-panel";
import { NextDaysLine } from "@/components/home/next-days-line";
import { SetupCard } from "@/components/home/setup-card";
import { HeaderAccount, PhoneMark } from "@/components/shell/page-header";
import { dayOfYear, dayStamp, greetingLine } from "@/features/home/home";
import { WINDOW_DAYS, type HomeData } from "@/features/home/load";

/**
 * Home (issue #218, C157; boards HHomePhone, HHome, HStates, redesigned): a centred column, at most 1560 px wide.
 * 1. The hero: the date, a greeting by the time of day (with the person's first name when the account has one), one
 *    line on how the day stands, and on a wide screen "Needs you" beside it (below it on a phone, so the most urgent
 *    thing is the first thing). With nothing needing the person the hero says "All clear" and shows the 30-day line.
 * 2. Electricity (or the first-day steps) beside a glance at each area, or stacked on a phone.
 * 3. The 30-day line as a card under Electricity, when "Needs you" took the hero's right side.
 * Every part is optional: a person who may not see Electricity gets no electricity card, an area they may not
 * see gets no glance, and an empty section is left out. Pure markup: `loadHome()` did the reading.
 */
export function HomeView({ data: h }: { data: HomeData }) {
  const year = dayOfYear(h.today);
  const hasNeeds = h.needs.length > 0;
  const hasDays = h.days.length > 0;
  const electricity = h.settingUp ? (
    <SetupCard steps={h.steps} />
  ) : h.meters.length > 0 ? (
    <ElectricitySummary snapshot={h.snap} action={h.canRead ? <AddBothReadingsButton meters={h.entries} defaultDate={h.today} compact /> : undefined} />
  ) : null;
  const hasAreas = h.areas.length > 0;

  const line = hasNeeds && hasDays ? <NextDaysLine days={h.days} windowDays={WINDOW_DAYS} /> : null;

  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-4 md:gap-5">
      <header className="flex items-center gap-3">
        <PhoneMark />
        <p className="min-w-0 flex-1 font-mono text-[10.5px] tracking-[0.14em] text-label uppercase">
          {dayStamp(h.today)} · day {year.day} of {year.of}
        </p>
        <HeaderAccount />
      </header>

      <HomeHero greeting={greetingLine(h.hour, h.firstName)} brief={h.brief}>
        {hasNeeds ? <NeedsPanel needs={h.needs} /> : hasDays ? <NextDaysLine days={h.days} windowDays={WINDOW_DAYS} framed={false} /> : null}
      </HomeHero>

      {electricity || hasAreas ? (
        <div className={`grid gap-4 md:gap-5 ${electricity && hasAreas ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" : ""}`}>
          {electricity ? (
            <div className="contents lg:flex lg:flex-col lg:gap-5">
              <div className="order-1 lg:order-none lg:flex lg:flex-1 lg:flex-col [&>*]:flex-1">{electricity}</div>
              {line ? <div className="order-3 lg:order-none">{line}</div> : null}
            </div>
          ) : null}
          <AreaGlances
            areas={h.areas}
            windowDays={WINDOW_DAYS}
            className={`order-2 grid content-start gap-3 lg:order-none lg:content-stretch ${electricity ? "lg:auto-rows-fr" : "lg:grid-cols-3"}`}
          />
        </div>
      ) : null}

      {electricity ? null : line}

      {h.failedSources.length > 0 ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load reminders from: {h.failedSources.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
