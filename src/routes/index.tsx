import { Match, Switch } from "solid-js"
import { useAppState } from "../context/app-state"
import { ActiveSprintRoute } from "./active-sprint"
import { BacklogRoute } from "./backlog"
import { IssueDetailRoute } from "./issue-detail"
import { KanbanRoute } from "./kanban"
import { WorkspaceRoute } from "./workspace"

export function RouteSurface() {
  const { state } = useAppState()

  return (
    <Switch fallback={<WorkspaceRoute />}>
      <Match when={state.route === "workspace"}>
        <WorkspaceRoute />
      </Match>
      <Match when={state.route === "active-sprint"}>
        <ActiveSprintRoute />
      </Match>
      <Match when={state.route === "backlog"}>
        <BacklogRoute />
      </Match>
      <Match when={state.route === "kanban"}>
        <KanbanRoute />
      </Match>
      <Match when={state.route === "issue-detail"}>
        <IssueDetailRoute />
      </Match>
    </Switch>
  )
}
