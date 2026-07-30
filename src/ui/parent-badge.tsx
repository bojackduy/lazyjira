import { Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"
import { issueTypeColorForName } from "../state/metadata-colors"
import type { IssueSummary } from "../state/app-state"

export function ParentBadge(props: { issue: IssueSummary; compact?: boolean; width?: number }) {
  const { state } = useAppState()
  const theme = useTheme()
  const parent = () => props.issue.parent ?? (props.issue.parentKey ? state.issues[props.issue.parentKey] : undefined)
  const parentType = () => parent()?.type
  const parentTypeName = () => parent()?.typeName
  const color = () => {
    const type = parentType()
    if (!type) return theme.textSubtle
    return state.issueTypes.find((candidate) => candidate.id === type || candidate.name === type || candidate.name === parentTypeName())?.color ?? issueTypeColorForName(parentTypeName() ?? type)
  }
  const label = () => {
    const value = parent()
    if (!value) return props.issue.parentKey
    return value.title ? `${value.key} ${value.title}` : value.key
  }

  return (
    <Show when={props.issue.parentKey}>
      <text fg={color()} width={props.width} wrapMode="none">
        <span style={{ fg: color() }}>◆ </span>{props.compact ? props.issue.parentKey : label()}
      </text>
    </Show>
  )
}
