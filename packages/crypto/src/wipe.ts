/** Client-side remote wipe checklist helpers. */

export interface WipeLocalResult {
  clearedKeys: boolean;
  clearedMessageDb: boolean;
  clearedCaches: boolean;
}

export async function performLocalWipe(hooks: {
  clearKeys: () => Promise<void>;
  clearMessageDb: () => Promise<void>;
  clearCaches: () => Promise<void>;
}): Promise<WipeLocalResult> {
  await hooks.clearKeys();
  await hooks.clearMessageDb();
  await hooks.clearCaches();
  return { clearedKeys: true, clearedMessageDb: true, clearedCaches: true };
}
