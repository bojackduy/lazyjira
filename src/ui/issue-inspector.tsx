import { TextAttributes, type InputRenderable, type ScrollBoxRenderable, type TextareaRenderable } from "@opentui/core"
import { createEffect, For, Show } from "solid-js"
import { useAppState } from "../context/app-state"
import { useBindings } from "../context/keymap"
import { useTheme } from "../context/theme"
import { configuredIssueTypes, configuredStatuses } from "../state/config-drafts"
import { issueByKey } from "../state/issue-drafts"
import { isEditableField, issueFieldColor, issueFieldDisplayValue, issueFields, type IssueFieldDefinition } from "../state/issue-fields"
import { issueTypeColor, statusColor, statusName } from "../state/selectors"
import { stagedChanges } from "../state/staged-changes"

export function IssueInspector(props: { compact: boolean }) {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  let scrollbox: ScrollBoxRenderable | undefined
  const issue = () => issueByKey(state, state.selectedIssueKey)
  const focused = () => state.focusedPane === "inspector"
  const stagedCount = () => stagedChanges(state).length
  const stagedComments = () => state.commentDrafts.filter((draft) => draft.issueKey === state.selectedIssueKey)
  const stagedRank = () => state.rankDrafts[state.selectedIssueKey]

  useBindings(() => ({
    commands: [
      { name: "inspector.scroll.down", run: () => scrollPage(1) },
      { name: "inspector.scroll.up", run: () => scrollPage(-1) },
    ],
    bindings: state.searchOpen ? [] : [
      { key: "d", cmd: "inspector.scroll.down", preventDefault: false },
      { key: { name: "d", ctrl: true }, cmd: "inspector.scroll.down" },
      { key: "u", cmd: "inspector.scroll.up", preventDefault: false },
      { key: { name: "u", ctrl: true }, cmd: "inspector.scroll.up" },
    ],
  }))

  createEffect(() => {
    if (!focused()) return
    scrollbox?.scrollChildIntoView(`inspector-field-${state.inspectorSelectedFieldIndex}`)
  })

  function scrollPage(delta: 1 | -1) {
    if (!focused() || state.remoteApplyOpen || state.stagedDiscardOpen || isPlainTextInspectorEditing()) return false
    scrollbox?.scrollBy(delta, "viewport")
  }

  function isPlainTextInspectorEditing() {
    return !!state.inspectorEditingFieldId && state.inspectorEditingFieldId !== "statusId" && state.inspectorEditingFieldId !== "type"
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
              <text fg={theme.accent} wrapMode="none">{selectedIssue().key}{selectedIssue().isDraft ? " draft" : ""}</text>
              <text fg={theme.text} wrapMode="none">{selectedIssue().title}</text>
              <text fg={issueTypeColor(state, selectedIssue())} wrapMode="none">■ {selectedIssue().type} <span style={{ fg: statusColor(state, selectedIssue()) }}>● {statusName(state, selectedIssue())}</span></text>
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
                      <text fg={theme.textMuted}>{comment.body}</text>
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
  const theme = useTheme()
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
  const theme = useTheme()
  const color = () => props.color ?? (props.selected ? theme.selectedText : theme.textMuted)
  if (props.field.multiline) {
    const preview = props.value.split("\n").slice(0, 8).join("\n") || "empty"
    return <text fg={color()}>{preview}</text>
  }
  return <text fg={color()} wrapMode="none">{props.value || "empty"}</text>
}

function FieldEditor(props: { field: IssueFieldDefinition }) {
  const appState = useAppState()
  const { state } = appState
  const theme = useTheme()
  if (props.field.id === "statusId" || props.field.id === "type") return <ChoiceEditor field={props.field} />
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

function ChoiceEditor(props: { field: IssueFieldDefinition }) {
  const { state } = useAppState()
  const theme = useTheme()
  const choices = () =>
    props.field.id === "statusId"
      ? configuredStatuses(state).map((status) => ({ value: status.id, label: status.name, color: status.color }))
      : configuredIssueTypes(state).map((type) => ({ value: type.id, label: type.name, color: type.color }))

  return (
    <box flexDirection="column" gap={1}>
      <For each={choices()}>
        {(choice) => {
          const selected = () => state.inspectorEditValue === choice.value
          return (
            <text fg={choice.color} bg={selected() ? theme.selected : undefined} wrapMode="none">
              {selected() ? ">" : " "} {props.field.id === "statusId" ? "●" : "■"} {choice.label}
            </text>
          )
        }}
      </For>
    </box>
  )
}
