/** MethodProof popup — session status and controls */

async function render(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "get_session" })) as {
    active?: boolean;
    session_id?: string;
    pending_count?: number;
  };

  const statusEl = document.getElementById("status") as HTMLDivElement;
  const sessionIdEl = document.getElementById("session-id") as HTMLDivElement;
  const captureInfo = document.getElementById("capture-info") as HTMLDivElement;
  const pendingEl = document.getElementById("pending") as HTMLDivElement;
  const syncBtn = document.getElementById("sync-now") as HTMLButtonElement;
  const endBtn = document.getElementById("end-session") as HTMLButtonElement;

  if (response?.active) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";
    sessionIdEl.textContent = `Session: ${response.session_id}`;
    captureInfo.style.display = "block";
    syncBtn.style.display = "block";
    endBtn.style.display = "block";

    const count = response.pending_count ?? 0;
    pendingEl.textContent = count > 0 ? `${count} event${count === 1 ? "" : "s"} pending` : "All synced";
    pendingEl.style.display = "block";
  } else {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status disconnected";
    sessionIdEl.textContent = "";
    captureInfo.style.display = "none";
    pendingEl.style.display = "none";
    syncBtn.style.display = "none";
    endBtn.style.display = "none";
  }
}

document.getElementById("sync-now")?.addEventListener("click", async () => {
  const btn = document.getElementById("sync-now") as HTMLButtonElement;
  btn.textContent = "Syncing...";
  btn.disabled = true;
  await chrome.runtime.sendMessage({ type: "flush" });
  await render();
  btn.disabled = false;
  btn.textContent = "Sync Now";
});

document.getElementById("end-session")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "deactivate" });
  await render();
});

render();
