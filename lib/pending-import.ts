/**
 * Files chosen on the new-class page, waiting for the class page to read them.
 *
 * Creating a class from your materials happens across a navigation: the class
 * has to exist before the import route will read anything for it (it checks
 * the caller teaches that class), so the new-class page creates it, parks the
 * files here and moves to the class's curriculum, where the setup screen carries
 * on and the read starts. `File` objects cannot survive a reload or go into
 * storage, and do not need to — this is a client-side hand-off of a second or
 * two, so module memory is exactly the right lifetime.
 */

export type SetupStepState = "done" | "run" | "wait" | "fail";

/** One line of the setup screen's list. */
export interface SetupStep {
  key: string;
  text: string;
  state: SetupStepState;
}

export interface PendingImport {
  files: File[];
  instructions: string;
  /** What the new-class page already did, so the setup screen's list carries on from it. */
  steps: SetupStep[];
}

const pending = new Map<string, PendingImport>();

export function setPendingImport(classId: string, value: PendingImport): void {
  pending.set(classId, value);
}

/** Whether one is waiting, leaving it there for `takePendingImport`. */
export function peekPendingImport(classId: string): PendingImport | null {
  return pending.get(classId) ?? null;
}

/** Reads and forgets, so a remount or a second visit does not start it again. */
export function takePendingImport(classId: string): PendingImport | null {
  const value = pending.get(classId) ?? null;
  pending.delete(classId);
  return value;
}
