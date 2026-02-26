const STORAGE_KEY = "blockedKeywords";
const FILTER_CONTENT_KEY = "filterArticleContent";
const PROCESSED_ATTR = "articleFilterProcessed";
const HIDDEN_ATTR = "articleFilterHidden";
const PREV_DISPLAY_ATTR = "articleFilterPrevDisplay";
const CONTENT_TARGET_ATTR = "articleFilterContentTarget";
const HIDDEN_SELECTOR = "[data-article-filter-hidden]";
let blockedKeywords = [];
let filterArticleContent = false;

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesBlockedWord(text) {
  if (!text || blockedKeywords.length === 0) {
    return false;
  }

  return blockedKeywords.some((word) => text.includes(word));
}

function isInternalHttpLink(href) {
  if (!href) {
    return false;
  }

  const trimmedHref = href.trim();
  if (
    !trimmedHref ||
    trimmedHref.startsWith("#") ||
    /^(javascript:|mailto:|tel:)/i.test(trimmedHref)
  ) {
    return false;
  }

  try {
    const url = new URL(trimmedHref, window.location.href);
    return /^https?:$/.test(url.protocol) && url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function setElementHidden(element, hidden) {
  if (!element) {
    return;
  }

  if (hidden) {
    if (element.dataset[HIDDEN_ATTR] !== "1") {
      element.dataset[PREV_DISPLAY_ATTR] = element.style.display || "";
    }

    element.style.setProperty("display", "none", "important");
    element.dataset[HIDDEN_ATTR] = "1";
    return;
  }

  if (element.dataset[HIDDEN_ATTR] === "1") {
    const previousDisplay = element.dataset[PREV_DISPLAY_ATTR] ?? "";
    if (previousDisplay) {
      element.style.display = previousDisplay;
    } else {
      element.style.removeProperty("display");
    }
  }

  delete element.dataset[HIDDEN_ATTR];
  delete element.dataset[PREV_DISPLAY_ATTR];
}

function updateIfMatch(element, force = false) {
  if (!element || (!force && element.dataset[PROCESSED_ATTR] === "1")) {
    return;
  }

  const contentText = normalize(element.innerText || "");
  if (!contentText) {
    element.dataset[PROCESSED_ATTR] = "1";
    return;
  }

  if (contentText.length < 20 || contentText.length > 1800) {
    setElementHidden(element, false);
    element.dataset[PROCESSED_ATTR] = "1";
    return;
  }

  setElementHidden(element, matchesBlockedWord(contentText));
  element.dataset[PROCESSED_ATTR] = "1";
}

function closestCard(anchor) {
  return (
    anchor.closest("article") ||
    anchor.closest("li") ||
    anchor.closest('[class*="teaser"]') ||
    anchor.closest('[class*="article"]') ||
    anchor.closest('[class*="card"]') ||
    anchor.closest("section") ||
    anchor.parentElement
  );
}

function getContentTarget() {
  const contentTarget =
    document.querySelector("main article") ||
    document.querySelector("article") ||
    document.querySelector("main");

  if (!contentTarget) {
    return null;
  }

  contentTarget.dataset[CONTENT_TARGET_ATTR] = "1";
  return contentTarget;
}

function updateContentTargetVisibility() {
  const contentTarget = getContentTarget();
  if (!contentTarget) {
    return;
  }

  if (!filterArticleContent) {
    setElementHidden(contentTarget, false);
    delete contentTarget.dataset[PROCESSED_ATTR];
    return;
  }

  const text = normalize(contentTarget.innerText || "");
  if (!text || text.length < 80) {
    setElementHidden(contentTarget, false);
    contentTarget.dataset[PROCESSED_ATTR] = "1";
    return;
  }

  setElementHidden(contentTarget, matchesBlockedWord(text));
  contentTarget.dataset[PROCESSED_ATTR] = "1";
}

function resolveStripContainer(stripElement) {
  if (!stripElement) {
    return null;
  }

  const container = stripElement.closest(
    "section, article, [class*='module'], [class*='section'], [class*='container'], [class*='block']"
  );

  if (!container || container === document.body || container === document.documentElement) {
    return null;
  }

  if (container.tagName === "MAIN") {
    return null;
  }

  const linkCount = container.querySelectorAll("a[href]").length;
  const articleCount = container.querySelectorAll("article").length;
  if (linkCount < 2 && articleCount === 0) {
    return null;
  }

  return container;
}

function isLikelyNextStrip(element) {
  if (!element) {
    return false;
  }

  const text = normalize(element.innerText || "");
  return (
    /^(h1|h2|h3)$/i.test(element.tagName) ||
    /stripe|header|heading|title|label|kicker|rubrikk|topic|tag/i.test(element.className || "") ||
    (text.length > 0 && text.length <= 60 && element.querySelectorAll("a[href]").length <= 2)
  );
}

function hideFollowingSiblingsFrom(baseElement, shouldHide) {
  if (!baseElement) {
    return;
  }

  let sibling = baseElement.nextElementSibling;
  while (sibling) {
    if (isLikelyNextStrip(sibling)) {
      break;
    }

    setElementHidden(sibling, shouldHide);
    sibling = sibling.nextElementSibling;
  }
}

function updateTopStripSectionsVisibility(force = false) {
  const stripSelectors = [
    "h1",
    "h2",
    "h3",
    '[class*="kicker"]',
    '[class*="rubrikk"]',
    '[class*="topic"]',
    '[class*="tag"]',
    '[class*="stripe"]',
    '[class*="header"]',
    '[class*="heading"]',
    '[class*="title"]',
    '[class*="label"]'
  ];

  document.querySelectorAll(stripSelectors.join(",")).forEach((stripElement) => {
    if (!force && stripElement.dataset[PROCESSED_ATTR] === "1") {
      return;
    }

    const stripText = normalize(stripElement.innerText || "");
    if (!stripText || stripText.length < 2 || stripText.length > 120) {
      stripElement.dataset[PROCESSED_ATTR] = "1";
      return;
    }

    const shouldHide = matchesBlockedWord(stripText);
    if (!shouldHide) {
      stripElement.dataset[PROCESSED_ATTR] = "1";
      return;
    }

    const container = resolveStripContainer(stripElement);
    if (container) {
      setElementHidden(container, true);
      stripElement.dataset[PROCESSED_ATTR] = "1";
      return;
    }

    setElementHidden(stripElement, true);
    hideFollowingSiblingsFrom(stripElement, true);
    hideFollowingSiblingsFrom(stripElement.parentElement, true);
    hideFollowingSiblingsFrom(stripElement.parentElement?.parentElement, true);

    stripElement.dataset[PROCESSED_ATTR] = "1";
  });
}

function updateContainerPackageVisibility(force = false) {
  document.querySelectorAll("section.container-package").forEach((section) => {
    const titleText = normalize(
      section.getAttribute("data-title") ||
      section.querySelector("header .title")?.innerText ||
      ""
    );

    if (!titleText) {
      return;
    }

    setElementHidden(section, matchesBlockedWord(titleText));
    section.dataset[PROCESSED_ATTR] = "1";
  });
}

function scanPage({ force = false } = {}) {
  const selectors = [
    "article",
    '[class*="teaser"]',
    '[class*="article"]',
    '[class*="card"]'
  ];

  if (force) {
    document.querySelectorAll(HIDDEN_SELECTOR).forEach((element) => {
      setElementHidden(element, false);
      delete element.dataset[PROCESSED_ATTR];
    });
  }

  if (blockedKeywords.length === 0) {
    document.querySelectorAll(HIDDEN_SELECTOR).forEach((element) => {
      setElementHidden(element, false);
      if (force) {
        delete element.dataset[PROCESSED_ATTR];
      }
    });
    return;
  }

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => updateIfMatch(element, force));
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!isInternalHttpLink(href)) {
      return;
    }

    const card = closestCard(link);
    if (!card || (!force && card.dataset[PROCESSED_ATTR] === "1")) {
      return;
    }

    const text = normalize(card.innerText || link.innerText || "");
    if (text.length < 20 || text.length > 1800) {
      return;
    }

    setElementHidden(card, matchesBlockedWord(text));
    card.dataset[PROCESSED_ATTR] = "1";
  });

  updateTopStripSectionsVisibility(force);
  updateContainerPackageVisibility(force);
  updateContentTargetVisibility();
}

function updateSettings() {
  chrome.storage.sync.get([STORAGE_KEY, FILTER_CONTENT_KEY], (result) => {
    blockedKeywords = Array.isArray(result[STORAGE_KEY])
      ? result[STORAGE_KEY].map((word) => normalize(String(word))).filter(Boolean)
      : [];
    filterArticleContent = Boolean(result[FILTER_CONTENT_KEY]);

    scanPage({ force: true });
  });
}

updateSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") {
    return;
  }

  if (changes[STORAGE_KEY]) {
    blockedKeywords = Array.isArray(changes[STORAGE_KEY].newValue)
      ? changes[STORAGE_KEY].newValue.map((word) => normalize(String(word))).filter(Boolean)
      : [];
  }

  if (changes[FILTER_CONTENT_KEY]) {
    filterArticleContent = Boolean(changes[FILTER_CONTENT_KEY].newValue);
  }

  scanPage({ force: true });
});

let timer = null;
const observer = new MutationObserver(() => {
  if (timer) {
    clearTimeout(timer);
  }

  timer = setTimeout(() => scanPage(), 120);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["data-title", "class"]
});
