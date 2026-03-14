const imageInput = document.getElementById("imageInput");
const directText = document.getElementById("directText");
const detectedText = document.getElementById("detectedText");
const promptOutput = document.getElementById("promptOutput");
const aiResponse = document.getElementById("aiResponse");
const ocrLoader = document.getElementById("ocrLoader");
const copyNotice = document.getElementById("copyNotice");
const generatePromptBtn = document.getElementById("generatePromptBtn");
const copyPromptBtn = document.getElementById("copyPromptBtn");
const openChatGptBtn = document.getElementById("openChatGptBtn");
const generatePdfBtn = document.getElementById("generatePdfBtn");

// Prompt skeleton used for ChatGPT.
const PROMPT_TEMPLATE = `Explain the following topic in a detailed and structured way.

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

Topic:
{{TOPIC_TEXT}}`;

let noticeTimeoutId;

// UI helpers.
function showLoader(isVisible) {
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

function updateDetectedFromDirectText() {
  detectedText.value = directText.value;
}

// OCR: extract topic text from uploaded image in-browser.
async function extractTextFromImage(file) {
  showLoader(true);

  try {
    const {
      data: { text }
    } = await Tesseract.recognize(file, "eng", {
      logger: () => {}
    });

    detectedText.value = text.trim();
    directText.value = "";
  } catch (error) {
    alert("OCR failed. Please try a different image or paste text manually.");
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
}

// Copy generated prompt for quick paste into ChatGPT.
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
  window.open("https://chatgpt.com", "_blank", "noopener,noreferrer");
}

// PDF formatting helpers.
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
  const responseText = aiResponse.value.trim();

  if (!responseText) {
    alert("Please paste the ChatGPT response before generating the PDF.");
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

// Event wiring.
imageInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    return;
  }

  extractTextFromImage(file);
});

directText.addEventListener("input", updateDetectedFromDirectText);
generatePromptBtn.addEventListener("click", generatePrompt);
copyPromptBtn.addEventListener("click", copyPrompt);
openChatGptBtn.addEventListener("click", openChatGPT);
generatePdfBtn.addEventListener("click", generatePdf);
