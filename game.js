// ── Constants ─────────────────────────────────────────────────────────────────

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
// 1-col with pos set  → absolute clue   (renders as 5-wide grid)
// 1-col with pos null → same-house clue (renders as 1-wide column)
// 2-col               → adjacent clue   (renders as ghostB|A|ghostB)
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

// ── Board state ───────────────────────────────────────────────────────────────

function emptyBoard() { return Object.fromEntries(ATTRS.map(a => [a, Array(5).fill(null)])); }

const board   = emptyBoard(); // main solution board
const sandbox = emptyBoard(); // scratch board

const usedClues    = new Set(); // clue indices placed on main board
const sandboxClues = new Set(); // clue indices placed on sandbox

// ── Rule helpers (a "rule" is a CLUE_DEFS entry) ──────────────────────────────

function isAbsolute(ruleDef) {
  return ruleDef.length === 1 && ruleDef[0].pos !== null;
}

function isAdjacent(ruleDef) {
  return ruleDef.length === 2 && ruleDef[0].pos === null;
}

// ── Board placement ───────────────────────────────────────────────────────────

function canPlace(ruleDef, houseIdx, brd) {
  if (ruleDef.length !== 1) return false;
  const { pos, cells } = ruleDef[0];
  if (pos !== null && pos !== houseIdx) return false;
  return Object.entries(cells).every(([attr, val]) => {
    const existing = brd[attr][houseIdx];
    return existing === null || existing === val;
  });
}

function placeRule(ruleDef, houseIdx, brd, clueIdx, usedSet) {
  Object.entries(ruleDef[0].cells).forEach(([attr, val]) => { brd[attr][houseIdx] = val; });
  if (clueIdx != null) usedSet.add(clueIdx);
}

// ── Board rendering ───────────────────────────────────────────────────────────

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

function flashBoard(boardId, houseIdx) {
  document.querySelectorAll(`#${boardId} .board-cell[data-house="${houseIdx}"]`).forEach(cell => {
    cell.classList.remove('flash'); void cell.offsetWidth;
    cell.classList.add('flash');
    cell.addEventListener('animationend', () => cell.classList.remove('flash'), { once: true });
  });
}

// ── Rule list rendering ───────────────────────────────────────────────────────

function renderRules() {
  const list = document.getElementById('rules-list');
  list.innerHTML = '';
  CLUE_TEXTS.forEach((text, i) => {
    const el = div('rule-item');
    el.innerHTML = `<span class="rule-num">${i + 1}.</span><span class="rule-text">${text}</span>`;
    if (usedClues.has(i)) el.classList.add('rule-used');
    setupRuleDrag(el, i);
    list.appendChild(el);
  });
}

// ── Board geometry (must match CSS) ──────────────────────────────────────────
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

// ── Drag ghost — board-layer column strip ─────────────────────────────────────

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
    ghost.appendChild(makeGhostCol(colB.cells, 'ghost-neighbor'));
    ghost.appendChild(makeGhostCol(colA.cells));
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
    { boardId: 'board',   brd: board,   usedSet: usedClues },
    { boardId: 'sandbox', brd: sandbox, usedSet: sandboxClues },
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

// ── Board preview ─────────────────────────────────────────────────────────────

function clearBoardPreview() {
  document.querySelectorAll('.board-cell.drop-hover').forEach(el => el.classList.remove('drop-hover'));
}

function showBoardPreview(boardId, houseIdx) {
  document.querySelectorAll(`#${boardId} .board-cell[data-house="${houseIdx}"]`)
    .forEach(el => el.classList.add('drop-hover'));
}

// ── Rule drag & drop ──────────────────────────────────────────────────────────

let drag = null;

function setupRuleDrag(ruleEl, ruleIdx) {
  const ruleDef = CLUE_DEFS[ruleIdx];
  ruleEl.addEventListener('pointerdown', e => {
    if (usedClues.has(ruleIdx)) return; // used rules can't be re-dragged to main board
    e.preventDefault();
    const rect = ruleEl.getBoundingClientRect();

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
    showBoardPreview(target.boardId, target.col);
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

  // Valid board drop
  if (canPlace(ruleDef, snapTarget.col, snapTarget.brd)) {
    commitRule(ruleIdx, snapTarget, ghostEl, e.clientX, e.clientY);
  } else {
    ghostEl?.remove();
    ruleEl.classList.remove('repulse'); void ruleEl.offsetWidth;
    ruleEl.classList.add('repulse');
    ruleEl.addEventListener('animationend', () => ruleEl.classList.remove('repulse'), { once: true });
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
    placeRule(CLUE_DEFS[ruleIdx], col, brd, ruleIdx, usedSet);
    resolveFromBoard(brd, usedSet, boardId);
    renderBoard(boardId, brd);
    renderRules();
    flashBoard(boardId, col);
    rewardBurst(dest ? dest.left + dest.width / 2 : cx, dest ? dest.top + dest.height / 2 : cy);
    autoCommitFromBoard(brd, usedSet, boardId, 400);
  }, dest ? 230 : 0);
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

function repulse(card) {
  card.el.classList.remove('repulse');
  void card.el.offsetWidth; // force reflow to restart the animation
  card.el.classList.add('repulse');
  card.el.addEventListener('animationend', () => card.el.classList.remove('repulse'), { once: true });
}

function animSnap(el) {
  if (!el) return;
  el.classList.remove('snap');
  void el.offsetWidth;
  el.classList.add('snap');
  el.addEventListener('animationend', () => el.classList.remove('snap'), { once: true });
}

function div(cls) {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  return el;
}

// ── Board-driven resolution ───────────────────────────────────────────────────

function findPos(cells, brd) {
  for (let h = 0; h < 5; h++) {
    if (Object.entries(cells).every(([attr, val]) => brd[attr][h] === val)) return h;
  }
  return null;
}

// For each unplaced adjacent clue, check if one side is resolved in brd → infer other side → auto-commit both.
function resolveFromBoard(brd, usedSet, boardId) {
  CLUE_DEFS.forEach((ruleDef, i) => {
    if (!isAdjacent(ruleDef)) return;
    if (usedSet.has(i)) return;
    const [col0, col1] = ruleDef;
    let p0 = col0.pos ?? findPos(col0.cells, brd);
    let p1 = col1.pos ?? findPos(col1.cells, brd);
    if (p0 !== null && p1 === null) p1 = p0 + 1;
    else if (p1 !== null && p0 === null) p0 = p1 - 1;
    if (p0 !== null && p1 !== null) {
      // Both sides resolved — auto-commit each as an absolute rule
      [[p0, col0], [p1, col1]].forEach(([pos, col]) => {
        if (pos < 0 || pos > 4) return;
        const absDef = [{ pos, cells: col.cells }];
        if (canPlace(absDef, pos, brd)) {
          placeRule(absDef, pos, brd, i, usedSet);
        }
      });
    }
  });
}

function autoCommitFromBoard(brd, usedSet, boardId, delay = 0) {
  // Find absolute rules not yet placed that are directly placeable
  const pending = CLUE_DEFS
    .map((def, i) => ({ def, i }))
    .filter(({ def, i }) => isAbsolute(def) && !usedSet.has(i) && canPlace(def, def[0].pos, brd));

  pending.forEach(({ def, i }, idx) => {
    setTimeout(() => {
      if (!canPlace(def, def[0].pos, brd)) return; // might have been filled meanwhile
      const boardEl = document.getElementById(boardId);
      const cellEl  = boardEl?.querySelector(`.board-cell[data-house="${def[0].pos}"]`);
      const rect    = cellEl?.getBoundingClientRect();
      const ghost   = createDragGhost(def);
      if (rect && ghost) {
        ghost.style.left = (rect.left + rect.width/2 - (ghost.offsetWidth||B_CELL)/2) + 'px';
        ghost.style.top  = boardDataTop(document.getElementById(boardId).getBoundingClientRect()) + 'px';
        ghost.style.transition = 'transform .22s, opacity .18s';
      }
      setTimeout(() => {
        if (ghost) {
          ghost.style.transform = 'scale(0.25)';
          ghost.style.opacity = '0';
        }
        setTimeout(() => {
          ghost?.remove();
          placeRule(def, def[0].pos, brd, i, usedSet);
          resolveFromBoard(brd, usedSet, boardId);
          renderBoard(boardId, brd);
          renderRules();
          flashBoard(boardId, def[0].pos);
          rewardBurst(rect ? rect.left + rect.width/2 : 0, rect ? rect.top + rect.height/2 : 0);
        }, 230);
      }, 50);
    }, delay + idx * 500);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  renderBoard('board', board);
  renderBoard('sandbox', sandbox);
  renderRules();
}

window.addEventListener('DOMContentLoaded', init);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}
