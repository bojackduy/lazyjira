import { TextAttributes, type InputRenderable, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useIcons } from "../context/icons"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import { routeBindingsBlocked } from "../state/keyboard-context"
import { isEditableField, issueFieldColor, issueFieldDisplayValue, issueFields, parentIssueChoices, type IssueFieldDefinition } from "../state/issue-fields"
import { issueColor, issueTypeColor, issueTypeName, statusColor, statusName } from "../state/selectors"
import { stagedChanges } from "../state/staged-changes"
import { RichText } from "./rich-text"

export function IssueInspector(props: { compact: boolean }) {
  const appState = useAppState()
  const { state } = appState
  const { theme } = useTheme()
  const icons = useIcons()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const focused = () => state.focusedPane === "inspector"
  const stagedCount = () => stagedChanges(state).length
  const stagedComments = () => state.commentDrafts.filter((draft) => draft.issueKey === state.selectedIssueKey)
  const stagedRank = () => state.rankDrafts[state.selectedIssueKey]
  const selectedIssueType = () => configuredIssueTypes(state).find((type) => type.id === issue()?.type || type.name === issue()?.type || type.name === issue()?.typeName)
  const selectedStatus = () => configuredStatuses(state).find((status) => status.id === issue()?.statusId)

  useBindings(() => ({
    commands: [
      { name: "inspector.scroll.down", run: () => scrollPage(1) },
      { name: "inspector.scroll.up", run: () => scrollPage(-1) },
    ],
    bindings: routeBindingsBlocked(state) ? [] : [
      { key: "d", cmd: "inspector.scroll.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "inspector.scroll.down" },
      { key: "u", cmd: "inspector.scroll.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "inspector.scroll.up" },
    ],
  }))

  createEffect(() => {
    if (!focused()) return
    const fieldId = state.inspectorEditingFieldId
    if (fieldId === "priority") {
      const picker = state.inspectorFieldPicker
      const value = picker?.options[picker.selectedIndex]?.value ?? state.inspectorEditValue
      scrollbox?.scrollChildIntoView(choiceRowId(fieldId, value))
      return
    }
    if (fieldId === "labels") {
      const picker = state.inspectorFieldPicker
      const value = picker?.options[picker.selectedIndex]?.value
      if (value) scrollbox?.scrollChildIntoView(choiceRowId(fieldId, value))
      return
    }
    if (fieldId === "statusId" || fieldId === "type" || fieldId === "parentKey" || fieldId === "sprintId") {
      scrollbox?.scrollChildIntoView(choiceRowId(fieldId, state.inspectorEditValue))
      return
    }
    scrollbox?.scrollChildIntoView(`inspector-field-${state.inspectorSelectedFieldIndex}`)
  })

  function scrollPage(delta: 1 | -1) {
    if (!focused() || state.remoteApplyOpen || state.stagedDiscardOpen || state.inspectorEditingFieldId) return false
    scrollbox?.scrollBy(delta, "viewport")
  }

  return (
    <box borderStyle="rounded" borderColor={focused() ? theme.borderActive : theme.border} padding={1} width={props.compact ? "100%" : 38} flexShrink={0} minHeight={0} onMouseUp={() => appState.setFocusedPane("inspector")}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>Inspector</text>
        <text fg={stagedCount() ? theme.warning : theme.textSubtle}>{stagedCount()} staged</text>
      </box>
      <Show when={issue()} fallback={<text fg={theme.textMuted}>No issue selected</text>}>
        {(selectedIssue) => (
          <box paddingTop={1} flexDirection="column" gap={1} flexGrow={1} minHeight={0}>
            <box flexDirection="column" flexShrink={0}>
              <text fg={issueColor(state, selectedIssue())} wrapMode="none">{selectedIssue().key}{selectedIssue().isDraft ? " draft" : ""}</text>
              <text fg={theme.text} wrapMode="none">{selectedIssue().title}</text>
              <text fg={issueTypeColor(state, selectedIssue())} wrapMode="none">{icons.issueType({ name: issueTypeName(state, selectedIssue()), subtask: selectedIssueType()?.subtask, hierarchyLevel: selectedIssueType()?.hierarchyLevel ?? selectedIssue().typeHierarchyLevel })} {issueTypeName(state, selectedIssue())} <span style={{ fg: statusColor(state, selectedIssue()) }}>{icons.status(selectedStatus() ?? { name: statusName(state, selectedIssue()) })} {statusName(state, selectedIssue())}</span></text>
              <Show when={state.issueDeletes.includes(selectedIssue().key)}>
                <text fg={theme.danger} wrapMode="none">Delete staged · w render · W write Jira</text>
              </Show>
              <Show when={stagedRank()}>
                {(rank) => <text fg={theme.warning} wrapMode="none">Rank staged {rank().position} {rank().targetIssueKey} · W review</text>}
              </Show>
              <Show when={stagedComments().length}>
                <text fg={theme.warning} wrapMode="none">{stagedComments().length} comment{stagedComments().length === 1 ? "" : "s"} staged · W review</text>
              </Show>
            </box>
            <scrollbox ref={(element: ScrollBoxRenderable) => (scrollbox = element)} flexGrow={1} scrollY={true} viewportCulling={true} viewportOptions={{ paddingRight: 1 }}>
              <For each={issueFields}>
                {(field, index) => <IssueFieldRow field={field} index={index()} />}
              </For>
              <box flexShrink={0} marginTop={1}>
                <text attributes={TextAttributes.BOLD} fg={theme.warning}>Comments</text>
                <Show when={state.issueDetailLoadingByKey[selectedIssue().key]}>
                  <text fg={theme.warning} wrapMode="none">Loading Jira comments...</text>
                </Show>
                <Show when={state.issueDetailErrorByKey[selectedIssue().key]}>
                  {(message) => <text fg={theme.danger} wrapMode="none">Detail load failed: {message()}</text>}
                </Show>
                <For each={selectedIssue().comments} fallback={<text fg={theme.textSubtle}>No comments</text>}>
                  {(comment) => (
                    <box flexDirection="column" marginTop={1}>
                      <text fg={theme.text} wrapMode="none">{comment.author} · {comment.age}</text>
                       <RichText markdown={comment.body} writeBlockedReason={comment.writeBlockedReason} compact />
                    </box>
                  )}
                </For>
              </box>
            </scrollbox>
          </box>
        )}
      </Show>
    </box>
  )
}

function IssueFieldRow(props: { field: IssueFieldDefinition; index: number }) {
  const appState = useAppState()
  const { state } = appState
  const { theme } = useTheme()
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const selected = () => state.focusedPane === "inspector" && state.inspectorSelectedFieldIndex === props.index
  const editing = () => state.inspectorEditingFieldId === props.field.id
  const dirty = () => issue() && isEditableField(props.field.id) && state.issueDrafts[issue()!.key]?.[props.field.id] !== undefined
  const value = () => (issue() ? issueFieldDisplayValue(state, issue()!, props.field) : "")

  return (
    <box id={`inspector-field-${props.index}`} flexDirection="column" flexShrink={0} marginBottom={1} backgroundColor={selected() && !editing() ? theme.selected : undefined} paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={selected() ? theme.selectedText : props.field.editable ? theme.text : theme.textSubtle} wrapMode="none">
          {selected() ? ">" : " "} {props.field.label}{dirty() ? " *" : ""}
        </text>
        <text fg={props.field.editable ? theme.textSubtle : theme.textSubtle}>{props.field.editable ? "edit" : "read"}</text>
      </box>
      <Show when={editing()} fallback={<FieldValue field={props.field} value={value()} selected={selected()} color={issue() ? issueFieldColor(state, issue()!, props.field) : undefined} />}>
        <FieldEditor field={props.field} />
      </Show>
    </box>
  )
}

function FieldValue(props: { field: IssueFieldDefinition; value: string; selected: boolean; color?: string }) {
  const { state } = useAppState()
  const icons = useIcons()
  const { theme } = useTheme()
  const color = () => props.color ?? (props.selected ? theme.selectedText : theme.textMuted)
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const issueType = () => configuredIssueTypes(state).find((type) => type.id === issue()?.type || type.name === issue()?.type || type.name === issue()?.typeName)
  const status = () => configuredStatuses(state).find((candidate) => candidate.id === issue()?.statusId)
  const icon = () => {
    const selectedIssue = issue()
    if (!selectedIssue) return ""
    if (props.field.id === "type") return icons.issueType({ name: issueTypeName(state, selectedIssue), subtask: issueType()?.subtask, hierarchyLevel: issueType()?.hierarchyLevel ?? selectedIssue.typeHierarchyLevel })
    if (props.field.id === "statusId") return icons.status(status() ?? { name: statusName(state, selectedIssue) })
    if (props.field.id === "priority") return icons.priority(selectedIssue.priority)
    if (props.field.id === "parentKey" && props.value) return icons.catalog.exceptional.parent
    if (props.field.id === "blocked" && props.value === "yes") return icons.catalog.exceptional.blocked
    if (props.field.id === "assignee" && props.value === "Unassigned") return icons.catalog.exceptional.unassigned
    return ""
  }
  if (props.field.multiline) {
    const preview = props.value.split("\n").slice(0, 8).join("\n") || "empty"
    return <text fg={color()}>{preview}</text>
  }
  return <text fg={color()} wrapMode="none">{icon() ? `${icon()} ` : ""}{props.value || "empty"}</text>
}

function FieldEditor(props: { field: IssueFieldDefinition }) {
  const appState = useAppState()
  const { state } = appState
  const { theme } = useTheme()
  if (props.field.id === "statusId" || props.field.id === "type" || props.field.id === "parentKey" || props.field.id === "sprintId") return <ChoiceEditor field={props.field} />
  if (props.field.id === "priority") return <FieldOptionPickerEditor />
  if (props.field.id === "labels") return <LabelPickerEditor />
  if (props.field.id === "assignee" || props.field.id === "reporter") return <UserPickerEditor fieldId={props.field.id} />
  if (props.field.multiline) {
    let textarea: TextareaRenderable | undefined
    return (
      <textarea
        height={8}
        initialValue={state.inspectorEditValue}
        onContentChange={() => appState.updateInspectorEditValue(textarea?.plainText ?? "")}
        onSubmit={() => appState.commitInspectorEdit()}
        ref={(element: TextareaRenderable) => {
          textarea = element
          setTimeout(() => !element.isDestroyed && element.focus(), 1)
        }}
        placeholder="Issue body"
        placeholderColor={theme.textSubtle}
        textColor={theme.text}
        focusedTextColor={theme.text}
        cursorColor={theme.accent}
        backgroundColor={theme.panel}
        focusedBackgroundColor={theme.panel}
      />
    )
  }
  return (
    <input
      value={state.inspectorEditValue}
      onInput={(value) => appState.updateInspectorEditValue(value)}
      onSubmit={() => appState.commitInspectorEdit()}
      ref={(element: InputRenderable) => setTimeout(() => !element.isDestroyed && element.focus(), 1)}
      placeholder={`Edit ${props.field.label}`}
      placeholderColor={theme.textSubtle}
      textColor={theme.text}
      focusedTextColor={theme.text}
      cursorColor={theme.accent}
      backgroundColor={theme.panel}
      focusedBackgroundColor={theme.panel}
    />
  )
}

function LabelPickerEditor() {
  const appState = useAppState()
  const { state } = appState
  const { theme } = useTheme()
  const picker = () => state.inspectorFieldPicker

  return (
    <box flexDirection="column" gap={1}>
      <input
        value={state.inspectorEditValue}
        onInput={(value) => appState.updateInspectorEditValue(value)}
        onSubmit={() => appState.commitInspectorEdit()}
        ref={(element: InputRenderable) => setTimeout(() => !element.isDestroyed && element.focus(), 1)}
        placeholder="Comma-separated Jira labels"
        placeholderColor={theme.textSubtle}
        textColor={theme.text}
        focusedTextColor={theme.text}
        cursorColor={theme.accent}
        backgroundColor={theme.panel}
        focusedBackgroundColor={theme.panel}
      />
      <Show when={picker()?.loading}><text fg={theme.warning}>Loading Jira label suggestions...</text></Show>
      <Show when={picker()?.error}>{(message) => <text fg={theme.danger}>Suggestions unavailable: {message()}</text>}</Show>
      <For each={picker()?.options ?? []} fallback={<Show when={!picker()?.loading}><text fg={theme.textMuted}>Type a new label or continue with the current values</text></Show>}>
        {(option, index) => {
          const selected = () => picker()?.selectedIndex === index()
          return <text id={choiceRowId("labels", option.value)} fg={selected() ? theme.selectedText : theme.text} bg={selected() ? theme.selected : undefined} wrapMode="none">{selected() ? ">" : " "} {option.label}</text>
        }}
      </For>
      <text fg={theme.textSubtle}>Up/Down apply suggestion · Enter stage · custom labels allowed</text>
    </box>
  )
}

function FieldOptionPickerEditor() {
  const { state } = useAppState()
  const icons = useIcons()
  const { theme } = useTheme()
  const picker = () => state.inspectorFieldPicker

  return (
    <box flexDirection="column" gap={1}>
      <Show when={picker()?.loading}><text fg={theme.warning}>Loading Jira Priority choices...</text></Show>
      <Show when={picker()?.error}>{(message) => <text fg={theme.danger}>{message()}</text>}</Show>
      <For each={picker()?.options ?? []} fallback={<Show when={!picker()?.loading && !picker()?.error}><text fg={theme.textMuted}>No Jira Priority choices</text></Show>}>
        {(option, index) => {
          const selected = () => picker()?.selectedIndex === index()
          return (
            <text id={choiceRowId("priority", option.value)} fg={option.color ?? theme.text} bg={selected() ? theme.selected : undefined} wrapMode="none">
              {selected() ? ">" : " "} {icons.priority(option.label)} {option.label}
            </text>
          )
        }}
      </For>
      <text fg={theme.textSubtle}>j/k choose · Enter stage Jira Priority · Esc cancel</text>
    </box>
  )
}

function UserPickerEditor(props: { fieldId: "assignee" | "reporter" }) {
  const appState = useAppState()
  const { state } = appState
  const { theme } = useTheme()
  const picker = () => state.inspectorUserPicker
  let input: InputRenderable | undefined

  return (
    <box flexDirection="column" gap={1}>
      <input
        value={state.inspectorEditValue}
        onInput={(value) => appState.updateInspectorEditValue(value)}
        onSubmit={() => appState.commitInspectorEdit()}
        ref={(element: InputRenderable) => {
          input = element
          setTimeout(() => !element.isDestroyed && element.focus(), 1)
        }}
        placeholder={`Filter ${props.fieldId === "assignee" ? "assignable users" : "project members"}`}
        placeholderColor={theme.textSubtle}
        textColor={theme.text}
        focusedTextColor={theme.text}
        cursorColor={theme.accent}
        backgroundColor={theme.panel}
        focusedBackgroundColor={theme.panel}
      />
      <Show when={picker()?.loading}><text fg={theme.warning}>Loading Jira users...</text></Show>
      <Show when={picker()?.error}>{(message) => <text fg={theme.danger}>{message()}</text>}</Show>
      <For each={picker()?.options ?? []} fallback={<Show when={!picker()?.loading}><text fg={theme.textMuted}>No matching Jira users</text></Show>}>
        {(user, index) => {
          const selected = () => picker()?.selectedIndex === index()
          return <text fg={selected() ? theme.selectedText : theme.text} bg={selected() ? theme.selected : undefined} wrapMode="none">{selected() ? ">" : " "} {user.displayName}</text>
        }}
      </For>
      <text fg={theme.textSubtle}>Up/Down choose · Enter stage selected user · Esc cancel</text>
    </box>
  )
}

function ChoiceEditor(props: { field: IssueFieldDefinition }) {
  const { state } = useAppState()
  const icons = useIcons()
  const { theme } = useTheme()
  const choices = () =>
    props.field.id === "statusId"
      ? configuredStatuses(state).map((status) => ({ value: status.id, label: status.name, color: status.color, icon: icons.status(status) }))
      : props.field.id === "type"
        ? configuredIssueTypes(state).map((type) => ({ value: type.id, label: type.name, color: type.color, icon: icons.issueType(type) }))
        : props.field.id === "sprintId"
          ? [{ value: "", label: "Backlog", color: theme.textSubtle, icon: icons.catalog.structural.leaf }, ...state.sprints.filter((sprint) => sprint.state !== "closed").map((sprint) => ({ value: sprint.id, label: sprint.name, color: theme.accent, icon: icons.catalog.structural.leaf }))]
          : [{ value: "", label: "No parent", color: theme.textSubtle, icon: icons.catalog.exceptional.parent }, ...(issueByKey(state, state.selectedIssueKey) ? parentIssueChoices(state, issueByKey(state, state.selectedIssueKey)!).map((choice) => ({ ...choice, icon: icons.catalog.exceptional.parent })) : [])]

  return (
    <box flexDirection="column" gap={1}>
      <For each={choices()}>
        {(choice) => {
          const selected = () => state.inspectorEditValue === choice.value
          return (
            <text id={choiceRowId(props.field.id, choice.value)} fg={choice.color} bg={selected() ? theme.selected : undefined} wrapMode="none">
              {selected() ? ">" : " "} {choice.icon} {choice.label}
            </text>
          )
        }}
      </For>
    </box>
  )
}

function choiceRowId(fieldId: string, value: string) {
  return `inspector-choice-${fieldId}-${encodeURIComponent(value)}`
}
