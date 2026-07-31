import { Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { parentColorForKey } from "../state/metadata-colors"
import { highestLoadedAncestor, topLevelLoadedAncestor } from "../state/selectors"
import type { IssueSummary } from "../state/app-state"

export function ParentBadge(props: { issue: IssueSummary; width?: number; topLevelOnly?: boolean }) {
  const { state } = useAppState()
  const parent = () => props.topLevelOnly ? topLevelLoadedAncestor(state, props.issue) : highestLoadedAncestor(state, props.issue)
  const color = () => parentColorForKey(parent()!.key)
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
