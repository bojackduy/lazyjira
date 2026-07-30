import { Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"
import { issueTypeColorForName } from "../state/metadata-colors"
import { highestLoadedAncestor } from "../state/selectors"
import type { IssueSummary } from "../state/app-state"

export function ParentBadge(props: { issue: IssueSummary; width?: number }) {
  const { state } = useAppState()
  const theme = useTheme()
  const parent = () => highestLoadedAncestor(state, props.issue)
  const parentType = () => parent()?.type
  const parentTypeName = () => parent()?.typeName
  const color = () => {
    const type = parentType()
    if (!type) return theme.textSubtle
    return state.issueTypes.find((candidate) => candidate.id === type || candidate.name === type || candidate.name === parentTypeName())?.color ?? issueTypeColorForName(parentTypeName() ?? type)
  }
  const label = () => {
    const value = parent()
    return value?.title ?? value?.typeName ?? value?.type ?? "Parent"
  }

  return (
    <Show when={props.issue.parentKey}>
      <text fg={color()} width={props.width} wrapMode="none">
        <span style={{ fg: color() }}>◆ </span>{label()}
      </text>
    </Show>
  )
}
