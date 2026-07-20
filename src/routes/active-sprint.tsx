import { For } from "solid-js"
import { useAppState } from "../context/app-state"
import { useTheme } from "../context/theme"

export function ActiveSprintRoute() {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1}>
      <text fg={theme.accent}>Active Sprint: {state.sprint.name}</text>
      <text fg={theme.textMuted}>{state.sprint.goal}</text>
      <box flexDirection="row" gap={1} paddingTop={1}>
        <For each={state.columns}>
          {(column) => (
            <box borderStyle="rounded" borderColor={theme.border} padding={1} width={22} flexShrink={0}>
              <text fg={theme.text}>{column.name}</text>
              <For each={column.issueKeys} fallback={<text fg={theme.textSubtle}>No issues</text>}>
                {(issueKey) => {
                  const issue = state.issues[issueKey]
                  return issue ? <text fg={theme.textMuted}>{issue.key} {issue.title}</text> : null
                }}
              </For>
            </box>
          )}
        </For>
      </box>
    </box>
  )
}
