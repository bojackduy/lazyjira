import { TextAttributes } from "@opentui/core"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"

export function PlannedProjectView(props: { name: "Timeline" | "List"; plannedWave: "N3" | "N5" }) {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexGrow={1} minHeight={0} flexDirection="column" alignItems="center" justifyContent="center" gap={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.accent}>{props.name}</text>
      <text fg={theme.text}>{state.project.key} {state.project.name}</text>
      <text fg={theme.textMuted}>{props.name} is planned for Wave 5 {props.plannedWave} and is not loaded yet.</text>
      <text fg={theme.textSubtle}>No Jira request is made from this placeholder. Use 3 Backlog or 5 board view.</text>
    </box>
  )
}
