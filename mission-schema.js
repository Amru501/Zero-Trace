export const FALLBACK_MISSION = {
  mission_title: "Basement Protocol",
  facility_name: "Black Site B-7",
  corruption_target: "offshore ledger accounts",
  opening_messages: [
    "Operative — Ghost on a hardened line. Kai's in the basement. I'm mapping the site now.",
    "Calculator uplink is live. Press = to push digits to his LED. I'll feed you every code.",
  ],
  scenes: [
    {
      banner: "Sub-basement · Handshake",
      messages: [
        "Handshake first. Kai needs to know the channel is real.",
        "Send 7391 to confirm Kai's channel.",
      ],
      kai_message: null,
      objective: "Send 7391",
      puzzle: {
        type: "code",
        operands: null,
        expected_answer: "7391",
        hint_on_wrong: "Wrong number. Send 7391",
      },
      success_messages: ["Link confirmed. Kai's alive."],
      success_reward: { alert_delta: -5, text: "Encrypted tunnel widened" },
      failure_risk: { alert_delta: 10, text: "Ping flagged by internal IDS" },
    },
    {
      banner: "Cell block · Routing",
      messages: [
        "Two corridors are clear on my map. One is a trap.",
        "Send 2 so he takes an open path.",
      ],
      kai_message: "88",
      objective: "Send 2",
      puzzle: {
        type: "code",
        operands: null,
        expected_answer: "2",
        hint_on_wrong: "Wrong number. Send 2",
      },
      success_messages: ["He's moving. Cameras looping."],
      success_reward: { alert_delta: -4, text: "Camera loop +12 seconds" },
      failure_risk: { alert_delta: 12, text: "Wrong turn — heat sensor tripped" },
    },
    {
      banner: "Patrol junction",
      messages: [
        "Guard cycle is 120 seconds. Door exposure window is 35 seconds.",
        "Calculate 120 − 35 and transmit the result.",
      ],
      kai_message: null,
      objective: "Calculate 120 − 35, then press =",
      puzzle: {
        type: "math",
        operands: { a: 120, operator: "-", b: 35 },
        expected_answer: "85",
        hint_on_wrong: "Wrong number. Calculate 120 − 35, then press =",
      },
      success_messages: ["85 seconds. Kai's counting down."],
      success_reward: { alert_delta: -6, text: "Patrol blind spot extended" },
      failure_risk: { alert_delta: 15, text: "Guard spotted movement" },
    },
    {
      banner: "Door panel · Lock hash",
      messages: [
        "Checksum digits on the panel: 14, 23, and 19.",
        "Add them together and send the sum.",
      ],
      kai_message: "31",
      objective: "Calculate 14 + 23 + 19, then press =",
      puzzle: {
        type: "math",
        operands: { a: 14, operator: "+", b: 42 },
        expected_answer: "56",
        hint_on_wrong: "Wrong number. Calculate 14 + 23 + 19, then press =",
      },
      success_messages: ["Door accepted. He's through."],
      success_reward: { alert_delta: -5, text: "Secondary lock delayed" },
      failure_risk: { alert_delta: 14, text: "Lockout timer halved" },
    },
    {
      banner: "Thermal fork",
      messages: [
        "Fork ahead. Thermals show the right path is clear.",
        "Send 2 for right. Send 1 only if you want the risky left path.",
      ],
      kai_message: "2",
      objective: "Send 2",
      puzzle: {
        type: "code",
        operands: null,
        expected_answer: "2",
        hint_on_wrong: "Wrong number. Send 2",
      },
      success_messages: ["Good line. Extraction ring ahead."],
      success_reward: { alert_delta: -3, text: "Extraction window opening" },
      failure_risk: { alert_delta: 18, text: "Hostile converging on left path" },
    },
  ],
  final_scene: {
    banner: "Extraction · Final route",
    messages: [
      "Three exits. Pick one and transmit it to Kai.",
      "Send 1 — ventilation (safe). Send 2 — elevator (fast). Send 3 — server data (risky).",
    ],
    objective: "Send 1, 2, or 3",
    options: [
      {
        code: "1",
        hint: "ventilation",
        ending_title: "Silent Exit",
        ending_messages: ["Kai's out through the vent. No pursuit.", "Ending: Silent Exit"],
      },
      {
        code: "2",
        hint: "elevator",
        ending_title: "Burning Bridge",
        ending_messages: ["Elevator was loud but he's clear.", "Ending: Burning Bridge"],
      },
      {
        code: "3",
        hint: "data vault",
        ending_title: "The Ledger",
        ending_messages: ["Files copied. Kai barely made it out.", "Ending: The Ledger"],
      },
    ],
  },
  fail_ending: {
    title: "Blackout",
    messages: [
      "Alert maxed. They jammed the calculator channel.",
      "Kai's LED went dark.",
      "Ending: Blackout",
    ],
  },
};

const OP_SYMBOLS = { "+": "+", "-": "−", "*": "×", "/": "÷" };

function computeMath(operands) {
  if (!operands) return null;
  const a = Number(operands.a);
  const b = Number(operands.b);
  const op = operands.operator;
  let result;
  switch (op) {
    case "+":
      result = a + b;
      break;
    case "-":
      result = a - b;
      break;
    case "*":
      result = a * b;
      break;
    case "/":
      if (b === 0) return null;
      result = a / b;
      break;
    default:
      return null;
  }
  if (!isFinite(result)) return null;
  const rounded = Math.round(result * 1e10) / 1e10;
  return String(rounded);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function asStringArray(val, max = 6) {
  if (!Array.isArray(val)) return [];
  return val.map((s) => String(s).slice(0, 200)).slice(0, max);
}

export function buildObjective(puzzle) {
  if (!puzzle) return "Wait for Ghost's instruction.";

  if (puzzle.type === "math" && puzzle.operands) {
    const { a, operator, b } = puzzle.operands;
    const sym = OP_SYMBOLS[operator] || operator;
    return `Calculate ${a} ${sym} ${b}, then press =`;
  }

  return `Send ${puzzle.expected_answer}`;
}

function isValidPuzzle(p) {
  const ans = String(p.expected_answer ?? "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(ans)) return false;

  const num = parseFloat(ans);
  if (!Number.isFinite(num) || Math.abs(num) > 9999) return false;

  if (p.type === "code") {
    const digits = ans.replace(/^-/, "").replace(/\..*/, "");
    if (digits.length < 1 || digits.length > 4) return false;
  }

  if (p.type === "math") {
    if (!p.operands || computeMath(p.operands) === null) return false;
    const computed = parseFloat(computeMath(p.operands));
    if (parseFloat(ans) !== computed) return false;
  }

  return true;
}

function repairPuzzle(puzzle, fallback) {
  let p = { ...fallback, ...(puzzle || {}) };
  p.type = p.type === "math" ? "math" : "code";

  if (p.type === "math" && p.operands) {
    const computed = computeMath(p.operands);
    if (computed !== null) p.expected_answer = computed;
  }

  p.expected_answer = String(p.expected_answer ?? fallback.expected_answer).trim();

  if (!isValidPuzzle(p)) {
    p = { ...fallback };
  }

  p.objective = buildObjective(p);
  p.hint_on_wrong = `Wrong number. ${p.objective}`;
  return p;
}

function repairScene(scene, fallback) {
  const puzzle = repairPuzzle(scene?.puzzle || {}, fallback.puzzle);
  const objective = buildObjective(puzzle);

  const narrative = asStringArray(scene?.messages, 3).filter(
    (m) => !/^(send |calculate |transmit )/i.test(m)
  );
  const messages =
    narrative.length > 0 ? [...narrative.slice(0, 2), objective] : [fallback.messages[0], objective];

  return {
    banner: String(scene?.banner || fallback.banner).slice(0, 100),
    messages,
    objective,
    kai_message:
      scene?.kai_message != null && scene.kai_message !== ""
        ? String(scene.kai_message).slice(0, 12)
        : fallback.kai_message ?? null,
    puzzle,
    success_messages: asStringArray(scene?.success_messages, 2).length
      ? asStringArray(scene?.success_messages, 2)
      : fallback.success_messages,
    success_reward: {
      alert_delta: clamp(
        Number(scene?.success_reward?.alert_delta ?? fallback.success_reward.alert_delta),
        -15,
        -1
      ),
      text: String(scene?.success_reward?.text || fallback.success_reward.text).slice(0, 100),
    },
    failure_risk: {
      alert_delta: clamp(
        Number(scene?.failure_risk?.alert_delta ?? fallback.failure_risk.alert_delta),
        5,
        20
      ),
      text: String(scene?.failure_risk?.text || fallback.failure_risk.text).slice(0, 100),
    },
  };
}

function repairFinalScene(raw, fallback) {
  const options = (raw?.options || fallback.options).slice(0, 3).map((opt, idx) => ({
    code: String(opt.code || idx + 1),
    hint: String(opt.hint || fallback.options[idx].hint).slice(0, 80),
    ending_title: String(opt.ending_title || fallback.options[idx].ending_title).slice(0, 60),
    ending_messages: asStringArray(opt.ending_messages, 3).length
      ? asStringArray(opt.ending_messages, 3)
      : fallback.options[idx].ending_messages,
  }));

  return {
    banner: String(raw?.banner || fallback.banner).slice(0, 100),
    messages: [
      ...(asStringArray(raw?.messages, 2).filter((m) => !/send 1/i.test(m)).slice(0, 1)),
      "Send 1 — safe route. Send 2 — fast route. Send 3 — grab intel (risky).",
    ],
    objective: "Send 1, 2, or 3",
    options,
  };
}

export function normalizeMission(raw) {
  const base = structuredClone(FALLBACK_MISSION);
  if (!raw || typeof raw !== "object") return base;

  const mission = {
    mission_title: String(raw.mission_title || base.mission_title).slice(0, 80),
    facility_name: String(raw.facility_name || base.facility_name).slice(0, 80),
    corruption_target: String(raw.corruption_target || base.corruption_target).slice(0, 120),
    opening_messages: asStringArray(raw.opening_messages, 4).length
      ? asStringArray(raw.opening_messages, 4)
      : base.opening_messages,
    scenes: [],
    final_scene: base.final_scene,
    fail_ending: base.fail_ending,
  };

  const scenes = Array.isArray(raw.scenes) ? raw.scenes : [];
  const count = Math.min(Math.max(scenes.length, 4), 5);

  for (let i = 0; i < count; i++) {
    const fb = base.scenes[i] || base.scenes[base.scenes.length - 1];
    mission.scenes.push(repairScene(scenes[i] || {}, fb));
  }

  if (mission.scenes.length < 4) {
    mission.scenes = base.scenes.map((s) => repairScene(s, s));
  }

  mission.final_scene = repairFinalScene(raw.final_scene, base.final_scene);

  if (raw.fail_ending) {
    mission.fail_ending = {
      title: String(raw.fail_ending.title || "Blackout").slice(0, 40),
      messages: asStringArray(raw.fail_ending.messages, 4).length
        ? asStringArray(raw.fail_ending.messages, 4)
        : base.fail_ending.messages,
    };
  }

  return mission;
}

export function validateAnswer(puzzle, answer) {
  if (!puzzle) return { correct: false };

  const player = String(answer).trim();
  let expected = String(puzzle.expected_answer).trim();

  if (puzzle.type === "math" && puzzle.operands) {
    const computed = computeMath(puzzle.operands);
    if (computed !== null) expected = computed;
  }

  const pn = parseFloat(player);
  const en = parseFloat(expected);
  const correct = player === expected || (Number.isFinite(pn) && Number.isFinite(en) && pn === en);

  return { correct, expected, objective: buildObjective(puzzle) };
}
