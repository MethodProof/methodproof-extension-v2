/** MethodProof popup — session status and controls */

async function render(): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: "get_session" })) as {
    active?: boolean;
    session_id?: string;
  };

  const statusEl = document.getElementById("status") as HTMLDivElement;
  const sessionIdEl = document.getElementById("session-id") as HTMLDivElement;
  const captureInfo = document.getElementById("capture-info") as HTMLDivElement;
  const endBtn = document.getElementById("end-session") as HTMLButtonElement;

  if (response?.active) {
    statusEl.textContent = "Connected";
    statusEl.className = "status connected";
    sessionIdEl.textContent = `Session: ${response.session_id}`;
    captureInfo.style.display = "block";
    endBtn.style.display = "block";
  } else {
    statusEl.textContent = "Disconnected";
    statusEl.className = "status disconnected";
    sessionIdEl.textContent = "";
    captureInfo.style.display = "none";
    endBtn.style.display = "none";
  }
}

document.getElementById("end-session")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "deactivate" });
  await render();
});

render();
