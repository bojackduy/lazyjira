import { createRequiredContext, type ProviderProps } from "./helper"
import { createSignal } from "solid-js"
import { builtInThemes, defaultThemeId, type ResolvedTheme, type ThemeColorName, type ThemeSyntaxName } from "../themes/catalog"

export type Theme = ResolvedTheme["colors"]
export type ThemeSyntax = ResolvedTheme["syntax"]

export type ThemeContext = {
  theme: Theme
  syntax: ThemeSyntax
  selectedTheme: ResolvedTheme
  setTheme: (theme: ResolvedTheme) => void
  applyTheme: (theme: ResolvedTheme) => void
  resetToDefault: () => void
}

const defaultResolved = builtInThemes.find((theme) => theme.id === defaultThemeId) ?? builtInThemes[0]!

export const defaultTheme: Theme = defaultResolved.colors
export const defaultThemeSyntax: ThemeSyntax = defaultResolved.syntax

const [ThemeContextProvider, useThemeContext] = createRequiredContext<ThemeContext>("Theme")

export function useTheme(): Theme {
  return useThemeContext().theme
}

export function useThemeSyntax(): ThemeSyntax {
  return useThemeContext().syntax
}

export { useThemeContext }

export function ThemeProvider(props: ProviderProps<{ value?: ResolvedTheme; onThemeChange?: (theme: ResolvedTheme) => Promise<unknown> | void }>) {
  const [selected, setSelected] = createSignal(props.value ?? defaultResolved)
  const colors = new Proxy({} as Theme, {
    get(_target, key: string) {
      return selected().colors[key as ThemeColorName]
    },
  })
  const syntax = new Proxy({} as ThemeSyntax, {
    get(_target, key: string) {
      return selected().syntax[key as ThemeSyntaxName]
    },
  })
  const value: ThemeContext = {
    get theme() {
      return colors
    },
    get syntax() {
      return syntax
    },
    get selectedTheme() {
      return selected()
    },
    setTheme(next) {
      setSelected(next)
    },
    applyTheme(next) {
      setSelected(next)
      void props.onThemeChange?.(next)
    },
    resetToDefault() {
      setSelected(defaultResolved)
    },
  }
  return <ThemeContextProvider value={value}>{props.children}</ThemeContextProvider>
}
