import { createRequiredContext, type ProviderProps } from "./helper"
import { createSignal } from "solid-js"
import { selectIcons, selectIconsFromEnv, type IconMode, type IconSelector, type IssueTypeIconMetadata, type StatusIconMetadata } from "../icons/catalog"

export type IconContext = IconSelector & {
  locked: boolean
  setMode: (mode: IconMode) => Promise<void>
}

const [IconContextProvider, useIcons] = createRequiredContext<IconContext>("Icon")

export { useIcons }

export function IconProvider(props: ProviderProps<{ mode?: unknown; value?: IconSelector; locked?: boolean; onModeChange?: (mode: IconMode) => Promise<unknown> }>) {
  const initial = props.value ?? (props.mode === undefined ? selectIconsFromEnv() : selectIcons(props.mode))
  const [selector, setSelector] = createSignal(initial)
  const value: IconContext = {
    locked: props.locked ?? false,
    get mode() {
      return selector().mode
    },
    get catalog() {
      return selector().catalog
    },
    issueType(metadata: IssueTypeIconMetadata) {
      return selector().issueType(metadata)
    },
    status(metadata: StatusIconMetadata) {
      return selector().status(metadata)
    },
    priority(name?: string) {
      return selector().priority(name)
    },
    async setMode(mode) {
      if (props.locked) return
      const next = selectIcons(mode)
      setSelector(next)
      await props.onModeChange?.(next.mode)
    },
  }
  return <IconContextProvider value={value}>{props.children}</IconContextProvider>
}
