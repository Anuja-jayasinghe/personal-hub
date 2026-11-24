/** Result returned by form Server Actions to `useActionState`: `error` when it failed, `notice` for something to say after it worked, `id` for the record a create action just saved (so a form can attach a file to it). */
export type ActionState = { ok: boolean; error?: string; notice?: string; id?: string };

export const initialActionState: ActionState = { ok: false };
