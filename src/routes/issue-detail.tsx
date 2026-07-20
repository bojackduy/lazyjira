import { RGBA, SyntaxStyle, TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { issueTypeColor, statusColor, statusName } from "../state/selectors"

const markdownSyntax = SyntaxStyle.fromStyles({
  "markup.heading.1": { fg: RGBA.fromHex("#38BDF8"), bold: true },
  "markup.heading.2": { fg: RGBA.fromHex("#A78BFA"), bold: true },
  "markup.heading.3": { fg: RGBA.fromHex("#A78BFA"), bold: true },
  "markup.list": { fg: RGBA.fromHex("#22C55E") },
  "markup.raw": { fg: RGBA.fromHex("#F59E0B") },
  "markup.quote": { fg: RGBA.fromHex("#94A3B8"), italic: true },
  "markup.link": { fg: RGBA.fromHex("#38BDF8"), underline: true },
  default: { fg: RGBA.fromHex("#E5E7EB") },
})

export function IssueDetailRoute() {
  const { state } = useAppState()
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => state.issues[state.selectedIssueKey]
  const descriptionHeight = () => Math.max(6, dimensions().height - 17)

  useBindings(() => ({
    commands: [
      { name: "issue-detail.scroll.down", run: () => scrollPage(1) },
      { name: "issue-detail.scroll.up", run: () => scrollPage(-1) },
    ],
    bindings: [
      { key: "d", cmd: "issue-detail.scroll.down" },
      { key: { name: "d", ctrl: true }, cmd: "issue-detail.scroll.down" },
      { key: "u", cmd: "issue-detail.scroll.up" },
      { key: { name: "u", ctrl: true }, cmd: "issue-detail.scroll.up" },
    ],
  }))

  function scrollPage(delta: 1 | -1) {
    if (state.focusedPane !== "main" || state.route !== "issue-detail") return
    scrollbox?.scrollBy(delta, "viewport")
  }

  return (
    <Show when={issue()} fallback={<text fg={theme.textMuted}>No issue selected</text>}>
      {(selectedIssue) => (
        <box flexDirection="row" gap={1} flexGrow={1} minHeight={0}>
          <box borderStyle="rounded" borderColor={statusColor(state, selectedIssue())} padding={1} width={34} flexShrink={0}>
            <text attributes={TextAttributes.BOLD} fg={theme.text}>{selectedIssue().key}</text>
            <text fg={theme.text}>{selectedIssue().title}</text>
            <box paddingTop={1} flexDirection="column" gap={1}>
              <text fg={issueTypeColor(state, selectedIssue())}>■ {selectedIssue().type}</text>
              <text fg={statusColor(state, selectedIssue())}>● {statusName(state, selectedIssue())}</text>
              <text fg={theme.textMuted}>Priority: {selectedIssue().priority}</text>
              <text fg={theme.textMuted}>Assignee: {selectedIssue().assignee}</text>
              <text fg={theme.textMuted}>Reporter: {selectedIssue().reporter}</text>
              <text fg={theme.textMuted}>Epic: {selectedIssue().epic ?? "None"}</text>
              <text fg={theme.textMuted}>Feature: {selectedIssue().feature ?? "None"}</text>
              <text fg={theme.textMuted}>Space: {selectedIssue().space ?? "None"}</text>
              <text fg={selectedIssue().blocked ? theme.danger : theme.success}>{selectedIssue().blocked ? "Blocked" : "Not blocked"}</text>
              <text fg={selectedIssue().staleDays >= 7 ? theme.warning : theme.textMuted}>Stale: {selectedIssue().staleDays}d</text>
            </box>
            <box paddingTop={1} flexDirection="column">
              <text fg={theme.warning}>Labels</text>
              <text fg={theme.textMuted}>{selectedIssue().labels.join(", ") || "None"}</text>
              <text fg={theme.warning}>Components</text>
              <text fg={theme.textMuted}>{selectedIssue().components.join(", ") || "None"}</text>
            </box>
          </box>
          <box flexGrow={1} flexDirection="column" gap={1} minHeight={0}>
            <box borderStyle="rounded" borderColor={theme.border} padding={1} flexGrow={1} minHeight={0}>
              <text attributes={TextAttributes.BOLD} fg={theme.accent}>Description</text>
              <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} height={descriptionHeight()} paddingTop={1} scrollY={true} viewportCulling={true}>
                <markdown
                  syntaxStyle={markdownSyntax}
                  content={selectedIssue().description}
                  internalBlockMode="top-level"
                  tableOptions={{ style: "grid", borderColor: theme.border }}
                  conceal={true}
                  fg={theme.text}
                  bg={theme.background}
                />
              </scrollbox>
            </box>
            <box borderStyle="rounded" borderColor={theme.border} padding={1}>
              <text attributes={TextAttributes.BOLD} fg={theme.accent}>Comments</text>
              <For each={selectedIssue().comments} fallback={<text fg={theme.textSubtle}>No comments in mock data</text>}>
                {(comment) => (
                  <box paddingTop={1} flexDirection="column">
                    <text fg={theme.text}>{comment.author} · {comment.age}</text>
                    <text fg={theme.textMuted}>{comment.body}</text>
                  </box>
                )}
              </For>
              <Show when={selectedIssue().links.length}>
                <box paddingTop={1}>
                  <text fg={theme.warning}>Linked: {selectedIssue().links.join(", ")}</text>
                </box>
              </Show>
            </box>
          </box>
        </box>
      )}
    </Show>
  )
}
