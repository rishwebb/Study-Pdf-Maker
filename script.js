const imageInput = document.getElementById("imageInput");
const directText = document.getElementById("directText");
const detectedText = document.getElementById("detectedText");
const promptOutput = document.getElementById("promptOutput");
const aiResponse = document.getElementById("aiResponse");
const saveResponseBtn = document.getElementById("saveResponseBtn");
const savedResponsesList = document.getElementById("savedResponsesList");
const menuToggleBtn = document.getElementById("menuToggleBtn");
const menuDropdown = document.getElementById("menuDropdown");
const resetAllBtn = document.getElementById("resetAllBtn");
const ocrLoader = document.getElementById("ocrLoader");
const copyNotice = document.getElementById("copyNotice");
const generatePromptBtn = document.getElementById("generatePromptBtn");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const openChatGptBtn = document.getElementById("openChatGptBtn");
const generatePdfBtn = document.getElementById("generatePdfBtn");

const PROMPT_TEMPLATE = `Explain the following study material in a very detailed, structured, and easy-to-understand way.

If the content contains multiple pages, read all pages together as one continuous topic before answering.
Do not explain each page separately unless the content clearly requires it.
If OCR includes duplicate fragments or small scanning errors, ignore them and keep the explanation coherent.
Write the answer in Canvas.
Make the answer more detailed by fully explaining concepts, definitions, processes, and important points without skipping intermediate steps.

Structure the response with clear headings:
Introduction
Detailed Explanation
Examples
Key Points
Conclusion

Formatting rules:
Use plain readable text only.
Do not use markdown symbols such as #, *, **, or backticks.
Do not use emojis or unusual characters.
Use clean headings and paragraphs suitable for PDF.
Use longer, richer explanations in each section so the material is useful for deep study and revision.

Study material:
{{TOPIC_TEXT}}`;

let noticeTimeoutId;
const DEFAULT_LOADER_TEXT = "Scanning uploaded pages and extracting text...";
const APP_STATE_STORAGE_KEY = "explainToPdfStateV1";
const savedResponses = [];
let editingResponseIndex = null;
let isOpeningChatGpt = false;

function showLoader(isVisible, message = DEFAULT_LOADER_TEXT) {
  ocrLoader.textContent = message;
  ocrLoader.classList.toggle("hidden", !isVisible);
}

function showCopyNotice() {
  copyNotice.classList.remove("hidden");

  if (noticeTimeoutId) {
    clearTimeout(noticeTimeoutId);
  }

  noticeTimeoutId = setTimeout(() => {
    copyNotice.classList.add("hidden");
  }, 2000);
}

function saveAppState() {
  const appState = {
    directText: directText.value,
    detectedText: detectedText.value,
    promptOutput: promptOutput.value,
    aiResponse: aiResponse.value,
    savedResponses
  };

  try {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(appState));
  } catch (error) {
    console.error("Could not save app state.", error);
  }
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(APP_STATE_STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    directText.value = typeof parsed.directText === "string" ? parsed.directText : "";
    detectedText.value = typeof parsed.detectedText === "string" ? parsed.detectedText : "";
    promptOutput.value = typeof parsed.promptOutput === "string" ? parsed.promptOutput : "";
    aiResponse.value = typeof parsed.aiResponse === "string" ? parsed.aiResponse : "";

    const storedResponses = Array.isArray(parsed.savedResponses)
      ? parsed.savedResponses.filter((item) => typeof item === "string" && item.trim().length > 0)
      : [];

    savedResponses.splice(0, savedResponses.length, ...storedResponses);
  } catch (error) {
    console.error("Could not load app state.", error);
  }
}

function updateDetectedFromDirectText() {
  detectedText.value = directText.value;
  saveAppState();
}

function buildCombinedOcrText(pageTexts) {
  if (pageTexts.length === 1) {
    return pageTexts[0].text;
  }

  return pageTexts
    .map(({ pageNumber, text }) => `Page ${pageNumber}\n${text}`)
    .join("\n\n");
}

async function extractTextFromImages(files) {
  const selectedFiles = Array.from(files);

  if (selectedFiles.length === 0) {
    return;
  }

  showLoader(true);

  try {
    const pageTexts = [];

    for (const [index, file] of selectedFiles.entries()) {
      const pageNumber = index + 1;
      const loadingMessage =
        selectedFiles.length === 1
          ? "Scanning uploaded page and extracting text..."
          : `Scanning page ${pageNumber} of ${selectedFiles.length} and extracting text...`;

      showLoader(true, loadingMessage);

      const {
        data: { text }
      } = await Tesseract.recognize(file, "eng", {
        logger: () => {}
      });

      const trimmedText = text.trim();

      if (trimmedText) {
        pageTexts.push({
          pageNumber,
          text: trimmedText
        });
      }
    }

    if (pageTexts.length === 0) {
      alert("No readable text was found in the selected image files.");
      detectedText.value = "";
      saveAppState();
      return;
    }

    detectedText.value = buildCombinedOcrText(pageTexts);
    directText.value = "";
    saveAppState();
  } catch (error) {
    alert("OCR failed. Please try different image files or paste text manually.");
    console.error(error);
  } finally {
    showLoader(false);
  }
}

function generatePrompt() {
  const topicText = detectedText.value.trim();

  if (!topicText) {
    alert("Please upload an image or paste text first.");
    return;
  }

  promptOutput.value = PROMPT_TEMPLATE.replace("{{TOPIC_TEXT}}", topicText);
  saveAppState();
}

async function copyPrompt() {
  const promptText = promptOutput.value.trim();

  if (!promptText) {
    alert("Generate a prompt first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(promptText);
    showCopyNotice();
  } catch (error) {
    alert("Could not copy prompt automatically. Please copy it manually.");
    console.error(error);
  }
}

function openChatGPT() {
  if (isOpeningChatGpt) {
    return;
  }

  isOpeningChatGpt = true;
  window.location.assign("https://chatgpt.com");

  setTimeout(() => {
    isOpeningChatGpt = false;
  }, 1500);
}

function closeMenu() {
  menuDropdown.classList.add("hidden");
  menuToggleBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const isHidden = menuDropdown.classList.contains("hidden");
  menuDropdown.classList.toggle("hidden", !isHidden);
  menuToggleBtn.setAttribute("aria-expanded", String(isHidden));
}

function setEditingMode(index) {
  editingResponseIndex = Number.isInteger(index) ? index : null;
  saveResponseBtn.textContent = editingResponseIndex === null ? "Save Response" : "Update Response";
}

function getIconSvg(type) {
  if (type === "up") {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-.32 0-.63.13-.85.35L3.35 10.15a1.2 1.2 0 0 0 .85 2.05H8.5V20a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2v-7.8h4.3a1.2 1.2 0 0 0 .85-2.05l-7.8-7.8A1.2 1.2 0 0 0 12 2Z"/></svg>';
  }

  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 2a2 2 0 0 0-2 2v7.8H4.2a1.2 1.2 0 0 0-.85 2.05l7.8 7.8a1.2 1.2 0 0 0 1.7 0l7.8-7.8a1.2 1.2 0 0 0-.85-2.05h-4.3V4a2 2 0 0 0-2-2h-3Z"/></svg>';
}

function renderSavedResponses() {
  if (savedResponses.length === 0) {
    savedResponsesList.innerHTML = "";
    return;
  }

  savedResponsesList.innerHTML = savedResponses
    .map((response, index) => {
      const escapedText = response
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");

      return `
        <div class="saved-response-item">
          <div class="saved-response-text" title="${escapedText}">${escapedText}</div>
          <div class="saved-response-controls">
            <button class="btn icon-btn" data-action="up" data-index="${index}" title="Move up" ${index === 0 ? "disabled" : ""}>${getIconSvg("up")}</button>
            <button class="btn icon-btn" data-action="down" data-index="${index}" title="Move down" ${index === savedResponses.length - 1 ? "disabled" : ""}>${getIconSvg("down")}</button>
            <button class="btn icon-btn" data-action="edit" data-index="${index}" title="Edit">&#9998;</button>
            <button class="btn icon-btn" data-action="delete" data-index="${index}" title="Delete">&#10005;</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function saveResponse() {
  const responseText = aiResponse.value.trim();

  if (!responseText) {
    alert("Please paste a response first before saving.");
    return;
  }

  if (editingResponseIndex === null) {
    savedResponses.push(responseText);
  } else {
    savedResponses[editingResponseIndex] = responseText;
  }

  directText.value = "";
  detectedText.value = "";
  promptOutput.value = "";
  imageInput.value = "";
  aiResponse.value = "";
  setEditingMode(null);
  renderSavedResponses();
  saveAppState();
}

function handleSavedResponseAction(event) {
  const actionButton = event.target.closest("button[data-action]");

  if (!actionButton) {
    return;
  }

  const index = Number(actionButton.dataset.index);
  const action = actionButton.dataset.action;

  if (!Number.isInteger(index) || index < 0 || index >= savedResponses.length) {
    return;
  }

  if (action === "edit") {
    aiResponse.value = savedResponses[index];
    aiResponse.focus();
    setEditingMode(index);
    saveAppState();
    return;
  }

  if (action === "delete") {
    savedResponses.splice(index, 1);

    if (editingResponseIndex === index) {
      setEditingMode(null);
    } else if (editingResponseIndex !== null && index < editingResponseIndex) {
      setEditingMode(editingResponseIndex - 1);
    }

    renderSavedResponses();
    saveAppState();
    return;
  }

  if (action === "up" && index > 0) {
    [savedResponses[index - 1], savedResponses[index]] = [savedResponses[index], savedResponses[index - 1]];

    if (editingResponseIndex === index) {
      setEditingMode(index - 1);
    } else if (editingResponseIndex === index - 1) {
      setEditingMode(index);
    }

    renderSavedResponses();
    saveAppState();
    return;
  }

  if (action === "down" && index < savedResponses.length - 1) {
    [savedResponses[index], savedResponses[index + 1]] = [savedResponses[index + 1], savedResponses[index]];

    if (editingResponseIndex === index) {
      setEditingMode(index + 1);
    } else if (editingResponseIndex === index + 1) {
      setEditingMode(index);
    }

    renderSavedResponses();
    saveAppState();
  }
}

function resetAllData() {
  const shouldReset = window.confirm("Do you want to delete all saved data and reset the app?");

  if (!shouldReset) {
    return;
  }

  directText.value = "";
  detectedText.value = "";
  promptOutput.value = "";
  aiResponse.value = "";
  imageInput.value = "";
  savedResponses.splice(0, savedResponses.length);

  setEditingMode(null);
  renderSavedResponses();

  try {
    localStorage.removeItem(APP_STATE_STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear app state.", error);
  }

  closeMenu();
}

function normalizeLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function sanitizePdfLine(line) {
  let cleaned = line;

  cleaned = cleaned.replace(/^\s{0,3}#{1,6}\s*/g, "");
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");
  cleaned = cleaned.replace(/`(.*?)`/g, "$1");
  cleaned = cleaned.replace(/^\s*[-*]\s+/g, "");
  cleaned = cleaned.replace(/\s+/g, " ");

  cleaned = cleaned
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");

  return cleaned.trim();
}

function isSectionHeading(line) {
  const normalized = line.toLowerCase().replace(/:$/, "");
  const headings = ["introduction", "detailed explanation", "examples", "key points", "conclusion"];
  return headings.includes(normalized);
}

function generatePdf() {
  const currentResponseText = aiResponse.value.trim();
  const responseText = savedResponses.length > 0 ? savedResponses.join("\n\n") : currentResponseText;

  if (!responseText) {
    alert("Please paste a response, or save at least one response, before generating the PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  let y = 60;

  const ensurePageSpace = (requiredHeight = 16) => {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Explained Topic", margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, y);
  y += 22;

  const lines = normalizeLines(responseText)
    .map((line) => sanitizePdfLine(line))
    .filter((line) => line.length > 0);

  lines.forEach((line) => {
    const heading = isSectionHeading(line);

    if (heading) {
      y += 8;
      ensurePageSpace(24);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);

      const headingText = line.endsWith(":") ? line : `${line}:`;
      doc.text(headingText, margin, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      return;
    }

    const wrapped = doc.splitTextToSize(line, contentWidth);

    wrapped.forEach((segment) => {
      ensurePageSpace(16);
      doc.text(segment, margin, y);
      y += 16;
    });

    y += 4;
  });

  doc.save("explained_topic.pdf");
}

loadAppState();
setEditingMode(null);
renderSavedResponses();

imageInput.addEventListener("change", (event) => {
  const files = event.target.files;

  if (!files?.length) {
    return;
  }

  extractTextFromImages(files);
});

directText.addEventListener("input", updateDetectedFromDirectText);
detectedText.addEventListener("input", saveAppState);
promptOutput.addEventListener("input", saveAppState);
aiResponse.addEventListener("input", saveAppState);
generatePromptBtn.addEventListener("click", generatePrompt);
copyPromptBtn.addEventListener("click", copyPrompt);
openChatGptBtn.addEventListener("click", openChatGPT);
saveResponseBtn.addEventListener("click", saveResponse);
savedResponsesList.addEventListener("click", handleSavedResponseAction);
generatePdfBtn.addEventListener("click", generatePdf);
menuToggleBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMenu();
});
resetAllBtn.addEventListener("click", resetAllData);
document.addEventListener("click", (event) => {
  if (!event.target.closest(".top-menu")) {
    closeMenu();
  }
});
