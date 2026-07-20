import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"

export function WorkspaceRoute() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.accent}>Workspace Home</text>
      <text fg={theme.text}>{state.project.key} {state.project.name}</text>
      <text fg={theme.textMuted}>Board: {state.board.name} ({state.board.type})</text>
      <text fg={theme.textMuted}>Active sprint: {state.sprint.name}</text>
      <box paddingTop={1} flexDirection="column" gap={1}>
        <text fg={theme.warning}>Signals</text>
        <text fg={theme.text}>Blocked: {state.stats.blocked}  Stale: {state.stats.stale}  Unassigned: {state.stats.unassigned}</text>
      </box>
      <text fg={theme.textSubtle}>Next tracks will replace this placeholder with project, board, sprint, and quick-filter navigation.</text>
    </box>
  )
}
