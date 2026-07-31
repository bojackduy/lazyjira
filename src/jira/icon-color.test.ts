import { describe, expect, test } from "bun:test"
import { PNG } from "pngjs"
import { fetchJiraIconColor } from "./icon-color"

const auth = { baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }

describe("Jira icon colors", () => {
  test("extracts the visible accent from Jira SVG icons", async () => {
    let authorization: string | undefined
    const color = await fetchJiraIconColor(auth, "https://team.atlassian.net/story.svg", async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization") ?? undefined
      return new Response('<svg><path fill="#FFFFFF"/><path fill="#36B37E"/></svg>', { headers: { "content-type": "image/svg+xml" } })
    })

    expect(color).toBe("#36B37E")
    expect(authorization).toStartWith("Basic ")
  })

  test("does not send Jira credentials to external icon hosts", async () => {
    let authorization: string | null = null
    await fetchJiraIconColor(auth, "https://cdn.example.com/bug.svg", async (_url, init) => {
      authorization = new Headers(init?.headers).get("authorization")
      return new Response('<svg><path fill="#FF5630"/></svg>', { headers: { "content-type": "image/svg+xml" } })
    })

    expect(authorization).toBeNull()
  })

  test("extracts the dominant saturated color from Jira PNG avatars", async () => {
    const image = new PNG({ width: 2, height: 2 })
    image.data.set([
      255, 255, 255, 0,
      0, 184, 217, 255,
      0, 184, 217, 255,
      0, 184, 217, 255,
    ])
    const bytes = PNG.sync.write(image)
    const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const color = await fetchJiraIconColor(auth, "https://team.atlassian.net/avatar.png", async () => new Response(body, { headers: { "content-type": "image/png" } }))

    expect(color).toBe("#00B8D9")
  })
})
