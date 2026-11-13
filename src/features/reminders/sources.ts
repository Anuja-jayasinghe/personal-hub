import "server-only";
import type { ReminderSource } from "./engine";
import { tasksSource } from "./sources/tasks";
import { vehicleServicesSource } from "./sources/vehicle-services";

/**
 * Every module that has dates worth reminding about adds one line here. Coming later:
 * vehicle renewals (Phase 1.3), electricity bill due dates (Phase 2), bills and
 * subscriptions (Phase 3).
 */
export const reminderSources: ReminderSource[] = [tasksSource, vehicleServicesSource];
