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

  syncBtn.style.display = "block";

  if (response?.active) {
    statusEl.innerHTML = '<span class="status-dot"></span>Connected';
    statusEl.className = "status connected";
    sessionIdEl.textContent = `Session: ${response.session_id}`;
    captureInfo.style.display = "block";
    endBtn.style.display = "block";
    syncBtn.textContent = "Sync Now";

    const count = response.pending_count ?? 0;
    pendingEl.textContent = count > 0 ? `${count} event${count === 1 ? "" : "s"} pending` : "All synced";
    pendingEl.style.display = "block";
  } else {
    statusEl.innerHTML = '<span class="status-dot"></span>Disconnected';
    statusEl.className = "status disconnected";
    sessionIdEl.textContent = "";
    captureInfo.style.display = "none";
    pendingEl.style.display = "none";
    endBtn.style.display = "none";
    syncBtn.textContent = "Connect";
  }
}

document.getElementById("sync-now")?.addEventListener("click", async () => {
  const btn = document.getElementById("sync-now") as HTMLButtonElement;
  const session = (await chrome.runtime.sendMessage({ type: "get_session" })) as { active?: boolean };
  btn.disabled = true;

  if (session?.active) {
    btn.textContent = "Syncing...";
    await chrome.runtime.sendMessage({ type: "flush" });
  } else {
    btn.textContent = "Connecting...";
    await chrome.runtime.sendMessage({ type: "check_bridge" });
    await new Promise((r) => setTimeout(r, 2000));
  }

  await render();
  btn.disabled = false;
});

document.getElementById("end-session")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "deactivate" });
  await render();
});

render();
