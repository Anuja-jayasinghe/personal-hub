/** Result returned by form Server Actions to `useActionState`. */
export type ActionState = { ok: boolean; error?: string };

export const initialActionState: ActionState = { ok: false };
