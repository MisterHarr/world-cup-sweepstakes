"use client";

import { useBuildSync } from "@/lib/useBuildSync";

/** Mounted in the root layout. Compares the cached build id with the live
 * one and force-reloads stale clients. Renders nothing. */
export function BuildSync({ currentBuildId }: { currentBuildId: string }) {
  useBuildSync(currentBuildId);
  return null;
}
