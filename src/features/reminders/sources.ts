import "server-only";
import type { ReminderSource } from "./engine";
import { electricityBillsSource } from "./sources/electricity-bills";
import { tasksSource } from "./sources/tasks";
import { vehicleRenewalsSource } from "./sources/vehicle-renewals";
import { vehicleServicesSource } from "./sources/vehicle-services";

/**
 * Every module that has dates worth reminding about adds one line here. Coming later: bills and
 * subscriptions (Phase 3).
 */
export const reminderSources: ReminderSource[] = [tasksSource, vehicleServicesSource, vehicleRenewalsSource, electricityBillsSource];
