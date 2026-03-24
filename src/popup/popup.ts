/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Event listeners require callbacks */
import type { PopupToContentMessage, WorkflowConfig, WorkflowResult } from "#shared/messages.js";
import { getLocalStorage, getSyncStorage } from "#shared/storage.js";
import { OUTLOOK_ORIGINS } from "#shared/origins.js";
import { getElement } from "#shared/dom.js";
import { getErrorMessage } from "#shared/errors.js";

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

async function loadConfig(): Promise<
  { config: WorkflowConfig; valid: true } | { error: string; valid: false }
> {
  const [sync, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);

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

function isOutlookMailUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      OUTLOOK_ORIGINS.some((origin) => origin === parsed.origin) &&
      parsed.pathname.startsWith("/mail")
    );
  } catch {
    return false;
  }
}

async function checkOutlookTab(): Promise<chrome.tabs.Tab | undefined> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url !== undefined && isOutlookMailUrl(activeTab.url)) {
    return activeTab;
  }
  const outlookTabs = await chrome.tabs.query({
    url: OUTLOOK_ORIGINS.map((origin) => `${origin}/mail/*`),
  });
  return outlookTabs[0];
}

async function dispatchWorkflow(): Promise<void> {
  const runBtn = getElement<HTMLButtonElement>("run-btn");
  runBtn.disabled = true;

  try {
    const [tab, configResult] = await Promise.all([checkOutlookTab(), loadConfig()]);
    if (tab?.id === undefined) {
      showStatus("error", "Open Outlook Web mail first");
      return;
    }
    if (!configResult.valid) {
      showStatus("error", configResult.error);
      return;
    }

    showStatus("info", "Starting workflow...");
    setProgress(true, 0, "Initializing...");

    const result = await chrome.tabs.sendMessage<PopupToContentMessage, WorkflowResult>(tab.id, {
      config: configResult.config,
      type: "START_WORKFLOW",
    });

    setProgress(false);

    if (result.success) {
      showStatus("ready", result.message);
    } else {
      showStatus("error", result.message);
    }
  } catch (error) {
    setProgress(false);
    const message = getErrorMessage(error);
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

  const [tab, configResult] = await Promise.all([checkOutlookTab(), loadConfig()]);
  if (tab === undefined) {
    showStatus("warning", "Open Outlook Web to use this extension");
    return;
  }
  if (!configResult.valid) {
    showStatus("warning", `${configResult.error} - click Settings to configure`);
    return;
  }

  showStatus("ready", "Ready to process emails");
  runBtn.disabled = false;
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error: unknown) => {
    console.error("[OPM] Init error:", error);
    showStatus("error", getErrorMessage(error));
  });

  getElement<HTMLButtonElement>("run-btn").addEventListener("click", () => {
    dispatchWorkflow().catch((error: unknown) => {
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
