import "server-only";
import { eq } from "drizzle-orm";
import { readDb } from "@/db/read";
import { vehicles } from "@/db/schema";
import { isOwnerType } from "@/lib/owners";
import { areaOfFile, type Area } from "./access";

/** Which section a stored file belongs to: `areaOfFile`, after looking up whether it is a vehicle's cover photo. */
export async function fileArea(file: { id: string; ownerType: string; ownerId: string }): Promise<Area> {
  if (!isOwnerType(file.ownerType)) return areaOfFile(null);
  if (file.ownerType !== "vehicle") return areaOfFile(file.ownerType);
  const db = await readDb();
  const [v] = await db.select({ cover: vehicles.coverAttachmentId }).from(vehicles).where(eq(vehicles.id, file.ownerId));
  return areaOfFile("vehicle", v?.cover === file.id);
}
