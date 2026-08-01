import { createRequiredContext, type ProviderProps } from "./helper"
import { selectIcons, selectIconsFromEnv, type IconSelector } from "../icons/catalog"

const [IconContextProvider, useIcons] = createRequiredContext<IconSelector>("Icon")

export { useIcons }

export function IconProvider(props: ProviderProps<{ mode?: unknown; value?: IconSelector }>) {
  const value = props.value ?? (props.mode === undefined ? selectIconsFromEnv() : selectIcons(props.mode))
  return <IconContextProvider value={value}>{props.children}</IconContextProvider>
}
