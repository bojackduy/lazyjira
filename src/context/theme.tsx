import { createRequiredContext, type ProviderProps } from "./helper"
import { createSignal } from "solid-js"
import { builtInThemes, defaultThemeId, type ResolvedTheme } from "../themes/catalog"

export type Theme = ResolvedTheme["colors"]
export type ThemeSyntax = ResolvedTheme["syntax"]

export type ThemeContext = {
  theme: Theme
  syntax: ThemeSyntax
  selectedTheme: ResolvedTheme
  setTheme: (theme: ResolvedTheme) => void
  resetToDefault: () => void
}

const defaultResolved = builtInThemes.find((theme) => theme.id === defaultThemeId) ?? builtInThemes[0]!

export const defaultTheme: Theme = defaultResolved.colors
export const defaultThemeSyntax: ThemeSyntax = defaultResolved.syntax

const [ThemeContextProvider, useTheme] = createRequiredContext<ThemeContext>("Theme")

export { useTheme }

export function ThemeProvider(props: ProviderProps<{ value?: ResolvedTheme; onThemeChange?: (theme: ResolvedTheme) => Promise<unknown> | void }>) {
  const [selected, setSelected] = createSignal(props.value ?? defaultResolved)
  const value: ThemeContext = {
    get theme() {
      return selected().colors
    },
    get syntax() {
      return selected().syntax
    },
    get selectedTheme() {
      return selected()
    },
    setTheme(next) {
      setSelected(next)
      void props.onThemeChange?.(next)
    },
    resetToDefault() {
      setSelected(defaultResolved)
    },
  }
  return <ThemeContextProvider value={value}>{props.children}</ThemeContextProvider>
}
