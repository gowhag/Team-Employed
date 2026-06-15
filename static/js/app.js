const parseBtn = document.getElementById("parseBtn");
const startRecordingBtn = document.getElementById("startRecordingBtn");
const stopRecordingBtn = document.getElementById("stopRecordingBtn");
const statusEmoji = document.getElementById("statusEmoji");
const statusLabel = document.getElementById("statusLabel");
const keywordStream = document.getElementById("keywordStream");
const webcamVideo = document.getElementById("webcamVideo");
const reviewVideo = document.getElementById("reviewVideo");
const videoOverlay = document.getElementById("videoOverlay");
const playAudioBtn = document.getElementById("playAudioBtn");
const resumeFile = document.getElementById("resumeFile");
const jobFile = document.getElementById("jobFile");
const resumeDrop = document.getElementById("resumeDrop");
const jobDescDrop = document.getElementById("jobDescDrop");
const parseResult = document.getElementById("parseResult");
const generatedQuestions = document.getElementById("generatedQuestions");
const parsedKeywords = document.getElementById("parsedKeywords");
const analysisText = document.getElementById("analysisText");
const eyeAnchor = document.getElementById("eyeAnchor");
const activeQuestion = document.getElementById("activeQuestion");
const currentQuestionCard = document.getElementById("currentQuestionCard");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");

let currentStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let feedbackInterval = null;
let questionQueue = [];
let currentQuestionIndex = 0;
let recognition = null;
let transcriptAccumulator = "";
const liveTranscript = document.getElementById("liveTranscript");

function setStatus(state, emoji, prompt) {
  statusEmoji.textContent = emoji;
  statusLabel.textContent = state === "green" ? "Excellent cadence" : state === "yellow" ? "Medium focus" : "Needs refocus";
  if (eyeAnchor) eyeAnchor.textContent = prompt;
  const statusColor = state === "green" ? "text-emerald-300" : state === "yellow" ? "text-amber-300" : "text-rose-300";
  statusEmoji.className = `text-2xl ${statusColor}`;
}

function updateChecklist(checklist) {
  const checklistItems = [
    { id: "Body Posture", value: checklist.posture },
    { id: "Expression Stability", value: checklist.expression },
    { id: "Core Content Accuracy", value: checklist.contentAccuracy },
    { id: "Industry Keyword Insertion", value: checklist.keywordInsertion },
  ];

  const aside = document.querySelector("aside ul");
  aside.innerHTML = checklistItems.map(item => {
    const mark = item.value ? "✓" : "";
    return `<li class="flex items-center gap-3"><span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-slate-800">${mark}</span><span>${item.id}</span></li>`;
  }).join("");
}

async function fetchRealtimeFeedback() {
  try {
    const response = await fetch("/api/realtime-feedback");
    const data = await response.json();
    setStatus(data.status, data.emoji, data.topPrompt);
    keywordStream.innerHTML = data.coachingKeywords.map(k => `<span class="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">${k}</span>`).join("");
    updateChecklist(data.checklist);
  } catch (error) {
    console.error("Realtime feedback failed", error);
  }
}

async function parseDocuments() {
  const formData = new FormData();
  if (resumeFile.files[0]) formData.append("resumeFile", resumeFile.files[0]);
  if (jobFile.files[0]) formData.append("jobFile", jobFile.files[0]);

  const response = await fetch("/api/parse", {
    method: "POST",
    body: formData,
  });
  const result = await response.json();

  parseResult.classList.remove("hidden");
  generatedQuestions.innerHTML = "";
  parsedKeywords.innerHTML = "";
  analysisText.textContent = result.insights || "No insights returned.";
  const parsed = result.parsed || { summary: "", keywords: [], questions: [] };
  renderParseResults(parsed);


function renderParseResults(parsed) {
  questionQueue = Array.isArray(parsed.questions) ? parsed.questions : [];
  currentQuestionIndex = 0;
  generatedQuestions.innerHTML = "";
  parsedKeywords.innerHTML = "";

  if (questionQueue.length) {
    questionQueue.forEach((question, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "w-full rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-800";
      item.textContent = question;
      item.addEventListener("click", () => selectQuestion(index));
      generatedQuestions.appendChild(item);
    });
    selectQuestion(0);
  } else {
    generatedQuestions.innerHTML = `<p class="text-slate-400">No questions parsed yet. Use the AI parse panel to generate your first prompt.</p>`;
    currentQuestionCard?.classList.add("hidden");
  }

  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  if (keywords.length) {
    keywords.forEach(k => {
      const chip = document.createElement("span");
      chip.className = "rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200";
      chip.textContent = k;
      parsedKeywords.appendChild(chip);
    });
  } else {
    parsedKeywords.innerHTML = `<span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">No keywords extracted yet.</span>`;
  }
}

function selectQuestion(index) {
  currentQuestionIndex = index % questionQueue.length;
  activeQuestion.textContent = questionQueue[currentQuestionIndex] || "Your tailored practice prompt will appear here.";
  currentQuestionCard?.classList.remove("hidden");
}

function nextQuestion() {
  if (!questionQueue.length) return;
  selectQuestion((currentQuestionIndex + 1) % questionQueue.length);
}
  const lines = (result.insights || "").split(/\n+/).filter(Boolean);
  lines.forEach(line => {
    if (line.match(/^\s*[-•]\s*/)) {
      const content = line.replace(/^\s*[-•]\s*/, "");
      if (content.match(/question|interview|ask/i)) {
        const item = document.createElement("div");
        item.className = "rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-200";
        item.textContent = content;
        generatedQuestions.appendChild(item);
      } else if (content.match(/keyword|skill|industry/i)) {
        const chip = document.createElement("span");
        chip.className = "rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200";
        chip.textContent = content;
        parsedKeywords.appendChild(chip);
      }
    }
  });

  if (!generatedQuestions.children.length && result.insights) {
    generatedQuestions.innerHTML = `<p class="text-slate-400">AI summary ready. Check the analysis block for extracted interview prompts.</p>`;
  }

  if (!parsedKeywords.children.length && result.insights) {
    parsedKeywords.innerHTML = `<span class="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Review the analysis for keyword highlights.</span>`;
  }
}

function enableDragDrop(dropArea, inputElement) {
  dropArea.addEventListener("click", () => inputElement.click());
  dropArea.addEventListener("dragover", event => {
    event.preventDefault();
    dropArea.classList.add("border-cyan-400", "bg-slate-900");
  });
  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("border-cyan-400", "bg-slate-900");
  });
  dropArea.addEventListener("drop", event => {
    event.preventDefault();
    dropArea.classList.remove("border-cyan-400", "bg-slate-900");
    if (event.dataTransfer.files.length) {
      inputElement.files = event.dataTransfer.files;
      const label = dropArea.querySelector("span:nth-child(1)");
      if (inputElement === resumeFile) {
        dropArea.querySelector("span:nth-child(1)").textContent = "Resume selected";
      } else {
        dropArea.querySelector("span:nth-child(1)").textContent = "JD selected";
      }
    }
  });
}

async function handleStartRecording() {
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    webcamVideo.srcObject = currentStream;
    await webcamVideo.play();

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(currentStream, { mimeType: "video/webm;codecs=vp9" });
    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    mediaRecorder.onstop = handleRecordingStop;
    mediaRecorder.start(1000);

    // Start browser speech recognition (if available)
    transcriptAccumulator = "";
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              transcriptAccumulator += (res[0].transcript || "") + " ";
            } else {
              interim += res[0].transcript || "";
            }
          }
          if (liveTranscript) liveTranscript.textContent = transcriptAccumulator + interim;
        };
        recognition.onerror = (e) => console.warn('Speech recognition error', e);
        recognition.start();
      } else {
        if (liveTranscript) liveTranscript.textContent = 'Speech recognition not supported in this browser.';
      }
    } catch (err) {
      console.warn('Speech recognition start failed', err);
    }

    startRecordingBtn.disabled = true;
    stopRecordingBtn.classList.remove("hidden");
    feedbackInterval = setInterval(fetchRealtimeFeedback, 2800);
    await fetchRealtimeFeedback();
  } catch (error) {
    console.error("Unable to start recording", error);
    alert("Please allow camera and microphone access to record.");
  }
}

function stopRecordingSession() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
  }
  clearInterval(feedbackInterval);
  try { if (recognition) recognition.stop(); } catch(e){}
  startRecordingBtn.disabled = false;
  stopRecordingBtn.classList.add("hidden");
}

function handleRecordingStop() {
  const blob = new Blob(recordedChunks, { type: "video/webm" });
  reviewVideo.src = URL.createObjectURL(blob);
  reviewVideo.play();
  generateReviewAnalytics();
}

async function generateReviewAnalytics() {
  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: transcriptAccumulator || "Simulated candidate response generated during the session." }),
    });
    const result = await response.json();
    renderReviewFeedback(result);
  } catch (error) {
    console.error("Review analytics failed", error);
  }
}

function renderReviewFeedback(result) {
  const { textAnalytics, diagnostics } = result;
  document.getElementById("reviewSummary").textContent = textAnalytics?.reviewSummary || "Coaching summary will appear here.";
  document.getElementById("fillerWordsText").textContent = `um: ${textAnalytics?.fillerWords?.um ?? 0}, uh: ${textAnalytics?.fillerWords?.uh ?? 0}, like: ${textAnalytics?.fillerWords?.like ?? 0}`;
  document.getElementById("structureScoreText").textContent = `${textAnalytics?.structureScore ?? 0}%`;
  document.getElementById("missedKeywordsText").textContent = (textAnalytics?.keywordMisses || []).join(", ");
  animateOverlay(diagnostics);
}

function animateOverlay(diagnostics) {
  videoOverlay.innerHTML = "";
  diagnostics.forEach((item, index) => {
    const box = document.createElement("div");
    box.className = "review-flag";
    const width = 26 + index * 5;
    const height = 18 + index * 4;
    const top = 18 + index * 14;
    const left = 8 + index * 22;
    box.style.top = `${top}%`;
    box.style.left = `${left}%`;
    box.style.width = `${width}%`;
    box.style.height = `${height}%`;
    box.innerHTML = `<span class="block rounded-full bg-rose-500/80 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white">${item.issue}</span>`;
    videoOverlay.appendChild(box);
  });
}

playAudioBtn.addEventListener("click", () => {
  const audio = new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3");
  audio.play();
});

parseBtn.addEventListener("click", parseDocuments);
startRecordingBtn.addEventListener("click", handleStartRecording);
stopRecordingBtn.addEventListener("click", stopRecordingSession);
nextQuestionBtn?.addEventListener("click", nextQuestion);

if (resumeDrop && jobDescDrop) {
  enableDragDrop(resumeDrop, resumeFile);
  enableDragDrop(jobDescDrop, jobFile);
}

window.addEventListener("load", () => {
  if (reviewVideo) {
    reviewVideo.poster = "";
  }
});
