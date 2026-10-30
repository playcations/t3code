import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import type { PendingDraftTask } from "../../state/pending-new-tasks-model";
import { makeThreadShellFixture } from "../../test-fixtures";
import { buildHomeProjectScopes } from "../home/homeThreadList";
import { buildProjectThreadList } from "./project-thread-list";
import {
  buildThreadListV2Items,
  buildThreadListV2ListItems,
  threadListV2ListItemsAreEqual,
} from "./threadListV2";

const now = "2026-10-21T12:00:00.000Z";
const environmentId = EnvironmentId.make("local");

function project(id: string, environment = environmentId): EnvironmentProject {
  return {
    id: ProjectId.make(id),
    environmentId: environment,
    title: id,
    workspaceRoot: `/work/${id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    scripts: [],
    createdAt: now,
    updatedAt: now,
  };
}
function thread(
  id: string,
  project: EnvironmentProject,
  overrides: Partial<EnvironmentThreadShell> = {},
) {
  return makeThreadShellFixture({
    id: ThreadId.make(id),
    title: id,
    environmentId: project.environmentId,
    projectId: project.id,
    ...overrides,
  });
}
function setup(settledShelfExpanded = true, settledLimit = Number.MAX_SAFE_INTEGER) {
  const a = project("A");
  const b = project("B");
  const scopes = buildHomeProjectScopes({
    projects: [a, b],
    environmentId: null,
    projectGroupingMode: "repository",
  });
  const threads = [
    thread("a-active", a, { hasPendingApprovals: true }),
    thread("b-active", b),
    thread("a-settled-1", a, { settledOverride: "settled", settledAt: now }),
    thread("a-settled-2", a, { settledOverride: "settled", settledAt: now }),
    thread("b-pinned", b, { pinnedAt: now }),
    thread("a-snoozed", a, { snoozedAt: now, snoozedUntil: "2026-10-22T12:00:00.000Z" }),
  ];
  const layout = buildThreadListV2Items({
    threads,
    environmentId: null,
    searchQuery: "",
    now,
    settledShelfExpanded,
    snoozedShelfExpanded: true,
    settledLimit,
  });
  const items = buildThreadListV2ListItems({
    ...layout,
    pendingTasks: [],
    settledShelfExpanded,
    snoozedShelfExpanded: true,
  });
  const input = {
    items,
    scopes,
    collapsedProjectGroups: [],
    searching: false,
    disabled: false,
  };
  return { a, b, input, layout };
}

describe("project thread folders", () => {
  it("keeps one shared Settled section below project folders and the Snoozed section", () => {
    const { input } = setup();
    const result = buildProjectThreadList(input);
    expect(
      result.map((item) => (item.type === "v2-thread" ? item.item.thread.id : item.type)),
    ).toEqual([
      "b-pinned",
      "v2-project-header",
      "a-active",
      "v2-project-header",
      "b-active",
      "v2-snoozed-shelf",
      "a-snoozed",
      "v2-settled-shelf",
      "a-settled-1",
      "a-settled-2",
    ]);
    expect(result.find((item) => item.type === "v2-project-header")).toMatchObject({
      title: "A",
      count: 1,
      needsAttention: true,
    });
  });
  it("marks only rows under a folder header as leaving out their project", () => {
    const { input } = setup();
    const inFolder = buildProjectThreadList(input)
      .filter((item) => item.type === "v2-thread")
      .filter((item) => item.inProjectFolder === true)
      .map((item) => item.item.thread.id);
    expect(inFolder).toEqual(["a-active", "b-active"]);
  });
  it("collapses only the selected project and restores its rows when reopened", () => {
    const { input } = setup();
    const result = buildProjectThreadList({
      ...input,
      collapsedProjectGroups: [input.scopes[0]!.key],
    });
    expect(
      result.filter((item) => item.type === "v2-thread").map((item) => item.item.thread.id),
    ).toEqual(["b-pinned", "b-active", "a-snoozed", "a-settled-1", "a-settled-2"]);
    expect(result.find((item) => item.type === "v2-project-header")).toMatchObject({
      expanded: false,
      count: 1,
      needsAttention: true,
    });
    expect(
      buildProjectThreadList(input).some(
        (item) => item.type === "v2-thread" && item.item.thread.id === "a-active",
      ),
    ).toBe(true);
  });
  it("keeps all settled chats behind one disclosure even when project folders are collapsed", () => {
    const { input } = setup(false);
    const result = buildProjectThreadList({
      ...input,
      collapsedProjectGroups: input.scopes.map((scope) => scope.key),
    });
    expect(result.filter((item) => item.type === "v2-settled-shelf")).toEqual([
      {
        type: "v2-settled-shelf",
        key: "v2-settled-shelf",
        count: 2,
        expanded: false,
        disabled: false,
      },
    ]);
    expect(
      result.filter((item) => item.type === "v2-thread").map((item) => item.item.thread.id),
    ).toEqual(["b-pinned", "a-snoozed"]);
  });
  it("retains global settled pagination and its total count", () => {
    const { input, layout } = setup(true, 1);
    const result = buildProjectThreadList(input);
    expect(
      result.filter(
        (item) => item.type === "v2-thread" && item.item.variant === "slim" && !item.item.snoozed,
      ),
    ).toHaveLength(1);
    expect(result.find((item) => item.type === "v2-settled-shelf")).toMatchObject({
      count: 2,
      expanded: true,
    });
    expect(layout.hiddenSettledCount).toBe(1);
  });
  it("search opens matching project folders without changing the saved collapse state", () => {
    const { input } = setup();
    const collapsedProjectGroups = [input.scopes[0]!.key];
    const result = buildProjectThreadList({ ...input, collapsedProjectGroups, searching: true });
    expect(result.find((item) => item.type === "v2-project-header")).toMatchObject({
      expanded: true,
    });
    expect(
      result.some((item) => item.type === "v2-thread" && item.item.thread.id === "a-active"),
    ).toBe(true);
    expect(collapsedProjectGroups).toEqual([input.scopes[0]!.key]);
  });
  it("omits empty project folders and projects containing only settled chats", () => {
    const { a, b, input } = setup();
    const layout = buildThreadListV2Items({
      threads: [
        thread("settled", a, { settledOverride: "settled" }),
        thread("other-settled", b, { settledOverride: "settled" }),
      ],
      environmentId: null,
      searchQuery: "",
      now,
      settledShelfExpanded: false,
    });
    const items = buildThreadListV2ListItems({
      ...layout,
      pendingTasks: [],
      settledShelfExpanded: false,
    });
    const result = buildProjectThreadList({
      ...input,
      items,
      scopes: buildHomeProjectScopes({
        projects: [a, b, project("empty")],
        environmentId: null,
        projectGroupingMode: "repository",
      }),
    });
    expect(result).toEqual([
      {
        type: "v2-settled-shelf",
        key: "v2-settled-shelf",
        count: 2,
        expanded: false,
        disabled: false,
      },
    ]);
    expect(
      result.some((item) => item.type === "v2-project-header" && item.project.id === b.id),
    ).toBe(false);
  });
  it("uses environment-scoped project identities and retains temporarily missing projects", () => {
    const local = project("same");
    const remote = project("same", EnvironmentId.make("remote"));
    const scopes = buildHomeProjectScopes({
      projects: [local, remote],
      environmentId: null,
      projectGroupingMode: "separate",
    });
    const layout = buildThreadListV2Items({
      threads: [thread("remote", remote), thread("orphan", project("missing"))],
      environmentId: null,
      searchQuery: "",
      now,
    });
    const items = buildThreadListV2ListItems({ ...layout, pendingTasks: [] });
    const result = buildProjectThreadList({
      ...setup().input,
      scopes,
      items,
      collapsedProjectGroups: [scopes[0]!.key],
    });
    expect(
      result.filter((item) => item.type === "v2-thread").map((item) => item.item.thread.id),
    ).toEqual(["orphan", "remote"]);
  });
  it("keeps unsent drafts inside their own folders with a divider in each folder", () => {
    const { a, b, input } = setup();
    const pendingItems = [a, b].map((project) => {
      const task: PendingDraftTask = {
        kind: "draft",
        key: `draft-${project.id}`,
        environmentId: project.environmentId,
        projectId: project.id,
        projectTitle: undefined,
        projectCwd: undefined,
        title: "Unsent draft",
        createdAt: now,
        draftKey: `draft-${project.id}`,
        draft: { text: "Unsent draft", attachments: [] },
      };
      return buildThreadListV2ListItems({ items: [], pendingTasks: [task] })[0]!;
    });
    const result = buildProjectThreadList({ ...input, items: [...pendingItems, ...input.items] });
    expect(result.filter((item) => item.type === "v2-pending")).toHaveLength(2);
    for (const [index, item] of result.entries()) {
      if (item.type !== "v2-pending") continue;
      expect(result[index - 1]).toMatchObject({
        type: "v2-project-header",
        project: { id: item.pendingTask.projectId },
      });
      expect(item.showPendingDivider).toBe(true);
    }
    const collapsed = buildProjectThreadList({
      ...input,
      items: [...pendingItems, ...input.items],
      collapsedProjectGroups: [input.scopes[0]!.key],
    });
    expect(
      collapsed
        .filter((item) => item.type === "v2-pending")
        .map((item) => item.pendingTask.projectId),
    ).toEqual([b.id]);
  });

  it("keeps inbox sections above the folders and their threads out of them", () => {
    const { a, b, input } = setup();
    const layout = buildThreadListV2Items({
      threads: [
        thread("a-idle", a),
        thread("b-asks", b, { hasPendingApprovals: true }),
        thread("a-asks", a, { hasPendingApprovals: true }),
      ],
      environmentId: null,
      searchQuery: "",
      now,
      inboxShelvesEnabled: { needsYou: true, failed: true, completed: true },
    });
    const items = buildThreadListV2ListItems({ ...layout, pendingTasks: [] });
    const result = buildProjectThreadList({ ...input, items });
    expect(
      result.map((item) =>
        item.type === "v2-thread"
          ? item.item.thread.id
          : item.type === "v2-project-header"
            ? `folder:${item.title}(${item.count})`
            : item.type,
      ),
    ).toEqual(["v2-inbox-shelf", "a-asks", "b-asks", "folder:A(1)", "a-idle"]);
  });

  it("updates recycled headers when collapse or attention state changes", () => {
    const { input } = setup();
    const header = buildProjectThreadList(input).find((item) => item.type === "v2-project-header")!;
    expect(threadListV2ListItemsAreEqual(header, { ...header })).toBe(true);
    expect(threadListV2ListItemsAreEqual(header, { ...header, expanded: false })).toBe(false);
    expect(threadListV2ListItemsAreEqual(header, { ...header, needsAttention: false })).toBe(false);
  });
});
