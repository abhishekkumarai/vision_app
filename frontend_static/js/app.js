/**
 * Main Application Orchestrator & State Manager
 * Traceability: Epic KAN-49, Task KAN-53
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const video = document.getElementById("webcam");
  const canvas = document.getElementById("hudCanvas");
  const btnToggleCam = document.getElementById("btnToggleCam");
  const btnInspect = document.getElementById("btnInspect");
  const btnAutoLock = document.getElementById("btnAutoLock");
  const btnSpeak = document.getElementById("btnSpeak");
  const providerSelect = document.getElementById("providerSelect");
  const statusGpu = document.getElementById("statusGpu");
  const statusEngine = document.getElementById("statusEngine");
  const trackingCount = document.getElementById("trackingCount");

  // Insights panel elements
  const insightsPlaceholder = document.getElementById("insightsPlaceholder");
  const insightsLoading = document.getElementById("insightsLoading");
  const insightsContent = document.getElementById("insightsContent");
  const targetThumbnail = document.getElementById("targetThumbnail");
  const targetName = document.getElementById("targetName");
  const targetCategory = document.getElementById("targetCategory");
  const targetConfidence = document.getElementById("targetConfidence");
  const targetModel = document.getElementById("targetModel");
  const targetSummary = document.getElementById("targetSummary");
  const usesList = document.getElementById("usesList");
  const specsList = document.getElementById("specsList");
  const safetyList = document.getElementById("safetyList");
  const factsList = document.getElementById("factsList");
  const questionsContainer = document.getElementById("questionsContainer");

  // Chat elements
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const btnSendChat = document.getElementById("btnSendChat");

  // State
  let cameraManager = new CameraManager(video, canvas);
  let hudDrawer = new HUDDrawer(canvas);
  let lockedTarget = null;
  let autoLock = true;
  let currentInsights = null;
  let isIdentifying = false;
  let chatHistory = [];

  // Check backend health and capabilities
  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        if (data.gpu_available) {
          statusGpu.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>GPU: ${data.gpu_name || 'Active'}`;
          statusGpu.className = "text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full flex items-center";
        } else {
          statusGpu.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span>CPU Mode`;
          statusGpu.className = "text-xs font-mono text-slate-400 bg-slate-800/60 border border-slate-700 px-2.5 py-1 rounded-full flex items-center";
        }
      }
    } catch (e) {
      console.warn("Backend health check failed:", e);
    }
  }
  await checkHealth();

  // Initialize MediaPipe Vision (client-side GPU accelerated or fallback)
  statusEngine.textContent = "Initializing Vision...";
  const clientMpReady = await cameraManager.initMediaPipe();
  if (clientMpReady) {
    statusEngine.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-cyan-400 mr-1.5 animate-ping"></span>MediaPipe: WebGPU/Wasm`;
    statusEngine.className = "text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/80 px-2.5 py-1 rounded-full flex items-center";
  } else {
    statusEngine.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>MediaPipe: FastAPI PyTask`;
    statusEngine.className = "text-xs font-mono text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 rounded-full flex items-center";
  }

  // Animation & Rendering Loop
  function renderLoop(timestamp) {
    if (cameraManager.isRunning) {
      cameraManager.updateCanvasDimensions();
      hudDrawer.clear();
      hudDrawer.drawGrid();

      const detections = cameraManager.processFrame(timestamp);
      trackingCount.textContent = `TARGETS: ${detections.length}`;

      // Auto-lock highest scoring detection if none manually locked
      if (autoLock && detections.length > 0) {
        let best = detections[0];
        for (let d of detections) {
          if (d.score > best.score) best = d;
        }
        lockedTarget = best;
      } else if (detections.length === 0 && autoLock) {
        lockedTarget = null;
      }

      // Draw all bounding boxes
      detections.forEach(det => {
        const isThisLocked = lockedTarget && (lockedTarget.label === det.label);
        hudDrawer.drawDetection(det.bounding_box, det.label, det.score, isThisLocked);
      });

      // Update inspect button state
      btnInspect.disabled = !lockedTarget || isIdentifying;
      if (lockedTarget) {
        btnInspect.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        btnInspect.classList.add("opacity-50", "cursor-not-allowed");
      }
    }

    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // Toggle Camera
  btnToggleCam.addEventListener("click", async () => {
    if (!cameraManager.isRunning) {
      try {
        await cameraManager.startCamera();
        btnToggleCam.innerHTML = `
          <svg class="w-4 h-4 mr-2 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path>
          </svg>
          Stop Camera
        `;
        btnToggleCam.className = "px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/70 text-rose-200 text-sm font-semibold rounded-lg shadow-lg flex items-center transition-all";
      } catch (err) {
        alert("Camera error: " + err.message + "\nPlease make sure you have allowed camera permissions.");
      }
    } else {
      cameraManager.stopCamera();
      hudDrawer.clear();
      trackingCount.textContent = "TARGETS: 0";
      lockedTarget = null;
      btnToggleCam.innerHTML = `
        <svg class="w-4 h-4 mr-2 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
        </svg>
        Start Camera
      `;
      btnToggleCam.className = "px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-lg shadow-lg shadow-cyan-500/20 flex items-center transition-all";
    }
  });

  // Toggle Auto-Lock
  btnAutoLock.addEventListener("click", () => {
    autoLock = !autoLock;
    if (autoLock) {
      btnAutoLock.className = "px-3 py-2 bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-xs font-mono rounded-lg transition-all";
      btnAutoLock.textContent = "AUTO-LOCK: ON";
    } else {
      btnAutoLock.className = "px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono rounded-lg transition-all";
      btnAutoLock.textContent = "AUTO-LOCK: OFF";
    }
  });

  // Canvas click to select/lock specific object
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Check which detection contains the click point
    let clicked = null;
    for (let det of cameraManager.detections) {
      const b = det.bounding_box;
      if (clickX >= b.origin_x && clickX <= b.origin_x + b.width &&
          clickY >= b.origin_y && clickY <= b.origin_y + b.height) {
        clicked = det;
        break;
      }
    }

    if (clicked) {
      autoLock = false;
      btnAutoLock.className = "px-3 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono rounded-lg transition-all";
      btnAutoLock.textContent = "AUTO-LOCK: OFF";
      lockedTarget = clicked;
    }
  });

  // Inspect & Identify Object with LLM
  async function identifyTarget() {
    if (!lockedTarget || isIdentifying) return;

    isIdentifying = true;
    insightsPlaceholder.classList.add("hidden");
    insightsContent.classList.add("hidden");
    insightsLoading.classList.remove("hidden");

    // Crop the target
    const cropB64 = cameraManager.cropBoundingBox(lockedTarget.bounding_box);
    if (cropB64) {
      targetThumbnail.src = cropB64;
      targetThumbnail.classList.remove("hidden");
    }

    try {
      const payload = {
        label: lockedTarget.label,
        score: lockedTarget.score,
        image_b64: cropB64,
        provider: providerSelect.value
      };

      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Server returned status " + res.status);
      const data = await res.json();
      currentInsights = data;
      renderInsights(data, lockedTarget);

      // Auto-narrate summary if speech is enabled
      if (window.speechAssistant) {
        window.speechAssistant.speak(`${data.name}. ${data.summary}`);
      }

    } catch (err) {
      alert("Identification error: " + err.message);
      insightsPlaceholder.classList.remove("hidden");
    } finally {
      insightsLoading.classList.add("hidden");
      isIdentifying = false;
    }
  }

  btnInspect.addEventListener("click", identifyTarget);

  function renderInsights(insights, target) {
    targetName.textContent = insights.name;
    targetCategory.textContent = insights.category;
    targetConfidence.textContent = `${Math.round(target.score * 100)}% CONFIDENCE`;
    targetModel.textContent = insights.model_used;
    targetSummary.textContent = insights.summary;

    // Primary Uses
    usesList.innerHTML = (insights.primary_uses || []).map(u => `
      <li class="flex items-start text-xs text-slate-300">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 mr-2 flex-shrink-0"></span>
        <span>${u}</span>
      </li>
    `).join("");

    // Technical Specs
    specsList.innerHTML = (insights.materials_and_specs || []).map(s => `
      <li class="flex items-start text-xs text-slate-300">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 mr-2 flex-shrink-0"></span>
        <span>${s}</span>
      </li>
    `).join("");

    // Safety & Maintenance
    safetyList.innerHTML = (insights.safety_and_maintenance || []).map(sm => `
      <li class="flex items-start text-xs text-slate-300">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 mr-2 flex-shrink-0"></span>
        <span>${sm}</span>
      </li>
    `).join("");

    // Fun Trivia
    factsList.innerHTML = (insights.fun_facts || []).map(f => `
      <li class="flex items-start text-xs text-slate-300">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 flex-shrink-0"></span>
        <span>${f}</span>
      </li>
    `).join("");

    // Suggested Questions Chips
    questionsContainer.innerHTML = (insights.suggested_questions || []).map(q => `
      <button class="question-chip text-left text-xs bg-slate-800/90 hover:bg-slate-700/90 text-cyan-300 hover:text-cyan-200 border border-slate-700/80 hover:border-cyan-500/50 px-2.5 py-1.5 rounded-lg transition-all">
        💡 "${q}"
      </button>
    `).join("");

    // Attach click handler to question chips
    document.querySelectorAll(".question-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const text = btn.textContent.replace(/^💡\s*"/, '').replace(/"$/, '').trim();
        chatInput.value = text;
        sendChatMessage();
      });
    });

    // Reset Chat messages for new object
    chatHistory = [];
    chatMessages.innerHTML = `
      <div class="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
        <span class="font-bold text-cyan-400">Assistant:</span> Visual lock acquired on <span class="text-white font-semibold">${insights.name}</span>. Feel free to ask any question!
      </div>
    `;

    insightsContent.classList.remove("hidden");
  }

  // Audio Narration
  btnSpeak.addEventListener("click", () => {
    if (!currentInsights) return;
    if (window.speechAssistant.isSpeaking()) {
      window.speechAssistant.stop();
      btnSpeak.classList.remove("text-cyan-400");
    } else {
      btnSpeak.classList.add("text-cyan-400");
      window.speechAssistant.speak(`${currentInsights.name}. ${currentInsights.summary}`, () => {
        btnSpeak.classList.remove("text-cyan-400");
      });
    }
  });

  // Chat Q&A Interaction
  async function sendChatMessage() {
    const question = chatInput.value.trim();
    if (!question || !currentInsights) return;

    chatInput.value = "";

    // Append user message
    const userBubble = document.createElement("div");
    userBubble.className = "p-2.5 rounded-lg bg-cyan-950/50 border border-cyan-800/60 text-xs text-cyan-100 ml-4 self-end";
    userBubble.innerHTML = `<span class="font-bold text-cyan-400">You:</span> ${question}`;
    chatMessages.appendChild(userBubble);

    // Placeholder assistant message
    const botBubble = document.createElement("div");
    botBubble.className = "p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 mr-4";
    botBubble.innerHTML = `<span class="font-bold text-cyan-400">Assistant:</span> <span class="animate-pulse">Analyzing...</span>`;
    chatMessages.appendChild(botBubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_context: currentInsights,
          question: question,
          history: chatHistory,
          provider: providerSelect.value
        })
      });

      if (!res.ok) throw new Error("Chat request failed");
      const data = await res.json();
      botBubble.innerHTML = `<span class="font-bold text-cyan-400">Assistant:</span> ${data.answer}`;
      chatHistory.push({ role: "user", content: question });
      chatHistory.push({ role: "assistant", content: data.answer });
    } catch (e) {
      botBubble.innerHTML = `<span class="font-bold text-rose-400">Error:</span> Could not obtain answer.`;
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  btnSendChat.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });
});
