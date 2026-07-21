import { TextAttributes, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { issueTypeColor, statusColor, statusName } from "../state/selectors"

export function IssueDetailRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => state.issues[state.selectedIssueKey]
  const bodyHeight = () => Math.max(8, dimensions().height - 10)

  useBindings(() => ({
    commands: [
      { name: "detail.scroll.down", run: () => scrollLine(1) },
      { name: "detail.scroll.up", run: () => scrollLine(-1) },
      { name: "detail.scroll.half-down", run: () => scrollHalfPage(1) },
      { name: "detail.scroll.half-up", run: () => scrollHalfPage(-1) },
    ],
    bindings: [
      { key: "j", cmd: "detail.scroll.down", preventDefault: false },
      { key: "down", cmd: "detail.scroll.down", preventDefault: false },
      { key: "k", cmd: "detail.scroll.up", preventDefault: false },
      { key: "up", cmd: "detail.scroll.up", preventDefault: false },
      { key: "d", cmd: "detail.scroll.half-down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "detail.scroll.half-down" },
      { key: "u", cmd: "detail.scroll.half-up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "detail.scroll.half-up" },
    ],
  }))

  function scrollLine(delta: 1 | -1) {
    if (!canScrollDetail()) return false
    scrollbox?.scrollBy(delta, "step")
  }

  function scrollHalfPage(delta: 1 | -1) {
    if (!canScrollDetail()) return false
    scrollbox?.scrollBy(delta * Math.max(1, Math.floor(bodyHeight() / 2)), "step")
  }

  function canScrollDetail() {
    return state.route === "issue-detail" && state.focusedPane === "main" && !state.detailBodyEditing && !state.remoteApplyOpen && !state.stagedDiscardOpen
  }

  return (
    <Show when={issue()} fallback={<text fg={theme.textMuted}>No issue selected</text>}>
      {(selectedIssue) => (
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} width="100%" height={bodyHeight()} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <IssueHeader issue={selectedIssue()} />
          <DetailSection title="Body">
            <BodyEditor issue={selectedIssue()} />
          </DetailSection>
          <DetailSection title="Fields">
            <FieldLine label="Assignee" value={selectedIssue().assignee} />
            <FieldLine label="Reporter" value={selectedIssue().reporter} />
            <FieldLine label="Sprint" value={state.sprints.find((sprint) => sprint.id === selectedIssue().sprintId)?.name ?? "Backlog"} />
            <FieldLine label="Story Points" value={String(selectedIssue().storyPoints ?? "?")} />
            <FieldLine label="Estimate" value={String(selectedIssue().estimate ?? "?")} />
            <FieldLine label="Due Date" value={selectedIssue().dueDate || "None"} />
            <FieldLine label="Epic" value={selectedIssue().epic || "None"} />
            <FieldLine label="Feature" value={selectedIssue().feature || "None"} />
            <FieldLine label="Space" value={selectedIssue().space || "None"} />
            <FieldLine label="Labels" value={selectedIssue().labels.join(", ") || "None"} />
            <FieldLine label="Components" value={selectedIssue().components.join(", ") || "None"} />
            <FieldLine label="Fix Versions" value={(selectedIssue().fixVersions ?? []).join(", ") || "None"} />
            <FieldLine label="Affects Versions" value={(selectedIssue().affectsVersions ?? []).join(", ") || "None"} />
          </DetailSection>
          <DetailSection title="Comments">
            <For each={selectedIssue().comments} fallback={<text fg={theme.textSubtle}>No comments</text>}>
              {(comment) => (
                <box flexDirection="column" marginBottom={1}>
                  <text fg={theme.text} wrapMode="none">{comment.author} · {comment.age}</text>
                  <text fg={theme.textMuted}>{comment.body}</text>
                </box>
              )}
            </For>
          </DetailSection>
          <DetailSection title="Links">
            <For each={selectedIssue().links} fallback={<text fg={theme.textSubtle}>No links</text>}>
              {(link) => <text fg={theme.accent} wrapMode="none">{link}</text>}
            </For>
          </DetailSection>
        </scrollbox>
      )}
    </Show>
  )
}

function BodyEditor(props: { issue: IssueSummary }) {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  let textarea: TextareaRenderable | undefined
  const body = () => state.issueDrafts[props.issue.key]?.description ?? props.issue.description

  createEffect(() => {
    if (!state.detailBodyEditing) return
    setTimeout(() => textarea && !textarea.isDestroyed && textarea.focus(), 1)
  })

  return (
    <Show when={state.detailBodyEditing} fallback={
      <box flexDirection="column" gap={1}>
        <Show when={state.issueDrafts[props.issue.key]?.description !== undefined}>
          <text fg={theme.warning} wrapMode="none">Body staged · w local apply · W write Jira</text>
        </Show>
        <text fg={theme.textMuted}>{body() || "No description"}</text>
        <text fg={theme.textSubtle} wrapMode="none">e edit body · j/k line scroll · d/u half page</text>
      </box>
    }>
      <box flexDirection="column" gap={1}>
        <textarea
          ref={(element: TextareaRenderable) => (textarea = element)}
          height={12}
          initialValue={state.detailBodyEditValue}
          onContentChange={() => appState.updateDetailBodyEditValue(textarea?.plainText ?? "")}
          onSubmit={() => appState.commitDetailBodyEdit()}
          keyBindings={[{ name: "return", ctrl: true, action: "submit" }]}
          placeholder="Issue body"
          placeholderColor={theme.textSubtle}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.accent}
          backgroundColor={theme.panel}
          focusedBackgroundColor={theme.panel}
        />
        <text fg={theme.textSubtle} wrapMode="none">Ctrl-Enter stage body · Esc cancel · w local apply · W write Jira</text>
      </box>
    </Show>
  )
}

function IssueHeader(props: { issue: IssueSummary }) {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1} marginBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">{props.issue.key}{props.issue.isDraft ? " draft" : ""}</text>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>{props.issue.title}</text>
      <box flexDirection="row" gap={1}>
        <text fg={issueTypeColor(state, props.issue)} wrapMode="none">■ {props.issue.type}</text>
        <text fg={statusColor(state, props.issue)} wrapMode="none">● {statusName(state, props.issue)}</text>
        <text fg={props.issue.blocked ? theme.danger : theme.textSubtle} wrapMode="none">{props.issue.blocked ? "Blocked" : "Not blocked"}</text>
        <text fg={props.issue.staleDays >= 7 ? theme.warning : theme.textSubtle} wrapMode="none">Stale {props.issue.staleDays}d</text>
      </box>
      <text fg={theme.textSubtle}>j/k line scroll · d/u half page · e edit body · q/backspace back</text>
    </box>
  )
}

function DetailSection(props: { title: string; children: JSX.Element }) {
  const theme = useTheme()
  return (
    <box border={["top"]} borderColor={theme.border} paddingTop={1} marginTop={1} flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD} fg={theme.warning}>{props.title}</text>
      {props.children}
    </box>
  )
}

function FieldLine(props: { label: string; value: string }) {
  const theme = useTheme()
  return (
    <text fg={theme.textMuted} wrapMode="none">
      <span style={{ fg: theme.text }}>{props.label}:</span> {props.value}
    </text>
  )
}
