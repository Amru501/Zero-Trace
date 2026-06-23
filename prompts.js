export function buildMissionPrompt() {
  return `You are the narrative engine for "Zero Trace", a spy escape game.

STORY (fixed):
- Player: field operative. Kai: captured partner (LED numbers only). Ghost: hacker on PC.
- Player transmits NUMBERS to Kai via calculator (= key).
- Ghost explains each puzzle in plain language.

CRITICAL RULES FOR PUZZLES:
1. Every scene MUST have a puzzle with expected_answer as a plain number string (e.g. "7391", "85", "2").
2. For math puzzles: set type "math", provide operands {a, operator, b} where operator is + - * /
3. For code puzzles: set type "code", operands null, expected_answer is 1-4 digits ONLY (e.g. "7", "42", "7391"). Never use long numbers.
4. Ghost messages = short story context ONLY (1-2 sentences). Do NOT write vague lines like "confirm the ID".
5. The game adds "Send X" instructions automatically — you provide the number in expected_answer.
6. hint_on_wrong must repeat the exact math or code needed.

Generate 5 puzzle scenes + final choice scene. Unique facility, corruption plot, complications.

JSON only:
{
  "mission_title": "string",
  "facility_name": "string",
  "corruption_target": "string",
  "opening_messages": ["2-3 short strings introducing the crisis"],
  "scenes": [
    {
      "banner": "location label",
      "messages": ["1-2 narrative strings — NO vague instructions"],
      "kai_message": "number string or null",
      "puzzle": {
        "type": "code or math",
        "operands": { "a": 0, "operator": "+", "b": 0 },
        "expected_answer": "must be numeric string",
        "hint_on_wrong": "include the exact calculation or code"
      },
      "success_messages": ["1 short string"],
      "success_reward": { "alert_delta": -5, "text": "tactical perk" },
      "failure_risk": { "alert_delta": 12, "text": "what goes wrong" }
    }
  ],
  "final_scene": {
    "banner": "string",
    "messages": ["1 narrative string about extraction"],
    "options": [
      { "code": "1", "hint": "safe", "ending_title": "string", "ending_messages": ["2 strings"] },
      { "code": "2", "hint": "fast", "ending_title": "string", "ending_messages": ["2 strings"] },
      { "code": "3", "hint": "intel", "ending_title": "string", "ending_messages": ["2 strings"] }
    ]
  },
  "fail_ending": { "title": "Blackout", "messages": ["2 strings"] }
}

Example math scene: operands 120 - 35, expected_answer "85".
Example code scene: expected_answer "7391", type code, operands null.`;
}
