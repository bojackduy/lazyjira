import { AppStateProvider } from "./app-state"
import { ConfigProvider } from "./config"
import { DialogProvider } from "./dialog"
import { ExitProvider } from "./exit"
import { IconProvider } from "./icons"
import { ThemeProvider } from "./theme"
import { ToastProvider } from "./toast"
import type { ProviderProps } from "./helper"
import type { AppState } from "../state/app-state"
import type { AppConfig } from "./config"
import type { JiraWorkspaceConfig } from "../auth/config"
import type { IconMode } from "../icons/catalog"
import type { ResolvedTheme } from "../themes/catalog"
import type { WorkspaceSelection, WorkspaceSource } from "../workspace/types"

export function AppProviders(props: ProviderProps<{ config: AppConfig; initialState: AppState; initialWorkspaceSelection?: WorkspaceSelection; source: WorkspaceSource; saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown>; iconMode?: unknown; iconModeLocked?: boolean; saveIconMode?: (mode: IconMode) => Promise<unknown>; theme?: ResolvedTheme; saveTheme?: (theme: ResolvedTheme) => Promise<unknown>; onExit: () => void }>) {
  return (
    <ConfigProvider value={props.config}>
      <ExitProvider onExit={props.onExit}>
        <ThemeProvider value={props.theme} onThemeChange={props.saveTheme}>
          <IconProvider mode={props.iconMode} locked={props.iconModeLocked} onModeChange={props.saveIconMode}>
            <ToastProvider>
              <DialogProvider>
                <AppStateProvider initialState={props.initialState} initialWorkspaceSelection={props.initialWorkspaceSelection} source={props.source} saveWorkspaceConfig={props.saveWorkspaceConfig}>{props.children}</AppStateProvider>
              </DialogProvider>
            </ToastProvider>
          </IconProvider>
        </ThemeProvider>
      </ExitProvider>
    </ConfigProvider>
  )
}
