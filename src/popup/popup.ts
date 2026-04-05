import { getElement } from "#shared/dom.js";
import { getErrorMessage } from "#shared/errors.js";
/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks -- Event listeners require callbacks */
import {
  type PopupToContentMessage,
  type WorkflowConfig,
  type WorkflowResult,
} from "#shared/messages.js";
import { OUTLOOK_ORIGINS } from "#shared/origins.js";
import { getLocalStorage, getSyncStorage } from "#shared/storage.js";

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

async function findOutlookTab(): Promise<chrome.tabs.Tab | undefined> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.url !== undefined && isOutlookMailUrl(activeTab.url)) {
    return activeTab;
  }
  const outlookTabs = await chrome.tabs.query({
    url: OUTLOOK_ORIGINS.map((origin) => `${origin}/mail/*`),
  });
  return outlookTabs[0];
}

interface Prerequisites {
  readonly config: WorkflowConfig;
  readonly tabId: number;
}

async function validatePrerequisites(): Promise<
  { prereqs: Prerequisites; valid: true } | { error: string; valid: false }
> {
  const [tab, configResult] = await Promise.all([findOutlookTab(), loadConfig()]);
  if (tab?.id === undefined) {
    return { error: "Open Outlook Web mail first", valid: false };
  }
  if (!configResult.valid) {
    return { error: configResult.error, valid: false };
  }
  return { prereqs: { config: configResult.config, tabId: tab.id }, valid: true };
}

export async function dispatchWorkflow(): Promise<void> {
  const runBtn = getElement<HTMLButtonElement>("run-btn");
  runBtn.disabled = true;

  try {
    const validation = await validatePrerequisites();
    if (!validation.valid) {
      showStatus("error", validation.error);
      return;
    }
    const { prereqs } = validation;

    showStatus("info", "Starting workflow...");
    setProgress(true, 0, "Initializing...");

    const result = await chrome.tabs.sendMessage<PopupToContentMessage, WorkflowResult>(
      prereqs.tabId,
      {
        config: prereqs.config,
        type: "START_WORKFLOW",
      },
    );

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

  const validation = await validatePrerequisites();
  if (!validation.valid) {
    showStatus("warning", `${validation.error} - click Settings to configure`);
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
      showStatus("error", getErrorMessage(error));
    });
  });
  getElement<HTMLAnchorElement>("settings-link").addEventListener("click", (event: MouseEvent) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage().catch((error: unknown) => {
      console.error("[OPM] Options page error:", error);
      showStatus("error", getErrorMessage(error));
    });
  });
});
