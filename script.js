(function () {
  "use strict";

  const state = {
    tokens: [],
    currentValue: "0",
    justEvaluated: false,
    hasError: false,
  };

  const expressionEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const keypad = document.querySelector(".keypad");

  const OPERATOR_SYMBOLS = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
  };

  window.Calculator = {
    onSend: null,
    getDisplayValue,
    clear: clearAll,
  };

  function formatNumber(value) {
    if (value === "Error" || value === "" || value === "-") return value;
    const num = parseFloat(value);
    if (isNaN(num)) return "0";

    const str = String(value);
    if (str.includes("e") || str.includes("E")) {
      return num.toPrecision(8).replace(/\.?0+$/, "");
    }

    const parts = str.split(".");
    const formattedInt = Number(parts[0]).toLocaleString("en-US");
    return parts[1] !== undefined ? `${formattedInt}.${parts[1]}` : formattedInt;
  }

  function formatTokensForDisplay(tokens) {
    return tokens
      .map((t) => (OPERATOR_SYMBOLS[t] || formatNumber(t)))
      .join(" ");
  }

  function isWaitingForOperand() {
    return (
      state.currentValue === "" &&
      state.tokens.length > 0 &&
      isOperator(state.tokens[state.tokens.length - 1])
    );
  }

  function isOperator(token) {
    return token === "+" || token === "-" || token === "*" || token === "/";
  }

  function getBuildingExpression() {
    const parts = [...state.tokens];
    if (state.currentValue !== "") {
      parts.push(state.currentValue);
    }
    return formatTokensForDisplay(parts);
  }

  function getRawValueForSend() {
    if (state.hasError) return null;

    if (state.justEvaluated) {
      return state.currentValue;
    }

    const tokens = [...state.tokens];
    if (!isWaitingForOperand() && state.currentValue !== "") {
      tokens.push(state.currentValue);
    }

    if (tokens.length >= 3) {
      const result = evaluateTokens(tokens);
      if (result === "Error") return null;
      return result;
    }

    if (tokens.length === 1) {
      return tokens[0];
    }

    if (state.currentValue !== "" && state.currentValue !== "0") {
      return state.currentValue;
    }

    if (state.currentValue === "0" && state.tokens.length === 0) {
      return "0";
    }

    return null;
  }

  function getDisplayValue() {
    return getRawValueForSend();
  }

  function updateDisplay(animate) {
    resultEl.classList.toggle("error", state.hasError);

    if (state.hasError) {
      expressionEl.textContent = "";
      resultEl.textContent = "Error";
    } else if (state.justEvaluated) {
      expressionEl.textContent = state.lastExpression || "";
      resultEl.textContent = formatNumber(state.currentValue);
    } else {
      expressionEl.textContent = "";
      resultEl.textContent = getBuildingExpression() || "0";
    }

    document.querySelectorAll(".key-op").forEach((btn) => {
      const lastToken = state.tokens[state.tokens.length - 1];
      btn.classList.toggle(
        "active",
        isWaitingForOperand() && btn.dataset.value === lastToken
      );
    });

    if (animate) {
      resultEl.classList.remove("updated");
      void resultEl.offsetWidth;
      resultEl.classList.add("updated");
    }
  }

  function clearAll() {
    state.tokens = [];
    state.currentValue = "0";
    state.justEvaluated = false;
    state.hasError = false;
    state.lastExpression = "";
    updateDisplay();
  }

  function setError() {
    state.tokens = [];
    state.currentValue = "Error";
    state.justEvaluated = false;
    state.hasError = true;
    state.lastExpression = "";
    updateDisplay();
  }

  function startNewEntry() {
    state.tokens = [];
    state.currentValue = "0";
    state.justEvaluated = false;
    state.lastExpression = "";
  }

  function inputDigit(digit) {
    if (state.hasError) {
      clearAll();
    }

    if (state.justEvaluated) {
      startNewEntry();
    }

    if (isWaitingForOperand() || state.currentValue === "0") {
      state.currentValue = digit;
    } else if (state.currentValue === "-0") {
      state.currentValue = "-" + digit;
    } else {
      state.currentValue += digit;
    }

    if (state.currentValue.replace(/[-.]/g, "").length > 15) {
      state.currentValue = state.currentValue.slice(0, -1);
      return;
    }

    updateDisplay(true);
  }

  function inputDecimal() {
    if (state.hasError) clearAll();
    if (state.justEvaluated) startNewEntry();

    if (isWaitingForOperand()) {
      state.currentValue = "0.";
    } else if (!state.currentValue.includes(".")) {
      state.currentValue += ".";
    }

    updateDisplay(true);
  }

  function toggleSign() {
    if (state.hasError || state.justEvaluated) return;
    if (state.currentValue === "0" || state.currentValue === "") return;

    state.currentValue = state.currentValue.startsWith("-")
      ? state.currentValue.slice(1)
      : "-" + state.currentValue;

    updateDisplay(true);
  }

  function handleOperator(nextOperator) {
    if (state.hasError) return;

    if (state.justEvaluated) {
      state.tokens = [state.currentValue, nextOperator];
      state.currentValue = "";
      state.justEvaluated = false;
      state.lastExpression = "";
      updateDisplay(true);
      return;
    }

    if (isWaitingForOperand()) {
      state.tokens[state.tokens.length - 1] = nextOperator;
    } else {
      state.tokens.push(state.currentValue, nextOperator);
      state.currentValue = "";
    }

    updateDisplay(true);
  }

  function evaluateTokens(tokens) {
    if (tokens.length === 0) return null;
    if (tokens.length === 1) return tokens[0];

    const nums = [];
    const ops = [];

    for (let i = 0; i < tokens.length; i++) {
      if (isOperator(tokens[i])) {
        ops.push(tokens[i]);
      } else {
        const num = parseFloat(tokens[i]);
        if (isNaN(num)) return "Error";
        nums.push(num);
      }
    }

    if (nums.length !== ops.length + 1) return "Error";

    let i = 0;
    while (i < ops.length) {
      if (ops[i] === "*" || ops[i] === "/") {
        const a = nums[i];
        const b = nums[i + 1];
        let result;
        if (ops[i] === "*") {
          result = a * b;
        } else {
          if (b === 0) return "Error";
          result = a / b;
        }
        if (!isFinite(result)) return "Error";
        nums.splice(i, 2, result);
        ops.splice(i, 1);
      } else {
        i++;
      }
    }

    let result = nums[0];
    for (let j = 0; j < ops.length; j++) {
      if (ops[j] === "+") result += nums[j + 1];
      else result -= nums[j + 1];
      if (!isFinite(result)) return "Error";
    }

    const rounded = Math.round(result * 1e10) / 1e10;
    return String(rounded);
  }

  function handleSend() {
    if (state.hasError) return;

    if (isWaitingForOperand()) {
      flashTransmitError();
      return;
    }

    const value = getRawValueForSend();
    if (value === null) {
      flashTransmitError();
      return;
    }

    if (typeof window.Calculator.onSend === "function") {
      window.Calculator.onSend(value);
    }

    clearAll();
  }

  function flashTransmitError() {
    const hint = document.getElementById("send-hint");
    if (!hint) return;
    hint.textContent = "INCOMPLETE";
    hint.classList.add("hint-error");
    setTimeout(() => {
      hint.textContent = "= TRANSMIT";
      hint.classList.remove("hint-error");
    }, 1200);
  }

  function handleBackspace() {
    if (state.hasError) {
      clearAll();
      return;
    }

    if (state.justEvaluated) {
      const val = state.currentValue;
      if (val.length <= 1 || (val.length === 2 && val.startsWith("-"))) {
        clearAll();
      } else {
        state.currentValue = val.slice(0, -1);
        state.justEvaluated = false;
        state.lastExpression = "";
      }
      updateDisplay(true);
      return;
    }

    if (state.currentValue !== "" && state.currentValue !== "0") {
      if (state.currentValue.length <= 1 || (state.currentValue.length === 2 && state.currentValue.startsWith("-"))) {
        state.currentValue = isWaitingForOperand() ? "" : "0";
      } else {
        state.currentValue = state.currentValue.slice(0, -1);
      }
      updateDisplay(true);
      return;
    }

    if (state.tokens.length >= 2) {
      state.tokens.pop();
      state.currentValue = state.tokens.pop();
      updateDisplay(true);
    } else if (state.tokens.length === 1) {
      state.currentValue = state.tokens.pop();
      updateDisplay(true);
    }
  }

  function handleAction(action, value) {
    switch (action) {
      case "digit":
        inputDigit(value);
        break;
      case "decimal":
        inputDecimal();
        break;
      case "operator":
        handleOperator(value);
        break;
      case "send":
        handleSend();
        break;
      case "clear":
        clearAll();
        break;
      case "backspace":
        handleBackspace();
        break;
      case "toggle-sign":
        toggleSign();
        break;
    }
  }

  keypad.addEventListener("click", (e) => {
    const key = e.target.closest(".key");
    if (!key) return;
    handleAction(key.dataset.action, key.dataset.value);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      inputDigit(e.key);
      return;
    }

    switch (e.key) {
      case ".":
      case ",":
        e.preventDefault();
        inputDecimal();
        break;
      case "+":
      case "-":
      case "*":
      case "/":
        e.preventDefault();
        handleOperator(e.key);
        break;
      case "Enter":
      case "=":
        e.preventDefault();
        handleSend();
        break;
      case "Escape":
        e.preventDefault();
        clearAll();
        break;
      case "Backspace":
        e.preventDefault();
        handleBackspace();
        break;
    }
  });

  updateDisplay();
})();
