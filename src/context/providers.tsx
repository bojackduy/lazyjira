import { AppStateProvider } from "./app-state"
import { ConfigProvider } from "./config"
import { DialogProvider } from "./dialog"
import { ExitProvider } from "./exit"
import { ThemeProvider } from "./theme"
import { ToastProvider } from "./toast"
import type { ProviderProps } from "./helper"
import type { AppState } from "../state/app-state"
import type { AppConfig } from "./config"

export function AppProviders(props: ProviderProps<{ config: AppConfig; initialState: AppState; onExit: () => void }>) {
  return (
    <ConfigProvider value={props.config}>
      <ExitProvider onExit={props.onExit}>
        <ThemeProvider>
          <ToastProvider>
            <DialogProvider>
              <AppStateProvider initialState={props.initialState}>{props.children}</AppStateProvider>
            </DialogProvider>
          </ToastProvider>
        </ThemeProvider>
      </ExitProvider>
    </ConfigProvider>
  )
}
