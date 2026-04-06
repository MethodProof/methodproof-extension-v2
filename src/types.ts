/** Session state stored in chrome.storage.session */
export interface SessionState {
  session_id: string;
  token: string;
  api_base: string;
  clock_offset_ms: number;
  active: boolean;
  e2e_key?: string;
  e2e_fingerprint?: string;
}

/** Browser telemetry event — field names match platform TelemetryEvent schema */
export interface BrowserEvent {
  id: string;
  type: string;
  timestamp: string;
  session_id: string;
  metadata: Record<string, unknown>;
}

/** Messages between content script, popup, and background */
export type ExtensionMessage =
  | { type: "activate"; session_id: string; token: string; api_base: string; e2e_key?: string }
  | { type: "deactivate" }
  | { type: "content_event"; event_type: string; data: Record<string, unknown> }
  | { type: "get_session" }
  | { type: "check_bridge" }
  | { type: "flush" };
