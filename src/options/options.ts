import { getElement } from "#shared/dom.js";
import { getErrorMessage } from "#shared/errors.js";
import { getSignatureFormat } from "#shared/pdf.js";
/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks, promise/avoid-new, promise/always-return, unicorn/prefer-add-event-listener */
import {
  getLocalStorage,
  getSyncStorage,
  setLocalStorage,
  setSyncStorage,
} from "#shared/storage.js";

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error("File read error"));
    };
    reader.readAsDataURL(file);
  });
}

async function loadSettings(): Promise<void> {
  const [sync, local] = await Promise.all([getSyncStorage(), getLocalStorage()]);

  getElement<HTMLInputElement>("myEmail").value = sync.myEmail;
  getElement<HTMLTextAreaElement>("replyMessage").value = sync.replyMessage;
  getElement<HTMLInputElement>("sigX").value = String(sync.signaturePosition.x);
  getElement<HTMLInputElement>("sigY").value = String(sync.signaturePosition.y);
  getElement<HTMLInputElement>("sigWidth").value = String(sync.signaturePosition.width);
  getElement<HTMLInputElement>("sigHeight").value = String(sync.signaturePosition.height);

  // eslint-disable-next-line unicorn/no-null -- Chrome storage API returns null
  if (local.signatureImage !== null) {
    const preview = getElement<HTMLImageElement>("signaturePreview");
    preview.src = `data:image/${local.signatureImage.format};base64,${local.signatureImage.data}`;
    preview.classList.remove("hidden");
  }
}

function showStatus(type: "error" | "success", message: string): void {
  const status = getElement<HTMLDivElement>("status");
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.remove("hidden");
  setTimeout(() => {
    status.classList.add("hidden");
  }, 3000);
}

async function storeSignatureFile(file: File): Promise<void> {
  const format = getSignatureFormat(file.name);
  const dataUrl = await readFileAsDataURL(file);
  const [, base64] = dataUrl.split(",");

  if (base64 === undefined) {
    throw new Error("Failed to parse data URL");
  }

  await setLocalStorage({
    signatureImage: {
      data: base64,
      format,
      name: file.name,
      uploadedAt: Date.now(),
    },
  });

  const preview = getElement<HTMLImageElement>("signaturePreview");
  preview.src = dataUrl;
  preview.classList.remove("hidden");
}

function getInputInt(id: string, fallback: number): number {
  const value = Number.parseInt(getElement<HTMLInputElement>(id).value, 10);
  return Number.isNaN(value) ? fallback : value;
}

export async function saveSettings(): Promise<void> {
  const saveBtn = getElement<HTMLButtonElement>("save");
  saveBtn.disabled = true;

  try {
    await setSyncStorage({
      myEmail: getElement<HTMLInputElement>("myEmail").value.trim(),
      replyMessage: getElement<HTMLTextAreaElement>("replyMessage").value || "Hello, Ok pour moi.",
      signaturePosition: {
        height: getInputInt("sigHeight", 50),
        width: getInputInt("sigWidth", 150),
        x: getInputInt("sigX", 120),
        y: getInputInt("sigY", 130),
      },
    });

    showStatus("success", "Settings saved!");
  } catch (error) {
    showStatus("error", `Failed to save: ${getErrorMessage(error)}`);
  } finally {
    saveBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch((error: unknown) => {
    console.error("[OPM] Load settings error:", error);
    showStatus("error", getErrorMessage(error));
  });

  getElement<HTMLButtonElement>("save").addEventListener("click", () => {
    saveSettings().catch((error: unknown) => {
      console.error("[OPM] Save settings error:", error);
    });
  });

  const fileInput = getElement<HTMLInputElement>("signatureFile");
  const chooseBtn = getElement<HTMLButtonElement>("chooseFileBtn");
  const fileNameSpan = getElement("fileName");

  chooseBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file !== undefined) {
      fileNameSpan.textContent = file.name;
      storeSignatureFile(file)
        .then(() => {
          showStatus("success", "Signature uploaded!");
        })
        .catch((error: unknown) => {
          showStatus("error", `Upload failed: ${getErrorMessage(error)}`);
        });
    }
  });
});
