import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"

export function IssueDetailRoute() {
  const { state } = useAppState()
  const theme = useTheme()
  const issue = () => state.issues[state.selectedIssueKey]

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.accent}>Issue Detail</text>
      <text fg={theme.text}>{issue()?.key ?? "No issue selected"} {issue()?.title ?? ""}</text>
      <text fg={theme.textMuted}>Description, comments, subtasks, links, attachments, and activity will render here.</text>
    </box>
  )
}
