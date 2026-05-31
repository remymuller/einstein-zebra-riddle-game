// ── Data ──────────────────────────────────────────────────────────────────────

const ATTRS = ['color', 'nationality', 'drink', 'smoke', 'pet'];

const ATTR_META = {
  color:       { label: 'Couleur',   icon: '🎨' },
  nationality: { label: 'Nation',    icon: '🌍' },
  drink:       { label: 'Boisson',   icon: '🥤' },
  smoke:       { label: 'Cigarette', icon: '💨' },
  pet:         { label: 'Animal',    icon: '🐾' },
};

const VALUE_ICONS = {
  yellow:'🟨', blue:'🟦', red:'🟥', green:'🟩', white:'⬜',
  norwegian:'🇳🇴', dane:'🇩🇰', brit:'🇬🇧', german:'🇩🇪', swede:'🇸🇪',
  water:'💧', tea:'🍵', milk:'🥛', coffee:'☕', beer:'🍺',
  dunhill:'🚬', blend:'🌫️', pallmall:'📦', prince:'👑', bluemaster:'💙',
  cats:'🐱', horse:'🐴', birds:'🐦', fish:'🐟', dog:'🐶',
};

const VALUE_SHORT = {
  yellow:'Jau', blue:'Bleu', red:'Rou', green:'Ver', white:'Bla',
  norwegian:'Nor', dane:'Dan', brit:'Bri', german:'All', swede:'Suè',
  water:'Eau', tea:'Thé', milk:'Lait', coffee:'Caf', beer:'Biè',
  dunhill:'Dun', blend:'Bld', pallmall:'P.M', prince:'Prn', bluemaster:'B.M',
  cats:'Chat', horse:'Chev', birds:'Ois', fish:'Pois', dog:'Chie',
};

// ── Puzzle data ───────────────────────────────────────────────────────────────

const CLUE_TEXTS = [
  'Le Norvégien habite la première maison.',
  'L\'habitant de la maison centrale boit du lait.',
  'Le Britannique habite la maison rouge.',
  'Le Suédois a un chien.',
  'Le Danois boit du thé.',
  'Le propriétaire de la maison verte boit du café.',
  'Le fumeur de Pall Mall a des oiseaux.',
  'Le propriétaire de la maison jaune fume des Dunhill.',
  'Le fumeur de Blue Master boit de la bière.',
  'L\'Allemand fume des Prince.',
  'La maison verte est immédiatement à gauche de la maison blanche.',
  'Le fumeur de Blend vit à côté du propriétaire du chat.',
  'Le propriétaire du cheval vit à côté du fumeur de Dunhill.',
  'Le Norvégien vit à côté de la maison bleue.',
  'Le voisin du fumeur de Blend boit de l\'eau.',
];

// Each definition is an array of column objects: { pos: null|0-4, cells: {attr: value} }
// 1-col with pos set  → absolute clue   (fixed house)
// 1-col with pos null → same-house clue (two attrs share a house, user picks which)
// 2-col               → adjacent clue   (colA goes at house h, colB at h+1)
const CLUE_DEFS = [
  [{ pos: 0,    cells: { nationality: 'norwegian' } }],
  [{ pos: 2,    cells: { drink: 'milk' } }],
  [{ pos: null, cells: { nationality: 'brit',   color: 'red'     } }],
  [{ pos: null, cells: { nationality: 'swede',  pet:   'dog'     } }],
  [{ pos: null, cells: { nationality: 'dane',   drink: 'tea'     } }],
  [{ pos: null, cells: { color: 'green',        drink: 'coffee'  } }],
  [{ pos: null, cells: { smoke: 'pallmall',     pet:   'birds'   } }],
  [{ pos: null, cells: { color: 'yellow',       smoke: 'dunhill' } }],
  [{ pos: null, cells: { smoke: 'bluemaster',   drink: 'beer'    } }],
  [{ pos: null, cells: { nationality: 'german', smoke: 'prince'  } }],
  [{ pos: null, cells: { color: 'green'  } }, { pos: null, cells: { color: 'white'   } }],
  [{ pos: null, cells: { pet:   'cats'    } }, { pos: null, cells: { smoke: 'blend'   } }],
  [{ pos: null, cells: { smoke: 'dunhill'} }, { pos: null, cells: { pet:   'horse'   } }],
  [{ pos: null, cells: { nationality: 'norwegian' } }, { pos: null, cells: { color: 'blue' } }],
  [{ pos: null, cells: { drink: 'water'  } }, { pos: null, cells: { smoke: 'blend'   } }],
];

// ── Solution (for win detection) ──────────────────────────────────────────────

const SOLUTION = {
  color:       ['yellow',    'blue',  'red',      'green',  'white'      ],
  nationality: ['norwegian', 'dane',  'brit',     'german', 'swede'      ],
  drink:       ['water',     'tea',   'milk',     'coffee', 'beer'       ],
  smoke:       ['dunhill',   'blend', 'pallmall', 'prince', 'bluemaster' ],
  pet:         ['cats',      'horse', 'birds',    'fish',   'dog'        ],
};

// ── State ─────────────────────────────────────────────────────────────────────

function emptyBoard() { return Object.fromEntries(ATTRS.map(a => [a, Array(5).fill(null)])); }

const board     = emptyBoard();
const usedClues = new Set();

const history = []; // undo stack: array of snapshots
const future  = []; // redo stack

let moveCount = 0;
let startTime = null;

function snapshot() {
  return {
    board: Object.fromEntries(ATTRS.map(a => [a, [...board[a]]])),
    used:  new Set(usedClues),
  };
}

function restoreSnapshot(snap) {
  ATTRS.forEach(a => { board[a] = [...snap.board[a]]; });
  usedClues.clear();
  snap.used.forEach(i => usedClues.add(i));
}

function updateUndoButtons() {
  const u = document.getElementById('btn-undo');
  const r = document.getElementById('btn-redo');
  if (u) u.disabled = history.length === 0;
  if (r) r.disabled = future.length  === 0;
}

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restoreSnapshot(history.pop());
  renderBoard('board', board);
  renderRules();
  updateUndoButtons();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restoreSnapshot(future.pop());
  renderBoard('board', board);
  renderRules();
  updateUndoButtons();
}

// ── Puzzle logic ──────────────────────────────────────────────────────────────

function isAbsolute(ruleDef) {
  return ruleDef.length === 1 && ruleDef[0].pos !== null;
}

function isAdjacent(ruleDef) {
  return ruleDef.length === 2;
}

// House index where all given cells match the board, or null.
function findPos(cells, brd) {
  for (let h = 0; h < 5; h++) {
    if (Object.entries(cells).every(([a, v]) => brd[a][h] === v)) return h;
  }
  return null;
}

// Resolve target house(s) for a rule.
// Adjacent → { p0, p1 } where p0/p1 = -1 signals an invalid/contradictory state.
// Single-col → { pos }.
function resolvePositions(ruleDef, col, brd) {
  if (isAdjacent(ruleDef)) {
    const pA = findPos(ruleDef[0].cells, brd);
    const pB = findPos(ruleDef[1].cells, brd);
    if (pA !== null && pB !== null) {
      // Both sides already on board — valid only if they are already adjacent
      return pB === pA + 1 ? { p0: pA, p1: pB } : { p0: -1, p1: -1 };
    }
    if (pA !== null) return { p0: pA,     p1: pA + 1 };
    if (pB !== null) return { p0: pB - 1, p1: pB };
    return { p0: col, p1: col + 1 };
  }
  const { pos } = ruleDef[0];
  return { pos: pos !== null ? pos : col };
}

// All (attr, val, house) triples a rule asserts at the given column, or null if invalid.
function getPlacementPairs(ruleDef, col, brd) {
  if (isAdjacent(ruleDef)) {
    const { p0, p1 } = resolvePositions(ruleDef, col, brd);
    if (p0 < 0 || p1 > 4) return null;
    return [
      ...Object.entries(ruleDef[0].cells).map(([a, v]) => ({ attr: a, val: v, house: p0 })),
      ...Object.entries(ruleDef[1].cells).map(([a, v]) => ({ attr: a, val: v, house: p1 })),
    ];
  }
  const { pos, cells } = ruleDef[0];
  if (pos !== null && pos !== col) return null;
  const house = pos !== null ? pos : col;
  if (house < 0 || house > 4) return null;
  return Object.entries(cells).map(([a, v]) => ({ attr: a, val: v, house }));
}

// True if placing val at house is valid:
//   • the cell is empty or already holds the same value (no overwrite of a different value)
//   • val doesn't already appear at any other house in the row
function canPlaceVal(attr, val, house, brd) {
  const current = brd[attr][house];
  if (current !== null && current !== val) return false; // would overwrite a different value
  for (let h = 0; h < 5; h++) {
    if (h !== house && brd[attr][h] === val) return false;
  }
  return true;
}

function canPlace(ruleDef, col, brd) {
  const pairs = getPlacementPairs(ruleDef, col, brd);
  return pairs !== null && pairs.every(({ attr, val, house }) => canPlaceVal(attr, val, house, brd));
}

function placeRule(ruleDef, col, brd, clueIdx, usedSet) {
  const pairs = getPlacementPairs(ruleDef, col, brd);
  if (!pairs) return;
  pairs.forEach(({ attr, val, house }) => { brd[attr][house] = val; });
  if (clueIdx != null) usedSet.add(clueIdx);
}

// When exactly one cell in a row is empty, fill it with the only remaining value.
// Uses SOLUTION as the authoritative value set (this puzzle has a unique solution).
function applyDeductions(brd) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const attr of ATTRS) {
      const nullAt = brd[attr].findIndex(v => v === null);
      if (nullAt < 0) continue;
      if (brd[attr].filter(v => v !== null).length !== 4) continue;
      const placed = new Set(brd[attr]);
      const missing = SOLUTION[attr].find(v => !placed.has(v));
      if (missing) { brd[attr][nullAt] = missing; changed = true; }
    }
  }
}

// Drop used clues whose values are no longer consistently placed on the board.
function revalidateUsed() {
  for (const i of [...usedClues]) {
    const def = CLUE_DEFS[i];
    let ok;
    if (isAdjacent(def)) {
      const pA = findPos(def[0].cells, board);
      const pB = findPos(def[1].cells, board);
      ok = pA !== null && pB !== null && pB === pA + 1;
    } else {
      const pos = def[0].pos !== null ? def[0].pos : findPos(def[0].cells, board);
      ok = pos !== null;
    }
    if (!ok) usedClues.delete(i);
  }
}

// True if the rule can be placed somewhere on the current board.
function isFeasible(ruleDef) {
  if (isAbsolute(ruleDef)) return canPlace(ruleDef, ruleDef[0].pos, board);
  if (isAdjacent(ruleDef)) {
    const pA = findPos(ruleDef[0].cells, board);
    const pB = findPos(ruleDef[1].cells, board);
    if (pA !== null) return canPlace(ruleDef, pA, board);
    if (pB !== null) return canPlace(ruleDef, pB - 1, board);
    return [0, 1, 2, 3].some(c => canPlace(ruleDef, c, board));
  }
  return [0, 1, 2, 3, 4].some(c => canPlace(ruleDef, c, board));
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderBoard(boardId, brd) {
  const el = document.getElementById(boardId);
  if (!el) return;
  el.innerHTML = '';

  el.appendChild(div('board-corner'));
  for (let h = 0; h < 5; h++) {
    const hdr = div('board-col-header');
    hdr.innerHTML = `<span class="house-num">${h + 1}</span>`;
    hdr.dataset.house = h; hdr.dataset.board = boardId;
    el.appendChild(hdr);
  }

  for (const attr of ATTRS) {
    const lbl = div('board-row-header');
    lbl.innerHTML = `<span class="row-icon">${ATTR_META[attr].icon}</span>`;
    lbl.title = ATTR_META[attr].label;
    lbl.dataset.attr = attr;
    el.appendChild(lbl);

    for (let h = 0; h < 5; h++) {
      const cell = div('board-cell');
      cell.dataset.attr = attr; cell.dataset.house = h; cell.dataset.board = boardId;
      const val = brd[attr][h];
      if (val) {
        cell.innerHTML = `<span class="cell-icon">${VALUE_ICONS[val]}</span><span class="cell-short">${VALUE_SHORT[val]}</span>`;
        cell.classList.add('filled');
      } else {
        cell.innerHTML = `<span class="cell-empty-dot">·</span>`;
      }
      el.appendChild(cell);
    }
  }
}

// Accepts one or more column indices to flash.
function flashBoard(boardId, ...cols) {
  cols.forEach(houseIdx => {
    document.querySelectorAll(`#${boardId} .board-cell[data-house="${houseIdx}"]`).forEach(cell => {
      pulse(cell, 'flash');
    });
  });
}

function renderRules() {
  const list = document.getElementById('rules-list');
  list.innerHTML = '';
  CLUE_TEXTS.forEach((text, i) => {
    if (usedClues.has(i)) return;
    const el = div('rule-item');
    el.dataset.ruleIdx = i;
    const placeable = isFeasible(CLUE_DEFS[i]);
    if (placeable) el.classList.add('rule-placeable');
    el.innerHTML =
      `<span class="rule-grip">⠿</span>` +
      `<span class="rule-num">${i + 1}.</span>` +
      `<span class="rule-text">${text}</span>`;
    setupRuleDrag(el, i);
    list.appendChild(el);
  });
}

// ── Geometry — read from live DOM so layout stays responsive ─────────────────

// Fallback constants (used only when DOM isn't ready yet)
const B_CELL = 44;
const B_GAP  = 3;

function boardCellSize(boardId) {
  return document.querySelector(`#${boardId} .board-cell`)?.getBoundingClientRect().width ?? B_CELL;
}
function boardCellGap(boardId) {
  const h0 = document.querySelector(`#${boardId} .board-col-header[data-house="0"]`);
  const h1 = document.querySelector(`#${boardId} .board-col-header[data-house="1"]`);
  return (h0 && h1) ? h1.getBoundingClientRect().left - h0.getBoundingClientRect().right : B_GAP;
}
function boardColLeft(boardId, col) {
  return document.querySelector(`#${boardId} .board-col-header[data-house="${col}"]`)
    ?.getBoundingClientRect().left ?? 0;
}
function boardDataTop(boardId) {
  return document.querySelector(`#${boardId} .board-cell`)?.getBoundingClientRect().top ?? 0;
}

// ── Drag ghost ────────────────────────────────────────────────────────────────

function makeGhostCol(cells, cls = '') {
  const col = div('ghost-col' + (cls ? ' ' + cls : ''));
  ATTRS.forEach(attr => {
    const cell = div('ghost-cell');
    cell.dataset.attr = attr;
    const val = cells[attr];
    if (val) {
      cell.innerHTML = `<span>${VALUE_ICONS[val]}</span><small>${VALUE_SHORT[val]}</small>`;
    } else {
      cell.classList.add('empty');
      cell.innerHTML = `<span>${ATTR_META[attr].icon}</span>`;
    }
    col.appendChild(cell);
  });
  return col;
}

function createDragGhost(ruleDef) {
  const sz  = boardCellSize('board');
  const gap = boardCellGap('board');

  function sizedCol(cells, cls) {
    const col = makeGhostCol(cells, cls);
    col.style.gap = gap + 'px';
    col.querySelectorAll('.ghost-cell').forEach(c => {
      c.style.width = c.style.height = sz + 'px';
    });
    return col;
  }

  const ghost = div('card-ghost');
  ghost.style.gap = gap + 'px';
  if (isAdjacent(ruleDef)) {
    const [colA, colB] = ruleDef;
    ghost.appendChild(sizedCol(colB.cells, 'ghost-neighbor'));
    ghost.appendChild(sizedCol(colA.cells, 'ghost-active'));
    ghost.appendChild(sizedCol(colB.cells, 'ghost-neighbor'));
  } else {
    ghost.appendChild(sizedCol(ruleDef[0].cells, ''));
  }
  ghost.style.cssText = `position:fixed;z-index:999;pointer-events:none;gap:${gap}px;`;
  document.body.appendChild(ghost);
  return ghost;
}

// Returns { boardId, brd, usedSet, col, boardRect } or null if not near the board.
function getSnapTarget(ruleDef, cx, cy) {
  const boardId  = 'board';
  const boardRect = document.getElementById(boardId)?.getBoundingClientRect();
  if (!boardRect) return null;

  const cellSz = boardCellSize(boardId);
  const gap    = boardCellGap(boardId);
  const margin = cellSz * 1.5;

  if (cx < boardRect.left - margin || cx > boardRect.right  + margin) return null;
  if (cy < boardRect.top  - margin || cy > boardRect.bottom + margin) return null;

  let col;
  if (isAbsolute(ruleDef)) {
    col = ruleDef[0].pos;
  } else if (isAdjacent(ruleDef)) {
    const pA = findPos(ruleDef[0].cells, board);
    const pB = findPos(ruleDef[1].cells, board);
    if (pA !== null && pB !== null) {
      if (pB !== pA + 1) return null;
      col = pA;
    } else if (pA !== null) col = pA;
    else if (pB !== null) col = pB - 1;
    else {
      col = Math.round((cx - boardColLeft(boardId, 0)) / (cellSz + gap));
      if (col < 0 || col > 3) return null;
    }
  } else {
    col = Math.round((cx - boardColLeft(boardId, 0)) / (cellSz + gap));
    if (col < 0 || col > 4) return null;
  }
  return { boardId, brd: board, usedSet: usedClues, col, boardRect };
}

function positionGhost(ghost, ruleDef, cx, cy) {
  const target = getSnapTarget(ruleDef, cx, cy);
  if (target) {
    const { col, boardId } = target;
    const cellSz = boardCellSize(boardId);
    const gap    = boardCellGap(boardId);
    const pivotOffset = isAdjacent(ruleDef) ? (cellSz + gap) : 0;
    ghost.style.left = (boardColLeft(boardId, col) - pivotOffset) + 'px';
    ghost.style.top  = boardDataTop(boardId) + 'px';
    ghost.style.transition = 'left .08s ease, top .04s ease';
  } else {
    const w = ghost.offsetWidth  || B_CELL;
    const h = ghost.offsetHeight || (5 * B_CELL + 4 * B_GAP);
    ghost.style.left = (cx - w / 2) + 'px';
    ghost.style.top  = (cy - h * 0.45) + 'px';
    ghost.style.transition = 'none';
  }
}

// ── Preview ───────────────────────────────────────────────────────────────────

function clearBoardPreview() {
  document.querySelectorAll('.board-cell.drop-hover').forEach(el => el.classList.remove('drop-hover'));
}

function showBoardPreview(boardId, houseIdx) {
  document.querySelectorAll(`#${boardId} .board-cell[data-house="${houseIdx}"]`)
    .forEach(el => el.classList.add('drop-hover'));
}

// ── Drag & drop ───────────────────────────────────────────────────────────────

let drag = null;

function setupRuleDrag(ruleEl, ruleIdx) {
  const ruleDef = CLUE_DEFS[ruleIdx];

  function startDrag(e, captureEl) {
    if (usedClues.has(ruleIdx)) return;
    if (!isFeasible(ruleDef)) { pulse(ruleEl, 'repulse'); return; }
    e.preventDefault();
    e.stopPropagation();

    const ghost = createDragGhost(ruleDef);
    positionGhost(ghost, ruleDef, e.clientX, e.clientY);

    drag = { ruleEl, ruleDef, ruleIdx, ghost, captureEl,
             startCX: e.clientX, startCY: e.clientY, snapTarget: null };
    captureEl.setPointerCapture(e.pointerId);
    ruleEl.classList.add('dragging');
    captureEl.addEventListener('pointermove',   onRuleDragMove);
    captureEl.addEventListener('pointerup',     onRuleDragEnd);
    captureEl.addEventListener('pointercancel', onRuleDragEnd);
  }

  // Touch: only start drag from the grip (its touch-action:none prevents scroll conflict)
  const grip = ruleEl.querySelector('.rule-grip');
  if (grip) {
    grip.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return; // handled by ruleEl handler below
      startDrag(e, grip);
    });
  }

  // Mouse: drag from anywhere on the rule item
  ruleEl.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    startDrag(e, ruleEl);
  });
}

function onRuleDragMove(e) {
  if (!drag) return;
  const { ruleDef } = drag;

  positionGhost(drag.ghost, ruleDef, e.clientX, e.clientY);

  clearBoardPreview();
  const target = getSnapTarget(ruleDef, e.clientX, e.clientY);
  if (target && canPlace(ruleDef, target.col, target.brd)) {
    if (isAdjacent(ruleDef)) {
      const { p0, p1 } = resolvePositions(ruleDef, target.col, target.brd);
      showBoardPreview(target.boardId, p0);
      if (p1 >= 0 && p1 <= 4) showBoardPreview(target.boardId, p1);
    } else {
      showBoardPreview(target.boardId, target.col);
    }
    drag.snapTarget = target;
  } else {
    drag.snapTarget = null;
  }
}

function onRuleDragEnd(e) {
  if (!drag) return;
  const { ruleEl, ruleDef, ruleIdx, ghost: ghostEl, snapTarget, startCX, startCY, captureEl } = drag;
  drag.ghost = null;
  drag = null;

  ruleEl.classList.remove('dragging');
  captureEl.removeEventListener('pointermove',   onRuleDragMove);
  captureEl.removeEventListener('pointerup',     onRuleDragEnd);
  captureEl.removeEventListener('pointercancel', onRuleDragEnd);
  clearBoardPreview();

  const dragDist = Math.hypot(e.clientX - startCX, e.clientY - startCY);
  if (dragDist < 8 || !snapTarget) {
    ghostEl?.remove();
    return;
  }

  if (canPlace(ruleDef, snapTarget.col, snapTarget.brd)) {
    commitRule(ruleIdx, snapTarget, ghostEl, e.clientX, e.clientY);
  } else {
    ghostEl?.remove();
    pulse(ruleEl, 'repulse');
  }
}

function commitRule(ruleIdx, target, ghostEl, cx, cy) {
  const { boardId, brd, usedSet, col } = target;
  const cellSz = boardCellSize(boardId);
  const dest = document.querySelector(`#${boardId} .board-cell[data-house="${col}"]`)?.getBoundingClientRect();

  // Snapshot which rules are feasible NOW, before the placement
  const feasibleBefore = new Set(
    CLUE_DEFS.map((_, i) => i).filter(i => !usedClues.has(i) && i !== ruleIdx && isFeasible(CLUE_DEFS[i]))
  );
  if (dest && ghostEl) {
    ghostEl.style.transition = 'left .22s ease, top .22s ease, transform .22s, opacity .18s';
    ghostEl.style.left      = (dest.left + dest.width  / 2 - (ghostEl.offsetWidth  || cellSz) / 2) + 'px';
    ghostEl.style.top       = (dest.top  + dest.height / 2 - (ghostEl.offsetHeight || cellSz) / 2) + 'px';
    ghostEl.style.transform = 'scale(0.25)';
    ghostEl.style.opacity   = '0';
  }
  setTimeout(() => {
    ghostEl?.remove();
    if (!startTime) startTime = Date.now();
    moveCount++;
    history.push(snapshot());
    future.length = 0;
    const ruleDef = CLUE_DEFS[ruleIdx];
    placeRule(ruleDef, col, brd, ruleIdx, usedSet);
    applyDeductions(brd);
    revalidateUsed();
    renderBoard(boardId, brd);
    renderRules();
    tutorialOnCommit(ruleIdx);
    // Flash all affected columns
    if (isAdjacent(ruleDef)) {
      const { p0, p1 } = resolvePositions(ruleDef, col, brd);
      flashBoard(boardId, p0, p1);
    } else {
      flashBoard(boardId, col);
    }
    rewardBurst(dest ? dest.left + dest.width / 2 : cx, dest ? dest.top + dest.height / 2 : cy);
    updateUndoButtons();
    // Flash rules that just became placeable
    CLUE_DEFS.forEach((def, i) => {
      if (!usedClues.has(i) && !feasibleBefore.has(i) && isFeasible(def)) {
        const el = document.querySelector(`.rule-item[data-rule-idx="${i}"]`);
        if (el) pulse(el, 'rule-unlocked');
      }
    });
    // Check for victory
    if (isSolved()) setTimeout(showWin, 400);
  }, dest ? 230 : 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Restart a CSS animation on an element via force-reflow trick.
function pulse(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}

function rewardBurst(cx, cy) {
  const COLORS = ['#f59e0b','#60a5fa','#34d399','#f472b6','#a78bfa','#ffffff'];
  Array.from({ length: 20 }, (_, i) => {
    const p = document.createElement('div');
    const angle = (i / 20) * Math.PI * 2;
    const dist  = 50 + Math.random() * 70;
    p.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:9999',
      `left:${cx}px`, `top:${cy}px`,
      `width:${4 + Math.random() * 5}px`, `height:${4 + Math.random() * 5}px`,
      'border-radius:50%',
      `background:${COLORS[i % COLORS.length]}`,
      `--dx:${Math.cos(angle) * dist}px`, `--dy:${Math.sin(angle) * dist}px`,
      'animation:burst-fly .55s cubic-bezier(.2,.8,.4,1) forwards',
    ].join(';');
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  });
}

function div(cls) {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  return el;
}

// ── Win detection ─────────────────────────────────────────────────────────────

function isSolved() {
  return ATTRS.every(attr => board[attr].every((val, h) => val === SOLUTION[attr][h]));
}

function showWin() {
  const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  document.getElementById('win-moves').textContent = moveCount;
  document.getElementById('win-time').textContent  = timeStr;
  document.getElementById('win-screen').hidden = false;
}

function resetGame() {
  if (tutorialActive && tutorialStep > 0) stopTutorial(); // guard against re-entry from startTutorial
  ATTRS.forEach(a => { board[a] = Array(5).fill(null); });
  usedClues.clear();
  history.length = 0;
  future.length  = 0;
  moveCount = 0;
  startTime = null;
  document.getElementById('win-screen').hidden = true;
  renderBoard('board', board);
  renderRules();
  updateUndoButtons();
}

// ── Tutorial ──────────────────────────────────────────────────────────────────

// Each step: which rule to place, which col to highlight / auto-place, and a hint.
// House numbers in hints are 1-based for the user.
const TUTORIAL_STEPS = [
  {
    ruleIdx: 0, col: 0,
    hint: '<strong>Indice fixe.</strong> Le Norvégien habite la maison&nbsp;1 — aucune déduction nécessaire. Glissez la règle&nbsp;1 vers la colonne&nbsp;1.',
  },
  {
    ruleIdx: 1, col: 2,
    hint: '<strong>Indice fixe.</strong> La maison centrale est la maison&nbsp;3, et on y boit du lait. Glissez la règle&nbsp;2 vers la colonne&nbsp;3.',
  },
  {
    ruleIdx: 13, col: 0,
    hint: '<strong>Forcé.</strong> Le Norvégien est en maison&nbsp;1. La maison bleue doit être immédiatement à côté de lui → la maison&nbsp;2 est bleue. Glissez la règle&nbsp;14 vers la colonne&nbsp;1.',
  },
  {
    ruleIdx: 2, col: 2,
    hint: '<strong>Placement.</strong> Le Britannique vit dans la maison rouge. Maison&nbsp;1&nbsp;=&nbsp;Norvégien ; maison&nbsp;2&nbsp;=&nbsp;bleu donc rouge&nbsp;≠&nbsp;maison&nbsp;2. Vert/blanc (règle&nbsp;11, adjacents) doivent occuper deux maisons consécutives libres — seules les maisons&nbsp;4–5 conviennent, laissant la maison&nbsp;3 pour le rouge. Glissez la règle&nbsp;3 vers la colonne&nbsp;3.',
  },
  {
    ruleIdx: 10, col: 3,
    hint: '<strong>Forcé.</strong> La maison verte est immédiatement à gauche de la blanche. Les maisons&nbsp;1–3 ont déjà jaune/bleu/rouge — la seule paire adjacente libre est les maisons&nbsp;4–5. Glissez la règle&nbsp;11 vers la colonne&nbsp;4.',
  },
  {
    ruleIdx: 7, col: 0,
    hint: '<strong>Forcé par élimination.</strong> Les cinq couleurs sont maintenant placées : bleu&nbsp;(2), rouge&nbsp;(3), vert&nbsp;(4), blanc&nbsp;(5). Seule la maison&nbsp;1 n\'a pas de couleur → c\'est forcément le jaune. Dunhill va avec. Glissez la règle&nbsp;8 vers la colonne&nbsp;1.',
  },
  {
    ruleIdx: 12, col: 0,
    hint: '<strong>Forcé.</strong> Dunhill est en maison&nbsp;1. Le propriétaire du cheval vit à côté du fumeur de Dunhill → maison&nbsp;2. Glissez la règle&nbsp;13 vers la colonne&nbsp;1.',
  },
  {
    ruleIdx: 4, col: 1,
    hint: '<strong>Placement.</strong> Le Danois boit du thé. La maison&nbsp;2 n\'a encore ni nationalité ni boisson. Glissez la règle&nbsp;5 vers la colonne&nbsp;2.',
  },
  {
    ruleIdx: 6, col: 2,
    hint: '<strong>Placement.</strong> Pall&nbsp;Mall&nbsp;+&nbsp;oiseaux. La maison&nbsp;3 (Britannique, lait) a des cases libres pour la cigarette et l\'animal. Glissez la règle&nbsp;7 vers la colonne&nbsp;3.',
  },
  {
    ruleIdx: 5, col: 3,
    hint: '<strong>Forcé.</strong> Le propriétaire de la maison verte boit du café. La maison verte est la&nbsp;4 → le café va là. Glissez la règle&nbsp;6 vers la colonne&nbsp;4.',
  },
  {
    ruleIdx: 9, col: 3,
    hint: '<strong>Placement.</strong> L\'Allemand fume Prince. La maison&nbsp;4 (vert, café) a des cases libres pour la nationalité et la cigarette. Glissez la règle&nbsp;10 vers la colonne&nbsp;4.',
  },
  {
    ruleIdx: 3, col: 4,
    hint: '<strong>Forcé.</strong> Les nationalités des maisons&nbsp;1–4 sont toutes placées → le Suédois est forcément en maison&nbsp;5. Le Suédois a un chien. Glissez la règle&nbsp;4 vers la colonne&nbsp;5.',
  },
  {
    ruleIdx: 8, col: 4,
    hint: '<strong>Placement.</strong> Blue&nbsp;Master&nbsp;+&nbsp;bière. Seule la maison&nbsp;5 a des cases libres pour la cigarette et la boisson. Glissez la règle&nbsp;9 vers la colonne&nbsp;5.',
  },
  {
    ruleIdx: 11, col: 0,
    hint: '<strong>Forcé.</strong> Dunhill/Pall&nbsp;Mall/Prince/Blue&nbsp;Master occupent les maisons&nbsp;1,3,4,5 → Blend est forcément en maison&nbsp;2. Le voisin du fumeur de Blend a des chats → chats en maison&nbsp;1. Glissez la règle&nbsp;12 vers la colonne&nbsp;1.',
  },
  {
    ruleIdx: 14, col: 0,
    hint: '<strong>Dernier indice.</strong> Blend est en maison&nbsp;2. Le voisin du fumeur de Blend boit de l\'eau → eau en maison&nbsp;1. Tableau complet&nbsp;! 🎉 Glissez la règle&nbsp;15 vers la colonne&nbsp;1.',
  },
];

let tutorialActive = false;
let tutorialStep   = 0;

function startTutorial() {
  tutorialActive = true;
  tutorialStep   = 0;
  resetGame();           // always start fresh
  document.getElementById('btn-tutorial').classList.add('active');
  document.getElementById('tutorial-hint').hidden = false;
  applyTutorialHighlights();
}

function stopTutorial() {
  tutorialActive = false;
  clearTutorialHighlights();
  const btn = document.getElementById('btn-tutorial');
  if (btn) btn.classList.remove('active');
  const hint = document.getElementById('tutorial-hint');
  if (hint) hint.hidden = true;
}

function toggleTutorial() {
  if (tutorialActive) stopTutorial(); else startTutorial();
}

function tutorialOnCommit(ruleIdx) {
  if (!tutorialActive) return;
  if (tutorialStep >= TUTORIAL_STEPS.length) return;
  if (TUTORIAL_STEPS[tutorialStep].ruleIdx !== ruleIdx) return;
  tutorialStep++;
  if (tutorialStep >= TUTORIAL_STEPS.length) {
    stopTutorial();
  } else {
    // Re-apply highlights after next render tick
    requestAnimationFrame(applyTutorialHighlights);
  }
}

function applyTutorialHighlights() {
  clearTutorialHighlights();
  if (!tutorialActive || tutorialStep >= TUTORIAL_STEPS.length) return;
  const step = TUTORIAL_STEPS[tutorialStep];

  // Highlight the target rule item
  const ruleEl = document.querySelector(`.rule-item[data-rule-idx="${step.ruleIdx}"]`);
  if (ruleEl) {
    ruleEl.classList.add('tutorial-target');
    ruleEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Determine which board columns to highlight
  const def = CLUE_DEFS[step.ruleIdx];
  let houses = [];
  if (isAbsolute(def)) {
    houses = [def[0].pos];
  } else if (isAdjacent(def)) {
    const { p0, p1 } = resolvePositions(def, step.col, board);
    if (p0 >= 0)       houses.push(p0);
    if (p1 >= 0 && p1 <= 4) houses.push(p1);
  } else {
    // same-house: check if board already constrains the position
    const pos = findPos(def[0].cells, board);
    houses = [pos !== null ? pos : step.col];
  }
  houses.forEach(h => {
    document.querySelectorAll(`#board .board-cell[data-house="${h}"]`)
      .forEach(el => el.classList.add('tutorial-col'));
  });

  // Update hint text + step counter
  const counter = document.getElementById('tutorial-step-num');
  const text    = document.getElementById('tutorial-hint-text');
  if (counter) counter.textContent = `${tutorialStep + 1} / ${TUTORIAL_STEPS.length}`;
  if (text)    text.innerHTML = step.hint;
}

function clearTutorialHighlights() {
  document.querySelectorAll('.rule-item.tutorial-target')
    .forEach(el => el.classList.remove('tutorial-target'));
  document.querySelectorAll('.board-cell.tutorial-col')
    .forEach(el => el.classList.remove('tutorial-col'));
}

// Auto-place the current tutorial step (the "Show me" button)
function tutorialAutoPlace() {
  if (!tutorialActive || tutorialStep >= TUTORIAL_STEPS.length) return;
  const step = TUTORIAL_STEPS[tutorialStep];
  const def = CLUE_DEFS[step.ruleIdx];

  // Resolve placement col from current board state
  let col = step.col;
  if (isAbsolute(def)) {
    col = def[0].pos;
  } else if (isAdjacent(def)) {
    const pA = findPos(def[0].cells, board);
    const pB = findPos(def[1].cells, board);
    if (pA !== null) col = pA;
    else if (pB !== null) col = pB - 1;
    // else use step.col
  } else {
    const pos = findPos(def[0].cells, board);
    if (pos !== null) col = pos;
  }

  if (!canPlace(def, col, board)) return;
  commitRule(step.ruleIdx, { boardId: 'board', brd: board, usedSet: usedClues, col }, null, 0, 0);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  // Detect iOS to suppress the desktop phone simulator frame
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) document.body.classList.add('ios');

  // Detect standalone (Home Screen PWA) vs browser (Safari with address bar)
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) document.body.classList.add('standalone');
  else if (isIOS) document.body.classList.add('ios-browser');

  renderBoard('board', board);
  renderRules();
  updateUndoButtons();
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (e.key === 'z' &&  e.shiftKey) { e.preventDefault(); redo(); }
  if (e.key === 'y')                 { e.preventDefault(); redo(); }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
