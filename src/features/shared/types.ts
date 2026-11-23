/** Result returned by form Server Actions to `useActionState`: `error` when it failed, `notice` for something to say after it worked. */
export type ActionState = { ok: boolean; error?: string; notice?: string };

export const initialActionState: ActionState = { ok: false };
