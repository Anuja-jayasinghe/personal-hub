import { describe, expect, it } from "vitest";
import { newUploadPath, pathBelongsTo, uploadProblem } from "./upload-rules";

const owner = { ownerType: "vehicle", ownerId: "11111111-1111-4111-8111-111111111111" };
const id = "22222222-2222-4222-8222-222222222222";

describe("upload paths", () => {
  it("makes a path inside the record's folder and recognises it", () => {
    const path = newUploadPath(owner, "My licence (2026).pdf", id);
    expect(path).toBe(`vehicle/${owner.ownerId}/${id}-My_licence_2026_.pdf`);
    expect(pathBelongsTo(path, owner)).toBe(true);
  });
  it("refuses paths of another record, sub-folders and tricks", () => {
    expect(pathBelongsTo(`vehicle/33333333-3333-4333-8333-333333333333/${id}-a.pdf`, owner)).toBe(false);
    expect(pathBelongsTo(`vehicle/${owner.ownerId}/x/${id}-a.pdf`, owner)).toBe(false);
    expect(pathBelongsTo(`vehicle/${owner.ownerId}/../note/${id}-a.pdf`, owner)).toBe(false);
    expect(pathBelongsTo(`vehicle/${owner.ownerId}/`, owner)).toBe(false);
    expect(pathBelongsTo(`vehicle/${owner.ownerId}/not-a-uuid-a.pdf`, owner)).toBe(false);
  });
});

describe("uploadProblem", () => {
  const allowed = ["image/jpeg", "application/pdf"];
  it("accepts an allowed file within the size limit", () => {
    expect(uploadProblem({ size: 5_000_000, mimeType: "application/pdf" }, allowed, 10 * 1024 * 1024, "bad type")).toBeNull();
  });
  it("refuses empty, too large and other types", () => {
    expect(uploadProblem({ size: 0, mimeType: "application/pdf" }, allowed, 100, "bad type")).toMatch(/Choose/);
    expect(uploadProblem({ size: 200, mimeType: "application/pdf" }, allowed, 100, "bad type")).toMatch(/too large/);
    expect(uploadProblem({ size: 50, mimeType: "text/html" }, allowed, 100, "bad type")).toBe("bad type");
  });
});
