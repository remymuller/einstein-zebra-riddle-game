// ── Data ──────────────────────────────────────────────────────────────────────

const ATTRS = ['color', 'nationality', 'drink', 'smoke', 'pet'];

const ATTR_META = {
  color:       { label: 'Color',  icon: '🎨' },
  nationality: { label: 'Nation', icon: '🌍' },
  drink:       { label: 'Drink',  icon: '🥤' },
  smoke:       { label: 'Smoke',  icon: '💨' },
  pet:         { label: 'Pet',    icon: '🐾' },
};

const VALUE_ICONS = {
  yellow:'🟨', blue:'🟦', red:'🟥', green:'🟩', white:'⬜',
  norwegian:'🇳🇴', dane:'🇩🇰', brit:'🇬🇧', german:'🇩🇪', swede:'🇸🇪',
  water:'💧', tea:'🍵', milk:'🥛', coffee:'☕', beer:'🍺',
  dunhill:'🚬', blend:'🌫️', pallmall:'📦', prince:'👑', bluemaster:'💙',
  cats:'🐱', horse:'🐴', birds:'🐦', fish:'🐟', dog:'🐶',
};

const VALUE_SHORT = {
  yellow:'Yel', blue:'Blu', red:'Red', green:'Grn', white:'Wht',
  norwegian:'Nor', dane:'Dan', brit:'Brt', german:'Ger', swede:'Swe',
  water:'H₂O', tea:'Tea', milk:'Mlk', coffee:'Cof', beer:'Beer',
  dunhill:'Dun', blend:'Bld', pallmall:'P.M', prince:'Prn', bluemaster:'B.M',
  cats:'Cat', horse:'Hrs', birds:'Brd', fish:'Fsh', dog:'Dog',
};

// ── Puzzle data ───────────────────────────────────────────────────────────────

const CLUE_TEXTS = [
  'The Norwegian lives in the first house.',
  'The man in the center house drinks milk.',
  'The Brit lives in the red house.',
  'The Swede keeps dogs.',
  'The Dane drinks tea.',
  'The green house owner drinks coffee.',
  'The Pall Mall smoker keeps birds.',
  'The yellow house owner smokes Dunhill.',
  'The Blue Master smoker drinks beer.',
  'The German smokes Prince.',
  'The green house is immediately left of the white house.',
  'The Blend smoker lives next to the cat owner.',
  'The horse owner lives next to the Dunhill smoker.',
  'The Norwegian lives next to the blue house.',
  "The Blend smoker's neighbor drinks water.",
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
  [{ pos: null, cells: { smoke: 'blend'  } }, { pos: null, cells: { pet:   'cats'    } }],
  [{ pos: null, cells: { pet:   'horse'  } }, { pos: null, cells: { smoke: 'dunhill' } }],
  [{ pos: null, cells: { nationality: 'norwegian' } }, { pos: null, cells: { color: 'blue' } }],
  [{ pos: null, cells: { smoke: 'blend'  } }, { pos: null, cells: { drink: 'water'   } }],
];

// ── State ─────────────────────────────────────────────────────────────────────

function emptyBoard() { return Object.fromEntries(ATTRS.map(a => [a, Array(5).fill(null)])); }

const board     = emptyBoard();
const usedClues = new Set();

const history = []; // undo stack: array of snapshots
const future  = []; // redo stack

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

function undo() {
  if (!history.length) return;
  future.push(snapshot());
  restoreSnapshot(history.pop());
  renderBoard('board', board);
  renderRules();
}

function redo() {
  if (!future.length) return;
  history.push(snapshot());
  restoreSnapshot(future.pop());
  renderBoard('board', board);
  renderRules();
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

// True if placing val at house won't duplicate it elsewhere in the attribute row.
// (Overwriting the same cell is fine; only a conflict at a *different* house is blocked.)
function canPlaceVal(attr, val, house, brd) {
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
    const el = div('rule-item');
    el.innerHTML = `<span class="rule-num">${i + 1}.</span><span class="rule-text">${text}</span>`;
    if (usedClues.has(i)) return;
    setupRuleDrag(el, i);
    list.appendChild(el);
  });
}

// ── Geometry (must match CSS) ─────────────────────────────────────────────────

const B_PAD  = 8;   // #board padding
const B_HCOL = 22;  // header column width
const B_HROW = 22;  // header row height
const B_CELL = 44;  // cell size
const B_GAP  = 3;   // grid gap

function boardColX(boardRect, col) {
  return boardRect.left + B_PAD + B_HCOL + B_GAP + col * (B_CELL + B_GAP);
}
function boardDataTop(boardRect) {
  return boardRect.top + B_PAD + B_HROW + B_GAP;
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
  const ghost = div('card-ghost');
  if (isAdjacent(ruleDef)) {
    const [colA, colB] = ruleDef;
    // Layout: neighbor | active-center | neighbor
    ghost.appendChild(makeGhostCol(colB.cells, 'ghost-neighbor'));
    ghost.appendChild(makeGhostCol(colA.cells, 'ghost-active'));
    ghost.appendChild(makeGhostCol(colB.cells, 'ghost-neighbor'));
  } else {
    ghost.appendChild(makeGhostCol(ruleDef[0].cells));
  }
  ghost.style.cssText = 'position:fixed;z-index:999;pointer-events:none;';
  document.body.appendChild(ghost);
  return ghost;
}

// Returns { boardId, brd, usedSet, col, boardRect } or null if not near any board.
function getSnapTarget(ruleDef, cx, cy) {
  const boards = [
    { boardId: 'board', brd: board, usedSet: usedClues },
  ];
  for (const { boardId, brd, usedSet } of boards) {
    const boardRect = document.getElementById(boardId)?.getBoundingClientRect();
    if (!boardRect) continue;
    const margin = B_CELL * 1.5;
    if (cx < boardRect.left - margin || cx > boardRect.right  + margin) continue;
    if (cy < boardRect.top  - margin || cy > boardRect.bottom + margin) continue;
    let col;
    if (isAbsolute(ruleDef)) {
      col = ruleDef[0].pos;
    } else if (isAdjacent(ruleDef)) {
      const pA = findPos(ruleDef[0].cells, brd);
      const pB = findPos(ruleDef[1].cells, brd);
      if (pA !== null && pB !== null) {
        if (pB !== pA + 1) continue; // contradictory — don't snap
        col = pA;
      } else if (pA !== null) col = pA;
      else if (pB !== null) col = pB - 1;
      else {
        col = Math.round((cx - boardColX(boardRect, 0)) / (B_CELL + B_GAP));
        if (col < 0 || col > 3) continue;
      }
    } else {
      col = Math.round((cx - boardColX(boardRect, 0)) / (B_CELL + B_GAP));
      if (col < 0 || col > 4) continue;
    }
    return { boardId, brd, usedSet, col, boardRect };
  }
  return null;
}

function positionGhost(ghost, ruleDef, cx, cy) {
  const target = getSnapTarget(ruleDef, cx, cy);
  if (target) {
    const { col, boardRect } = target;
    const pivotOffset = isAdjacent(ruleDef) ? (B_CELL + B_GAP) : 0;
    ghost.style.left = (boardColX(boardRect, col) - pivotOffset) + 'px';
    ghost.style.top  = boardDataTop(boardRect) + 'px';
    ghost.style.transition = 'left .08s ease, top .04s ease';
  } else {
    const w = ghost.offsetWidth || B_CELL;
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
  ruleEl.addEventListener('pointerdown', e => {
    if (usedClues.has(ruleIdx)) return;
    if (!isFeasible(ruleDef)) { pulse(ruleEl, 'repulse'); return; }
    e.preventDefault();

    const ghost = createDragGhost(ruleDef);
    positionGhost(ghost, ruleDef, e.clientX, e.clientY);

    drag = { ruleEl, ruleDef, ruleIdx, ghost,
             startCX: e.clientX, startCY: e.clientY, snapTarget: null };
    ruleEl.setPointerCapture(e.pointerId);
    ruleEl.classList.add('dragging');
    ruleEl.addEventListener('pointermove', onRuleDragMove);
    ruleEl.addEventListener('pointerup',   onRuleDragEnd);
    ruleEl.addEventListener('pointercancel', onRuleDragEnd);
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
  const { ruleEl, ruleDef, ruleIdx, ghost: ghostEl, snapTarget, startCX, startCY } = drag;
  drag.ghost = null;
  drag = null;

  ruleEl.classList.remove('dragging');
  ruleEl.removeEventListener('pointermove', onRuleDragMove);
  ruleEl.removeEventListener('pointerup',   onRuleDragEnd);
  ruleEl.removeEventListener('pointercancel', onRuleDragEnd);
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
  const { boardId, brd, usedSet, col, boardRect } = target;
  const dest = document.querySelector(`#${boardId} .board-cell[data-house="${col}"]`)?.getBoundingClientRect();
  if (dest && ghostEl) {
    ghostEl.style.transition = 'left .22s ease, top .22s ease, transform .22s, opacity .18s';
    ghostEl.style.left      = (dest.left + dest.width  / 2 - (ghostEl.offsetWidth  || B_CELL) / 2) + 'px';
    ghostEl.style.top       = (dest.top  + dest.height / 2 - (ghostEl.offsetHeight || B_CELL) / 2) + 'px';
    ghostEl.style.transform = 'scale(0.25)';
    ghostEl.style.opacity   = '0';
  }
  setTimeout(() => {
    ghostEl?.remove();
    history.push(snapshot());
    future.length = 0;
    const ruleDef = CLUE_DEFS[ruleIdx];
    placeRule(ruleDef, col, brd, ruleIdx, usedSet);
    revalidateUsed();
    renderBoard(boardId, brd);
    renderRules();
    // Flash all affected columns
    if (isAdjacent(ruleDef)) {
      const { p0, p1 } = resolvePositions(ruleDef, col, brd);
      flashBoard(boardId, p0, p1);
    } else {
      flashBoard(boardId, col);
    }
    rewardBurst(dest ? dest.left + dest.width / 2 : cx, dest ? dest.top + dest.height / 2 : cy);
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

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  renderBoard('board', board);
  renderRules();
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
