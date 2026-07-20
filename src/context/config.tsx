import { createRequiredContext, type ProviderProps } from "./helper"

export type AppConfig = {
  appName: string
  demoMode: boolean
}

const [ConfigContextProvider, useConfig] = createRequiredContext<AppConfig>("Config")

export { useConfig }

export function ConfigProvider(props: ProviderProps<{ value: AppConfig }>) {
  return <ConfigContextProvider value={props.value}>{props.children}</ConfigContextProvider>
}
