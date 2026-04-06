# Changelog

## [0.1.1] — 2026-04-06

### Fixed
- Event schema mismatch: `event_id`/`data` renamed to `id`/`metadata` to match platform `TelemetryEvent` model (was causing 422 rejection on every flush)
- Added missing required metadata fields for `browser_copy`, `browser_search`, `browser_ai_chat`, `browser_visit` events
- Telemetry flush now parses response body — logs partial rejections and HTTP error detail instead of status code alone

### Changed
- Popup redesigned with circuit-node brand art, status dot indicator, and press-effect buttons
- Sync Now button relabeled to "Connect" when disconnected; triggers bridge discovery instead of flush

## [0.1.0] — 2026-04-04

### Added
- Chrome Web Store submission: manifest icons, store description, privacy policy URL
- Auto-discovery: background polls `localhost:9877` for CLI bridge sessions
- Fast discovery via `setInterval(3s)` + `webNavigation` trigger + content script wake-up
- Disconnection detection: auto-deactivates when bridge goes away, auto-reconnects on new session
- CLI pairing: content script reads credentials from bridge pairing page
- `host_permissions` for `127.0.0.1:9877` and `localhost:9877`
- `check_bridge` message type for content script → background wake-up
- CI/CD: `publish.yml` auto-publishes to Chrome Web Store on `v*` tags
- `npm run zip` script for manual store upload
- `STORE_LISTING.md` — full store description, privacy disclosures, permission justifications
- `PUBLISHING.md` — step-by-step Chrome Web Store submission guide

## [0.0.9] — 2026-04-03

### Added
- Search efficiency metrics (query length, word count, result tracking)
- Scroll depth and time-on-page tracking for documentation sites
- Copilot Chat and Cursor interaction pattern observers
- Documentation site detection (MDN, React, Node.js, Python, etc.)
- Claude interaction patterns observer
- ChatGPT interaction patterns observer
- AI usage module registration with toggle and dynamic script loading

## [0.0.5] — 2026-03-30

### Added
- Music playback detection via page title parsing
- E2E encryption support (company-held keys)
- Data minimization (copy = length only, search = word count only, AI = platform only)
- Local bridge fallback — send events to CLI when running locally
- CI workflow — lint, typecheck, test, build

## [0.0.1] — 2026-03-27

### Added
- Initial extension
- Browser visit tracking with URL redaction (sensitive domains → domain-only)
- Tab switch tracking with domain categorization
- Copy event detection (character count only, no content)
- Search query detection (engine + length, no query text)
- AI chat platform detection (ChatGPT, Claude, Perplexity)
- Session binding via `chrome.runtime.onMessageExternal`
- Event buffering with retry backoff
- Clock sync with platform API
- Popup UI showing session status
