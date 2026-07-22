import { createInterface } from "node:readline/promises"
import { loadJiraAuthConfig, lazyJiraConfigPath, removeJiraAuthConfig, saveJiraAuthConfig, type JiraAuthConfig } from "./config"

export async function runAuthCli(argv: string[]) {
  if (argv[0] === "--help" || argv[0] === "-h") {
    printRootHelp()
    return true
  }
  if (argv[0] !== "auth") return false

  try {
    switch (argv[1] ?? "help") {
      case "login":
        await login()
        return true
      case "status":
        await status()
        return true
      case "logout":
        await logout()
        return true
      case "path":
        console.log(lazyJiraConfigPath())
        return true
      case "help":
      case "--help":
      case "-h":
        printAuthHelp()
        return true
      default:
        console.error(`Unknown auth command: ${argv[1]}`)
        printAuthHelp()
        process.exitCode = 1
        return true
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
    return true
  }
}

async function login() {
  const existing = await loadJiraAuthConfig().catch(() => undefined)
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let closed = false
  try {
    const baseUrl = await questionWithDefault(rl, "Jira site URL", existing?.baseUrl)
    const email = await questionWithDefault(rl, "Email", existing?.email)
    rl.close()
    closed = true

    const apiToken = (await readPassword(existing ? "API token (leave blank to keep current): " : "API token: ")) || existing?.apiToken || ""
    const auth: JiraAuthConfig = { baseUrl, email, apiToken }
    const path = await saveJiraAuthConfig(auth)
    console.log(`Saved Jira credentials to ${path}`)
  } finally {
    if (!closed) rl.close()
  }
}

async function status() {
  const auth = await loadJiraAuthConfig()
  if (!auth) {
    console.log("No Jira credentials configured. Run `lazyjira auth login`.")
    console.log(`Config path: ${lazyJiraConfigPath()}`)
    return
  }
  console.log("Jira credentials configured")
  console.log(`URL: ${auth.baseUrl}`)
  console.log(`Email: ${auth.email}`)
  console.log(`API token: ${auth.apiToken ? "configured" : "missing"}`)
  console.log(`Config path: ${lazyJiraConfigPath()}`)
}

async function logout() {
  const removed = await removeJiraAuthConfig()
  console.log(removed ? "Removed Jira credentials" : "No Jira credentials were configured")
}

async function questionWithDefault(rl: ReturnType<typeof createInterface>, label: string, defaultValue?: string) {
  const suffix = defaultValue ? ` [${defaultValue}]` : ""
  const answer = (await rl.question(`${label}${suffix}: `)).trim()
  return answer || defaultValue || ""
}

async function readPassword(prompt: string) {
  const stdin = process.stdin as typeof process.stdin & { isTTY?: boolean; setRawMode?: (mode: boolean) => void }
  if (!stdin.isTTY || !stdin.setRawMode) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      return (await rl.question(prompt)).trim()
    } finally {
      rl.close()
    }
  }

  return new Promise<string>((resolve, reject) => {
    let value = ""
    const cleanup = () => {
      stdin.off("data", onData)
      stdin.setRawMode?.(false)
      stdin.pause()
    }
    const finish = () => {
      process.stdout.write("\n")
      cleanup()
      resolve(value.trim())
    }
    const onData = (chunk: Buffer | string) => {
      const text = chunk.toString("utf8")
      for (const char of text) {
        if (char === "\u0003") {
          cleanup()
          reject(new Error("Cancelled"))
          return
        }
        if (char === "\r" || char === "\n") {
          finish()
          return
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }

    process.stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on("data", onData)
  })
}

function printRootHelp() {
  console.log("lazyjira")
  console.log("")
  console.log("Usage:")
  console.log("  lazyjira                 Open the TUI")
  console.log("  lazyjira auth login      Save Jira credentials")
  console.log("  lazyjira auth status     Show configured Jira account")
  console.log("  lazyjira auth logout     Remove saved Jira credentials")
}

function printAuthHelp() {
  console.log("lazyjira auth")
  console.log("")
  console.log("Commands:")
  console.log("  login    Prompt for Jira URL, email, and API token")
  console.log("  status   Show URL/email and token presence")
  console.log("  logout   Remove saved local credentials")
  console.log("  path     Print the config file path")
}
