import { addDays } from "@/lib/dates";
import type {
  attachments,
  billItems,
  billPayments,
  electricityBills,
  electricityLiveSwitches,
  electricityMeters,
  electricityReadings,
  notes,
  tasks,
  vehicleOdometerReadings,
  vehicleRenewals,
  vehicleServices,
  vehicles,
} from "@/db/schema";

/**
 * The demo's sample data (S.9, DECISIONS C118): what signed-out visitors and people waiting for
 * approval see instead of the real hub. Pure and deterministic: the same `today` always gives the
 * same rows, so tests and screenshots are stable.
 *
 * Unlike the solaredge demo (dated 2035), the dates sit around today, because reminders, the live
 * meter and the billing cycle all count from today; a page-wide DEMO badge marks it as sample data
 * instead. Everything is made up: names, plates ("DEM-…"), account numbers ("DEMO-…") and amounts.
 */

type Rows = {
  electricityMeters: (typeof electricityMeters.$inferInsert)[];
  electricityReadings: (typeof electricityReadings.$inferInsert)[];
  electricityBills: (typeof electricityBills.$inferInsert)[];
  electricityLiveSwitches: (typeof electricityLiveSwitches.$inferInsert)[];
  billItems: (typeof billItems.$inferInsert)[];
  billPayments: (typeof billPayments.$inferInsert)[];
  vehicles: (typeof vehicles.$inferInsert)[];
  vehicleRenewals: (typeof vehicleRenewals.$inferInsert)[];
  vehicleServices: (typeof vehicleServices.$inferInsert)[];
  vehicleOdometerReadings: (typeof vehicleOdometerReadings.$inferInsert)[];
  tasks: (typeof tasks.$inferInsert)[];
  notes: (typeof notes.$inferInsert)[];
  attachments: (typeof attachments.$inferInsert)[];
};

/** Fixed ids, so demo addresses stay the same between visits. Group `g`, number `n`. */
export function demoId(g: number, n: number): string {
  return `de000000-0000-4000-8${String(g).padStart(3, "0")}-${String(n).padStart(12, "0")}`;
}

/** Small seeded generator (mulberry32), so the "noise" in usage is the same every time. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (n: number) => n.toFixed(2);

/** A made-up block tariff for sample bill amounts (not the real one). */
function sampleBill(units: number): number {
  const blocks: [number, number][] = [
    [60, 12],
    [30, 20],
    [30, 30],
    [60, 50],
    [Infinity, 75],
  ];
  let left = units;
  let total = 400;
  for (const [size, rate] of blocks) {
    const used = Math.min(left, size);
    total += used * rate;
    left -= used;
    if (left <= 0) break;
  }
  return Math.round(total);
}

export const DEMO_METERS = [
  { id: demoId(1, 1), name: "Main house", accountNumber: "DEMO-0001", perDay: 4.4, start: 18_240, seed: 11 },
  { id: demoId(1, 2), name: "Annex", accountNumber: "DEMO-0002", perDay: 8.2, start: 9_870, seed: 23 },
] as const;

export const DEMO_VEHICLES = {
  /** An insurance ending in 9 days (Needs you) and an oil-change marker due in 20 days (the amber card). */
  car: demoId(5, 1),
  bike: demoId(5, 2),
  /** A fresh set: every paper far from running out, a recent oil change, so Overview says All clear. */
  scooter: demoId(5, 3),
  /** Brand new, nothing recorded: the Overview shows the "Let's set up" checklist. */
  newcomer: demoId(5, 4),
};

export function demoRows(today: string): Rows {
  const rows: Rows = {
    electricityMeters: [],
    electricityReadings: [],
    electricityBills: [],
    electricityLiveSwitches: [],
    billItems: [],
    billPayments: [],
    vehicles: [],
    vehicleRenewals: [],
    vehicleServices: [],
    vehicleOdometerReadings: [],
    tasks: [],
    notes: [],
    attachments: [],
  };

  // ---- Electricity: two meters, a reading every few days, three bills each -----------------------
  // Bills are read 18, 48 and 78 days ago, so today is day 18 of a 30-day cycle. The house runs on
  // the annex, which has passed the low slab and may go up to the high one; the main house stays
  // under the low one. The newest bills are due in a few days.
  const billReadDays = [78, 48, 18];
  const firstDay = 100;
  for (const m of DEMO_METERS) {
    rows.electricityMeters.push({ id: m.id, name: m.name, accountNumber: m.accountNumber, notes: "Sample meter for the demo." });
    const rnd = random(m.seed);
    const valueOn = new Map<number, number>();
    let value: number = m.start;
    for (let ago = firstDay; ago >= 0; ago--) {
      valueOn.set(ago, Math.round(value * 100) / 100);
      value += m.perDay * (0.7 + rnd() * 0.6);
    }
    let n = 0;
    for (let ago = firstDay; ago >= 1; ago -= 4) {
      n += 1;
      rows.electricityReadings.push({ id: demoId(2, m.seed * 100 + n), meterId: m.id, readingDate: addDays(today, -ago), value: money(valueOn.get(ago)!) });
    }
    // The newest reading is from yesterday, so no meter shows as overdue for a check.
    rows.electricityReadings.push({ id: demoId(2, m.seed * 100 + 99), meterId: m.id, readingDate: addDays(today, -1), value: money(valueOn.get(1)!) });

    let previous = firstDay;
    billReadDays.forEach((ago, i) => {
      const prev = valueOn.get(previous)!;
      const curr = valueOn.get(ago)!;
      const units = Math.round((curr - prev) * 100) / 100;
      const readingDate = addDays(today, -ago);
      const billDate = addDays(readingDate, 2);
      const dueDate = addDays(billDate, 21);
      const isNewest = i === billReadDays.length - 1;
      rows.electricityBills.push({
        id: demoId(3, m.seed * 10 + i),
        meterId: m.id,
        billDate,
        readingDate,
        previousReading: money(prev),
        currentReading: money(curr),
        units: money(units),
        amount: money(sampleBill(units)),
        dueDate,
        paidDate: isNewest ? null : addDays(billDate, 6),
      });
      previous = ago;
    });
  }
  rows.electricityLiveSwitches.push({ id: demoId(4, 1), meterId: DEMO_METERS[1].id, switchedOn: addDays(today, -18) });

  // ---- Bills & subscriptions ------------------------------------------------------------------------
  const items: { n: number; kind: "bill" | "subscription"; name: string; amount: number; dueIn: number; autopay?: boolean; method: string; frequency?: "monthly" | "yearly" | "quarterly" }[] = [
    { n: 1, kind: "bill", name: "Water", amount: 1_150, dueIn: 4, method: "Bank app" },
    { n: 2, kind: "bill", name: "Internet", amount: 3_204, dueIn: 11, autopay: true, method: "Card" },
    { n: 3, kind: "bill", name: "Mobile phone", amount: 2_499, dueIn: -2, method: "Bank app" },
    { n: 4, kind: "subscription", name: "Video streaming", amount: 1_890, dueIn: 16, autopay: true, method: "Card" },
    { n: 5, kind: "subscription", name: "Cloud storage", amount: 650, dueIn: 23, autopay: true, method: "Card" },
    { n: 6, kind: "bill", name: "Home insurance", amount: 24_500, dueIn: 52, method: "Bank transfer", frequency: "yearly" },
    { n: 7, kind: "subscription", name: "Gym", amount: 6_000, dueIn: 37, method: "Cash", frequency: "quarterly" },
  ];
  for (const it of items) {
    const id = demoId(6, it.n);
    const nextDueDate = addDays(today, it.dueIn);
    const frequency = it.frequency ?? "monthly";
    rows.billItems.push({
      id,
      kind: it.kind,
      name: it.name,
      frequency,
      nextDueDate,
      anchorDay: Number(nextDueDate.slice(8, 10)),
      amount: money(it.amount),
      autopay: it.autopay ?? false,
      paymentMethod: it.method,
      notes: "Sample item for the demo.",
    });
    if (frequency !== "monthly") continue;
    for (let back = 1; back <= 3; back++) {
      const dueDate = addDays(nextDueDate, -30 * back);
      rows.billPayments.push({ id: demoId(7, it.n * 10 + back), itemId: id, dueDate, paidDate: addDays(dueDate, -1), amount: money(it.amount + (back % 2) * 40) });
    }
  }

  // ---- Vehicles ------------------------------------------------------------------------------------
  rows.vehicles.push(
    { id: DEMO_VEHICLES.car, nickname: "Family car", registrationNumber: "DEM-1234", make: "Toyota", model: "Corolla", year: 2017, fuelType: "Hybrid", vehicleType: "car", odometerKm: 84_310 },
    { id: DEMO_VEHICLES.bike, nickname: "Commuter bike", registrationNumber: "DM-5678", make: "Honda", model: "CB Shine", year: 2019, fuelType: "Petrol", vehicleType: "motorbike", odometerKm: 31_820 },
    { id: DEMO_VEHICLES.scooter, nickname: "City scooter", registrationNumber: "DM-2468", make: "Zippy", model: "Z110", year: 2024, fuelType: "Petrol", vehicleType: "scooter", odometerKm: 3_960 },
    { id: DEMO_VEHICLES.newcomer, nickname: "New runabout", registrationNumber: "DEM-4321", make: "Suzuki", model: "Alto", year: 2025, fuelType: "Petrol", vehicleType: "car" },
  );
  // The last number is an emission test's test-day odometer (issue #181), in line with the readings below.
  const renewals: [number, string, string, string, number, number, number | null][] = [
    [1, DEMO_VEHICLES.car, "Revenue license", "Divisional Secretariat", 42, 3_200, null],
    [2, DEMO_VEHICLES.car, "Insurance", "Sample Insurance Co.", 9, 58_000, null],
    [3, DEMO_VEHICLES.car, "Emission test", "Sample Testing Centre", 120, 1_800, 77_150],
    [4, DEMO_VEHICLES.bike, "Revenue license", "Divisional Secretariat", 25, 1_200, null],
    [5, DEMO_VEHICLES.bike, "Insurance", "Sample Insurance Co.", 200, 9_400, null],
    [6, DEMO_VEHICLES.bike, "Emission test", "Sample Testing Centre", 60, 640, 27_600],
    // The scooter's fresh set: all far from running out.
    [12, DEMO_VEHICLES.scooter, "Revenue license", "Divisional Secretariat", 310, 900, null],
    [13, DEMO_VEHICLES.scooter, "Insurance", "Sample Insurance Co.", 340, 7_200, null],
    [14, DEMO_VEHICLES.scooter, "Emission test", "Sample Testing Centre", 280, 500, 3_600],
  ];
  for (const [n, vehicleId, type, provider, expiresIn, amount, odometerKm] of renewals) {
    const expiryDate = addDays(today, expiresIn);
    rows.vehicleRenewals.push({ id: demoId(8, n), vehicleId, type, provider, startDate: addDays(expiryDate, -365), expiryDate, amount: money(amount), odometerKm });
  }
  // Earlier papers, renewed (issue #187): the car's license has a stretch with none on file, so the Documents
  // timeline shows a gap.
  const earlier: [number, string, string, string, string, string, number][] = [
    // n, vehicle, type, provider, start, expiry, amount
    [7, DEMO_VEHICLES.car, "Revenue license", "Divisional Secretariat", addDays(today, 42 - 730), addDays(today, 42 - 366), 3_000],
    [8, DEMO_VEHICLES.car, "Revenue license", "Divisional Secretariat", addDays(today, 42 - 1460 - 730), addDays(today, 42 - 1460 - 366), 2_400],
    [9, DEMO_VEHICLES.car, "Insurance", "Sample Insurance Co.", addDays(today, 9 - 730), addDays(today, 9 - 366), 54_500],
    [10, DEMO_VEHICLES.car, "Emission test", "Sample Testing Centre", addDays(today, 120 - 730), addDays(today, 120 - 366), 1_600],
    [11, DEMO_VEHICLES.bike, "Revenue license", "Divisional Secretariat", addDays(today, 25 - 730), addDays(today, 25 - 366), 1_100],
  ];
  for (const [n, vehicleId, type, provider, startDate, expiryDate, amount] of earlier) {
    rows.vehicleRenewals.push({ id: demoId(8, n), vehicleId, type, provider, startDate, expiryDate, amount: money(amount), renewedAt: new Date(`${expiryDate}T09:00:00Z`) });
  }
  // Sample papers: only the rows, there are no files behind them (the viewer shows a drawing in the demo).
  // Named the way the hub names them (C134): plate, kind, date.
  const plateOf = (vehicleId: string) => (vehicleId === DEMO_VEHICLES.car ? "DEM-1234" : vehicleId === DEMO_VEHICLES.scooter ? "DM-2468" : "DM-5678");
  const renewalOf = (n: number) => rows.vehicleRenewals.find((r) => r.id === demoId(8, n))!;
  const kindOf: Record<string, string> = { "Revenue license": "license", Insurance: "insurance", "Emission test": "emission" };
  const papers: [number, number, string, number, number][] = [
    // n, renewal n, mime type, size in KB, days after the renewal's start it was added
    [1, 1, "application/pdf", 556, 2],
    [2, 2, "image/jpeg", 1_240, 1],
    [3, 2, "image/jpeg", 1_180, 1],
    [4, 3, "application/pdf", 410, 0],
    [5, 5, "image/jpeg", 980, 3],
    [6, 4, "application/pdf", 520, 4],
    [7, 7, "application/pdf", 548, 2],
    [8, 8, "image/jpeg", 870, 5],
    [9, 9, "image/jpeg", 1_110, 1],
    [10, 11, "application/pdf", 490, 6],
    [11, 12, "application/pdf", 530, 1],
    [12, 13, "image/jpeg", 910, 2],
    [13, 14, "application/pdf", 380, 0],
  ];
  for (const [n, renewalN, mimeType, kb, after] of papers) {
    const r = renewalOf(renewalN);
    const ext = mimeType === "application/pdf" ? "pdf" : "jpg";
    const second = n === 3 ? "_2" : "";
    rows.attachments.push({
      id: demoId(13, n),
      ownerType: "vehicle_renewal",
      ownerId: r.id!,
      storagePath: `demo/vehicle_renewal/${r.id}/${n}.${ext}`,
      fileName: `${plateOf(r.vehicleId)}_${kindOf[r.type]}_${r.expiryDate}${second}.${ext}`,
      mimeType,
      sizeBytes: kb * 1024,
      createdAt: new Date(`${addDays(r.startDate!, after)}T09:00:00Z`),
    });
  }
  const bookDate = "2017-03-02";
  rows.attachments.push(
    { id: demoId(13, 21), ownerType: "vehicle", ownerId: DEMO_VEHICLES.car, storagePath: `demo/vehicle/${DEMO_VEHICLES.car}/21.pdf`, fileName: `DEM-1234_book_${bookDate}.pdf`, title: "Registration book", mimeType: "application/pdf", sizeBytes: 2_310 * 1024, createdAt: new Date(`${addDays(today, -200)}T09:00:00Z`) },
    // An upload of a kind a renewal owns: shown "on file" under insurance, never as the current paper.
    { id: demoId(13, 23), ownerType: "vehicle", ownerId: DEMO_VEHICLES.bike, storagePath: `demo/vehicle/${DEMO_VEHICLES.bike}/23.jpg`, fileName: `DM-5678_insurance_${addDays(today, 200 - 365)}.jpg`, title: "Cover note", mimeType: "image/jpeg", sizeBytes: 340 * 1024, createdAt: new Date(`${addDays(today, -165)}T10:00:00Z`) },
    // The scooter's book, so its Overview has nothing left to set up.
    { id: demoId(13, 24), ownerType: "vehicle", ownerId: DEMO_VEHICLES.scooter, storagePath: `demo/vehicle/${DEMO_VEHICLES.scooter}/24.pdf`, fileName: "DM-2468_book_2024-02-10.pdf", title: "Registration book", mimeType: "application/pdf", sizeBytes: 1_980 * 1024, createdAt: new Date(`${addDays(today, -60)}T09:00:00Z`) },
  );

  const services: [number, string, number, string, number, number, string, number | null][] = [
    [1, DEMO_VEHICLES.car, 260, "Full service", 76_900, 28_500, "Oil, oil filter, air filter, brake check", null],
    [2, DEMO_VEHICLES.car, 75, "Full service", 81_700, 31_200, "Oil, oil filter, cabin filter, wheel alignment", 95],
    [3, DEMO_VEHICLES.car, 30, "Tyres", 83_100, 64_000, "Two front tyres", null],
    [4, DEMO_VEHICLES.bike, 140, "Oil change", 29_400, 3_900, "Engine oil", null],
    [5, DEMO_VEHICLES.bike, 20, "Oil change", 31_500, 4_100, "Engine oil, chain lube", 70],
    [6, DEMO_VEHICLES.scooter, 12, "Oil change", 3_700, 2_400, "Engine oil", 170],
  ];
  for (const [n, vehicleId, ago, serviceType, km, cost, itemsDone, nextIn] of services) {
    const serviceDate = addDays(today, -ago);
    rows.vehicleServices.push({ id: demoId(9, n), vehicleId, serviceDate, serviceType, garage: "Sample Motors", odometerKm: km, cost: money(cost), itemsDone, nextDueDate: nextIn === null ? null : addDays(serviceDate, nextIn) });
  }
  // Service invoices (V.1a, V.4): named PLATE_service_<date>, like every file the hub names. Only some services have one.
  const serviceOf = (n: number) => rows.vehicleServices.find((x) => x.id === demoId(9, n))!;
  const invoices: [number, number, string, string, number][] = [
    // n, service n, plate, mime type, size in KB
    [31, 2, "DEM-1234", "application/pdf", 640],
    [32, 5, "DM-5678", "image/jpeg", 820],
    [33, 6, "DM-2468", "image/jpeg", 710],
  ];
  for (const [n, serviceN, plate, mimeType, kb] of invoices) {
    const service = serviceOf(serviceN);
    const ext = mimeType === "application/pdf" ? "pdf" : "jpg";
    rows.attachments.push({
      id: demoId(13, n),
      ownerType: "vehicle_service",
      ownerId: service.id!,
      storagePath: `demo/vehicle_service/${service.id}/${n}.${ext}`,
      fileName: `${plate}_service_${service.serviceDate}.${ext}`,
      mimeType,
      sizeBytes: kb * 1024,
      createdAt: new Date(`${service.serviceDate}T14:00:00Z`),
    });
  }
  // The scooter's newest reading is after its oil change, so its card shows "260 of 2,500 km".
  rows.vehicleOdometerReadings.push({ id: demoId(10, 30), vehicleId: DEMO_VEHICLES.scooter, readingDate: addDays(today, -3), km: 3_960 });
  for (let month = 6; month >= 1; month--) {
    rows.vehicleOdometerReadings.push(
      { id: demoId(10, month), vehicleId: DEMO_VEHICLES.car, readingDate: addDays(today, -30 * month + 3), km: 84_310 - month * 1_150 },
      { id: demoId(10, 10 + month), vehicleId: DEMO_VEHICLES.bike, readingDate: addDays(today, -30 * month + 5), km: 31_820 - month * 520 },
    );
  }

  // ---- Tasks and notes -------------------------------------------------------------------------------
  rows.tasks.push(
    { id: demoId(11, 1), title: "Book the car's next full service", status: "todo", priority: "normal", ownerType: "vehicle", ownerId: DEMO_VEHICLES.car, estimatedCost: money(32_000) },
    { id: demoId(11, 2), title: "Fix the dripping kitchen tap", status: "todo", priority: "high", dueDate: addDays(today, 3) },
    { id: demoId(11, 3), title: "Renew the passport", status: "doing", priority: "normal", dueDate: addDays(today, 21) },
    { id: demoId(11, 4), title: "Clean the water tank", status: "todo", priority: "low", dueDate: addDays(today, 40) },
    { id: demoId(11, 5), title: "Replace the porch bulb", status: "done", priority: "low", completedAt: new Date(`${addDays(today, -5)}T09:00:00Z`) },
  );
  rows.notes.push(
    { id: demoId(12, 1), title: "Wi-Fi for guests", body: "Network: Sample-Guest. The password is on the fridge.", pinned: true },
    { id: demoId(12, 2), title: "Tyre pressure", body: "Front 32 psi, rear 30 psi.", ownerType: "vehicle", ownerId: DEMO_VEHICLES.car },
    { id: demoId(12, 3), title: null, body: "The annex meter is read on the same day as the main house." },
  );

  return rows;
}
