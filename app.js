import data from "./data.js";

// Configuration
const MAX_RESULTS = 10;

// 1. Normalize accents, apostrophes, spaces and capitalization.
function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’‘`´ʼʻ＇]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// 2. Extract a searchable label from each dataset item.
// Supports strings and objects containing a name or label.
function getLabel(item) {
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }

  if (item && typeof item === "object") {
    const value = item.name ?? item.label;

    if (value !== undefined && value !== null) {
      return String(value);
    }
  }

  return "";
}

// 3. Build the index only once.
const searchIndex = data
  .map((item, originalIndex) => ({
    item,
    label: getLabel(item),
    normalized: normalizeText(getLabel(item)),
    originalIndex,
  }))
  .filter((entry) => entry.normalized.length > 0);

// 4. Search anywhere in the text, not just at the beginning.
function autocomplete(query, limit = MAX_RESULTS) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery || limit <= 0) {
    return [];
  }

  const results = [];

  for (const entry of searchIndex) {
    if (entry.normalized.includes(normalizedQuery)) {
      results.push(entry);

      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
}

// DOM elements
const input = document.getElementById("search-input");
const suggestions = document.getElementById("suggestions");
const clearButton = document.getElementById("clear-button");
const status = document.getElementById("status");

let currentResults = [];
let activeIndex = -1;

// 5. Highlight the matching part safely.
// Use text nodes rather than inserting user input as HTML.
function highlightMatch(label, query) {
  const fragment = document.createDocumentFragment();
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    fragment.appendChild(document.createTextNode(label));
    return fragment;
  }

  // Find a matching substring using normalized text while preserving
  // the original spelling and accents in the displayed result.
  const characters = Array.from(label);
  let matchStart = -1;
  let matchEnd = -1;

  for (let start = 0; start < characters.length; start++) {
    for (let end = start + 1; end <= characters.length; end++) {
      const candidate = characters.slice(start, end).join("");

      if (normalizeText(candidate) === normalizedQuery) {
        matchStart = start;
        matchEnd = end;
        break;
      }
    }

    if (matchStart !== -1) break;
  }

  if (matchStart === -1) {
    fragment.appendChild(document.createTextNode(label));
    return fragment;
  }

  fragment.appendChild(
    document.createTextNode(characters.slice(0, matchStart).join("")),
  );

  const mark = document.createElement("mark");
  mark.textContent = characters.slice(matchStart, matchEnd).join("");
  fragment.appendChild(mark);

  fragment.appendChild(
    document.createTextNode(characters.slice(matchEnd).join("")),
  );

  return fragment;
}

// 6. Render the suggestions.
function renderSuggestions(query) {
  currentResults = autocomplete(query);
  activeIndex = -1;

  suggestions.replaceChildren();

  if (!normalizeText(query)) {
    closeSuggestions();
    status.textContent = "";
    return;
  }

  if (currentResults.length === 0) {
    closeSuggestions();
    status.textContent = "No results found.";
    return;
  }

  currentResults.forEach((entry, index) => {
    const li = document.createElement("li");

    li.className = "suggestion";
    li.id = `suggestion-${index}`;
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", "false");
    li.appendChild(highlightMatch(entry.label, query));

    li.addEventListener("mousedown", (event) => {
      // Prevent blur before selection on mouse interaction.
      event.preventDefault();
      selectResult(index);
    });

    suggestions.appendChild(li);
  });

  suggestions.hidden = false;
  input.setAttribute("aria-expanded", "true");
  status.textContent =
    `${currentResults.length} suggestion` +
    `${currentResults.length === 1 ? "" : "s"} shown.`;
}

// 7. Close the dropdown.
function closeSuggestions() {
  suggestions.hidden = true;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
  activeIndex = -1;
}

// 8. Select a result.
function selectResult(index) {
  const entry = currentResults[index];

  if (!entry) return;

  input.value = entry.label;
  clearButton.classList.add("visible");
  status.textContent = `Selected: ${entry.label}`;
  closeSuggestions();
  input.focus();
}

// 9. Keyboard navigation.
function updateActiveOption() {
  const options = suggestions.querySelectorAll(".suggestion");

  options.forEach((option, index) => {
    const isActive = index === activeIndex;

    option.classList.toggle("active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  if (activeIndex >= 0 && options[activeIndex]) {
    input.setAttribute("aria-activedescendant", options[activeIndex].id);

    options[activeIndex].scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

// 10. Listen to typing.
input.addEventListener("input", () => {
  clearButton.classList.toggle("visible", input.value.length > 0);
  renderSuggestions(input.value);
});

// 11. Handle keyboard controls.
input.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    if (suggestions.hidden) {
      renderSuggestions(input.value);
    }

    if (currentResults.length > 0) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % currentResults.length;
      updateActiveOption();
    }
  } else if (event.key === "ArrowUp") {
    if (currentResults.length > 0 && !suggestions.hidden) {
      event.preventDefault();

      activeIndex =
        activeIndex <= 0 ? currentResults.length - 1 : activeIndex - 1;

      updateActiveOption();
    }
  } else if (event.key === "Enter") {
    if (!suggestions.hidden && activeIndex >= 0) {
      event.preventDefault();
      selectResult(activeIndex);
    }
  } else if (event.key === "Escape") {
    closeSuggestions();
  }
});

// 12. Clear the input.
clearButton.addEventListener("click", () => {
  input.value = "";
  clearButton.classList.remove("visible");
  status.textContent = "";
  closeSuggestions();
  suggestions.replaceChildren();
  currentResults = [];
  input.focus();
});

// 13. Close when clicking outside.
document.addEventListener("click", (event) => {
  if (!event.target.closest(".search-container")) {
    closeSuggestions();
  }
});

// Optional: expose functions for testing in the browser console.
window.autocompleteSearch = autocomplete;
window.normalizeSearchText = normalizeText;
