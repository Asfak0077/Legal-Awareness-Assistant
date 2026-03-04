// app.js — Handles form submission and API communication

const API_URL = "https://nk7mck4dfj.execute-api.ap-south-1.amazonaws.com/prod/analyze";

async function submitComplaint() {
  const complaintText = document.getElementById("complaintText").value.trim();
  const userState = document.getElementById("userState").value;
  const errorBox = document.getElementById("errorBox");
  const submitBtn = document.getElementById("submitBtn");
  const spinner = document.getElementById("spinner");

  // Clear previous errors
  errorBox.style.display = "none";
  errorBox.innerText = "";

  // Validate inputs
  if (!complaintText || complaintText.length < 10) {
    errorBox.innerText = "Please enter at least 10 characters describing your complaint.";
    errorBox.style.display = "block";
    return;
  }

  if (!userState) {
    errorBox.innerText = "Please select your state.";
    errorBox.style.display = "block";
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  submitBtn.innerText = "Processing...";
  spinner.style.display = "block";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ complaintText, userState })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong. Please try again.");
    }

    // Save to sessionStorage and redirect
    sessionStorage.setItem("legalResponse", JSON.stringify(data));
    window.location.href = "result.html";

  } catch (error) {
    errorBox.innerText = error.message || "Unable to process your complaint. Please try again.";
    errorBox.style.display = "block";
  } finally {
    // Reset button
    submitBtn.disabled = false;
    submitBtn.innerText = "Submit Complaint / शिकायत दर्ज करें";
    spinner.style.display = "none";
  }
}

// Copy draft to clipboard
function copyDraft() {
  const draftText = document.getElementById("draftOutput");
  if (draftText) {
    draftText.select();
    document.execCommand("copy");
    const copyBtn = document.getElementById("copyBtn");
    copyBtn.innerText = "✅ Copied!";
    setTimeout(() => { copyBtn.innerText = "Copy Draft"; }, 2000);
  }
}

// Start over
function startOver() {
  sessionStorage.removeItem("legalResponse");
  window.location.href = "index.html";
}

// Load results on result.html
function loadResults() {
  const raw = sessionStorage.getItem("legalResponse");

  if (!raw) {
    window.location.href = "index.html";
    return;
  }

  const data = JSON.parse(raw);

  // Populate all fields safely
  setText("detectedLanguage", data.detectedLanguage || "Unknown");
  setText("category", data.category || "Unknown");
  setText("articleNumber", data.articleNumber || "N/A");
  setText("articleExplanation", data.articleExplanation || "N/A");
  setText("relevantLaw", data.relevantLaw || "N/A");
  setText("authority", data.authority || "N/A");
  setText("disclaimer", data.disclaimer || "This tool provides awareness only. Not legal advice.");

  // Portal link
  const portalLink = document.getElementById("portalLink");
  if (portalLink && data.portalLink) {
    portalLink.href = data.portalLink;
    portalLink.innerText = data.portalLink;
  }

  // Draft output
  const draftOutput = document.getElementById("draftOutput");
  if (draftOutput) {
    draftOutput.value = data.draftLocalized || data.draftEN || "Draft not available.";
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}