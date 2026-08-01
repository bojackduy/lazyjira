import { Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { highestLoadedAncestor, parentIssueColor, topLevelLoadedAncestor } from "../state/selectors"
import type { IssueSummary } from "../state/app-state"

export function ParentBadge(props: { issue: IssueSummary; width?: number; maxWidth?: number; flexShrink?: number; label?: "title" | "key" | "key-title"; topLevelOnly?: boolean }) {
  const { state } = useAppState()
  const icons = useIcons()
  const parent = () => props.topLevelOnly ? topLevelLoadedAncestor(state, props.issue) : highestLoadedAncestor(state, props.issue)
  const color = () => parentIssueColor(state, parent()!)
  const label = () => {
    const value = parent()
    if (!value) return "Parent"
    if (props.label === "key") return value.key
    if (props.label === "key-title") return `${value.key} ${value.title}`
    return value.title ?? value.typeName ?? value.type ?? value.key
  }

  return (
    <Show when={parent()}>
      <text fg={color()} width={props.width} maxWidth={props.maxWidth} flexShrink={props.flexShrink} wrapMode="none">
        <span style={{ fg: color() }}>{icons.catalog.exceptional.parent} {label()}</span>
      </text>
    </Show>
  )
}
