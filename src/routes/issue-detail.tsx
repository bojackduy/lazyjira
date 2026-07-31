import { TextAttributes, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import type { IssueSummary } from "../state/app-state"
import { issueByKey } from "../state/issue-drafts"
import { issueColor, issueTypeColor, priorityColor, statusColor, statusName } from "../state/selectors"
import { RichText } from "../ui/rich-text"
import { ParentBadge } from "../ui/parent-badge"

export function IssueDetailRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const bodyHeight = () => Math.max(8, dimensions().height - 10)

  useBindings(() => ({
    commands: [
      { name: "detail.scroll.down", run: () => scrollLine(1) },
      { name: "detail.scroll.up", run: () => scrollLine(-1) },
      { name: "detail.scroll.half-down", run: () => scrollHalfPage(1) },
      { name: "detail.scroll.half-up", run: () => scrollHalfPage(-1) },
      { name: "detail.open-parent", run: () => appState.openParentIssue() },
    ],
    bindings: state.searchOpen ? [] : [
      { key: "j", cmd: "detail.scroll.down", preventDefault: false },
      { key: "down", cmd: "detail.scroll.down", preventDefault: false },
      { key: "k", cmd: "detail.scroll.up", preventDefault: false },
      { key: "up", cmd: "detail.scroll.up", preventDefault: false },
      { key: "d", cmd: "detail.scroll.half-down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "detail.scroll.half-down" },
      { key: "u", cmd: "detail.scroll.half-up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "detail.scroll.half-up" },
      ...(canOpenParent() ? [{ key: "return", cmd: "detail.open-parent", preventDefault: false }] : []),
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

  function canOpenParent() {
    return state.route === "issue-detail" && state.focusedPane === "main" && !state.detailBodyEditing && !state.searchOpen && !state.remoteApplyOpen && !state.stagedDiscardOpen && !state.commandPaletteOpen && !state.helpOpen && !state.projectPicker.open && !state.commentEditing
  }

  return (
    <Show when={issue()} fallback={<PendingIssueDetail issueKey={state.selectedIssueKey} />}>
      {(selectedIssue) => (
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} width="100%" height={bodyHeight()} scrollY={true} scrollX viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <IssueHeader issue={selectedIssue()} />
          <DetailLoadState issueKey={selectedIssue().key} />
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
                  <RichText markdown={comment.body} writeBlockedReason={comment.writeBlockedReason} />
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

function PendingIssueDetail(props: { issueKey: string }) {
  const { state } = useAppState()
  const theme = useTheme()
  const loading = () => state.issueDetailLoadingByKey[props.issueKey]
  const error = () => state.issueDetailErrorByKey[props.issueKey]
  return (
    <box flexGrow={1} alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
      <text attributes={TextAttributes.BOLD} fg={error() ? theme.danger : theme.accent}>{props.issueKey}</text>
      <Show when={error()} fallback={<text fg={loading() ? theme.warning : theme.textMuted}>Loading Jira issue detail...</text>}>
        {(message) => <text fg={theme.danger}>Detail load failed: {message()}</text>}
      </Show>
      <text fg={theme.textSubtle}>q/Esc back</text>
    </box>
  )
}

function DetailLoadState(props: { issueKey: string }) {
  const { state } = useAppState()
  const theme = useTheme()
  const loading = () => state.issueDetailLoadingByKey[props.issueKey]
  const error = () => state.issueDetailErrorByKey[props.issueKey]
  const loadedAt = () => state.issueDetailLoadedAtByKey[props.issueKey]

  return (
    <Show when={loading() || error() || loadedAt()}>
      <box flexDirection="column" gap={0} marginBottom={1}>
        <Show when={loading()}>
          <text fg={theme.warning} wrapMode="none">Loading Jira issue detail...</text>
        </Show>
        <Show when={error()}>
          {(message) => <text fg={theme.danger} wrapMode="none">Detail load failed: {message()}</text>}
        </Show>
        <Show when={!loading() && !error() && loadedAt()}>
          {(value) => <text fg={theme.textSubtle} wrapMode="none">Jira detail loaded {value().slice(0, 19).replace("T", " ")} · r refresh</text>}
        </Show>
      </box>
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
          <text fg={theme.warning} wrapMode="none">Body staged · w render · W write Jira</text>
        </Show>
        <RichText markdown={body()} writeBlockedReason={props.issue.descriptionWriteBlockedReason} />
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
          placeholder="Markdown issue body"
          placeholderColor={theme.textSubtle}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.accent}
          backgroundColor={theme.panel}
          focusedBackgroundColor={theme.panel}
        />
        <text fg={theme.textSubtle} wrapMode="none">Markdown supported · Ctrl-Enter stage · Esc cancel · w render · W write Jira</text>
      </box>
    </Show>
  )
}

function IssueHeader(props: { issue: IssueSummary }) {
  const { state } = useAppState()
  const theme = useTheme()

  return (
    <box flexDirection="column" gap={1} marginBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={issueColor(state, props.issue)} wrapMode="none">{props.issue.key}{props.issue.isDraft ? " draft" : ""}</text>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>{props.issue.title}</text>
       <box flexDirection="row" gap={1}>
         <text fg={issueTypeColor(state, props.issue)} wrapMode="none">■ {props.issue.type}</text>
         <text fg={statusColor(state, props.issue)} wrapMode="none">● {statusName(state, props.issue)}</text>
         <text fg={priorityColor(props.issue)} wrapMode="none">◆ {props.issue.priority}</text>
        <text fg={props.issue.blocked ? theme.danger : theme.textSubtle} wrapMode="none">{props.issue.blocked ? "Blocked" : "Not blocked"}</text>
        <text fg={props.issue.staleDays >= 7 ? theme.warning : theme.textSubtle} wrapMode="none">Stale {props.issue.staleDays}d</text>
       </box>
       <ParentBadge issue={props.issue} />
      <text fg={theme.textSubtle}>{props.issue.parentKey ? "Enter parent · " : ""}j/k line scroll · d/u half page · e edit body · q/Esc back</text>
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
