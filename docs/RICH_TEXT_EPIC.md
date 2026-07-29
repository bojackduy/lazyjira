# Rich Jira Text Epic

## Goal

Make every Jira text field that lazyjira reads or edits use one rich-text pipeline:

```text
Jira ADF -> Markdown projection -> OpenTUI Markdown reader / textarea editor -> Markdown -> Jira ADF
```

The first implementation covers issue descriptions, comments, and issue-create descriptions. Future Jira fields are added only through the same mapper and renderer; no route or widget may flatten ADF independently.

## Product Contract

- Read rich Jira content as Markdown, not flattened text.
- Render Markdown with OpenTUI `markdown`, syntax highlighting, concealed markup, readable code blocks, and grid tables.
- Edit Markdown in the existing textarea flow and stage it before any Jira write.
- Convert staged Markdown back to ADF only in the write path.
- Re-fetch and remap after a successful remote write.
- Render unsupported ADF in a readable fallback, but block a remote replacement that would drop unsupported structure.
- Keep dev fixtures rich enough to exercise supported and blocked cases.

## Supported Markdown And ADF

The initial mapper supports:

- Headings, paragraphs, hard breaks, rules, block quotes, panels, bullet lists, ordered lists, code blocks, and tables.
- Bold, italic, strike-through, inline code, and links.
- Jira ADF `doc`, `paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `panel`, `codeBlock`, `rule`, `table`, `tableRow`, `tableHeader`, `tableCell`, `hardBreak`, and matching inline marks.

Unsupported nodes such as media, attachment references, layout/color marks, unknown vendor extensions, and unmodeled ADF nodes must have a readable fallback. A description or comment containing unsupported nodes is marked write-blocked until its round-trip behavior is explicitly implemented.

### Jira Markdown Directives

The non-media Jira-specific nodes use visible, editable directives so their identity survives the textarea round trip:

```md
@[Duy](jira-mention://account-id)
:rocket:
[[status:In Review|yellow]]
[[date:1765843200000]]
[[card:https://example.com|Architecture]]
- [ ] Verify release
- [x] Notify team
[[expand:Rollout notes]]
Details shown in the reader.
[[/expand]]
```

The reader renders standalone status, date, card, and expand directives as Jira-aware terminal components. Mentions and emoji remain readable inline Markdown/text while retaining their ADF identity on write. Image, attachment, and media directives remain intentionally deferred to a separate media epic.

## Architecture

### Mapping Boundary

Add `src/jira/adf.ts` as the only Jira rich-text conversion module. It owns:

- ADF validation and typed node guards.
- `adfToMarkdown()` and `markdownToAdf()`.
- Plain-text extraction for search/snippets.
- Unsupported-node detection and human-readable blocked reasons.
- The shared ADF document builder used by description, comment, and issue-create writes.

Do not duplicate ADF builders in `src/context/app-state.tsx`, `src/jira/client.ts`, or `src/workspace/prod/source.ts`.

### Domain Model

Keep `IssueSummary.description` as the Markdown projection so selectors, drafts, and fixtures have one text format. Add description metadata that records whether remote writes are safe and why they are blocked. Comments need the same Markdown projection and write safety metadata.

Raw Jira DTOs remain inside the Jira client/normalizer boundary. UI code consumes Markdown plus safe-write metadata only.

### Rendering

Create a shared rich-text reader component and Jira Markdown syntax style. Model its layout after lazyconfluence's reader:

- A dedicated `scrollbox` with horizontal scrolling for wide tables/code.
- OpenTUI `markdown` with `conceal`, syntax styling, and grid/balanced table options.
- A readable unsupported-content warning before the body or comment.
- Responsive sizing that does not overflow narrow terminals.

Issue detail uses the full reader. Inspector and comments use the same projection with intentionally bounded height rather than separate plain-text rendering.

### Writing

`Ctrl-Enter` stages Markdown exactly as it does today. `W` plans the rich-text field update, validates the draft with `markdownToAdf()`, and marks unsupported/lossy operations blocked in the existing write review. The remote apply path sends the generated ADF, clears a draft only after success, then reloads the issue and comments.

## Work Breakdown

1. `R1` ADF model and reader mapper
   - Add typed ADF helpers and ADF-to-Markdown projection.
   - Preserve block boundaries and inline marks.
   - Produce readable unsupported fallbacks and write-block metadata.

2. `R2` Markdown-to-ADF writer
   - Support the documented Markdown subset.
   - Replace existing plain paragraph builders for descriptions, comments, and issue creation.
   - Reject opaque/unsupported drafts before remote apply.

3. `R3` State and staged-write integration
   - Carry rich-text metadata through normalization, issue drafts, comments, write plans, and post-write reloads.
   - Keep staged drafts on validation or remote failures.

4. `R4` Shared OpenTUI rendering
   - Add Jira Markdown syntax style and reusable reader component.
   - Render descriptions, comments, and other readable rich fields through it.
   - Keep Markdown editing in the existing textarea path.

5. `R5` Fixtures, tests, and manual verification
   - Add ADF fixtures for every supported node and unsupported fallback.
   - Cover conversion, API payloads, staged blocked writes, detail/comments rendering, and narrow-terminal behavior.
   - Add Jira smoke steps for create, description edit, and comment edit using a safe test project.

## File Ownership

- Mapping: `src/jira/adf.ts`, `src/jira/normalize.ts`, and focused tests.
- State/write flow: `src/state/app-state.ts`, `src/context/app-state.tsx`, `src/state/jira-write-plan.ts`, `src/state/staged-changes.ts`.
- Jira payloads: `src/jira/client.ts`, `src/workspace/prod/source.ts`.
- UI: `src/routes/issue-detail.tsx`, `src/ui/issue-inspector.tsx`, future shared rich-text reader/style files.
- Fixture and test data: `src/workspace/dev/fixtures.ts`, `src/jira/client.test.ts`, `src/workspace/prod/source.test.ts`, and new mapper/render tests.

## Verification

- Unit tests for ADF-to-Markdown and Markdown-to-ADF, including malformed and unsupported input.
- Request assertions for description, comment, and create-issue ADF payloads.
- State tests proving blocked rich-text drafts remain staged.
- OpenTUI render tests for descriptions/comments and narrow-terminal layout.
- `bun run typecheck` and `bun test`.
- Manual dev smoke: read supported fixture body, edit/stage/write a supported body, and verify an unsupported fixture is readable but write-blocked.
