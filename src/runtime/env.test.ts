import { describe, expect, test } from "bun:test"
import { isVersionRequest, parseRuntimeEnv } from "./env"

describe("runtime env", () => {
  test("defaults to prod", () => {
    expect(parseRuntimeEnv([])).toBe("prod")
  })

  test("supports explicit dev and prod", () => {
    expect(parseRuntimeEnv(["dev"])).toBe("dev")
    expect(parseRuntimeEnv(["prod"])).toBe("prod")
  })

  test("recognizes version flags", () => {
    expect(isVersionRequest(["--version"])).toBe(true)
    expect(isVersionRequest(["-v"])).toBe(true)
    expect(isVersionRequest([])).toBe(false)
    expect(isVersionRequest(["dev"])).toBe(false)
  })

  test("rejects unknown environments", () => {
    expect(() => parseRuntimeEnv(["demo"])).toThrow("Unknown runtime environment: demo")
  })
})
