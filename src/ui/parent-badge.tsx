import { Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"
import { highestLoadedAncestor, issueTypeColorByIdentity, topLevelLoadedAncestor } from "../state/selectors"
import type { IssueSummary } from "../state/app-state"

export function ParentBadge(props: { issue: IssueSummary; width?: number; topLevelOnly?: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const parent = () => props.topLevelOnly ? topLevelLoadedAncestor(state, props.issue) : highestLoadedAncestor(state, props.issue)
  const parentType = () => parent()?.type
  const parentTypeName = () => parent()?.typeName
  const color = () => {
    const type = parentType()
    if (!type) return theme.textSubtle
    return issueTypeColorByIdentity(state, type, parentTypeName())
  }
  const label = () => {
    const value = parent()
    return value?.title ?? value?.typeName ?? value?.type ?? "Parent"
  }

  return (
    <Show when={parent()}>
      <text fg={color()} width={props.width} wrapMode="none">
        <span style={{ fg: color() }}>◆ {label()}</span>
      </text>
    </Show>
  )
}
