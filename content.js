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
    .replace(/[\/_-]+/g, " ")
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

  if (contentText.length < 20 || contentText.length > 3000) {
    setElementHidden(element, false);
    element.dataset[PROCESSED_ATTR] = "1";
    return;
  }

  setElementHidden(element, matchesBlockedWord(contentText));
  element.dataset[PROCESSED_ATTR] = "1";
}

function closestCard(anchor) {
  const cardMatch =
    anchor.closest("article") ||
    anchor.closest("li") ||
    anchor.closest('[class*="teaser" i]') ||
    anchor.closest('[class*="article" i]') ||
    anchor.closest('[class*="card" i]') ||
    anchor.closest('[class*="story" i]') ||
    anchor.closest('[class*="item" i]') ||
    anchor.closest('[class*="sak" i]') ||
    anchor.closest('[class*="promo" i]') ||
    anchor.closest('[class*="tile" i]') ||
    anchor.closest('[data-testid*="card" i], [data-testid*="teaser" i], [data-testid*="article" i]') ||
    anchor.closest("section");

  return cardMatch || anchor.parentElement;
}

function resolveBestCardFromLink(link) {
  if (!link) {
    return null;
  }

  let node = link;
  let depth = 0;

  while (node && node !== document.body && depth < 9) {
    if (node.matches && node.matches("article, li")) {
      return node;
    }

    if (
      node.matches &&
      node.matches(
        '[class*="teaser" i], [class*="article" i], [class*="card" i], [class*="story" i], [class*="item" i], [class*="sak" i], [class*="promo" i], [class*="tile" i], [data-testid*="card" i], [data-testid*="teaser" i], [data-testid*="article" i]'
      )
    ) {
      const textLength = normalize(node.innerText || "").length;
      if (textLength >= 20 && textLength <= 3000) {
        return node;
      }
    }

    node = node.parentElement;
    depth += 1;
  }

  return closestCard(link);
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

function countContentCards(root) {
  if (!root) {
    return 0;
  }

  return root.querySelectorAll(
    "article, li, [class*='teaser' i], [class*='article' i], [class*='card' i], [class*='story' i], [class*='item' i], [class*='sak' i], [class*='promo' i], [class*='tile' i], [data-testid*='card' i], [data-testid*='teaser' i], [data-testid*='article' i]"
  ).length;
}

function resolveStripContainer(stripElement) {
  if (!stripElement) {
    return null;
  }

  const isContainerCandidate = (element) => {
    if (!element || !element.matches) {
      return false;
    }

    return element.matches(
      "section, article, ul, ol, [class*='module' i], [class*='section' i], [class*='container' i], [class*='block' i], [class*='package' i], [class*='stripe' i], [class*='shelf' i], [class*='feed' i], [class*='list' i]"
    );
  };

  let node = stripElement;
  let depth = 0;

  while (node && node !== document.body && node !== document.documentElement && depth < 8) {
    if (node.tagName === "MAIN") {
      node = node.parentElement;
      depth += 1;
      continue;
    }

    if (isContainerCandidate(node)) {
      const linkCount = node.querySelectorAll("a[href]").length;
      const articleCount = node.querySelectorAll("article").length;
      const cardCount = countContentCards(node);

      if (linkCount >= 2 || articleCount > 0 || cardCount >= 2) {
        return node;
      }
    }

    node = node.parentElement;
    depth += 1;
  }

  return null;
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

function getStripLabelText(element) {
  if (!element) {
    return "";
  }

  const directText = normalize(
    Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ")
  );

  const headingText = normalize(
    element.querySelector("h1, h2, h3, h4, h5, h6, [role='heading']")?.innerText || ""
  );

  const linkedLabelText = normalize(element.querySelector("a[href]")?.innerText || "");
  const ariaLabel = normalize(element.getAttribute("aria-label") || "");
  const dataTitle = normalize(element.getAttribute("data-title") || "");

  const candidates = [directText, headingText, linkedLabelText, ariaLabel, dataTitle].filter(Boolean);
  if (candidates.length === 0) {
    return "";
  }

  const shortCandidate = candidates.find((text) => text.length <= 160);
  if (shortCandidate) {
    return shortCandidate;
  }

  return candidates[0];
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

function hideNestedCardsInScope(scopeElement, shouldHide) {
  if (!scopeElement) {
    return;
  }

  const cardSelectors = [
    "article",
    "li",
    '[class*="teaser" i]',
    '[class*="article" i]',
    '[class*="card" i]',
    '[class*="story" i]',
    '[class*="item" i]',
    '[class*="sak" i]',
    '[class*="promo" i]',
    '[class*="tile" i]',
    '[data-testid*="card" i]',
    '[data-testid*="teaser" i]',
    '[data-testid*="article" i]'
  ];

  scopeElement.querySelectorAll(cardSelectors.join(",")).forEach((element) => {
    const hasLink = Boolean(element.querySelector("a[href]"));
    if (!hasLink) {
      return;
    }

    if (/^(NAV|HEADER)$/i.test(element.tagName)) {
      return;
    }

    setElementHidden(element, shouldHide);
    element.dataset[PROCESSED_ATTR] = "1";
  });
}

function getSectionKeywordSignal(section) {
  if (!section) {
    return "";
  }

  const signalParts = [];

  signalParts.push(section.getAttribute("data-title") || "");
  signalParts.push(section.id || "");
  signalParts.push(section.className || "");

  section.querySelectorAll("a[href]").forEach((link) => {
    signalParts.push(link.getAttribute("href") || "");
  });

  section.querySelectorAll("script[src]").forEach((script) => {
    signalParts.push(script.getAttribute("src") || "");
  });

  return normalize(signalParts.join(" "));
}

function updateTopStripSectionsVisibility(force = false) {
  const stripSelectors = [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    '[role="heading"]',
    '[aria-level]',
    '[class*="kicker"]',
    '[class*="rubrikk"]',
    '[class*="topic"]',
    '[class*="tag"]',
    '[class*="topstripe" i]',
    '[class*="stripe"]',
    '[class*="header"]',
    '[class*="heading"]',
    '[class*="title"]',
    '[class*="label"]',
    '[data-testid*="stripe" i]',
    '[data-test-id*="stripe" i]'
  ];

  document.querySelectorAll(stripSelectors.join(",")).forEach((stripElement) => {
    if (!force && stripElement.dataset[PROCESSED_ATTR] === "1") {
      return;
    }

    const stripText = getStripLabelText(stripElement) || normalize(stripElement.innerText || "");
    if (!stripText || stripText.length < 2 || stripText.length > 240) {
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
      hideNestedCardsInScope(container, true);
      stripElement.dataset[PROCESSED_ATTR] = "1";
      return;
    }

    setElementHidden(stripElement, true);
    hideFollowingSiblingsFrom(stripElement, true);
    hideFollowingSiblingsFrom(stripElement.parentElement, true);
    hideFollowingSiblingsFrom(stripElement.parentElement?.parentElement, true);
    hideNestedCardsInScope(stripElement.parentElement, true);
    hideNestedCardsInScope(stripElement.parentElement?.parentElement, true);

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

    const hasTopStripeWidget = Boolean(
      section.querySelector(
        '.vg-marius-toppstripe, vg-marius-toppstripe, [class*="topstripe" i], script[src*="toppstripe" i]'
      )
    );

    const signalText = hasTopStripeWidget ? getSectionKeywordSignal(section) : "";

    const shouldHide =
      (titleText && matchesBlockedWord(titleText)) ||
      (signalText && matchesBlockedWord(signalText));

    if (!titleText && !signalText) {
      return;
    }

    setElementHidden(section, shouldHide);
    section.dataset[PROCESSED_ATTR] = "1";
  });
}

function scanPage({ force = false } = {}) {
  const selectors = [
    "article",
    "li",
    '[class*="teaser" i]',
    '[class*="article" i]',
    '[class*="card" i]',
    '[class*="story" i]',
    '[class*="item" i]',
    '[class*="sak" i]',
    '[class*="promo" i]',
    '[class*="tile" i]',
    '[data-testid*="card" i]',
    '[data-testid*="teaser" i]',
    '[data-testid*="article" i]'
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

    const card = resolveBestCardFromLink(link);
    if (!card || (!force && card.dataset[PROCESSED_ATTR] === "1")) {
      return;
    }

    const text = normalize(card.innerText || link.innerText || "");
    if (text.length < 20 || text.length > 3000) {
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
