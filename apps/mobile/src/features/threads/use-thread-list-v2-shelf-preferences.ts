import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";

import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "../../state/preferences";
import type { ThreadListV2InboxKind } from "./threadListV2";

const INBOX_EXPANDED_PREFERENCE = {
  needsYou: "threadListNeedsYouShelfExpanded",
  failed: "threadListFailedShelfExpanded",
  completed: "threadListCompletedShelfExpanded",
} as const;

export function useThreadListV2ShelfPreferences() {
  const preferencesResult = useAtomValue(mobilePreferencesAtom);
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const loaded = AsyncResult.isSuccess(preferencesResult);
  const snoozedShelfExpanded =
    loaded && preferencesResult.value.threadListSnoozedShelfExpanded === true;
  const settledShelfExpanded =
    loaded && preferencesResult.value.threadListSettledShelfExpanded === true;
  const projectFoldersEnabled = loaded && preferencesResult.value.projectFoldersEnabled === true;
  const collapsedProjectGroups = loaded
    ? (preferencesResult.value.collapsedProjectGroups ?? [])
    : [];
  const workingShelfEnabled =
    !projectFoldersEnabled && loaded && preferencesResult.value.workingShelfEnabled !== false;
  const toggleProjectGroup = (key: string) => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        collapsedProjectGroups: current.collapsedProjectGroups?.includes(key)
          ? current.collapsedProjectGroups.filter((value) => value !== key)
          : [...(current.collapsedProjectGroups ?? []), key],
      }),
    });
  };
  const workingShelfExpanded =
    loaded && preferencesResult.value.threadListWorkingShelfExpanded === true;
  // Inbox sections belong to the project folder layout; the flat list stays as it is.
  const inboxShelvesEnabled = {
    needsYou: projectFoldersEnabled && preferencesResult.value.needsYouShelfEnabled === true,
    failed: projectFoldersEnabled && preferencesResult.value.failedShelfEnabled === true,
    completed: projectFoldersEnabled && preferencesResult.value.completedShelfEnabled === true,
  };
  // Inbox sections start open: they only list threads that want the user.
  const inboxShelfExpanded = {
    needsYou: !loaded || preferencesResult.value.threadListNeedsYouShelfExpanded !== false,
    failed: !loaded || preferencesResult.value.threadListFailedShelfExpanded !== false,
    completed: !loaded || preferencesResult.value.threadListCompletedShelfExpanded !== false,
  };
  const toggleInboxShelf = (kind: ThreadListV2InboxKind) => {
    if (!loaded) return;
    const preference = INBOX_EXPANDED_PREFERENCE[kind];
    savePreferences({
      transform: (current) => ({ [preference]: current[preference] === false }),
    });
  };

  // Transforms read optimistic state so same-frame presses toggle twice.
  const toggleSnoozedShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListSnoozedShelfExpanded: current.threadListSnoozedShelfExpanded !== true,
      }),
    });
  };
  const toggleSettledShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListSettledShelfExpanded: current.threadListSettledShelfExpanded !== true,
      }),
    });
  };
  const toggleWorkingShelf = () => {
    if (!loaded) return;
    savePreferences({
      transform: (current) => ({
        threadListWorkingShelfExpanded: current.threadListWorkingShelfExpanded !== true,
      }),
    });
  };

  return {
    loaded,
    projectFoldersEnabled,
    collapsedProjectGroups,
    toggleProjectGroup,
    settledShelfExpanded,
    snoozedShelfExpanded,
    workingShelfEnabled,
    workingShelfExpanded,
    inboxShelvesEnabled,
    inboxShelfExpanded,
    toggleInboxShelf,
    toggleSettledShelf,
    toggleSnoozedShelf,
    toggleWorkingShelf,
  } as const;
}
