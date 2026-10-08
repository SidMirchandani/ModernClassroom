/**
 * Files chosen on the new-class page, waiting for the class page to read them.
 *
 * Creating a class from your materials happens across a navigation: the class
 * has to exist before the import route will read anything for it (it checks
 * the caller teaches that class), so the new-class page creates it, parks the
 * files here and moves to the class's curriculum, where the panel picks them
 * up and starts the read. `File` objects cannot survive a reload or go into
 * storage, and do not need to — this is a client-side hand-off of a second or
 * two, so module memory is exactly the right lifetime.
 */

export interface PendingImport {
  files: File[];
  instructions: string;
}

const pending = new Map<string, PendingImport>();

export function setPendingImport(classId: string, value: PendingImport): void {
  pending.set(classId, value);
}

/** Reads and forgets, so a remount or a second visit does not start it again. */
export function takePendingImport(classId: string): PendingImport | null {
  const value = pending.get(classId) ?? null;
  pending.delete(classId);
  return value;
}
