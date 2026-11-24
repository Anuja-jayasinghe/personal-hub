import { allows, sharedVisible, type Access } from "@/features/people/access";

/**
 * What the vehicle page's one Add button offers (V.1a, C147; the owner-approved design). Each choice shows only
 * when the signed-in person may do it, with the same levels the actions check, so the menu never offers
 * something the server would then refuse. Pure: the page works the flags out on the server with this and
 * passes plain booleans down, so nothing about a person's access is decided in the browser.
 */

export type AddChoices = {
  /** A paper: needs Add in Vehicle documents (for now the existing Add a document form; V.1b replaces it). */
  paper: boolean;
  /** A service: needs Add in Vehicles. */
  service: boolean;
  /** An odometer reading: needs Add in Vehicles. */
  reading: boolean;
  /** A note: what adding a note needs today, Add in Tasks & notes plus seeing the vehicle it is attached to. */
  note: boolean;
};

export function addChoices(access: Access): AddChoices {
  return {
    paper: allows(access, "vehicle_documents", "add"),
    service: allows(access, "vehicles", "add"),
    reading: allows(access, "vehicles", "add"),
    note: sharedVisible(access, "vehicle", "add"),
  };
}

/** True when there is nothing to add, so the page shows no Add button at all. */
export function hasAddChoice(choices: AddChoices): boolean {
  return choices.paper || choices.service || choices.reading || choices.note;
}
