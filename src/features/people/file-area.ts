import "server-only";
import { eq } from "drizzle-orm";
import { readDb } from "@/db/read";
import { vehicles } from "@/db/schema";
import { isOwnerType } from "@/lib/owners";
import { areaOfOwner, type Area } from "./access";

/**
 * Which section a stored file belongs to (S.8, C114): a vehicle's cover photo is part of Vehicles; its
 * other files and a renewal's papers are Vehicle documents; anything else follows what it is attached to.
 */
export async function fileArea(file: { id: string; ownerType: string; ownerId: string }): Promise<Area> {
  const db = await readDb();
  if (file.ownerType === "vehicle_renewal") return "vehicle_documents";
  if (file.ownerType === "vehicle") {
    const [v] = await db.select({ cover: vehicles.coverAttachmentId }).from(vehicles).where(eq(vehicles.id, file.ownerId));
    return v?.cover === file.id ? "vehicles" : "vehicle_documents";
  }
  return areaOfOwner(isOwnerType(file.ownerType) ? file.ownerType : null);
}
