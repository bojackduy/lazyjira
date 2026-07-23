import { AppStateProvider } from "./app-state"
import { ConfigProvider } from "./config"
import { DialogProvider } from "./dialog"
import { ExitProvider } from "./exit"
import { ThemeProvider } from "./theme"
import { ToastProvider } from "./toast"
import type { ProviderProps } from "./helper"
import type { AppState } from "../state/app-state"
import type { AppConfig } from "./config"
import type { JiraWorkspaceConfig } from "../auth/config"
import type { WorkspaceSource } from "../workspace/types"

export function AppProviders(props: ProviderProps<{ config: AppConfig; initialState: AppState; source: WorkspaceSource; saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown>; onExit: () => void }>) {
  return (
    <ConfigProvider value={props.config}>
      <ExitProvider onExit={props.onExit}>
        <ThemeProvider>
          <ToastProvider>
            <DialogProvider>
              <AppStateProvider initialState={props.initialState} source={props.source} saveWorkspaceConfig={props.saveWorkspaceConfig}>{props.children}</AppStateProvider>
            </DialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </ExitProvider>
    </ConfigProvider>
  )
}
