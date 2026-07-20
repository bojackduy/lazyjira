import { useBindings } from "./context/keymap"
import { useExit } from "./context/exit"
import { AppShell } from "./ui/shell"

export function App() {
  const exit = useExit()

  useBindings(() => ({
    commands: [
      {
        name: "app.quit",
        run() {
          exit.exit()
        },
      },
    ],
    bindings: [
      { key: "q", cmd: "app.quit" },
      { key: { name: "c", ctrl: true }, cmd: "app.quit" },
    ],
  }))

  return <AppShell />
}
