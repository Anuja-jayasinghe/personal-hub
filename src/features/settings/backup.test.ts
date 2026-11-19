import { describe, expect, it } from "vitest";
import { latestBackup, storageShare } from "./backup";

describe("latestBackup", () => {
  it("picks the newest backup by its name and ignores other files", () => {
    expect(
      latestBackup(["notes.txt", "personal-hub-20261113-150811.zip", "personal-hub-20261118-030000.zip", "personal-hub-20261117-235959.zip", "personal-hub-2026.zip"]),
    ).toEqual({ file: "personal-hub-20261118-030000.zip", date: "2026-11-18", time: "03:00" });
  });

  it("is null when there is no backup", () => {
    expect(latestBackup([])).toBeNull();
    expect(latestBackup(["backup.zip"])).toBeNull();
  });
});

describe("storageShare", () => {
  it("is the used share, capped at 1", () => {
    expect(storageShare(0, 1024)).toBe(0);
    expect(storageShare(256, 1024)).toBe(0.25);
    expect(storageShare(4096, 1024)).toBe(1);
    expect(storageShare(10, 0)).toBe(0);
  });
});
