/**
 * Grammar Simplification Visualizer
 * Zero-dependency vanilla JS application
 */

// ─── DOM References ───────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const DOM = {
  // Input pane
  startSymbol:    $('#start-symbol'),
  rulesContainer: $('#rules-container'),
  addRuleBtn:     $('#btn-add-rule'),
  simplifyBtn:    $('#btn-simplify'),
  clearBtn:       $('#btn-clear'),
  dropdownContainer: $('#sample-dropdown'),
  dropdownHeader: $('#sample-dropdown-header'),
  dropdownItems:  $$('.pill-dropdown__item'),
  ruleCount:      $('#rule-count'),

  // Center pane — playback
  stepsBody:          $('#steps-body'),
  stepDisplay:        $('#step-display'),
  emptyState:         $('#empty-state'),
  stepCounter:        $('#step-counter'),
  phaseBadge:         $('#phase-badge'),
  phaseTitle:         $('#phase-title'),
  descriptionBox:     $('#description-box'),
  descriptionText:    $('#description-text'),
  grammarDisplay:     $('#grammar-display'),
  highlightsContainer:$('#highlights-container'),

  // Playback controls
  btnStepBack:    $('#btn-step-back'),
  btnPlay:        $('#btn-play'),
  btnStepForward: $('#btn-step-forward'),
  playIcon:       $('#play-icon'),
  pauseIcon:      $('#pause-icon'),
  progressFill:   $('#progress-fill'),
  progressTrack:  $('#progress-track'),
  speedSelect:    $('#speed-select'),

  // Theme toggle
  themeDarkBtn:  $('#theme-dark'),
  themeLightBtn: $('#theme-light'),

  // Tree + status
  treeCanvas:   $('#tree-canvas'),
  statusText:   $('#status-text'),

  // Header Menu & Quiz Modal
  headerMenu:       $('#header-menu'),
  btnHamburger:     $('#btn-hamburger'),
  btnPracticeQuiz:  $('#btn-practice-quiz'),
  quizModal:        $('#quiz-modal'),
  btnCloseQuiz:     $('#btn-close-quiz'),
  quizGrammarDisplay: $('#quiz-grammar-display'),
  quizPrompt:       $('#quiz-prompt'),
  quizOptionsContainer: $('#quiz-options'),
  quizOptions:      $$('.quiz-option'),
  quizFeedback:     $('#quiz-feedback'),
  btnQuizReset:     $('#btn-quiz-reset'),
  btnQuizNext:      $('#btn-quiz-next'),
};

// ─── State ────────────────────────────────────────────────────
let ruleIdCounter = 0;

const state = {
  rules: [],              // { id, lhs, rhs }
  steps: [],              // HistoryState[]
  currentStepIndex: -1,   // Playback cursor (-1 = no step)
  isPlaying: false,       // Auto-play active?
  playTimer: null,        // setInterval ID
};

// ─── Quiz Data ───────────────────────────────────────────────────
const quizQuestions = [
  {
    initialGrammar: "S → ABC | a\nA → aA | ε\nB → b | ε\nC → cC",
    questionText: "Identify the correct grammar after removing Null (ε) productions.",
    options: [
      "S → ABC | BC | AC | C | a\nA → aA | a\nB → b\nC → cC",
      "S → ABC | BC | AC | a\nA → aA | a\nB → b\nC → cC",
      "S → ABC | BC | AC | C | a\nA → aA\nB → b\nC → cC",
      "S → ABC | BC | AC | C | a | ε\nA → aA | a\nB → b\nC → cC"
    ],
    correctIndex: 0,
    explanations: [
      "Correct: Both A and B are nullable. Removing them from S creates combinations {ABC, BC, AC, C}. A's right-hand 'aA' becomes 'a', and B's right-hand 'ε' is dropped entirely.",
      "Incorrect: You found the combinations for S, but forgot the case where BOTH A and B are removed simultaneously, which should leave just C.",
      "Incorrect: You successfully updated S, but forgot to update A. When a non-terminal like A is nullable, any production containing it (like A → aA) must also produce a version without it (A → a).",
      "Incorrect: You added ε to S, but S itself is not nullable! The combination where both A and B are removed leaves C, which cannot derive ε."
    ]
  },
  {
    initialGrammar: "S → A | b\nA → B | a\nB → C\nC → c",
    questionText: "Identify the correct grammar after removing Unit productions.",
    options: [
      "S → A | b | a | c\nA → B | a | c\nB → C | c\nC → c",
      "S → b | a\nA → a | c\nB → c\nC → c",
      "S → b | a | c\nA → a | c\nB → c\nC → c",
      "S → b | a | c"
    ],
    correctIndex: 2,
    explanations: [
      "Incorrect: You added the non-unit productions but failed to actually remove the unit productions (S → A, A → B, etc.).",
      "Incorrect: You missed the transitive unit closure. Since S → A and A → B and B → C, S must also inherit the non-unit productions of C (S → c).",
      "Correct: You found all unit closures (S inherits from A, B, C; A inherits from B, C; B inherits from C) and correctly replaced the unit rules with their respective non-unit productions.",
      "Incorrect: You correctly updated S, but improperly deleted the other non-terminals. Unless they are proven useless in a subsequent phase, they must remain in the grammar."
    ]
  },
  {
    initialGrammar: "S → aA | b\nA → aA\nB → bB | a",
    questionText: "Identify the correct grammar after removing Useless symbols.",
    options: [
      "S → aA | b\nA → aA",
      "S → b\nB → bB | a",
      "S → b",
      "S → b\nA → aA\nB → bB | a"
    ],
    correctIndex: 2,
    explanations: [
      "Incorrect: You removed the unreachable symbol 'B', but failed to notice that 'A' is non-generating. 'A' can strictly never terminate into a string of terminals.",
      "Incorrect: You successfully removed the non-generating symbol 'A' and the rule S → aA, but you forgot to remove 'B', which is completely unreachable from the start symbol S.",
      "Correct: 'A' is non-generating (cannot derive a terminal string), so it and 'S → aA' are removed. 'B' is generating but unreachable from S, so it is also removed. Only S → b remains.",
      "Incorrect: You correctly identified that S → aA uses a non-generating symbol 'A', but you kept 'A' and 'B' in the grammar. Useless variables and their rules must be entirely eliminated."
    ]
  }
];

// ─── Quiz Logic ──────────────────────────────────────────────────
let currentQuestionIndex = 0;
let isQuestionAnswered = false;

function loadQuizQuestion(index) {
  if (index < 0 || index >= quizQuestions.length) return;
  currentQuestionIndex = index;
  isQuestionAnswered = false;
  
  const q = quizQuestions[index];
  
  // Populate text
  DOM.quizGrammarDisplay.innerHTML = q.initialGrammar.replace(/\n/g, '<br>');
  DOM.quizPrompt.textContent = q.questionText;
  
  // Reset feedback
  DOM.quizFeedback.style.display = 'none';
  DOM.quizFeedback.className = 'quiz-feedback';
  DOM.quizFeedback.textContent = '';
  
  // Populate options
  DOM.quizOptions.forEach((btn, i) => {
    btn.innerHTML = q.options[i].replace(/\n/g, '<br>');
    btn.className = 'quiz-option'; // Reset classes
    btn.disabled = false;          // Re-enable
  });
  
  // Reset next button state
  DOM.btnQuizNext.disabled = true;
  DOM.btnQuizNext.textContent = 'Next Question';
}

function handleOptionClick(selectedIndex) {
  if (isQuestionAnswered) return;
  isQuestionAnswered = true;
  
  const q = quizQuestions[currentQuestionIndex];
  const isCorrect = (selectedIndex === q.correctIndex);
  
  // Disable all options
  DOM.quizOptions.forEach((btn, i) => {
    btn.disabled = true;
    btn.classList.add('is-disabled');
    
    // Highlight correct option if they were wrong
    if (!isCorrect && i === q.correctIndex) {
      btn.classList.add('is-selected');
      btn.style.borderColor = '#39d2c0';
      btn.style.backgroundColor = 'rgba(57, 210, 192, 0.1)';
      btn.style.color = '#39d2c0';
    }
  });
  
  // Highlight clicked option
  const clickedBtn = DOM.quizOptions[selectedIndex];
  clickedBtn.classList.add('is-selected');
  if (isCorrect) {
    clickedBtn.style.borderColor = '#39d2c0';
    clickedBtn.style.backgroundColor = 'rgba(57, 210, 192, 0.1)';
    clickedBtn.style.color = '#39d2c0';
  } else {
    clickedBtn.style.borderColor = 'var(--accent-error)';
    clickedBtn.style.backgroundColor = 'rgba(248, 81, 73, 0.1)';
    clickedBtn.style.color = 'var(--accent-error)';
  }
  
  // Show feedback
  DOM.quizFeedback.style.display = 'block';
  DOM.quizFeedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  DOM.quizFeedback.innerHTML = q.explanations[selectedIndex].replace(/\n/g, '<br>');
  
  // Enable next button
  DOM.btnQuizNext.disabled = false;
  
  // If Last question, change text
  if (currentQuestionIndex === quizQuestions.length - 1) {
    DOM.btnQuizNext.textContent = 'Finish';
  }
}

function initQuiz() {
  DOM.quizOptions.forEach((btn, i) => {
    btn.addEventListener('click', () => handleOptionClick(i));
  });
  
  DOM.btnQuizNext.addEventListener('click', () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      // Clear inline styles
      DOM.quizOptions.forEach(btn => {
        btn.style.borderColor = '';
        btn.style.backgroundColor = '';
        btn.style.color = '';
      });
      loadQuizQuestion(currentQuestionIndex + 1);
    } else {
      DOM.quizModal.classList.remove('is-active');
      // Reset inline styles for next open
      DOM.quizOptions.forEach(btn => {
        btn.style.borderColor = '';
        btn.style.backgroundColor = '';
        btn.style.color = '';
      });
      loadQuizQuestion(0);
    }
  });
  
  DOM.btnQuizReset.addEventListener('click', () => {
    DOM.quizOptions.forEach(btn => {
      btn.style.borderColor = '';
      btn.style.backgroundColor = '';
      btn.style.color = '';
    });
    loadQuizQuestion(0);
  });
  
  // Preload first question
  loadQuizQuestion(0);
}

// ─── Rule Management ──────────────────────────────────────────

/** Creates a new rule row in the left pane */
function addRule(lhs = '', rhs = '') {
  const id = ++ruleIdCounter;
  state.rules.push({ id, lhs, rhs });

  const row = document.createElement('div');
  row.className = 'rule-row';
  row.dataset.ruleId = id;
  row.innerHTML = `
    <input
      class="form-input rule-row__lhs mono"
      type="text"
      maxlength="3"
      placeholder="A"
      value="${escapeHtml(lhs)}"
      aria-label="Non-terminal"
      id="rule-lhs-${id}"
    />
    <span class="rule-row__arrow">→</span>
    <input
      class="form-input rule-row__rhs mono"
      type="text"
      placeholder="aB | ε"
      value="${escapeHtml(rhs)}"
      aria-label="Productions"
      id="rule-rhs-${id}"
    />
    <button
      class="rule-row__delete"
      data-tooltip="Remove rule"
      aria-label="Remove rule"
      id="rule-del-${id}"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  // Wire up live sync
  const lhsInput = row.querySelector('.rule-row__lhs');
  const rhsInput = row.querySelector('.rule-row__rhs');

  lhsInput.addEventListener('input', () => {
    const r = state.rules.find(r => r.id === id);
    if (r) r.lhs = lhsInput.value.trim();
  });
  rhsInput.addEventListener('input', () => {
    const r = state.rules.find(r => r.id === id);
    if (r) r.rhs = rhsInput.value.trim();
  });

  // Delete handler
  row.querySelector('.rule-row__delete').addEventListener('click', () => {
    state.rules = state.rules.filter(r => r.id !== id);
    row.style.animation = 'ruleSlideIn 200ms ease-out reverse forwards';
    setTimeout(() => row.remove(), 200);
    updateRuleCount();
  });

  DOM.rulesContainer.appendChild(row);
  lhsInput.focus();
  updateRuleCount();
}

function updateRuleCount() {
  DOM.ruleCount.textContent = `${state.rules.length} rule${state.rules.length !== 1 ? 's' : ''}`;
}

/** Clear all rules and steps */
function clearAll() {
  state.rules = [];
  state.steps = [];
  state.currentStepIndex = -1;
  ruleIdCounter = 0;
  stopPlay();
  DOM.rulesContainer.innerHTML = '';
  updateRuleCount();
  showEmptyState();
  clearTree();
  setStatus('Cleared');
}

// ─── Grammar Parsing ──────────────────────────────────────────

/**
 * Determine if a symbol is a non-terminal (uppercase letter).
 */
function isNonTerminal(sym) {
  return /^[A-Z]/.test(sym) && sym !== 'ε';
}

/**
 * Deep-clone a grammar object so mutations don't propagate.
 */
function cloneGrammar(grammar) {
  const rules = new Map();
  for (const [nt, prods] of grammar.rules) {
    rules.set(nt, prods.map(p => [...p]));
  }
  return { startSymbol: grammar.startSymbol, rules };
}

/**
 * Compare two productions (arrays of symbols) for equality.
 */
function prodEquals(a, b) {
  if (a.length !== b.length) return false;
  return a.every((sym, i) => sym === b[i]);
}

/**
 * Format a single production rule as a string: "A → aB | c"
 */
function formatRule(nt, prods) {
  if (!prods || prods.length === 0) return '';
  const rhs = prods.map(p => p.join('')).join(' | ');
  return `${nt} → ${rhs}`;
}

/**
 * Parse the UI inputs into a grammar object.
 * Returns { startSymbol, rules: Map<string, string[][]> }
 * Each non-terminal maps to an array of productions, where each
 * production is an array of symbols.
 */
function parseGrammar() {
  const startSymbol = DOM.startSymbol.value.trim() || 'S';
  const rules = new Map();

  for (const { lhs, rhs } of state.rules) {
    if (!lhs || !rhs) continue;

    const alternatives = rhs.split('|').map(alt => alt.trim()).filter(Boolean);
    const productions = alternatives.map(alt => {
      if (alt === 'ε' || alt === 'epsilon' || alt === 'eps') return ['ε'];
      // Tokenize: each uppercase letter is a non-terminal, lowercase/digits are terminals
      const tokens = [];
      for (const ch of alt) {
        if (ch.trim()) tokens.push(ch);
      }
      return tokens;
    });

    if (!rules.has(lhs)) rules.set(lhs, []);
    rules.get(lhs).push(...productions);
  }

  return { startSymbol, rules };
}

/**
 * Convert a grammar object to a structured array of { nt, production }
 * for display. Maintains start-symbol-first ordering.
 */
function grammarToRuleList(grammar) {
  const list = [];
  const ordered = [grammar.startSymbol, ...[...grammar.rules.keys()].filter(k => k !== grammar.startSymbol)];
  for (const nt of ordered) {
    const prods = grammar.rules.get(nt);
    if (!prods || prods.length === 0) continue;
    for (const prod of prods) {
      list.push({ nt, production: [...prod] });
    }
  }
  return list;
}

/**
 * Convert a grammar object back to a display string.
 */
function grammarToString(grammar) {
  let out = '';
  if (grammar.rules.has(grammar.startSymbol)) {
    out += formatRule(grammar.startSymbol, grammar.rules.get(grammar.startSymbol)) + '\n';
  }
  for (const [nt, prods] of grammar.rules) {
    if (nt === grammar.startSymbol) continue;
    if (prods.length > 0) out += formatRule(nt, prods) + '\n';
  }
  return out.trim();
}


// ═══════════════════════════════════════════════════════════════
//  PHASE 1: REMOVE NULL (ε) PRODUCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Removes all ε-productions while preserving the generated language.
 * Returns an array of HistoryState objects documenting each micro-step.
 *
 * Algorithm:
 *  1. Find all nullable variables (those that can derive ε).
 *  2. For every production containing nullable variables, add all
 *     combinations with those variables removed.
 *  3. Remove all explicit ε-productions.
 *  4. If the start symbol was nullable, add S' → S | ε.
 */
function removeNullProductions(grammar, startStepId) {
  const history = [];
  let stepId = startStepId;
  let g = cloneGrammar(grammar);

  // ── Step: Identify directly nullable variables ──
  const nullable = new Set();

  // Direct nullable: A → ε
  for (const [nt, prods] of g.rules) {
    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') {
        nullable.add(nt);
      }
    }
  }

  history.push({
    stepId: stepId++,
    phase: 'Remove Null Productions',
    description: `Identify directly nullable variables: ${nullable.size > 0 ? `{ ${[...nullable].join(', ')} }` : '∅'}. These have ε as a direct production.`,
    currentGrammar: cloneGrammar(g),
    highlightedRules: [...nullable].map(nt => ({
      rule: formatRule(nt, [['ε']]),
      type: 'identified', // visually highlight
    })),
  });

  // ── Step: Find indirectly nullable (fixed-point) ──
  let changed = true;
  const iterationSets = [];
  while (changed) {
    changed = false;
    for (const [nt, prods] of g.rules) {
      if (nullable.has(nt)) continue;
      for (const prod of prods) {
        // A production is nullable if ALL its symbols are nullable non-terminals
        if (prod.every(sym => nullable.has(sym))) {
          nullable.add(nt);
          changed = true;
          iterationSets.push(nt);
        }
      }
    }
  }

  if (iterationSets.length > 0) {
    history.push({
      stepId: stepId++,
      phase: 'Remove Null Productions',
      description: `Compute nullable closure (fixed-point). Indirectly nullable: { ${iterationSets.join(', ')} }. Full nullable set: { ${[...nullable].join(', ')} }.`,
      currentGrammar: cloneGrammar(g),
      highlightedRules: iterationSets.map(nt => ({
        rule: formatRule(nt, g.rules.get(nt)),
        type: 'identified',
      })),
    });
  } else {
    history.push({
      stepId: stepId++,
      phase: 'Remove Null Productions',
      description: `No indirectly nullable variables found. Final nullable set: { ${[...nullable].join(', ')} }.`,
      currentGrammar: cloneGrammar(g),
      highlightedRules: [],
    });
  }

  // ── Step: Generate new productions for each rule containing nullable symbols ──
  const newGrammar = cloneGrammar(g);
  const addedRules = [];

  for (const [nt, prods] of g.rules) {
    const expandedProds = [];

    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') continue; // skip ε itself

      // Find positions of nullable symbols in this production
      const nullablePositions = [];
      for (let i = 0; i < prod.length; i++) {
        if (nullable.has(prod[i])) {
          nullablePositions.push(i);
        }
      }

      if (nullablePositions.length === 0) {
        // No nullable symbols — keep as-is
        expandedProds.push([...prod]);
        continue;
      }

      // Generate all subsets of nullable positions (include / exclude each)
      const totalCombinations = 1 << nullablePositions.length;
      for (let mask = 0; mask < totalCombinations; mask++) {
        const newProd = [];
        for (let i = 0; i < prod.length; i++) {
          const nIdx = nullablePositions.indexOf(i);
          if (nIdx !== -1 && (mask & (1 << nIdx))) {
            // This nullable symbol is excluded in this combination
            continue;
          }
          newProd.push(prod[i]);
        }
        // Don't add empty productions
        if (newProd.length > 0) {
          expandedProds.push(newProd);
        }
      }
    }

    // Deduplicate
    const uniqueProds = [];
    for (const ep of expandedProds) {
      if (!uniqueProds.some(up => prodEquals(up, ep))) {
        uniqueProds.push(ep);
      }
    }

    // Track what was added
    const originalProds = g.rules.get(nt).filter(p => !(p.length === 1 && p[0] === 'ε'));
    for (const up of uniqueProds) {
      if (!originalProds.some(op => prodEquals(op, up))) {
        addedRules.push({ rule: `${nt} → ${up.join('')}`, type: 'added' });
      }
    }

    newGrammar.rules.set(nt, uniqueProds);
  }

  // ── Step: Show the expanded grammar ──
  const removedEpsilons = [];
  for (const [nt, prods] of g.rules) {
    for (const prod of prods) {
      if (prod.length === 1 && prod[0] === 'ε') {
        removedEpsilons.push({ rule: `${nt} → ε`, type: 'removed' });
      }
    }
  }

  history.push({
    stepId: stepId++,
    phase: 'Remove Null Productions',
    description: `For each production containing nullable variables { ${[...nullable].join(', ')} }, generate all combinations with those variables present/absent. ε-productions are removed.`,
    currentGrammar: cloneGrammar(newGrammar),
    highlightedRules: [...removedEpsilons, ...addedRules],
  });

  // ── Handle start symbol nullable ──
  if (nullable.has(g.startSymbol)) {
    // Check if the original language includes ε
    // Standard approach: add new start symbol S' → S | ε if start was nullable
    const newStart = g.startSymbol + "'";
    const updatedGrammar = cloneGrammar(newGrammar);
    updatedGrammar.rules = new Map([
      [newStart, [[g.startSymbol], ['ε']]],
      ...updatedGrammar.rules,
    ]);
    updatedGrammar.startSymbol = newStart;

    history.push({
      stepId: stepId++,
      phase: 'Remove Null Productions',
      description: `Start symbol "${g.startSymbol}" was nullable. Introduce new start symbol ${newStart} → ${g.startSymbol} | ε to preserve ε in the language.`,
      currentGrammar: cloneGrammar(updatedGrammar),
      highlightedRules: [
        { rule: `${newStart} → ${g.startSymbol} | ε`, type: 'added' },
      ],
    });

    return { history, result: updatedGrammar, nextStepId: stepId };
  }

  return { history, result: newGrammar, nextStepId: stepId };
}


// ═══════════════════════════════════════════════════════════════
//  PHASE 2: REMOVE UNIT PRODUCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Removes all unit productions (A → B where B is a single non-terminal).
 * Returns an array of HistoryState objects.
 *
 * Algorithm:
 *  1. Identify all unit productions.
 *  2. For each non-terminal A, compute the unit closure
 *     (all non-terminals B such that A ⇒* B via unit productions).
 *  3. Replace each A → B (unit) with B's non-unit productions.
 */
function removeUnitProductions(grammar, startStepId) {
  const history = [];
  let stepId = startStepId;
  let g = cloneGrammar(grammar);

  // ── Step: Identify all unit productions ──
  const unitProductions = [];
  for (const [nt, prods] of g.rules) {
    for (const prod of prods) {
      if (prod.length === 1 && isNonTerminal(prod[0]) && prod[0] !== nt) {
        unitProductions.push({ from: nt, to: prod[0] });
      }
    }
  }

  if (unitProductions.length === 0) {
    history.push({
      stepId: stepId++,
      phase: 'Remove Unit Productions',
      description: 'No unit productions found. Grammar is unchanged.',
      currentGrammar: cloneGrammar(g),
      highlightedRules: [],
    });
    return { history, result: g, nextStepId: stepId };
  }

  history.push({
    stepId: stepId++,
    phase: 'Remove Unit Productions',
    description: `Identified ${unitProductions.length} unit production(s): ${unitProductions.map(u => `${u.from} → ${u.to}`).join(', ')}.`,
    currentGrammar: cloneGrammar(g),
    highlightedRules: unitProductions.map(u => ({
      rule: `${u.from} → ${u.to}`,
      type: 'identified',
    })),
  });

  // ── Step: Compute unit closures for each non-terminal ──
  const unitClosures = new Map();
  for (const nt of g.rules.keys()) {
    const closure = new Set([nt]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const v of closure) {
        const prods = g.rules.get(v) || [];
        for (const prod of prods) {
          if (prod.length === 1 && isNonTerminal(prod[0]) && !closure.has(prod[0])) {
            closure.add(prod[0]);
            changed = true;
          }
        }
      }
    }
    closure.delete(nt); // remove self
    if (closure.size > 0) {
      unitClosures.set(nt, closure);
    }
  }

  const closureDesc = [...unitClosures.entries()]
    .map(([nt, cl]) => `${nt}: { ${[...cl].join(', ')} }`)
    .join('; ');

  history.push({
    stepId: stepId++,
    phase: 'Remove Unit Productions',
    description: `Compute unit closures for each non-terminal. ${closureDesc || 'No transitive chains.'}`,
    currentGrammar: cloneGrammar(g),
    highlightedRules: [],
  });

  // ── Step: Build new productions by substitution ──
  const newGrammar = cloneGrammar(g);
  const allAdded = [];
  const allRemoved = [];

  for (const [nt, prods] of g.rules) {
    // Start with all non-unit productions of nt
    const nonUnitProds = prods.filter(p => !(p.length === 1 && isNonTerminal(p[0])));
    const newProds = [...nonUnitProds.map(p => [...p])];

    // Mark removed unit productions
    const removedUnits = prods.filter(p => p.length === 1 && isNonTerminal(p[0]));
    for (const ru of removedUnits) {
      allRemoved.push({ rule: `${nt} → ${ru.join('')}`, type: 'removed' });
    }

    // Add non-unit productions from the closure
    const closure = unitClosures.get(nt);
    if (closure) {
      for (const target of closure) {
        const targetProds = g.rules.get(target) || [];
        for (const tp of targetProds) {
          if (tp.length === 1 && isNonTerminal(tp[0])) continue; // skip unit prods
          if (!newProds.some(np => prodEquals(np, tp))) {
            newProds.push([...tp]);
            allAdded.push({ rule: `${nt} → ${tp.join('')}`, type: 'added' });
          }
        }
      }
    }

    newGrammar.rules.set(nt, newProds);
  }

  // Remove non-terminals with empty production sets
  for (const [nt, prods] of newGrammar.rules) {
    if (prods.length === 0) {
      newGrammar.rules.delete(nt);
    }
  }

  history.push({
    stepId: stepId++,
    phase: 'Remove Unit Productions',
    description: `Replace each unit production by substituting the target's non-unit productions. Removed ${allRemoved.length} unit production(s), added ${allAdded.length} substituted production(s).`,
    currentGrammar: cloneGrammar(newGrammar),
    highlightedRules: [...allRemoved, ...allAdded],
  });

  return { history, result: newGrammar, nextStepId: stepId };
}


// ═══════════════════════════════════════════════════════════════
//  PHASE 3: REMOVE USELESS SYMBOLS
// ═══════════════════════════════════════════════════════════════

/**
 * Removes useless symbols (non-generating and unreachable).
 * Returns an array of HistoryState objects.
 *
 * Algorithm:
 *  1. Find generating symbols (those that can derive a string of terminals).
 *  2. Remove non-generating symbols and their productions.
 *  3. Find reachable symbols (those reachable from the start symbol).
 *  4. Remove unreachable symbols and their productions.
 */
function removeUselessSymbols(grammar, startStepId) {
  const history = [];
  let stepId = startStepId;
  let g = cloneGrammar(grammar);

  // ── Sub-phase A: Find generating symbols (fixed-point) ──
  const generating = new Set();

  // All terminals are generating by definition
  for (const [, prods] of g.rules) {
    for (const prod of prods) {
      for (const sym of prod) {
        if (!isNonTerminal(sym) && sym !== 'ε') {
          generating.add(sym);
        }
      }
    }
  }
  // ε counts as generating
  generating.add('ε');

  let changed = true;
  while (changed) {
    changed = false;
    for (const [nt, prods] of g.rules) {
      if (generating.has(nt)) continue;
      for (const prod of prods) {
        if (prod.every(sym => generating.has(sym))) {
          generating.add(nt);
          changed = true;
          break;
        }
      }
    }
  }

  const allNonTerminals = new Set(g.rules.keys());
  const nonGenerating = [...allNonTerminals].filter(nt => !generating.has(nt));

  history.push({
    stepId: stepId++,
    phase: 'Remove Useless Symbols',
    description: `Compute generating symbols (can derive terminal strings). Generating non-terminals: { ${[...allNonTerminals].filter(nt => generating.has(nt)).join(', ')} }.${nonGenerating.length > 0 ? ` Non-generating: { ${nonGenerating.join(', ')} }.` : ' All non-terminals are generating.'}`,
    currentGrammar: cloneGrammar(g),
    highlightedRules: nonGenerating.map(nt => ({
      rule: formatRule(nt, g.rules.get(nt)),
      type: 'removed',
    })),
  });

  // ── Remove non-generating symbols ──
  if (nonGenerating.length > 0) {
    const cleaned = cloneGrammar(g);
    const removedRules = [];

    for (const nt of nonGenerating) {
      removedRules.push({ rule: formatRule(nt, cleaned.rules.get(nt)), type: 'removed' });
      cleaned.rules.delete(nt);
    }

    // Also remove any production that references a non-generating symbol
    for (const [nt, prods] of cleaned.rules) {
      const filtered = prods.filter(prod => {
        const uses = prod.some(sym => nonGenerating.includes(sym));
        if (uses) {
          removedRules.push({ rule: `${nt} → ${prod.join('')}`, type: 'removed' });
        }
        return !uses;
      });
      cleaned.rules.set(nt, filtered);
    }

    // Remove empty entries
    for (const [nt, prods] of cleaned.rules) {
      if (prods.length === 0) cleaned.rules.delete(nt);
    }

    g = cleaned;

    history.push({
      stepId: stepId++,
      phase: 'Remove Useless Symbols',
      description: `Remove non-generating symbol(s) { ${nonGenerating.join(', ')} } and all productions referencing them.`,
      currentGrammar: cloneGrammar(g),
      highlightedRules: removedRules,
    });
  }

  // ── Sub-phase B: Find reachable symbols ──
  const reachable = new Set([g.startSymbol]);
  changed = true;
  while (changed) {
    changed = false;
    for (const nt of reachable) {
      const prods = g.rules.get(nt) || [];
      for (const prod of prods) {
        for (const sym of prod) {
          if (isNonTerminal(sym) && !reachable.has(sym) && g.rules.has(sym)) {
            reachable.add(sym);
            changed = true;
          }
        }
      }
    }
  }

  const unreachable = [...g.rules.keys()].filter(nt => !reachable.has(nt));

  history.push({
    stepId: stepId++,
    phase: 'Remove Useless Symbols',
    description: `Compute reachable symbols from start symbol "${g.startSymbol}". Reachable: { ${[...reachable].join(', ')} }.${unreachable.length > 0 ? ` Unreachable: { ${unreachable.join(', ')} }.` : ' All symbols are reachable.'}`,
    currentGrammar: cloneGrammar(g),
    highlightedRules: unreachable.map(nt => ({
      rule: formatRule(nt, g.rules.get(nt)),
      type: 'removed',
    })),
  });

  // ── Remove unreachable symbols ──
  if (unreachable.length > 0) {
    const cleaned = cloneGrammar(g);
    const removedRules = [];

    for (const nt of unreachable) {
      removedRules.push({ rule: formatRule(nt, cleaned.rules.get(nt)), type: 'removed' });
      cleaned.rules.delete(nt);
    }

    g = cleaned;

    history.push({
      stepId: stepId++,
      phase: 'Remove Useless Symbols',
      description: `Remove unreachable symbol(s) { ${unreachable.join(', ')} } and their productions.`,
      currentGrammar: cloneGrammar(g),
      highlightedRules: removedRules,
    });
  }

  // ── Final summary ──
  if (nonGenerating.length === 0 && unreachable.length === 0) {
    history.push({
      stepId: stepId++,
      phase: 'Remove Useless Symbols',
      description: 'No useless symbols found. Grammar is unchanged.',
      currentGrammar: cloneGrammar(g),
      highlightedRules: [],
    });
  }

  return { history, result: g, nextStepId: stepId };
}


// ═══════════════════════════════════════════════════════════════
//  ORCHESTRATOR: SIMPLIFY
// ═══════════════════════════════════════════════════════════════

function simplify() {
  const grammar = parseGrammar();

  if (grammar.rules.size === 0) {
    setStatus('No rules to simplify', 'warning');
    return;
  }

  /** @type {Array<HistoryState>} */
  const allHistory = [];
  let stepId = 1;

  // ── Step 0: Record original grammar ──
  allHistory.push({
    stepId: stepId++,
    phase: 'Original',
    description: 'Input Context-Free Grammar as entered by the user.',
    currentGrammar: cloneGrammar(grammar),
    highlightedRules: [],
  });

  // ── Phase 1: Null Productions ──
  const phase1 = removeNullProductions(grammar, stepId);
  allHistory.push(...phase1.history);
  stepId = phase1.nextStepId;

  // ── Phase 2: Unit Productions ──
  const phase2 = removeUnitProductions(phase1.result, stepId);
  allHistory.push(...phase2.history);
  stepId = phase2.nextStepId;

  // ── Phase 3: Useless Symbols ──
  const phase3 = removeUselessSymbols(phase2.result, stepId);
  allHistory.push(...phase3.history);
  stepId = phase3.nextStepId;

  // ── Final result ──
  allHistory.push({
    stepId: stepId++,
    phase: 'Complete',
    description: 'Simplified grammar — all null productions, unit productions, and useless symbols have been removed.',
    currentGrammar: cloneGrammar(phase3.result),
    highlightedRules: [],
  });

  // Store and begin playback
  state.steps = allHistory;
  state.currentStepIndex = -1;
  stopPlay();
  enablePlaybackControls(true);
  goToStep(0);
  setStatus(`Simplification complete — ${allHistory.length} steps generated`);
}


// ═══════════════════════════════════════════════════════════════
//  PLAYBACK ENGINE
// ═══════════════════════════════════════════════════════════════

/** Phase → badge config */
const PHASE_BADGES = {
  'Original':                 { text: 'Input',     cssClass: '' },
  'Remove Null Productions':  { text: 'Phase 1',   cssClass: 'badge--warning' },
  'Remove Unit Productions':  { text: 'Phase 2',   cssClass: 'badge--phase2' },
  'Remove Useless Symbols':   { text: 'Phase 3',   cssClass: 'badge--purple' },
  'Complete':                 { text: 'Result',     cssClass: 'badge--success' },
};

/** Phase → description-box color class */
const PHASE_BOX_CLASS = {
  'Original':                 '',
  'Remove Null Productions':  'phase-null',
  'Remove Unit Productions':  'phase-unit',
  'Remove Useless Symbols':   'phase-useless',
  'Complete':                 'phase-complete',
};

// ── Enable / disable transport buttons ──
function enablePlaybackControls(enabled) {
  DOM.btnStepBack.disabled    = !enabled;
  DOM.btnPlay.disabled        = !enabled;
  DOM.btnStepForward.disabled = !enabled;
}

function updateButtonStates() {
  const idx = state.currentStepIndex;
  const max = state.steps.length - 1;
  DOM.btnStepBack.disabled    = idx <= 0;
  DOM.btnStepForward.disabled = idx >= max;
  DOM.stepCounter.textContent = `${idx + 1} / ${state.steps.length}`;

  // Progress bar
  const pct = max > 0 ? ((idx / max) * 100) : 0;
  DOM.progressFill.style.width = `${pct}%`;
}

// ── Navigation ──
function stepForward() {
  if (state.currentStepIndex < state.steps.length - 1) {
    goToStep(state.currentStepIndex + 1);
  } else {
    stopPlay();
  }
}

function stepBack() {
  if (state.currentStepIndex > 0) {
    goToStep(state.currentStepIndex - 1);
  }
}

function goToStep(index) {
  if (index < 0 || index >= state.steps.length) return;

  const prevIndex = state.currentStepIndex;
  state.currentStepIndex = index;
  renderCurrentStep(prevIndex);
  updateButtonStates();
}

// ── Auto-play ──
function togglePlay() {
  if (state.steps.length === 0) return;

  if (state.isPlaying) {
    stopPlay();
  } else {
    // If at the end, restart from beginning
    if (state.currentStepIndex >= state.steps.length - 1) {
      goToStep(0);
    }
    startPlay();
  }
}

function startPlay() {
  state.isPlaying = true;
  DOM.btnPlay.classList.add('is-playing');
  DOM.playIcon.style.display  = 'none';
  DOM.pauseIcon.style.display = '';

  const speed = parseInt(DOM.speedSelect.value, 10) || 1200;
  state.playTimer = setInterval(() => {
    if (state.currentStepIndex >= state.steps.length - 1) {
      stopPlay();
      return;
    }
    stepForward();
  }, speed);
}

function stopPlay() {
  state.isPlaying = false;
  DOM.btnPlay.classList.remove('is-playing');
  DOM.playIcon.style.display  = '';
  DOM.pauseIcon.style.display = 'none';

  if (state.playTimer) {
    clearInterval(state.playTimer);
    state.playTimer = null;
  }
}


// ═══════════════════════════════════════════════════════════════
//  RENDERING: Current Step
// ═══════════════════════════════════════════════════════════════

/**
 * Renders the current step in the center pane.
 * Shows the grammar with per-rule-line highlight classes based
 * on the highlightedRules in the history state.
 */
function renderCurrentStep(prevIndex) {
  const step = state.steps[state.currentStepIndex];
  if (!step) return;

  // Show step display, hide empty state
  DOM.emptyState.style.display  = 'none';
  DOM.stepDisplay.style.display = '';

  // ── Phase badge ──
  const badge = PHASE_BADGES[step.phase] || { text: step.phase, cssClass: '' };
  DOM.phaseBadge.textContent = badge.text;
  DOM.phaseBadge.className   = `badge ${badge.cssClass}`;
  DOM.phaseTitle.textContent = step.phase;

  // ── Description box ──
  DOM.descriptionText.textContent = step.description;
  const boxClass = PHASE_BOX_CLASS[step.phase] || '';
  DOM.descriptionBox.className = `description-box ${boxClass}`;

  // ── Build a set of highlighted rule strings for matching ──
  const highlightMap = new Map(); // "NT → rhs" → type
  if (step.highlightedRules) {
    for (const hr of step.highlightedRules) {
      highlightMap.set(hr.rule, hr.type);
    }
  }

  // ── Render grammar rules line by line ──
  const grammar = step.currentGrammar;
  const ruleLines = [];
  const ordered = [grammar.startSymbol, ...[...grammar.rules.keys()].filter(k => k !== grammar.startSymbol)];

  for (const nt of ordered) {
    const prods = grammar.rules.get(nt);
    if (!prods || prods.length === 0) continue;
    const rhs = prods.map(p => p.join('')).join(' | ');
    const ruleStr = `${nt} → ${rhs}`;
    ruleLines.push({ nt, rhs, ruleStr });
  }

  // Build HTML for grammar display
  DOM.grammarDisplay.innerHTML = ruleLines.map((line, i) => {
    // Check if this rule line matches any highlighted rule
    let hlClass = '';
    // Try exact match first for added or identified rules.
    // Removed rules are not in the current grammar, so they shouldn't be highlighted as removed.
    if (highlightMap.has(line.ruleStr)) {
      const type = highlightMap.get(line.ruleStr);
      if (type === 'added') hlClass = 'highlight-add';
      else if (type === 'identified') hlClass = 'highlight-identify';
    } else {
      // Check if any added/identified rule's NT matches this line's NT
      for (const [hrRule, hrType] of highlightMap) {
        if (hrType !== 'removed' && hrRule.startsWith(line.nt + ' →')) {
          hlClass = hrType === 'added' ? 'highlight-add' : 'highlight-identify';
          break;
        }
      }
    }

    return `<div class="grammar-rule-line entering ${hlClass}" style="animation-delay: ${i * 50}ms">
      <span class="rule-nt">${escapeHtml(line.nt)}</span>
      <span class="rule-arrow">→</span>
      <span class="rule-rhs">${escapeHtml(line.rhs)}</span>
    </div>`;
  }).join('');

  // ── Highlighted rules tags ──
  if (step.highlightedRules && step.highlightedRules.length > 0) {
    DOM.highlightsContainer.style.display = '';
    DOM.highlightsContainer.innerHTML = step.highlightedRules.map(hr => {
      const cls = hr.type === 'removed' ? 'token--removed'
                : hr.type === 'added'   ? 'token--added'
                : 'token--identified';
      const icon = hr.type === 'removed' ? '−'
                 : hr.type === 'added'   ? '+'
                 : '●';
      return `<span class="highlight-rule ${cls}">${icon} ${escapeHtml(hr.rule)}</span>`;
    }).join('');
  } else {
    DOM.highlightsContainer.style.display = 'none';
    DOM.highlightsContainer.innerHTML = '';
  }

  // Trigger re-animation on the step display
  if (prevIndex !== state.currentStepIndex) {
    DOM.stepDisplay.style.animation = 'none';
    // Force reflow
    void DOM.stepDisplay.offsetHeight;
    DOM.stepDisplay.style.animation = '';
  }

  setStatus(`Step ${state.currentStepIndex + 1} of ${state.steps.length} — ${step.phase}`);

  // ── Redraw dependency tree ──
  try {
    renderDependencyTree(step.currentGrammar);
  } catch (err) {
    console.error('Tree render error:', err);
    setStatus(`Tree error: ${err.message}`);
  }
}

/** Show the empty state (no steps) */
function showEmptyState() {
  DOM.emptyState.style.display  = '';
  DOM.stepDisplay.style.display = 'none';
  DOM.stepCounter.textContent   = '0 / 0';
  DOM.progressFill.style.width  = '0%';
  enablePlaybackControls(false);
}

// ─── Tree Canvas ──────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function clearTree() {
  DOM.treeCanvas.innerHTML = '';
  renderTreePlaceholder();
}

// ═══════════════════════════════════════════════════════════════
//  SVG DEPENDENCY TREE RENDERER
// ═══════════════════════════════════════════════════════════════

/**
 * Renders a top-down dependency graph of the grammar.
 * Non-terminals are parent nodes; their production symbols are children.
 * Each alternative production creates a separate branch group.
 *
 * Layout algorithm:
 *  1. Build a tree structure: start symbol → productions → child symbols
 *  2. Use a recursive bottom-up pass to compute subtree widths
 *  3. Use a top-down pass to assign (x, y) positions
 *  4. Render SVG elements: edges first, then nodes on top
 */
function renderDependencyTree(grammar) {
  DOM.treeCanvas.innerHTML = '';

  if (!grammar || grammar.rules.size === 0) {
    renderTreePlaceholder();
    return;
  }

  const w = DOM.treeCanvas.clientWidth  || 340;
  const h = DOM.treeCanvas.clientHeight || 500;

  // ── Layout constants ──
  const NODE_R      = 20;   // Non-terminal circle radius
  const TERM_H      = 26;   // Terminal rect height
  const TERM_PAD    = 12;   // Terminal horizontal padding
  const LEVEL_GAP   = 70;   // Vertical distance between levels
  const SIBLING_GAP = 14;   // Horizontal gap between siblings
  const TOP_PAD     = 40;   // Top margin

  // ── Build the tree data structure ──
  // Each tree node: { id, label, isNT, children: [...], width (computed) }
  let nodeId = 0;
  const allNodes = [];
  const allEdges = []; // { from: nodeId, to: nodeId }
  const visited = new Set();

  function buildSubtree(nt, depth) {
    if (depth > 5) return null; // prevent infinite recursion
    if (visited.has(nt) && depth > 0) {
      // Recursive reference — show as a reference node
      const refNode = { id: nodeId++, label: nt, isNT: true, isRef: true, children: [], width: 0 };
      allNodes.push(refNode);
      return refNode;
    }

    const prods = grammar.rules.get(nt);
    if (!prods || prods.length === 0) {
      const leaf = { id: nodeId++, label: nt, isNT: isNonTerminal(nt), children: [], width: 0 };
      allNodes.push(leaf);
      return leaf;
    }

    visited.add(nt);

    const parentNode = { id: nodeId++, label: nt, isNT: true, isRef: false, children: [], width: 0 };
    allNodes.push(parentNode);

    // For each production alternative, create children
    for (const prod of prods) {
      for (const sym of prod) {
        if (sym === 'ε') {
          const epsNode = { id: nodeId++, label: 'ε', isNT: false, children: [], width: 0 };
          allNodes.push(epsNode);
          parentNode.children.push(epsNode);
          allEdges.push({ from: parentNode.id, to: epsNode.id });
        } else if (isNonTerminal(sym) && grammar.rules.has(sym)) {
          const child = buildSubtree(sym, depth + 1);
          if (child) {
            parentNode.children.push(child);
            allEdges.push({ from: parentNode.id, to: child.id });
          }
        } else {
          const termNode = { id: nodeId++, label: sym, isNT: false, children: [], width: 0 };
          allNodes.push(termNode);
          parentNode.children.push(termNode);
          allEdges.push({ from: parentNode.id, to: termNode.id });
        }
      }
    }

    visited.delete(nt);
    return parentNode;
  }

  const root = buildSubtree(grammar.startSymbol, 0);
  if (!root) {
    renderTreePlaceholder();
    return;
  }

  // ── Compute subtree widths (bottom-up) ──
  function computeWidth(node) {
    const labelW = Math.max(node.label.length * 10 + TERM_PAD * 2, NODE_R * 2 + 8);
    if (node.children.length === 0) {
      node.width = labelW;
      return node.width;
    }
    let childrenWidth = 0;
    for (const child of node.children) {
      childrenWidth += computeWidth(child);
    }
    childrenWidth += (node.children.length - 1) * SIBLING_GAP;
    node.width = Math.max(labelW, childrenWidth);
    return node.width;
  }

  computeWidth(root);

  // ── Assign positions (top-down) ──
  const positions = new Map(); // nodeId → { x, y }

  function assignPositions(node, cx, cy) {
    positions.set(node.id, { x: cx, y: cy });

    if (node.children.length === 0) return;

    const childY = cy + LEVEL_GAP;
    let totalChildWidth = 0;
    for (const child of node.children) {
      totalChildWidth += child.width;
    }
    totalChildWidth += (node.children.length - 1) * SIBLING_GAP;

    let startX = cx - totalChildWidth / 2;
    for (const child of node.children) {
      const childCx = startX + child.width / 2;
      assignPositions(child, childCx, childY);
      startX += child.width + SIBLING_GAP;
    }
  }

  assignPositions(root, w / 2, TOP_PAD);

  // ── Compute bounds and scale to fit ──
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x - NODE_R * 2);
    maxX = Math.max(maxX, pos.x + NODE_R * 2);
    minY = Math.min(minY, pos.y - NODE_R);
    maxY = Math.max(maxY, pos.y + NODE_R + TERM_H);
  }

  const treeW = maxX - minX + 40;
  const treeH = maxY - minY + 40;
  const scaleX = w / treeW;
  const scaleY = h / treeH;
  const scale = Math.min(scaleX, scaleY, 1.0); // Don't scale up, only down

  const offsetX = (w - treeW * scale) / 2 - minX * scale + 20 * scale;
  const offsetY = (h - treeH * scale) / 2 - minY * scale + 20 * scale;

  function tx(x) { return x * scale + offsetX; }
  function ty(y) { return y * scale + offsetY; }

  // ── Add SVG definitions (gradients, filters) ──
  const defs = document.createElementNS(SVG_NS, 'defs');

  // Glow filter
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', 'node-glow');
  filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%');
  filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
  const feGauss = document.createElementNS(SVG_NS, 'feGaussianBlur');
  feGauss.setAttribute('stdDeviation', '3');
  feGauss.setAttribute('result', 'blur');
  filter.appendChild(feGauss);
  const feMerge = document.createElementNS(SVG_NS, 'feMerge');
  const feMerge1 = document.createElementNS(SVG_NS, 'feMergeNode');
  feMerge1.setAttribute('in', 'blur');
  const feMerge2 = document.createElementNS(SVG_NS, 'feMergeNode');
  feMerge2.setAttribute('in', 'SourceGraphic');
  feMerge.appendChild(feMerge1);
  feMerge.appendChild(feMerge2);
  filter.appendChild(feMerge);
  defs.appendChild(filter);

  // Edge gradient
  const edgeGrad = document.createElementNS(SVG_NS, 'linearGradient');
  edgeGrad.setAttribute('id', 'edge-gradient');
  edgeGrad.setAttribute('x1', '0'); edgeGrad.setAttribute('y1', '0');
  edgeGrad.setAttribute('x2', '0'); edgeGrad.setAttribute('y2', '1');
  const stop1 = document.createElementNS(SVG_NS, 'stop');
  stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#58a6ff'); stop1.setAttribute('stop-opacity', '0.6');
  const stop2 = document.createElementNS(SVG_NS, 'stop');
  stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#bc8cff'); stop2.setAttribute('stop-opacity', '0.3');
  edgeGrad.appendChild(stop1); edgeGrad.appendChild(stop2);
  defs.appendChild(edgeGrad);

  DOM.treeCanvas.appendChild(defs);

  // ── Render edges (curved paths) ──
  const edgeGroup = document.createElementNS(SVG_NS, 'g');
  edgeGroup.setAttribute('class', 'tree-edges');

  for (const edge of allEdges) {
    const from = positions.get(edge.from);
    const to   = positions.get(edge.to);
    if (!from || !to) continue;

    const x1 = tx(from.x), y1 = ty(from.y) + NODE_R * scale;
    const x2 = tx(to.x),   y2 = ty(to.y)   - NODE_R * scale;

    // Smooth cubic bezier curve
    const midY = (y1 + y2) / 2;
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'url(#edge-gradient)');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('class', 'tree-edge');
    edgeGroup.appendChild(path);
  }

  DOM.treeCanvas.appendChild(edgeGroup);

  // ── Render nodes ──
  const nodeGroup = document.createElementNS(SVG_NS, 'g');
  nodeGroup.setAttribute('class', 'tree-nodes');

  for (const node of allNodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    const cx = tx(pos.x);
    const cy = ty(pos.y);
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', `tree-node ${node.isNT ? 'tree-node--nt' : 'tree-node--term'}${node.isRef ? ' tree-node--ref' : ''}`);

    // Animation delay based on depth
    const depth = Math.round((pos.y - TOP_PAD) / LEVEL_GAP);
    g.style.animationDelay = `${depth * 80}ms`;

    if (node.isNT) {
      // Non-terminal: circle
      const r = NODE_R * scale;
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', r);
      circle.setAttribute('class', node.isRef ? 'nt-circle nt-circle--ref' : 'nt-circle');
      g.appendChild(circle);

      // Label
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', cx);
      text.setAttribute('y', cy + 4 * scale);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'nt-label');
      text.setAttribute('font-size', `${13 * scale}px`);
      text.textContent = node.label;
      g.appendChild(text);
    } else {
      // Terminal: rounded rectangle
      const labelW = Math.max(node.label.length * 9 * scale + TERM_PAD * scale, 28 * scale);
      const rectH  = TERM_H * scale;
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', cx - labelW / 2);
      rect.setAttribute('y', cy - rectH / 2);
      rect.setAttribute('width', labelW);
      rect.setAttribute('height', rectH);
      rect.setAttribute('rx', 5 * scale);
      rect.setAttribute('ry', 5 * scale);
      rect.setAttribute('class', node.label === 'ε' ? 'term-rect term-rect--eps' : 'term-rect');
      g.appendChild(rect);

      // Label
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', cx);
      text.setAttribute('y', cy + 4 * scale);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'term-label');
      text.setAttribute('font-size', `${12 * scale}px`);
      text.textContent = node.label;
      g.appendChild(text);
    }

    nodeGroup.appendChild(g);
  }

  DOM.treeCanvas.appendChild(nodeGroup);
}

function renderTreePlaceholder() {
  const w = DOM.treeCanvas.clientWidth || 300;
  const h = DOM.treeCanvas.clientHeight || 400;

  const cx = w / 2, cy = h / 2;
  const group = document.createElementNS(SVG_NS, 'g');
  group.setAttribute('opacity', '0.25');

  const positions = [
    { x: cx, y: cy - 60, label: '?' },
    { x: cx - 50, y: cy + 20, label: '' },
    { x: cx + 50, y: cy + 20, label: '' },
  ];

  for (let i = 1; i < positions.length; i++) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', positions[0].x);
    line.setAttribute('y1', positions[0].y);
    line.setAttribute('x2', positions[i].x);
    line.setAttribute('y2', positions[i].y);
    line.setAttribute('stroke', '#30363d');
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('stroke-dasharray', '5,5');
    group.appendChild(line);
  }

  for (const { x, y, label } of positions) {
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', 18);
    group.appendChild(circle);

    if (label) {
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y + 5);
      text.setAttribute('text-anchor', 'middle');
      text.textContent = label;
      group.appendChild(text);
    }
  }

  const caption = document.createElementNS(SVG_NS, 'text');
  caption.setAttribute('x', cx);
  caption.setAttribute('y', cy + 80);
  caption.setAttribute('text-anchor', 'middle');
  caption.setAttribute('font-size', '12');
  caption.setAttribute('fill', '#484f58');
  caption.textContent = 'Derivation tree will appear here';
  group.appendChild(caption);

  DOM.treeCanvas.appendChild(group);
}

// ─── Status Bar ───────────────────────────────────────────────

function setStatus(msg, level = 'info') {
  DOM.statusText.textContent = msg;
}

// ─── Utilities ────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Keyboard Shortcuts ───────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Ctrl+Enter → Simplify
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    simplify();
  }
  // Ctrl+Shift+N → Add rule
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
    e.preventDefault();
    addRule();
  }
  // Arrow Right → Step Forward
  if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    stepForward();
  }
  // Arrow Left → Step Back
  if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    stepBack();
  }
  // Space → Toggle Play (when not in input)
  if (e.key === ' ' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT') {
    e.preventDefault();
    togglePlay();
  }
});

// ─── Init ─────────────────────────────────────────────────────

function init() {
  // Button handlers — grammar input
  DOM.addRuleBtn.addEventListener('click', () => addRule());
  DOM.simplifyBtn.addEventListener('click', () => simplify());
  DOM.clearBtn.addEventListener('click', () => clearAll());

  DOM.dropdownHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.dropdownContainer.classList.toggle('is-open');
  });

  document.addEventListener('click', (e) => {
    if (!DOM.dropdownContainer.contains(e.target)) {
      DOM.dropdownContainer.classList.remove('is-open');
    }
  });

  DOM.dropdownItems.forEach(item => {
    item.addEventListener('click', () => {
      DOM.dropdownContainer.classList.remove('is-open');
      loadSample(item.dataset.sample);
    });
  });

  // Playback controls
  DOM.btnStepBack.addEventListener('click', () => stepBack());
  DOM.btnStepForward.addEventListener('click', () => stepForward());
  DOM.btnPlay.addEventListener('click', () => togglePlay());

  // Speed change updates interval if already playing
  DOM.speedSelect.addEventListener('change', () => {
    if (state.isPlaying) {
      stopPlay();
      startPlay();
    }
  });

  // Progress bar click-to-seek
  DOM.progressTrack.addEventListener('click', (e) => {
    if (state.steps.length === 0) return;
    const rect = DOM.progressTrack.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(pct * (state.steps.length - 1));
    goToStep(Math.max(0, Math.min(idx, state.steps.length - 1)));
  });

  // Theme toggle
  DOM.themeDarkBtn.addEventListener('click', () => setTheme('dark'));
  DOM.themeLightBtn.addEventListener('click', () => setTheme('light'));

  // Header Menu Toggle
  DOM.btnHamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.headerMenu.classList.toggle('is-open');
  });

  document.addEventListener('click', (e) => {
    if (!DOM.headerMenu.contains(e.target)) {
      DOM.headerMenu.classList.remove('is-open');
    }
  });

  // Quiz Modal Toggle
  DOM.btnPracticeQuiz.addEventListener('click', () => {
    DOM.headerMenu.classList.remove('is-open');
    loadQuizQuestion(0);
    DOM.quizOptions.forEach(btn => {
      btn.style.borderColor = '';
      btn.style.backgroundColor = '';
      btn.style.color = '';
    });
    DOM.quizModal.classList.add('is-active');
  });

  DOM.btnCloseQuiz.addEventListener('click', () => {
    DOM.quizModal.classList.remove('is-active');
  });

  // Close modal on escape or click outside
  DOM.quizModal.addEventListener('click', (e) => {
    if (e.target === DOM.quizModal) DOM.quizModal.classList.remove('is-active');
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') DOM.quizModal.classList.remove('is-active');
  });

  // Restore saved theme or default to dark
  const saved = localStorage.getItem('gsv-theme');
  setTheme(saved || 'dark');

  // Initialize Quiz logic
  initQuiz();

  // Seed with a simple example grammar
  addRule('S', 'AB | a');
  addRule('A', 'aA | ε');
  addRule('B', 'bB | b');

  // Initial UI state
  showEmptyState();
  renderTreePlaceholder();
  setStatus('Ready — click Simplify or press Ctrl+Enter');
}

document.addEventListener('DOMContentLoaded', init);

// ═══════════════════════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════════════════════

/**
 * Switch between 'dark' and 'light' themes.
 * Persists choice to localStorage for offline (file://) usage.
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('gsv-theme', theme);

  if (theme === 'dark') {
    DOM.themeDarkBtn.classList.add('theme-toggle__btn--active');
    DOM.themeDarkBtn.setAttribute('aria-pressed', 'true');
    DOM.themeLightBtn.classList.remove('theme-toggle__btn--active');
    DOM.themeLightBtn.setAttribute('aria-pressed', 'false');
  } else {
    DOM.themeLightBtn.classList.add('theme-toggle__btn--active');
    DOM.themeLightBtn.setAttribute('aria-pressed', 'true');
    DOM.themeDarkBtn.classList.remove('theme-toggle__btn--active');
    DOM.themeDarkBtn.setAttribute('aria-pressed', 'false');
  }
}

// ═══════════════════════════════════════════════════════════════
//  SAMPLE GRAMMAR LOADER
// ═══════════════════════════════════════════════════════════════

function loadSample(sampleId) {
  clearAll();
  
  if (sampleId === 'blank') {
    DOM.startSymbol.value = '';
    setStatus('Cleared to Default/Blank state.');
    DOM.simplifyBtn.disabled = false;
    return;
  }

  DOM.startSymbol.value = 'S';
  DOM.simplifyBtn.disabled = false;

  if (sampleId === 'null-cascader') {
    addRule('S', 'AB | a');
    addRule('A', 'aA | ε');
    addRule('B', 'bB | ε');
    setStatus('Loaded "The Null Cascader".');
  } else if (sampleId === 'unit-loop') {
    addRule('S', 'A | a');
    addRule('A', 'B');
    addRule('B', 'C | b');
    addRule('C', 'A | c');
    setStatus('Loaded "The Unit Loop".');
  } else if (sampleId === 'dead-end') {
    addRule('S', 'aS | A | C');
    addRule('A', 'a');
    addRule('B', 'aa');
    addRule('C', 'aCb');
    setStatus('Loaded "The Dead End".');
  }
}
