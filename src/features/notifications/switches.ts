import { sql } from "drizzle-orm";
import type { Db } from "@/db/read";
import { appSettings } from "@/db/schema";
import { NOTIFICATIONS_SETTINGS_KEY } from "./channels";
import type { Channel } from "./steps";

/**
 * Saves one channel's switch in `app_settings` › notifications (N.2, N.3). One statement that merges
 * `{ <channel>: { enabled } }` into what is saved (jsonb `||`), so the email and iPhone switches never
 * undo each other, even when both are flipped at the same moment. A saved value that is not an object
 * starts again from `{}`. Called by the owner-only Server Actions with the real database.
 */
export async function saveSwitch(db: Db, channel: Channel, enabled: boolean): Promise<void> {
  const patch = { [channel]: { enabled } };
  await db
    .insert(appSettings)
    .values({ key: NOTIFICATIONS_SETTINGS_KEY, value: patch })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: sql`(case when jsonb_typeof(${appSettings.value}) = 'object' then ${appSettings.value} else '{}'::jsonb end) || ${JSON.stringify(patch)}::jsonb`,
        updatedAt: new Date(),
      },
    });
}
