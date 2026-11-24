/** A cheque keeps a photo of its front and, optionally, its back (issue #178, C158). */
export const MAX_CHEQUE_PHOTOS = 2;

/**
 * The next free hub-made name for a cheque's photo: `cheque_2026-12-10_1.jpg`, then `_2`. The number is
 * the first one not used by `taken` (names with any extension), so deleting the first photo and adding
 * another never makes two files with the same name. Pure.
 */
export function chequePhotoName(chequeDate: string, taken: readonly string[], ext: string): string {
  const used = new Set(taken.map((n) => n.replace(/\.[^.]*$/, "")));
  let n = 1;
  while (used.has(`cheque_${chequeDate}_${n}`)) n++;
  return `cheque_${chequeDate}_${n}.${ext}`;
}
