import { describe, expect, test } from "bun:test"
import { parseRuntimeMode } from "./mode"

describe("runtime mode", () => {
  test("defaults to Jira mode", () => {
    expect(parseRuntimeMode([])).toBe("jira")
  })

  test("supports demo mode", () => {
    expect(parseRuntimeMode(["demo"])).toBe("demo")
    expect(parseRuntimeMode(["--demo"])).toBe("demo")
  })

  test("rejects unknown commands", () => {
    expect(() => parseRuntimeMode(["unknown"])).toThrow("Unknown command: unknown")
  })
})
