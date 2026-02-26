const KEY = "blockedKeywords";
const FILTER_CONTENT_KEY = "filterArticleContent";

const keywordInput = document.getElementById("keywordInput");
const addKeywordButton = document.getElementById("addKeyword");
const chipList = document.getElementById("chipList");
const filterContentCheckbox = document.getElementById("filterContent");
const statusEl = document.getElementById("status");

let keywords = [];

function normalizeKeyword(value) {
  return String(value).trim().toLowerCase();
}

function setStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 1600);
}

function refreshActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || typeof tab.id !== "number") {
      return;
    }

    const url = tab.url || "";
    if (!/^https?:\/\//i.test(url)) {
      return;
    }

    chrome.tabs.reload(tab.id);
  });
}

function persistAndRefresh() {
  chrome.storage.sync.set({
    [KEY]: keywords,
    [FILTER_CONTENT_KEY]: filterContentCheckbox.checked
  }, () => {
    setStatus(`Lagret ${keywords.length} ord`);
    refreshActiveTab();
  });
}

function renderChips() {
  chipList.innerHTML = "";

  if (keywords.length === 0) {
    const empty = document.createElement("span");
    empty.className = "chip-empty";
    empty.textContent = "Ingen ord lagt til ennå";
    chipList.appendChild(empty);
    return;
  }

  keywords.forEach((word) => {
    const chip = document.createElement("span");
    chip.className = "chip";

    const text = document.createElement("span");
    text.textContent = word;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "chip-remove";
    removeButton.setAttribute("aria-label", `Fjern ${word}`);
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => {
      keywords = keywords.filter((item) => item !== word);
      renderChips();
      persistAndRefresh();
    });

    chip.appendChild(text);
    chip.appendChild(removeButton);
    chipList.appendChild(chip);
  });
}

function addFromInput() {
  const input = keywordInput.value;
  const parts = input.split(/[\n,]/).map(normalizeKeyword).filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  parts.forEach((part) => {
    if (!keywords.includes(part)) {
      keywords.push(part);
    }
  });

  keywordInput.value = "";
  renderChips();
  persistAndRefresh();
}

chrome.storage.sync.get([KEY, FILTER_CONTENT_KEY], (result) => {
  const values = Array.isArray(result[KEY]) ? result[KEY] : [];
  keywords = [...new Set(values.map(normalizeKeyword).filter(Boolean))];
  renderChips();
  filterContentCheckbox.checked = Boolean(result[FILTER_CONTENT_KEY]);
});

addKeywordButton.addEventListener("click", addFromInput);

keywordInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") {
    return;
  }
  event.preventDefault();
  addFromInput();
});

filterContentCheckbox.addEventListener("change", persistAndRefresh);
