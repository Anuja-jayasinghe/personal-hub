import { ValidationError } from "./validation";
import type { ActionState } from "./types";

/** Turns a thrown error into the { ok, error } result form Server Actions return. */
export function toActionState(err: unknown): ActionState {
  if (err instanceof ValidationError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: "Something went wrong. Please try again." };
}
