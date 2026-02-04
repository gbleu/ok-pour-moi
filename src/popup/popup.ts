/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Event listeners require callbacks */
import type { WorkflowConfig, WorkflowResult } from "#shared/messages.js";
import { getLocalStorage, getSyncStorage } from "#shared/storage.js";
import { getElement } from "#shared/dom.js";

function showStatus(type: "error" | "info" | "ready" | "warning", message: string): void {
  const status = getElement<HTMLDivElement>("status");
  status.textContent = message;
  status.className = `status ${type}`;
}

function setProgress(show: boolean, value = 0, text = ""): void {
  const progress = getElement<HTMLDivElement>("progress");
  progress.classList.toggle("hidden", !show);
  if (show) {
    getElement<HTMLProgressElement>("progress-bar").value = value;
    getElement<HTMLDivElement>("progress-text").textContent = text;
  }
}

async function checkConfig(): Promise<{ config?: WorkflowConfig; error?: string; valid: boolean }> {
  const sync = await getSyncStorage();
  const local = await getLocalStorage();

  if (sync.myEmail === "") {
    return { error: "Email not configured", valid: false };
  }
  if (sync.replyMessage === "") {
    return { error: "Reply message not configured", valid: false };
  }
  // eslint-disable-next-line unicorn/no-null -- Chrome storage API returns null
  if (local.signatureImage === null) {
    return { error: "Signature image not uploaded", valid: false };
  }

  return {
    config: {
      myEmail: sync.myEmail,
      replyMessage: sync.replyMessage,
      signaturePosition: sync.signaturePosition,
    },
    valid: true,
  };
}

async function checkOutlookTab(): Promise<chrome.tabs.Tab | undefined> {
  // First try active tab in current window
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    activeTab?.url !== undefined &&
    /outlook\.(office365|office|live)\.com\/mail|outlook\.cloud\.microsoft\/mail/.test(
      activeTab.url,
    )
  ) {
    return activeTab;
  }
  // Fallback: find any Outlook tab (useful when popup is opened as a page)
  const outlookTabs = await chrome.tabs.query({
    url: [
      "*://outlook.office365.com/mail/*",
      "*://outlook.office.com/mail/*",
      "*://outlook.live.com/mail/*",
      "*://outlook.cloud.microsoft/mail/*",
    ],
  });
  return outlookTabs[0];
}

async function runWorkflow(): Promise<void> {
  const runBtn = getElement<HTMLButtonElement>("run-btn");
  runBtn.disabled = true;

  try {
    const tab = await checkOutlookTab();
    if (tab?.id === undefined) {
      showStatus("error", "Open Outlook Web mail first");
      return;
    }

    const { valid, config, error } = await checkConfig();
    if (!valid || config === undefined) {
      showStatus("error", error ?? "Invalid configuration");
      return;
    }

    showStatus("info", "Starting workflow...");
    setProgress(true, 0, "Initializing...");

    const result = await chrome.tabs.sendMessage<
      { config: WorkflowConfig; type: "START_WORKFLOW" },
      WorkflowResult
    >(tab.id, { config, type: "START_WORKFLOW" });

    setProgress(false);

    if (result.success) {
      showStatus("ready", result.message);
    } else {
      showStatus("error", result.message);
    }
  } catch (error) {
    setProgress(false);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Receiving end does not exist")) {
      showStatus("error", "Refresh Outlook page and try again");
    } else {
      showStatus("error", message);
    }
  } finally {
    runBtn.disabled = false;
  }
}

async function init(): Promise<void> {
  const runBtn = getElement<HTMLButtonElement>("run-btn");

  const tab = await checkOutlookTab();
  if (tab === undefined) {
    showStatus("warning", "Open Outlook Web to use this extension");
    return;
  }

  const { valid, error } = await checkConfig();
  if (!valid) {
    showStatus("warning", `${error} - click Settings to configure`);
    return;
  }

  showStatus("ready", "Ready to process emails");
  runBtn.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error: unknown) => {
    console.error("[OPM] Init error:", error);
  });

  getElement<HTMLButtonElement>("run-btn").addEventListener("click", () => {
    runWorkflow().catch((error: unknown) => {
      console.error("[OPM] Workflow error:", error);
    });
  });
  getElement<HTMLAnchorElement>("settings-link").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage().catch((error: unknown) => {
      console.error("[OPM] Options page error:", error);
    });
  });
});
