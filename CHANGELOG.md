# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Node version 2** for new nodes. Saved workflows keep version 1 and behave as before.
- **Visibility** (version 2): who can open the presentation in Presentations.AI. **Private** (default), **Project** or **Workspace**. Choosing Project with no project set stops with a clear error before anything is created. Public decks are made only through **Create Share Link**.

### Changed

- **Language** defaults to `auto` in version 2, so the presentation follows the language of the topic, text or file. Version 1 keeps English.

## [0.3.2] - 2026-11-13

### Fixed

- **Waiting for a presentation works again on current n8n.** On n8n 2.34 and later, including n8n Cloud, a create operation that had to keep checking on the presentation stopped with "sleepWithAbort is not a function". n8n 2.34 removed that helper. The node now uses n8n's `sleep`, works on older n8n too, and still stops promptly when you stop the workflow.
- If 0.3.1 stopped with that error, the presentation was still created and charged. The error shows its Request ID: use **Job → Get Status** with that ID (turn on **Download File** for the file), or open the presentation in your Presentations.AI account. Running the workflow again creates, and charges for, a new one.
- **Errors reach the error output on every n8n version.** With _On Error → Continue (using error output)_, n8n 2.33 and earlier sent the node's error items down the success output. They now go to the error output, as on newer n8n.

### Changed

- The hint for n8n's AI workflow builder uses the current field name.
- Development uses n8n-workflow 2.47.1 and @n8n/node-cli 0.56.3.

## [0.3.1] - 2026-11-06

### Changed

- Same changes as 0.3.0 below. 0.3.0 is deprecated on npm, so install or update to 0.3.1.

## [0.3.0] - 2026-11-06

### Fixed

- **Every operation and the credential test work again.** On 2026-11-05 Presentations.AI removed the API endpoints 0.2.x used (`/api/v1/topic/document`, `/topic/singleslide`, `/document/content`, `/document/file`, `/polljob/{id}` and `/authenticate` now return 404). The node now uses the current API: `POST /api/v1/decks` to create, `POST /api/v1/files` to upload source files, `GET /api/v1/requests/{request_id}` for status, and `GET /api/v1/me` for the credential test.
- **Create From File** uploads now work. The old upload passed a request-library `formData` object, which n8n's HTTP client does not support, so the file never arrived as multipart. Uploads now use native `FormData`.

### Changed (breaking)

- Create operations wait for the finished deck by default (**Wait for Completion**, on) and download the file into binary field `data` (**Download File**, on). The JSON output is now simplified to ten fields (`status`, `request_id`, `deck_id`, `deck_url`, `share_url`, `export_format`, `file_size_bytes`, `stage`, `status_url`, `error`); turn **Simplify** off for the full API response. Expressions reading the old `job_id`, `pollUrl` or `document_url` fields need updating.
- **Job → Check Status** is now labelled **Get Status** (operation value unchanged). It takes a `request_id` or `status_url` and can download the file with **Download File**.
- **Language** takes the language name in English (e.g. `Spanish`) or `auto`. Two-letter codes such as `es` still work and are translated.
- **Domain** is now **Company Domain**, the company's web domain. Saved values carry over.
- **Target Audience** defaults to the new **Auto** option, which leaves the audience to Presentations.AI. A saved workflow that doesn't store a Target Audience value now uses Auto; choose General Audience to keep the old behaviour. Other choices are sent as a readable label, and an expression can pass any free-text audience.
- **Preservation Mode** maps to the API's source fidelity: Enhance → context, Preserve → retain, Summarize → condense, and Instruction uses the Topic or Instructions field as instructions.
- Saved workflows that used the PPT, Render or Share Link export formats now export PPTX. Share Link workflows still get a public share link.
- API keys from the old API don't work. Create a new key at https://api.presentations.ai/#/apikeys; the node's 401 message says so.
- Node version stays 1 and parameter names are unchanged, so saved workflows keep their values.
- Operation labels and messages follow n8n's UX guidelines (for example, "Create presentation from topic").
- The node is now programmatic (`execute()`) with n8n's recommended `actions/` + `transport/` layout. The previous `customOperations` were skipped when the node ran as an AI Agent tool.
- Dev tooling: `@n8n/node-cli` upgraded from 0.32.1 to 0.55.5.

### Removed

- **Tone**, **Callback URL** and **Return Job ID Immediately** parameters. The API has no equivalent; use Wait for Completion off plus Get Status instead of callbacks.
- **PPT**, **Render** and **Share Link** export formats. The API exports PPTX, PDF or IMAGE (a ZIP of slide images) only; use **Create Share Link** for a link.
- The 5 MB client-side limit on **Create From File**. The API accepts files up to 150 MB.

### Added

- The finished presentation is returned as a binary file (**Download File**, **Put Output File in Field**). Downloads use the API key, since `export.download_url` and `deck_url` are not public.
- **Create Share Link**: creates a public view link once the deck is ready (`share_url`, or `share_link` with Simplify off).
- **Simplify** (default on), following n8n's UX guidelines for responses with more than ten fields.
- **Wait for Completion** and **Max Wait (Seconds)** (default 600): the node waits with `Prefer: wait`, then checks every 5 seconds as the API docs recommend, and returns `RUNNING` if the deck isn't ready in time. Stopping the workflow ends the wait.
- **Options**: Brand Kit and Project (pick from a searchable list or enter an ID), Level of Detail, Model, Presentation Title, Put Output File in Field, Request ID and Speaker Notes.
- API keys limited to one project work: when no Project is chosen, the node creates the presentation in the key's own project.
- The credential **Test** explains an invalid key and links to the page for creating a new one.
- A note in the output panel points to **Get Status** when a presentation isn't ready yet, and a notice warns that share links are public.
- Search terms for the nodes panel (Slides, Slide Deck, Deck, PowerPoint, PPTX, Pitch Deck), and a hint for n8n's AI workflow builder.
- Example workflows carry overview notes with setup steps, following n8n's template guidelines.
- Errors show the message from Presentations.AI (for example, which field was rejected) instead of a generic HTTP status text.
- A request ID per node run and item (also tied to the n8n instance and workflow), so n8n's Retry On Fail never creates a second deck, while each loop pass and item still gets its own. **Request ID** lets you set your own.
- While waiting, rate limits (429) and temporary outages (5xx) are waited out, honouring `Retry-After`. Errors after a deck was requested include its request ID.
- Create From File accepts PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, TXT, Markdown, HTML, JSON, EPUB, PNG and JPEG (up to 150 MB). RTF, .doc and .ppt aren't accepted by the API.
- In AI Agent tool mode, Create From File and Download File are hidden, because tool calls carry no binary data.
- README section on using Presentations.AI with AI agents: this node as a tool, the Presentations.AI MCP server through n8n's MCP Client Tool, and the MCP Client node.
- Importable example workflows in `examples/`: an AI Agent using the Presentations.AI MCP server, and a form that returns a deck file.
- Unit tests with vitest (`npm test`), also run in CI.

## [0.2.0] - 2026-05-30

### Fixed (n8n verification feedback)

- Codex `node` field now uses the package-scoped prefix `@presentations-ai/n8n-nodes-presentations-ai.presentationsAi` (was `n8n-nodes-base.presentationsAi`).
- Removed dead declarative `routing` block from the `createFromFile` operation; it is dispatched exclusively via `customOperations.presentation.createFromFile`.
- Replaced unsupported codex categories (`AI`, `Marketing`) with the allowed values `Productivity` and `Marketing & Content`.

### Fixed

- **Job → Check Status** now accepts either a bare `job_id` or the full `pollUrl` returned by an async create op. Previously, expression-binding `$json.pollUrl` produced a 404 because the URL was concatenated onto the base path. Operation is now dispatched via `customOperations.job.checkStatus`.
- `createFromFile` enforces the 5 MB upload limit client-side with a clear `NodeOperationError` instead of letting the server reject the request silently.
- `Callback URL` field is validated to require `https://` before the request is sent.

### Changed (breaking)

- Internal parameter names standardized to camelCase: `target_audience` → `targetAudience`, `callback_url` → `callbackUrl`. The wire-format sent to the API is unchanged (still `target_audience` / `callback_url`). **Workflows saved on 0.1.0 that set these fields will need to re-enter the values after upgrade.**
- `Return Job ID Immediately` toggle is now available on all four create operations (Topic, Single Slide, Content, File), not just Create From Topic.

## [0.1.0] - 2026-05-29

Initial release.

### Added

- `PresentationsAi` node with two resources:
  - **Presentation**: Create From Topic, Create Single Slide, Create From Content, Create From File
  - **Job**: Check Status
- `PresentationsAiApi` credential (API key, configurable base URL, automatic test against `/api/v1/authenticate`)
- Preservation modes for content/file operations: enhance, summarize, preserve, instruction
- Async support via Callback URL or "Return Job ID Immediately" + `Job → Check Status` polling
- `usableAsTool: true` for use with n8n AI Agents

[0.3.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.3.0
[0.2.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.2.0
[0.1.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.1.0
