import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show, type JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { issueByKey } from "../state/issue-drafts"
import { activeSprint, issueTypeColor, statusColor, statusName } from "../state/selectors"
import {
  workspaceAttentionQueues,
  workspaceCurrentResults,
  workspaceItems,
  workspaceJumpTargets,
  workspacePendingItem,
  workspaceRecentItems,
  workspaceSearchItems,
  workspaceSelectedItem,
  type WorkspaceItem,
  type WorkspaceResult,
} from "../state/workspace"

export function WorkspaceRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  const compact = () => dimensions().width < 95
  let cardsScrollbox: ScrollBoxRenderable | undefined
  const bodyHeight = () => Math.max(8, dimensions().height - 17)
  const cardsHeight = () => compact() ? Math.max(8, Math.floor(bodyHeight() * 0.55)) : bodyHeight()
  const resultsHeight = () => compact() ? Math.max(8, Math.floor(bodyHeight() * 0.45)) : bodyHeight()
  const selectedId = () => workspaceItems(state)[state.workspaceSelectedIndex]?.id
  const selected = (item: WorkspaceItem) => selectedId() === item.id
  const cardsFocused = () => state.focusedPane === "main" && state.workspaceFocusedArea === "cards"

  createEffect(() => {
    if (state.route !== "workspace" || state.workspaceFocusedArea !== "cards") return
    const item = workspaceItems(state)[state.workspaceSelectedIndex]
    if (item) cardsScrollbox?.scrollChildIntoView(workspaceCardId(item.id))
  })

  useBindings(() => ({
    commands: [
      { name: "workspace.page.down", run: () => pageWorkspace(1) },
      { name: "workspace.page.up", run: () => pageWorkspace(-1) },
    ],
    bindings: state.searchOpen ? [] : [
      { key: "d", cmd: "workspace.page.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "workspace.page.down" },
      { key: "u", cmd: "workspace.page.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "workspace.page.up" },
    ],
  }))

  function pageWorkspace(delta: 1 | -1) {
    if (state.route !== "workspace" || state.focusedPane !== "main" || state.remoteApplyOpen || state.stagedDiscardOpen) return false
    const activeHeight = state.workspaceFocusedArea === "results" ? resultsHeight() : cardsHeight()
    const visibleRows = Math.max(1, Math.floor(activeHeight / 3))
    const halfPageRows = Math.max(1, Math.floor(visibleRows / 2))
    appState.moveWorkspaceSelection(delta * halfPageRows)
  }

  return (
    <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
      <box height={4} flexShrink={0} flexDirection="column">
        <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">Workspace Dashboard</text>
        <text fg={theme.text} wrapMode="none">{state.project.key} {state.project.name} · {state.board.name}</text>
        <text fg={theme.textMuted} wrapMode="none">Active sprint: {activeSprint(state)?.name ?? "None"}</text>
        <text fg={theme.textSubtle} wrapMode="none">j/k choose · d/u page · l/enter results · h/q back · X discard staged · W write Jira</text>
      </box>

      <box flexDirection={compact() ? "column" : "row"} gap={1} flexGrow={1} minHeight={0}>
        <scrollbox ref={(element: ScrollBoxRenderable) => (cardsScrollbox = element)} width={compact() ? "100%" : 44} height={cardsHeight()} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <box flexDirection="column" gap={1} width="100%" minHeight={0}>
            <WorkspaceSection title="Jump Targets">
              <For each={workspaceJumpTargets(state)}>
                {(item) => <WorkspaceCard item={item} selected={selected(item)} active={cardsFocused()} />}
              </For>
            </WorkspaceSection>
            <WorkspaceSection title="Pending Local">
              <WorkspaceCard item={workspacePendingItem(state)} selected={selected(workspacePendingItem(state))} active={cardsFocused()} tone={workspacePendingItem(state).count ? "danger" : "muted"} />
            </WorkspaceSection>
            <Show when={workspaceSearchItems(state).length}>
              <WorkspaceSection title="Search">
                <For each={workspaceSearchItems(state)}>
                  {(item) => <WorkspaceCard item={item} selected={selected(item)} active={cardsFocused()} tone={item.count ? "warning" : "muted"} />}
                </For>
              </WorkspaceSection>
            </Show>
            <WorkspaceSection title="Attention Queues">
              <For each={workspaceAttentionQueues(state)}>
                {(item) => <WorkspaceCard item={item} selected={selected(item)} active={cardsFocused()} tone={item.count ? "warning" : "muted"} />}
              </For>
            </WorkspaceSection>
            <WorkspaceSection title="Recent / Updated">
              <For each={workspaceRecentItems(state)} fallback={<text fg={theme.textSubtle}>No recent issues</text>}>
                {(item) => <WorkspaceCard item={item} selected={selected(item)} active={cardsFocused()} />}
              </For>
            </WorkspaceSection>
          </box>
        </scrollbox>

        <box flexDirection="column" gap={1} flexGrow={1} minWidth={0} minHeight={0}>
          <WorkspacePreview height={resultsHeight()} />
        </box>
      </box>
    </box>
  )
}

function WorkspaceSection(props: { title: string; children: JSX.Element }) {
  const theme = useTheme()
  return (
    <box borderStyle="rounded" borderColor={theme.border} padding={1} flexDirection="column" gap={1} flexShrink={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>{props.title}</text>
      {props.children}
    </box>
  )
}

function WorkspacePreview(props: { height: number }) {
  const { state } = useAppState()
  const theme = useTheme()
  const item = () => workspaceSelectedItem(state)
  const results = () => workspaceCurrentResults(state)
  const focused = () => state.focusedPane === "main" && state.workspaceFocusedArea === "results"
  let resultsScrollbox: ScrollBoxRenderable | undefined

  createEffect(() => {
    if (state.route !== "workspace" || state.workspaceFocusedArea !== "results") return
    const result = results()[state.workspaceResultSelectedIndex]
    if (result) resultsScrollbox?.scrollChildIntoView(workspaceResultId(result.id))
  })

  return (
    <box borderStyle="rounded" borderColor={theme.border} padding={1} flexDirection="column" gap={1} height={props.height} minHeight={0}>
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>Selected Results</text>
      <Show when={item()} fallback={<text fg={theme.textSubtle}>No workspace item selected</text>}>
        {(selectedItem) => (
          <box flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
            <text attributes={TextAttributes.BOLD} fg={theme.text} wrapMode="none">{selectedItem().title}</text>
            <text fg={theme.textMuted}>{previewHint(selectedItem(), results().length)}</text>
            <Show when={results().length}>
              <scrollbox ref={(element: ScrollBoxRenderable) => (resultsScrollbox = element)} width="100%" height={Math.max(3, props.height - 7)} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
                <For each={results()}>
                  {(result, index) => <WorkspaceResultRow result={result} selected={focused() && state.workspaceResultSelectedIndex === index()} />}
                </For>
              </scrollbox>
            </Show>
          </box>
        )}
      </Show>
    </box>
  )
}

function WorkspaceResultRow(props: { result: WorkspaceResult; selected: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const issue = () => props.result.issueKey ? issueByKey(state, props.result.issueKey) : undefined
  return (
    <box id={workspaceResultId(props.result.id)} height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={props.selected ? theme.selected : undefined} flexDirection="column">
      <text fg={props.selected ? theme.selectedText : props.result.kind === "change" ? theme.warning : theme.text} wrapMode="none">
        {props.selected ? ">" : " "} <Show when={issue()} fallback={props.result.title}>{(selectedIssue) => (
          <>
            <span style={{ fg: issueTypeColor(state, selectedIssue()) }}>■ </span>
            <span>{selectedIssue().key}</span>
            <span> {selectedIssue().title}</span>
          </>
        )}</Show>
      </text>
      <text fg={props.selected ? theme.selectedText : theme.textMuted} wrapMode="none">
        <Show when={issue()} fallback={props.result.subtitle}>{(selectedIssue) => (
          <>
            <span style={{ fg: issueTypeColor(state, selectedIssue()) }}>{selectedIssue().type}</span>
            <span> · {selectedIssue().priority} · {selectedIssue().assignee} · </span>
            <span style={{ fg: statusColor(state, selectedIssue()) }}>● {statusName(state, selectedIssue())}</span>
            <span>{selectedIssue().staleDays >= 7 ? ` · stale ${selectedIssue().staleDays}d` : ""}</span>
          </>
        )}</Show>
      </text>
    </box>
  )
}

function WorkspaceCard(props: { item: WorkspaceItem; selected: boolean; active: boolean; tone?: "warning" | "danger" | "muted" }) {
  const { state } = useAppState()
  const theme = useTheme()
  const issue = () => props.item.issueKey ? issueByKey(state, props.item.issueKey) : undefined
  const accent = () => props.tone === "danger" ? theme.danger : props.tone === "warning" ? theme.warning : props.tone === "muted" ? theme.textSubtle : theme.accent
  return (
    <box id={workspaceCardId(props.item.id)} height={3} flexShrink={0} paddingLeft={1} paddingRight={1} backgroundColor={props.selected && props.active ? theme.selected : undefined} flexDirection="column">
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.selected && props.active ? theme.selectedText : props.selected ? theme.accent : theme.text} wrapMode="none">
          {props.selected ? ">" : " "} <Show when={issue()} fallback={props.item.title}>{(selectedIssue) => (
            <>
              <span style={{ fg: issueTypeColor(state, selectedIssue()) }}>■ </span>
              <span>{selectedIssue().key}</span>
            </>
          )}</Show>
        </text>
        <Show when={props.item.count !== undefined}>
          <text fg={accent()} wrapMode="none">{props.item.count}</text>
        </Show>
      </box>
      <text fg={props.selected && props.active ? theme.selectedText : theme.textMuted} wrapMode="none">
        <Show when={issue()} fallback={props.item.subtitle}>{(selectedIssue) => (
          <>
            <span>{selectedIssue().title} · </span>
            <span style={{ fg: statusColor(state, selectedIssue()) }}>● {statusName(state, selectedIssue())}</span>
          </>
        )}</Show>
      </text>
    </box>
  )
}

function previewHint(item: WorkspaceItem, resultCount: number) {
  if (item.route) return "Enter opens the view."
  if (item.issueKey) return "Enter opens this issue."
  if (item.section === "pending") return resultCount ? "l/Enter focuses staged changes · W writes Jira · X discards" : "No staged changes."
  return resultCount ? "l/Enter focuses results · Enter on a row opens issue detail" : "No matching issues."
}

function workspaceCardId(id: string) {
  return `workspace-card-${id}`
}

function workspaceResultId(id: string) {
  return `workspace-result-${id}`
}
