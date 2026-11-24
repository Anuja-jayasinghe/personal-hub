import { describe, expect, it } from "vitest";
import { chequePhotoName, MAX_CHEQUE_PHOTOS } from "./photos";

describe("chequePhotoName", () => {
  it("is cheque_<date>_<n>, the first number free", () => {
    expect(chequePhotoName("2026-12-10", [], "jpg")).toBe("cheque_2026-12-10_1.jpg");
    expect(chequePhotoName("2026-12-10", ["cheque_2026-12-10_1.jpg"], "png")).toBe("cheque_2026-12-10_2.png");
  });

  it("refills a gap left by a deleted photo, whatever the extension, so two files never share a name", () => {
    expect(chequePhotoName("2026-12-10", ["cheque_2026-12-10_2.pdf"], "jpg")).toBe("cheque_2026-12-10_1.jpg");
    expect(chequePhotoName("2026-12-10", ["cheque_2026-12-10_1.heic", "cheque_2026-12-10_2.jpg"], "jpg")).toBe("cheque_2026-12-10_3.jpg");
  });

  it("is never taken from what the uploader called the file", () => {
    expect(chequePhotoName("2026-12-10", ["IMG_0001.jpg"], "jpg")).toBe("cheque_2026-12-10_1.jpg");
  });

  it("a cheque keeps a front and a back", () => expect(MAX_CHEQUE_PHOTOS).toBe(2));
});
