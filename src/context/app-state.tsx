import { createStore } from "solid-js/store"
import { createRequiredContext, type ProviderProps } from "./helper"
import type { AppState } from "../state/app-state"
import type { AppRoute } from "../state/routes"

export type AppStateContext = {
  state: AppState
  setRoute: (route: AppRoute) => void
  selectIssue: (issueKey: string) => void
}

const [AppStateContextProvider, useAppState] = createRequiredContext<AppStateContext>("AppState")

export { useAppState }

export function AppStateProvider(props: ProviderProps<{ initialState: AppState }>) {
  const [state, setState] = createStore<AppState>(props.initialState)

  const context: AppStateContext = {
    state,
    setRoute(route) {
      setState("route", route)
    },
    selectIssue(issueKey) {
      setState("selectedIssueKey", issueKey)
    },
  }

  return <AppStateContextProvider value={context}>{props.children}</AppStateContextProvider>
}
