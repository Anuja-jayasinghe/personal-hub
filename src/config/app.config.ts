/**
 * Central app configuration — the ONE place for identity, locale and module settings.
 *
 * Branding is deliberately placeholder (DECISIONS C3, C14): the real name, logo, colours and
 * fonts are decided in a separate session. Nothing else in the codebase hard-codes the app
 * name, currency or reminder lead times; everything reads from here.
 *
 *   Colours / radius  → src/theme/theme.css
 *   Fonts             → src/theme/fonts.ts
 *   Name / logo / ... → this file
 */

export type ModuleKey = "vehicles" | "electricity" | "bills";

/** Pages that belong to the app itself rather than to one module (shown under Home in the sidebar). */
export type SharedPageConfig = {
  key: string;
  label: string;
  href: string;
  icon: string;
};

export type ModuleConfig = {
  key: ModuleKey;
  label: string;
  description: string;
  href: string;
  /** lucide-react icon name; resolved when the app shell is built (step 0.6). */
  icon: string;
  enabled: boolean;
};

export const appConfig = {
  // ---- Identity (placeholder until branding is decided — P9) ----------------------------
  name: "Personal Hub",
  shortName: "Hub",
  tagline: "Everything you need to keep on top of, in one place.",
  description: "Personal dashboard for vehicles, electricity and bills.",

  logo: {
    /** Set to a path under /public (e.g. "/brand/logo.svg") once a real logo exists. */
    src: null as string | null,
    /** Text mark shown while there is no logo image. */
    mark: "H",
    alt: "Personal Hub logo",
  },

  // ---- Locale & money (DECISIONS C21) -----------------------------------------------------
  currency: {
    code: "LKR",
    /** Used for number/date formatting. */
    locale: "en-LK",
    /** Fraction digits shown for amounts. */
    fractionDigits: 2,
  },
  /** Confirmed (DECISIONS C25). Used to decide what "today" is for reminders. */
  timeZone: "Asia/Colombo",

  // ---- Reminders (DECISIONS C20): days before a due date that an item gets flagged ----------
  reminders: {
    leadDays: [30, 14, 7, 1, 0],
  },

  // ---- Vehicles (Phase 1) -----------------------------------------------------------------------
  vehicles: {
    /**
     * What kind of vehicle it is. Each type picks the icon shown when a vehicle has no cover photo,
     * so a bike does not look like a car. `icon` is a name from src/components/vehicles/vehicle-icons.ts.
     * Add a line here to add a type; the stored value is the `key`, so do not rename one in use.
     */
    types: [
      { key: "car", label: "Car", icon: "car" },
      { key: "suv", label: "SUV / Jeep", icon: "suv" },
      { key: "van", label: "Van", icon: "van" },
      { key: "pickup", label: "Pickup / Truck", icon: "truck" },
      { key: "motorbike", label: "Motorbike", icon: "motorbike" },
      { key: "scooter", label: "Scooter", icon: "scooter" },
      { key: "bicycle", label: "Bicycle", icon: "bicycle" },
      { key: "three-wheeler", label: "Three-wheeler", icon: "three-wheeler" },
      { key: "bus", label: "Bus", icon: "bus" },
      { key: "other", label: "Other", icon: "car" },
    ] as readonly { key: string; label: string; icon: string }[],
    fuelTypes: ["Petrol", "Diesel", "Hybrid", "Electric", "Other"] as readonly string[],
    /** Suggestions for the service type box (Phase 1.2); anything else can be typed in. */
    serviceTypes: ["Full service", "Oil change", "Tyres", "Brakes", "Battery", "Other"] as readonly string[],
    /**
     * Renewals that expire (Phase 1.3, DECISIONS C23: the driving license is not here, C45).
     * `leadDays` is optional: leave it out to use the app-wide reminder lead times above, or set
     * it to warn earlier for one type, e.g. { label: "Insurance", leadDays: [60, 30, 14, 7, 1, 0] }.
     */
    renewalTypes: [
      { label: "Revenue license" },
      { label: "Insurance" },
      { label: "Emission test" },
    ] as readonly { label: string; leadDays?: readonly number[] }[],
  },

  // ---- Electricity (Phase 2) ----------------------------------------------------------------------
  electricity: {
    /** Length of a billing cycle in days, used to project usage ("at this rate: ~N kWh per cycle"). */
    billingCycleDays: 30,
  },

  // ---- Bills & subscriptions (Phase 3) -------------------------------------------------------------
  bills: {
    /** How many days ahead the Upcoming list on the Bills page looks (overdue items are always shown). */
    upcomingDays: 60,
    /** How many months ahead the calendar can be moved forward. */
    calendarMonthsAhead: 12,
  },

  // ---- Shared pages (DECISIONS C35) ------------------------------------------------------------
  sharedPages: [
    { key: "reminders", label: "Reminders", href: "/reminders", icon: "bell" },
    { key: "tasks", label: "Tasks & notes", href: "/tasks", icon: "tasks" },
  ] satisfies SharedPageConfig[],

  // ---- Modules (DECISIONS C1): flip `enabled` to show/hide a module in navigation ------------
  modules: [
    {
      key: "vehicles",
      label: "Vehicles",
      description: "Services, licence and insurance renewals, and notes.",
      href: "/vehicles",
      icon: "car",
      enabled: true,
    },
    {
      key: "electricity",
      label: "Electricity",
      description: "Meter readings, bills and a running total since your last bill.",
      href: "/electricity",
      icon: "zap",
      enabled: true,
    },
    {
      key: "bills",
      label: "Bills & subscriptions",
      description: "Payment dates, amounts and history.",
      href: "/bills",
      icon: "receipt",
      enabled: true,
    },
  ] satisfies ModuleConfig[],
} as const;

export type AppConfig = typeof appConfig;

export const enabledModules = appConfig.modules.filter((m) => m.enabled);

/** True when a module is switched on in `appConfig.modules`; route pages use it to 404 when off. */
export function isModuleEnabled(key: ModuleKey): boolean {
  return appConfig.modules.some((m) => m.key === key && m.enabled);
}
