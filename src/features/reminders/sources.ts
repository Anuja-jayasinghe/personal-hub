import "server-only";
import type { ReminderSource } from "./engine";
import { tasksSource } from "./sources/tasks";

/**
 * Every module that has dates worth reminding about adds one line here. Coming later:
 * vehicle renewals and services (Phase 1), electricity bill due dates (Phase 2), bills and
 * subscriptions (Phase 3).
 */
export const reminderSources: ReminderSource[] = [tasksSource];
