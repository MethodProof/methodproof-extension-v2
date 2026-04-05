# Chrome Web Store Listing

## Short Description (132 chars max)

Capture your engineering process — browser telemetry for MethodProof sessions. Metadata only, never content.

## Full Description

MethodProof captures how engineers work — not what they type. This extension adds browser telemetry to your MethodProof sessions, recording navigation patterns, tool usage, and research workflow as part of your engineering process graph.

**Only active during sessions.** The extension is dormant until you start a MethodProof session. No background tracking, no passive data collection.

**Metadata only.** We record that you searched — not what you searched for. We record that you copied text — not the text itself. We record which AI tool you used — not the conversation. Sensitive domains (banking, email, health) are automatically redacted.

**What it captures during a session:**
- Page visits (URL + title, with sensitive domains redacted)
- Tab switches (domain categories: docs, code host, AI chat, etc.)
- Copy events (character count only)
- Search activity (engine + query length, no query text)
- AI tool usage (platform name only)

**Privacy by design:**
- All data encrypted in transit (HTTPS)
- Optional end-to-end encryption (your org holds the key)
- Communicates only with methodproof.com — no third parties
- Open source: github.com/MethodProof/methodproof-extension

**Part of the MethodProof platform:**
MethodProof is an engineering process intelligence platform. Engineers capture how they work, share sessions publicly, and build a visible track record. Reviewers see process graphs, narrated timelines, and behavioral patterns. Learn more at methodproof.com.

## Category

Developer Tools

## Language

English

## Privacy Practices (Chrome Web Store disclosure)

### Single Purpose Description
Captures browser navigation metadata during MethodProof engineering sessions for process analysis and review.

### Permission Justifications

| Permission | Justification |
|-----------|---------------|
| webNavigation | Detect page loads to record which sites are visited during a session |
| tabs | Read current tab URL and title for visit and tab-switch telemetry |
| storage | Store active session state and buffer events before server flush |
| alarms | Schedule periodic event flush (every 10 seconds during sessions) |
| activeTab | Access current tab info when user opens the extension popup |
| Host permission: <all_urls> | Content script runs on all pages to detect copy events, search queries, and AI platform usage. No DOM content is read or modified. |

### Data Use Disclosure

**Personally identifiable information:** Not collected
**Health information:** Not collected
**Financial information:** Not collected
**Authentication information:** Not collected (session tokens come from the platform, not from user input in the extension)
**Personal communications:** Not collected
**Location:** Not collected
**Web history:** Collected — URLs visited during active sessions only (sensitive domains redacted to domain-only)
**User activity:** Collected — tab switches, copy event counts, search metadata, AI tool usage (platform name only)

**Certifications:**
- Data is not sold to third parties
- Data is not used for purposes unrelated to the extension's core functionality
- Data is not used for creditworthiness or lending purposes
