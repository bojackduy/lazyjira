import { For } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"

export function BacklogRoute() {
  const { state } = useAppState()
  const theme = useTheme()
  const backlogIssues = () => Object.values(state.issues).filter((issue) => issue.status === "Backlog")

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.accent}>Backlog: {state.board.name}</text>
      <text fg={theme.textMuted}>Active sprint, future sprint, and backlog sections will share this surface.</text>
      <box borderStyle="rounded" borderColor={theme.border} padding={1}>
        <text fg={theme.text}>Backlog</text>
        <For each={backlogIssues()} fallback={<text fg={theme.textSubtle}>No backlog issues in demo data</text>}>
          {(issue) => <text fg={theme.textMuted}>{issue.key} {issue.type} {issue.priority} {issue.title}</text>}
        </For>
      </box>
    </box>
  )
}
