import { View } from "react-native";

import { RowPressable } from "../../components/ui/RowPressable";
import { cn } from "../../lib/cn";
import { AppText as Text } from "../../components/ui/AppText";
import { SymbolView } from "../../components/ui/AppSymbol";
import { ProjectFavicon } from "../../components/ProjectFavicon";
import type { ThreadListV2ProjectHeaderItem } from "./threadListV2";

export function ProjectThreadHeader(props: {
  readonly item: ThreadListV2ProjectHeaderItem;
  readonly pane?: "screen" | "sidebar";
  readonly onToggle: () => void;
  readonly onNewThread: () => void;
}) {
  const { item } = props;
  const sidebar = props.pane === "sidebar";
  return (
    <View className={cn("mt-1 flex-row items-center", sidebar ? "mx-1" : "mx-2")}>
      <RowPressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.count} chats${!item.expanded && item.needsAttention ? ", needs attention" : ""}`}
        accessibilityState={{ expanded: item.expanded, disabled: item.disabled }}
        disabled={item.disabled}
        onPress={props.onToggle}
        className="min-h-12 flex-1 flex-row items-center gap-2 rounded-xl px-3 py-2"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <SymbolView
          name={item.expanded ? "chevron.down" : "chevron.right"}
          size={12}
          tintColorClassName={sidebar ? "accent-drawer-foreground-muted" : "accent-icon-muted"}
        />
        <ProjectFavicon
          environmentId={item.project.environmentId}
          faviconPath={item.project.faviconPath}
          projectIcon={item.project.projectIcon}
          projectTitle={item.title}
          workspaceRoot={item.project.workspaceRoot}
          size={18}
        />
        <Text
          className={cn(
            "flex-1 text-sm font-t3-medium",
            sidebar ? "text-drawer-foreground" : "text-foreground-secondary",
          )}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {!item.expanded && item.needsAttention ? (
          <View className="h-2 w-2 rounded-full bg-primary" />
        ) : null}
        {!item.expanded ? (
          <Text
            className={cn(
              "text-xs tabular-nums",
              sidebar ? "text-drawer-foreground-muted" : "text-foreground-muted",
            )}
          >
            {item.count}
          </Text>
        ) : null}
      </RowPressable>
      <RowPressable
        accessibilityRole="button"
        accessibilityLabel={`New thread in ${item.title}`}
        onPress={props.onNewThread}
        disabled={item.disabled}
        className="min-h-12 min-w-12 items-center justify-center rounded-xl"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <SymbolView
          name="square.and.pencil"
          size={18}
          tintColorClassName={sidebar ? "accent-drawer-foreground-muted" : "accent-icon-muted"}
        />
      </RowPressable>
    </View>
  );
}
