import { createRequiredContext, type ProviderProps } from "./helper"
import type { JiraAuthSummary } from "../auth/config"
import type { RuntimeEnv } from "../runtime/env"

export type AppConfig = {
  appName: string
  runtimeEnv: RuntimeEnv
  jira?: JiraAuthSummary
}

const [ConfigContextProvider, useConfig] = createRequiredContext<AppConfig>("Config")

export { useConfig }

export function ConfigProvider(props: ProviderProps<{ value: AppConfig }>) {
  return <ConfigContextProvider value={props.value}>{props.children}</ConfigContextProvider>
}
