import { describe, expect, it } from "vitest";
import { restoreValues, type FormField } from "./restore-values";

const field = (name: string, type: string, value = "", checked = false): FormField => ({ name, type, value, checked });
const data = (entries: Record<string, string>) => ({
  has: (n: string) => n in entries,
  get: (n: string) => (n in entries ? entries[n] : null),
});

describe("restoreValues", () => {
  it("puts text, date, select and textarea values back", () => {
    const fields = [field("name", "text"), field("dueDate", "date"), field("kind", "select-one"), field("notes", "textarea")];
    restoreValues(fields, data({ name: "Dialog", dueDate: "2026-11-25", kind: "subscription", notes: "a\nb" }));
    expect(fields.map((f) => f.value)).toEqual(["Dialog", "2026-11-25", "subscription", "a\nb"]);
  });

  it("restores checkboxes both ways: ticked stays ticked, unticked stays unticked", () => {
    const ticked = field("autopay", "checkbox", "on", false); // reset cleared it
    const unticked = field("replaced", "checkbox", "on", true); // reset ticked it from defaultChecked
    restoreValues([ticked, unticked], data({ autopay: "on" }));
    expect(ticked.checked).toBe(true);
    expect(unticked.checked).toBe(false);
  });

  it("restores the chosen radio button", () => {
    const a = field("size", "radio", "s");
    const b = field("size", "radio", "m");
    restoreValues([a, b], data({ size: "m" }));
    expect([a.checked, b.checked]).toEqual([false, true]);
  });

  it("leaves hidden fields, files, buttons and unnamed fields alone", () => {
    const hidden = field("id", "hidden", "real-id");
    const react = field("$ACTION_KEY", "hidden", "k"); // React adds these as hidden inputs
    const file = field("file", "file", "");
    const button = field("", "submit", "Save");
    restoreValues([hidden, react, file, button], data({ id: "tampered", $ACTION_KEY: "x", file: "x" }));
    expect([hidden.value, react.value, file.value, button.value]).toEqual(["real-id", "k", "", "Save"]);
  });

  it("keeps the current value when the field was not submitted, or was a file", () => {
    const f = field("amount", "text", "kept");
    restoreValues([f], { has: () => false, get: () => ({ name: "a.pdf" }) });
    expect(f.value).toBe("kept");
  });

  it("restores an empty string (a cleared field stays cleared)", () => {
    const f = field("note", "text", "default from props");
    restoreValues([f], data({ note: "" }));
    expect(f.value).toBe("");
  });
});
