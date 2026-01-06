/* eslint-disable promise/prefer-await-to-then, promise/prefer-await-to-callbacks, promise/avoid-new, promise/always-return, prefer-destructuring, unicorn/prefer-add-event-listener */
import {
  getLocalStorage,
  getSyncStorage,
  setLocalStorage,
  setSyncStorage,
} from "../shared/storage.js";
import { getElement } from "../shared/dom.js";
import { getSignatureFormat } from "../shared/pdf.js";

async function loadSettings(): Promise<void> {
  const sync = await getSyncStorage();
  const local = await getLocalStorage();

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

async function handleSignatureUpload(file: File): Promise<void> {
  const format = getSignatureFormat(file.name);

  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      (async (): Promise<void> => {
        const { result } = reader;
        if (typeof result !== "string") {
          reject(new Error("Failed to read file"));
          return;
        }
        const base64 = result.split(",")[1];
        if (base64 === undefined) {
          reject(new Error("Failed to read file"));
          return;
        }

        try {
          await setLocalStorage({
            signatureImage: {
              data: base64,
              format,
              name: file.name,
              uploadedAt: Date.now(),
            },
          });
          const preview = getElement<HTMLImageElement>("signaturePreview");
          preview.src = result;
          preview.classList.remove("hidden");
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error("Unknown error"));
        }
      })().catch(reject);
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error("File read error"));
    };
    reader.readAsDataURL(file);
  });
}

async function saveSettings(): Promise<void> {
  const saveBtn = getElement<HTMLButtonElement>("save");
  saveBtn.disabled = true;

  try {
    await setSyncStorage({
      myEmail: getElement<HTMLInputElement>("myEmail").value.trim(),
      replyMessage: getElement<HTMLTextAreaElement>("replyMessage").value || "Hello, Ok pour moi.",
      signaturePosition: {
        height: Number.parseInt(getElement<HTMLInputElement>("sigHeight").value, 10) || 50,
        width: Number.parseInt(getElement<HTMLInputElement>("sigWidth").value, 10) || 150,
        x: Number.parseInt(getElement<HTMLInputElement>("sigX").value, 10) || 120,
        y: Number.parseInt(getElement<HTMLInputElement>("sigY").value, 10) || 130,
      },
    });

    const fileInput = getElement<HTMLInputElement>("signatureFile");
    if (fileInput.files?.[0] !== undefined) {
      await handleSignatureUpload(fileInput.files[0]);
    }

    showStatus("success", "Settings saved!");
  } catch (error) {
    showStatus(
      "error",
      `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  } finally {
    saveBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch((error: unknown) => {
    console.error("[OPM] Load settings error:", error);
  });

  getElement<HTMLButtonElement>("save").addEventListener("click", () => {
    saveSettings().catch((error: unknown) => {
      console.error("[OPM] Save settings error:", error);
    });
  });

  const fileInput = getElement<HTMLInputElement>("signatureFile");
  const chooseBtn = getElement<HTMLButtonElement>("chooseFileBtn");
  const fileNameSpan = getElement<HTMLSpanElement>("fileName");

  chooseBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file !== undefined) {
      fileNameSpan.textContent = file.name;
      handleSignatureUpload(file)
        .then(() => {
          showStatus("success", "Signature uploaded!");
        })
        .catch((error: unknown) => {
          showStatus(
            "error",
            `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        });
    }
  });
});
