import type { ScopedThreadRef } from "@t3tools/contracts";
import { useEffect, useMemo, useState } from "react";

import { useAppActive } from "../../lib/appState";
import { scopedThreadKey } from "../../lib/scopedEntities";

/** How long a synced thread shows in the foreground before it counts as read. */
export const THREAD_READ_DWELL_MS = 2_000;

/**
 * The thread once the app has shown it, synced and in the foreground, for a moment; otherwise
 * null. A thread that only flashes by while the app resumes and syncs keeps its unread state.
 */
export function useSettledThreadView(
  ref: ScopedThreadRef | null,
  synchronizing: boolean,
): ScopedThreadRef | null {
  const active = useAppActive();
  const key = ref === null ? null : scopedThreadKey(ref.environmentId, ref.threadId);
  // A fresh view each time the thread becomes visible and synced, so the wait restarts after a
  // resume or sync even if no timer ran meanwhile.
  const view = useMemo(
    () => (active && !synchronizing && key !== null ? { key } : null),
    [active, synchronizing, key],
  );
  const [settled, setSettled] = useState<{ readonly key: string } | null>(null);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- times how long the app has shown this synced thread in the foreground
  useEffect(() => {
    if (view === null) return;
    const timer = setTimeout(() => setSettled(view), THREAD_READ_DWELL_MS);
    return () => clearTimeout(timer);
  }, [view]);
  return view !== null && settled === view ? ref : null;
}
