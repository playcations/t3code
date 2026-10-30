import { scopedProjectKey } from "../../lib/scopedEntities";
import type { HomeProjectScope } from "../home/homeThreadList";
import {
  resolveThreadListV2Status,
  threadHasUnseenCompletion,
  type ThreadListV2ListItem,
  type ThreadListV2PendingListItem,
  type ThreadListV2ThreadListItem,
} from "./threadListV2";

export function buildProjectThreadList(input: {
  readonly items: readonly ThreadListV2ListItem[];
  readonly scopes: readonly HomeProjectScope[];
  readonly collapsedProjectGroups: readonly string[];
  readonly searching: boolean;
  readonly disabled: boolean;
}): ThreadListV2ListItem[] {
  const folders = input.scopes.map((scope) => ({
    scope,
    inbox: [] as Array<ThreadListV2ThreadListItem | ThreadListV2PendingListItem>,
    needsAttention: false,
  }));
  const folderByProject = new Map(
    folders.flatMap((folder) =>
      folder.scope.projectRefs.map(
        (ref) => [scopedProjectKey(ref.environmentId, ref.projectId), folder] as const,
      ),
    ),
  );
  const pinned: ThreadListV2ListItem[] = [];
  const shelves: ThreadListV2ListItem[] = [];
  for (const item of input.items) {
    if (
      item.type === "v2-snoozed-shelf" ||
      item.type === "v2-settled-shelf" ||
      (item.type === "v2-thread" && (item.item.snoozed || item.item.variant === "slim"))
    ) {
      shelves.push(item);
      continue;
    }
    if (item.type !== "v2-thread" && item.type !== "v2-pending") continue;
    if (item.type === "v2-thread" && item.item.pinned) {
      pinned.push(item);
      continue;
    }
    const entity = item.type === "v2-thread" ? item.item.thread : item.pendingTask;
    const folder = folderByProject.get(scopedProjectKey(entity.environmentId, entity.projectId));
    // A shell can arrive before its project; keep the thread reachable during that gap.
    if (!folder) {
      pinned.push(item);
      continue;
    }
    folder.inbox.push(item);
    if (item.type === "v2-thread") {
      const status = resolveThreadListV2Status(item.item.thread);
      folder.needsAttention ||=
        status === "approval" ||
        status === "input" ||
        status === "failed" ||
        status === "limited" ||
        threadHasUnseenCompletion(item.item.thread);
    }
  }
  const collapsed = new Set(input.collapsedProjectGroups);
  const result: ThreadListV2ListItem[] = [...pinned];
  for (const folder of folders) {
    const count = folder.inbox.length;
    if (count === 0) continue;
    const projectKey = folder.scope.key;
    const expanded = input.searching || !collapsed.has(projectKey);
    result.push({
      type: "v2-project-header",
      key: `v2-project:${projectKey}`,
      projectKey,
      title: folder.scope.title,
      project: folder.scope.representative,
      count,
      needsAttention: folder.needsAttention,
      expanded,
      disabled: input.disabled,
    });
    if (!expanded) continue;
    result.push(
      ...folder.inbox.map((item, index): ThreadListV2ListItem =>
        item.type === "v2-pending"
          ? { ...item, showPendingDivider: index === 0, inProjectFolder: true }
          : { ...item, inProjectFolder: true },
      ),
    );
  }
  result.push(...shelves);
  return result.map((item, index) => {
    if (item.type !== "v2-thread" && item.type !== "v2-pending") return item;
    const next = result[index + 1];
    const showTrailingDivider = next?.type === "v2-thread" || next?.type === "v2-pending";
    return { ...item, showTrailingDivider };
  });
}
