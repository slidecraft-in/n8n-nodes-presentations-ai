# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/slidecraft-in/n8n-nodes-presentations-ai/releases/tag/0.1.0
