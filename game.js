(function () {
  "use strict";

  const chatEl = document.getElementById("chat-messages");
  const typingEl = document.getElementById("chat-typing");
  const bannerEl = document.getElementById("facility-banner");
  const bannerTextEl = document.getElementById("banner-text");
  const alertBar = document.getElementById("alert-bar");
  const chatStatus = document.getElementById("chat-status");
  const partnerLog = document.getElementById("partner-log");
  const loadingEl = document.getElementById("loading-overlay");
  const rewardsEl = document.getElementById("rewards-log");
  const subtitleEl = document.querySelector(".game-subtitle");
  const aiBadge = document.getElementById("ai-badge");
  const objectiveEl = document.getElementById("current-objective");

  const gameState = {
    mission: null,
    sceneIndex: 0,
    alert: 10,
    rewards: [],
    waitingForInput: false,
    inputHandler: null,
    hackerMessageCount: 0,
    finished: false,
    currentObjective: "",
  };

  const glitchState = {
    lastGlitchAt: -99,
    GLITCH_ALERT: 55,
    GLITCH_CHANCE: 0.1,
    GLITCH_COOLDOWN: 5,
  };

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API ${path} failed`);
    return res.json();
  }

  async function initGame() {
    showLoading(true, "Ghost is compiling a new mission via Ollama…");
    try {
      const health = await api("/api/health");
      if (aiBadge) {
        aiBadge.textContent = health.ok ? `AI · ${health.model}` : "AI · offline";
        aiBadge.classList.toggle("offline", !health.ok);
      }
    } catch {
      if (aiBadge) {
        aiBadge.textContent = "AI · offline";
        aiBadge.classList.add("offline");
      }
    }

    try {
      const data = await api("/api/mission", { seed: Date.now() });
      gameState.mission = data.mission;
      if (data.warning) console.warn("Mission fallback:", data.warning);
    } catch (err) {
      console.error(err);
      showLoading(true, "Could not reach server. Run: npm start");
      showLoadingHint("Open http://localhost:3000 — not the HTML file directly.");
      return;
    }

    showLoading(false);
    if (subtitleEl) {
      subtitleEl.textContent = `${gameState.mission.facility_name} · ${gameState.mission.mission_title}`;
    }
  }

  function setObjective(text) {
    gameState.currentObjective = text;
    if (objectiveEl) objectiveEl.textContent = text;
  }

  async function runMission() {
    const m = gameState.mission;
    setBanner(`${m.facility_name} · ${m.corruption_target}`);
    await hackerSays(m.opening_messages);
    hackerQuick("I'll end every instruction with exactly what to transmit. Press = to send.");

    for (let i = 0; i < m.scenes.length; i++) {
      gameState.sceneIndex = i;
      const ok = await runPuzzleScene(m.scenes[i]);
      if (!ok) {
        await runFailEnding();
        return;
      }
    }

    await runFinalScene(m.final_scene);
  }

  async function runPuzzleScene(scene) {
    setBanner(scene.banner);
    setObjective(scene.objective || scene.puzzle?.hint_on_wrong || "Awaiting instruction…");
    await hackerSays(scene.messages);
    if (scene.kai_message) await partnerSends(scene.kai_message);

    return new Promise((resolve) => {
      const listen = () => {
        waitForInput(async (value) => {
          transmitToKai(value);
          const check = await api("/api/validate", {
            puzzle: scene.puzzle,
            answer: value,
          });

          if (check.correct) {
            await onPuzzleSuccess(scene);
            resolve(true);
            return true;
          }

          const missionOver = onPuzzleFailure(scene, check);
          if (missionOver) {
            resolve(false);
            return true;
          }

          listen();
          return false;
        });
      };
      listen();
    });
  }

  async function onPuzzleSuccess(scene) {
    changeAlert(scene.success_reward.alert_delta);
    addReward(scene.success_reward.text);
    setObjective("Transmit accepted ✓");
    await hackerSays(scene.success_messages);
  }

  function onPuzzleFailure(scene, check) {
    changeAlert(scene.failure_risk.alert_delta);
    const objective = check.objective || scene.objective || scene.puzzle.hint_on_wrong;
    setObjective(objective);
    hackerQuick(scene.puzzle.hint_on_wrong || `Wrong number. ${objective}`);
    hackerQuick(`⚠ ${scene.failure_risk.text}`);
    return gameState.alert >= 85;
  }

  async function runFinalScene(finalScene) {
    setBanner(finalScene.banner);
    setObjective(finalScene.objective || "Send 1, 2, or 3");
    await hackerSays(finalScene.messages);

    waitForInput((value) => {
      transmitToKai(value);
      const option = finalScene.options.find((o) => o.code === value);
      if (option) {
        finishEnding(option);
        return true;
      }
      hackerQuick("Send 1 (safe), 2 (fast), or 3 (intel).");
      return false;
    });
  }

  async function finishEnding(option) {
    gameState.finished = true;
    setObjective(`Extracted — ${option.ending_title}`);
    setBanner(`Extracted · ${option.ending_title}`);
    chatStatus.textContent = "mission complete";
    await partnerSends("0");
    await hackerSays(option.ending_messages);
    gameState.waitingForInput = false;
    showReplayPrompt();
  }

  async function runFailEnding() {
    gameState.finished = true;
    const fail = gameState.mission.fail_ending;
    setObjective("Mission failed");
    setBanner(`Compromised · ${fail.title}`);
    chatStatus.textContent = "connection lost";
    await hackerSays(fail.messages);
    gameState.waitingForInput = false;
    showReplayPrompt();
  }

  function showReplayPrompt() {
    const row = document.createElement("div");
    row.className = "replay-prompt";
    row.innerHTML = `
      <p>Mission complete. Ghost can compile a new scenario.</p>
      <button type="button" id="replay-btn">New AI Mission</button>
    `;
    chatEl.appendChild(row);
    scrollChat();
    document.getElementById("replay-btn").addEventListener("click", () => location.reload());
  }

  function waitForInput(handler) {
    gameState.waitingForInput = true;
    gameState.inputHandler = handler;
  }

  window.Calculator.onSend = async function (value) {
    if (gameState.finished) return;
    if (!gameState.waitingForInput || !gameState.inputHandler) {
      hackerQuick("Stand by — wait for my transmit instruction.");
      return;
    }

    const handler = gameState.inputHandler;
    gameState.waitingForInput = false;
    gameState.inputHandler = null;

    const accepted = await handler(value);
    if (!accepted && !gameState.finished) {
      gameState.waitingForInput = true;
      gameState.inputHandler = handler;
    }
  };

  function addReward(text) {
    gameState.rewards.push(text);
    if (!rewardsEl) return;
    const empty = rewardsEl.querySelector(".rewards-empty");
    if (empty) empty.remove();
    const item = document.createElement("div");
    item.className = "reward-item";
    item.textContent = `+ ${text}`;
    rewardsEl.appendChild(item);
  }

  function showLoading(show, text) {
    if (!loadingEl) return;
    loadingEl.classList.toggle("hidden", !show);
    const msg = loadingEl.querySelector(".loading-text");
    if (msg && text) msg.textContent = text;
  }

  function showLoadingHint(text) {
    const hint = loadingEl?.querySelector(".loading-hint");
    if (hint) hint.textContent = text;
  }

  function addMessage(text, type) {
    const bubble = document.createElement("div");
    bubble.className = `message message-${type}`;
    if (type === "hacker" && text === gameState.currentObjective) {
      bubble.classList.add("message-objective");
    }
    bubble.innerHTML = formatMessage(text);
    chatEl.appendChild(bubble);
    scrollChat();
    return bubble;
  }

  function transmitToKai(value) {
    const row = document.createElement("div");
    row.className = "led-row led-out";
    row.innerHTML = `<span class="led-dir">YOU →</span><span class="led-val">${escapeHtml(value)}</span>`;
    partnerLog.appendChild(row);
    scrollPartnerLog();
  }

  async function partnerSends(value) {
    await delay(400 + Math.random() * 300);
    const row = document.createElement("div");
    row.className = "led-row led-in";
    row.innerHTML = `<span class="led-dir">KAI →</span><span class="led-val">${escapeHtml(value)}</span>`;
    partnerLog.appendChild(row);
    scrollPartnerLog();
    pulseLed();
  }

  function pulseLed() {
    const dot = document.querySelector(".led-dot");
    if (!dot) return;
    dot.classList.add("blink");
    setTimeout(() => dot.classList.remove("blink"), 800);
  }

  function scrollPartnerLog() {
    partnerLog.scrollTop = partnerLog.scrollHeight;
  }

  function formatMessage(text) {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function scrollChat() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showTyping(show) {
    typingEl.classList.toggle("hidden", !show);
    if (show) scrollChat();
  }

  function shouldGlitchMessage() {
    if (gameState.alert < glitchState.GLITCH_ALERT) return false;
    if (gameState.hackerMessageCount - glitchState.lastGlitchAt < glitchState.GLITCH_COOLDOWN) {
      return false;
    }
    return Math.random() < glitchState.GLITCH_CHANCE;
  }

  async function deliverGlitchBurst(text) {
    glitchState.lastGlitchAt = gameState.hackerMessageCount;
    const prevStatus = chatStatus.textContent;
    chatStatus.textContent = "packet loss · decrypting";

    const burstLen = Math.min(4, Math.max(2, Math.floor(text.length * 0.06)));
    for (let i = 0; i < burstLen; i++) {
      addMessage(text[i].toUpperCase(), "hacker glitch-char");
      await delay(60 + Math.random() * 40);
    }

    await delay(250);
    addMessage("…", "hacker glitch-char");
    await delay(350);
    showTyping(true);
    await delay(450);
    showTyping(false);
    addMessage(text, "hacker glitch-recover");
    chatStatus.textContent = prevStatus;
    await delay(400);
  }

  async function deliverHackerMessage(text) {
    gameState.hackerMessageCount++;

    if (shouldGlitchMessage()) {
      await deliverGlitchBurst(text);
      return;
    }

    showTyping(true);
    await delay(400 + text.length * 8);
    showTyping(false);
    addMessage(text, "hacker");
    await delay(300);
  }

  async function hackerSays(messages) {
    const list = Array.isArray(messages) ? messages : [messages];
    for (const text of list) {
      await deliverHackerMessage(text);
    }
  }

  function hackerQuick(text) {
    addMessage(text, "hacker");
  }

  function setBanner(text) {
    bannerTextEl.textContent = text;
  }

  function pulseBanner() {
    bannerEl.classList.add("pulse");
    setTimeout(() => bannerEl.classList.remove("pulse"), 600);
  }

  function changeAlert(delta) {
    gameState.alert = Math.max(0, Math.min(100, gameState.alert + delta));
    alertBar.style.width = gameState.alert + "%";
    alertBar.classList.toggle("critical", gameState.alert >= 65);
    if (delta > 0) pulseBanner();
  }

  function updateClock() {
    const el = document.getElementById("phone-time");
    if (!el) return;
    el.textContent = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }

  updateClock();
  setInterval(updateClock, 30000);

  (async function start() {
    await initGame();
    if (gameState.mission) await runMission();
  })();
})();
