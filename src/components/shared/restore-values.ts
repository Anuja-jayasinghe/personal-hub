/**
 * Puts what someone typed back into a form after a Server Action returned an error. React 19
 * resets a form's uncontrolled fields when its action finishes, error or not, so without this a
 * validation message arrives together with an empty form. Pure (plain objects in), so it is testable.
 */
export type FormField = { name: string; type: string; value: string; checked: boolean };

/** The part of `FormData` this needs. */
export type Submitted = { has(name: string): boolean; get(name: string): unknown };

// Never restored: values the app or React set (hidden), files (browsers refuse to set them), buttons.
const SKIPPED = new Set(["hidden", "file", "submit", "button", "reset", "image"]);

export function restoreValues(fields: ArrayLike<FormField>, data: Submitted): void {
  for (const f of Array.from(fields)) {
    if (!f.name || SKIPPED.has(f.type)) continue;
    if (f.type === "checkbox") {
      f.checked = data.has(f.name); // an unticked checkbox is simply absent from the submitted data
    } else if (f.type === "radio") {
      f.checked = data.get(f.name) === f.value;
    } else {
      const v = data.get(f.name);
      if (typeof v === "string") f.value = v;
    }
  }
}
