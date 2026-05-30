# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.2.0
[0.1.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.1.0
