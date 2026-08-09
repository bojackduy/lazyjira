import { TextAttributes, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, For, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useAppState } from "../context/app-state"
import { useConfig } from "../context/config"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { useToast } from "../context/toast"
import type { IssueSummary } from "../state/app-state"
import { issueByKey } from "../state/issue-drafts"
import { routeBindingsBlocked } from "../state/keyboard-context"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueColor, issueTypeColor, issueTypeName, priorityColor, statusColor, statusName } from "../state/selectors"
import { issueFields } from "../state/issue-fields"
import { RichText } from "../ui/rich-text"
import { ParentBadge } from "../ui/parent-badge"
import { browserOpenCommand } from "../app"

const detailSectionIds = ["detail-section-body", "detail-section-fields", "detail-section-comments", "detail-section-links"]

const detailFieldIds = [
  "assignee", "reporter", "sprintId", "storyPoints", "estimate",
  "dueDate", "epic", "feature", "space", "labels", "components", "fixVersions", "affectsVersions",
]

export function IssueDetailRoute() {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  const config = useConfig()
  const toast = useToast()
  const dimensions = useTerminalDimensions()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const bodyHeight = () => Math.max(8, dimensions().height - 10)
  const sectionItemCount = () => {
    if (state.detailSectionIndex === 0) return 1
    if (state.detailSectionIndex === 1) return detailFieldIds.length
    if (state.detailSectionIndex === 2) return 1 + (issue()?.comments.length ?? 0)
    return issue()?.links.length ?? 0
  }
  const maxSectionItemIndex = () => Math.max(0, sectionItemCount() - 1)
  const sectionFocused = () => state.detailSectionFocus && state.focusedPane === "main"

  useBindings(() => ({
    commands: [
      { name: "detail.scroll.down", run: () => scrollLine(1) },
      { name: "detail.scroll.up", run: () => scrollLine(-1) },
      { name: "detail.scroll.half-down", run: () => scrollHalfPage(1) },
      { name: "detail.scroll.half-up", run: () => scrollHalfPage(-1) },
      { name: "detail.open-parent", run: () => appState.openParentIssue() },
      { name: "detail.section.item-up", run: () => appState.moveDetailSectionItem(-1, sectionItemCount()) },
      { name: "detail.section.item-down", run: () => appState.moveDetailSectionItem(1, sectionItemCount()) },
      { name: "detail.section.prev", run: () => appState.setDetailSectionIndex((state.detailSectionIndex + 3) % 4) },
      { name: "detail.section.next", run: () => appState.setDetailSectionIndex((state.detailSectionIndex + 1) % 4) },
      { name: "detail.section.enter", run: () => sectionEnter() },
      { name: "detail.section.exit", run: () => appState.setDetailSectionFocus(false) },
    ],
    bindings: state.route !== "issue-detail" || routeBindingsBlocked(state) ? [] : state.detailSectionFocus
      ? [
        { key: "j", cmd: "detail.section.item-down", preventDefault: false },
        { key: "down", cmd: "detail.section.item-down", preventDefault: false },
        { key: "k", cmd: "detail.section.item-up", preventDefault: false },
        { key: "up", cmd: "detail.section.item-up", preventDefault: false },
        { key: "h", cmd: "detail.section.prev", preventDefault: false },
        { key: "left", cmd: "detail.section.prev", preventDefault: false },
        { key: "l", cmd: "detail.section.next", preventDefault: false },
        { key: "right", cmd: "detail.section.next", preventDefault: false },
        { key: "return", cmd: "detail.section.enter", preventDefault: false },
        { key: "escape", cmd: "detail.section.exit", preventDefault: false },
      ]
      : [
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

  createEffect(() => {
    if (!sectionFocused()) return
    scrollbox?.scrollChildIntoView(detailSectionIds[clamp(state.detailSectionIndex, 0, 3)] ?? "")
  })

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
    return !state.detailSectionFocus && state.route === "issue-detail" && state.focusedPane === "main" && !state.detailBodyEditing && !state.searchOpen && !state.remoteApplyOpen && !state.stagedDiscardOpen && !state.commandPaletteOpen && !state.helpOpen && !state.projectPicker.open && !state.commentEditing
  }

  function sectionEnter() {
    const index = state.detailSectionIndex
    if (index === 0) {
      appState.setDetailSectionFocus(false)
      appState.startDetailBodyEdit()
    } else if (index === 1) {
      const fieldId = detailFieldIds[clamp(state.detailSectionItemIndex, 0, detailFieldIds.length - 1)]
      if (fieldId) {
        appState.setDetailSectionFocus(false)
        editFieldInInspector(fieldId)
      }
    } else if (index === 2) {
      appState.setDetailSectionFocus(false)
      appState.startComment()
    } else if (index === 3) {
      const links = issue()?.links ?? []
      if (links.length) {
        const link = links[clamp(state.detailSectionItemIndex, 0, links.length - 1)] ?? links[0]!
        openLink(link)
      }
    }
  }

  function editFieldInInspector(fieldId: string) {
    const fieldIndex = issueFields.findIndex((field) => field.id === fieldId)
    if (fieldIndex < 0) return
    appState.moveInspectorSelection(fieldIndex - state.inspectorSelectedFieldIndex)
    appState.setFocusedPane("inspector")
    appState.startInspectorEdit()
  }

  function openLink(link: string) {
    if (link.includes("://")) {
      try { Bun.spawn(browserOpenCommand(link), { stdout: "ignore", stderr: "ignore" }).unref(); toast.show(`Opening ${link}`) }
      catch (error) { toast.show(`Could not open: ${error instanceof Error ? error.message : String(error)}`) }
      return
    }
    if (/^[A-Z][A-Z0-9_]+-\d+$/.test(link)) {
      appState.openIssueDetail(link)
      return
    }
    const url = config.jira?.baseUrl ? `${config.jira.baseUrl.replace(/\/$/, "")}/browse/${encodeURIComponent(link)}` : undefined
    if (!url) { toast.show("No Jira site URL configured"); return }
    try { Bun.spawn(browserOpenCommand(url), { stdout: "ignore", stderr: "ignore" }).unref(); toast.show(`Opening ${link}`) }
    catch (error) { toast.show(`Could not open: ${error instanceof Error ? error.message : String(error)}`) }
  }

  return (
    <Show when={issue()} fallback={<PendingIssueDetail issueKey={state.selectedIssueKey} />}>
      {(selectedIssue) => (
        <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} width="100%" height={bodyHeight()} scrollY={true} scrollX viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
          <IssueHeader issue={selectedIssue()} />
          <DetailLoadState issueKey={selectedIssue().key} />
          <DetailSection id={detailSectionIds[0]!} title="Body" focused={sectionFocused() && state.detailSectionIndex === 0}>
            <BodyEditor issue={selectedIssue()} focused={sectionFocused() && state.detailSectionIndex === 0 && state.detailSectionItemIndex === 0} />
          </DetailSection>
          <DetailSection id={detailSectionIds[1]!} title="Fields" focused={sectionFocused() && state.detailSectionIndex === 1}>
            <For each={detailFieldIds}>
              {(fieldId, index) => <FocusableFieldLine fieldId={fieldId} issue={selectedIssue()} index={index()} focused={sectionFocused() && state.detailSectionIndex === 1 && state.detailSectionItemIndex === index()} />}
            </For>
          </DetailSection>
          <DetailSection id={detailSectionIds[2]!} title="Comments" focused={sectionFocused() && state.detailSectionIndex === 2}>
            <CommentPlaceholder focused={sectionFocused() && state.detailSectionIndex === 2 && state.detailSectionItemIndex === 0} />
            <For each={selectedIssue().comments}>
              {(comment, index) => (
                <box backgroundColor={sectionFocused() && state.detailSectionIndex === 2 && state.detailSectionItemIndex === index() + 1 ? theme.selected : undefined} flexDirection="column" marginBottom={1}>
                  <text fg={sectionFocused() && state.detailSectionIndex === 2 && state.detailSectionItemIndex === index() + 1 ? theme.selectedText : theme.text} wrapMode="none">
                    {sectionFocused() && state.detailSectionIndex === 2 && state.detailSectionItemIndex === index() + 1 ? ">" : " "} {comment.author} · {comment.age}
                  </text>
                  <RichText markdown={comment.body} writeBlockedReason={comment.writeBlockedReason} />
                </box>
              )}
            </For>
          </DetailSection>
          <DetailSection id={detailSectionIds[3]!} title="Links" focused={sectionFocused() && state.detailSectionIndex === 3}>
            <For each={selectedIssue().links} fallback={<text fg={theme.textSubtle}>No links</text>}>
              {(link, index) => (
                <box backgroundColor={sectionFocused() && state.detailSectionIndex === 3 && state.detailSectionItemIndex === index() ? theme.selected : undefined}>
                  <text fg={sectionFocused() && state.detailSectionIndex === 3 && state.detailSectionItemIndex === index() ? theme.selectedText : theme.accent} wrapMode="none">
                    {sectionFocused() && state.detailSectionIndex === 3 && state.detailSectionItemIndex === index() ? ">" : " "} {link}
                  </text>
                </box>
              )}
            </For>
          </DetailSection>
        </scrollbox>
      )}
    </Show>
  )
}

function CommentPlaceholder(props: { focused: boolean }) {
  const theme = useTheme()
  return (
    <box backgroundColor={props.focused ? theme.selected : undefined} marginBottom={1}>
      <text fg={props.focused ? theme.selectedText : theme.textMuted} wrapMode="none">
        {props.focused ? ">" : " "} + New comment
      </text>
    </box>
  )
}

function FocusableFieldLine(props: { fieldId: string; issue: IssueSummary; index: number; focused: boolean }) {
  const { state } = useAppState()
  const theme = useTheme()
  const field = () => issueFields.find((field) => field.id === props.fieldId)
  const value = () => field()?.value(props.issue, state) ?? ""
  const label = () => field()?.label ?? props.fieldId
  return (
    <box backgroundColor={props.focused ? theme.selected : undefined}>
      <text fg={props.focused ? theme.selectedText : theme.textMuted} wrapMode="none">
        {props.focused ? ">" : " "} <span style={{ fg: props.focused ? theme.selectedText : theme.text }}>{label()}:</span> {value()}
      </text>
    </box>
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

function BodyEditor(props: { issue: IssueSummary; focused: boolean }) {
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
      <box backgroundColor={props.focused ? theme.selected : undefined} flexDirection="column" gap={1}>
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
  const icons = useIcons()
  const theme = useTheme()
  const issueType = () => configuredIssueTypes(state).find((type) => type.id === props.issue.type || type.name === props.issue.type || type.name === props.issue.typeName)
  const status = () => configuredStatuses(state).find((candidate) => candidate.id === props.issue.statusId)

  return (
    <box flexDirection="column" gap={1} marginBottom={1}>
      <text attributes={TextAttributes.BOLD} fg={issueColor(state, props.issue)} wrapMode="none">{props.issue.key}{props.issue.isDraft ? " draft" : ""}</text>
      <text attributes={TextAttributes.BOLD} fg={theme.text}>{props.issue.title}</text>
       <box flexDirection="row" gap={1}>
         <text fg={issueTypeColor(state, props.issue)} wrapMode="none">{icons.issueType({ name: issueTypeName(state, props.issue), subtask: issueType()?.subtask, hierarchyLevel: issueType()?.hierarchyLevel ?? props.issue.typeHierarchyLevel })} {issueTypeName(state, props.issue)}</text>
         <text fg={statusColor(state, props.issue)} wrapMode="none">{icons.status(status() ?? { name: statusName(state, props.issue) })} {statusName(state, props.issue)}</text>
         <text fg={priorityColor(props.issue)} wrapMode="none">{icons.priority(props.issue.priority)} {props.issue.priority}</text>
         <text fg={props.issue.blocked ? theme.danger : theme.textSubtle} wrapMode="none">{props.issue.blocked ? `${icons.catalog.exceptional.blocked} ` : ""}{props.issue.blocked ? "Blocked" : "Not blocked"}</text>
         <text fg={props.issue.staleDays >= 7 ? theme.warning : theme.textSubtle} wrapMode="none">{props.issue.staleDays >= 7 ? `${icons.catalog.exceptional.stale} ` : ""}Stale {props.issue.staleDays}d</text>
       </box>
       <ParentBadge issue={props.issue} />
      <box flexDirection="row" gap={1}>
        {state.detailBodyEditing
          ? <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">[EDITING BODY]</text>
          : state.detailSectionFocus
          ? <text attributes={TextAttributes.BOLD} fg={theme.accent} wrapMode="none">[FOCUS]</text>
          : <text attributes={TextAttributes.BOLD} fg={theme.textSubtle} wrapMode="none">[scroll]</text>
        }
        <text fg={theme.textSubtle} wrapMode="none">
          {state.detailBodyEditing
            ? "Ctrl+Enter stage · Esc cancel"
            : state.detailSectionFocus
            ? `▶ ${sectionTitle(state.detailSectionIndex)} · h/l section · j/k item · enter act`
            : `j/k · d/u · e body · c comment · Tab focus${props.issue.parentKey ? " · Enter parent" : ""} · q back`}
        </text>
      </box>
    </box>
  )
}

function DetailSection(props: { id?: string; title: string; focused?: boolean; children: JSX.Element }) {
  const theme = useTheme()
  return (
    <box id={props.id} border={props.focused ? ["left", "top"] : ["top"]} borderColor={props.focused ? theme.accent : theme.border} paddingTop={1} marginTop={1} flexDirection="column" gap={1}>
      <box backgroundColor={props.focused ? theme.selected : undefined} paddingLeft={props.focused ? 0 : 0}>
        <text attributes={TextAttributes.BOLD} fg={props.focused ? theme.selectedText : theme.warning}>{props.focused ? `▶ ${props.title}` : props.title}</text>
      </box>
      {props.children}
    </box>
  )
}

function sectionTitle(index: number) {
  return ["Body", "Fields", "Comments", "Links"][index] ?? ""
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
