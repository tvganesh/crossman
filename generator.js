// Crossword generator: places words from a bank onto a grid so that every
// word crosses at least one other, with no illegal adjacent letters.

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIRS = { A: [0, 1], D: [1, 0] };

function tryBuild(bank, target, maxSize) {
  const cells = new Map(); // "r,c" -> { ch, dirs:Set }
  const placed = [];
  let minR = 0, maxR = 0, minC = 0, maxC = 0;
  const key = (r, c) => r + "," + c;
  const get = (r, c) => cells.get(key(r, c));

  function evaluate(word, r, c, dir) {
    const [dr, dc] = DIRS[dir];
    const len = word.length;
    const endR = r + dr * (len - 1), endC = c + dc * (len - 1);
    const nMinR = Math.min(minR, r), nMaxR = Math.max(maxR, endR);
    const nMinC = Math.min(minC, c), nMaxC = Math.max(maxC, endC);
    if (placed.length && (nMaxR - nMinR + 1 > maxSize || nMaxC - nMinC + 1 > maxSize)) return -1;
    if (get(r - dr, c - dc) || get(endR + dr, endC + dc)) return -1;
    let crossings = 0;
    for (let i = 0; i < len; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const cell = get(rr, cc);
      if (cell) {
        if (cell.ch !== word[i] || cell.dirs.has(dir)) return -1;
        crossings++;
      } else {
        // perpendicular neighbours of a new letter must be empty
        if (get(rr + dc, cc + dr) || get(rr - dc, cc - dr)) return -1;
      }
    }
    if (placed.length && crossings === 0) return -1;
    if (crossings === len) return -1;
    const area = (nMaxR - nMinR + 1) * (nMaxC - nMinC + 1);
    return crossings * 100 - area * 0.5 + Math.random() * 10;
  }

  function place(word, clue, r, c, dir) {
    const [dr, dc] = DIRS[dir];
    for (let i = 0; i < word.length; i++) {
      const rr = r + dr * i, cc = c + dc * i;
      const k = key(rr, cc);
      if (!cells.has(k)) cells.set(k, { ch: word[i], dirs: new Set() });
      cells.get(k).dirs.add(dir);
    }
    if (!placed.length) { minR = maxR = r; minC = maxC = c; }
    minR = Math.min(minR, r); minC = Math.min(minC, c);
    maxR = Math.max(maxR, r + dr * (word.length - 1));
    maxC = Math.max(maxC, c + dc * (word.length - 1));
    placed.push({ word, clue, row: r, col: c, dir });
  }

  const pool = shuffle(bank).filter(([w]) => w.length <= maxSize);
  const firstIdx = pool.findIndex(([w]) => w.length >= 7);
  const [first] = pool.splice(firstIdx < 0 ? 0 : firstIdx, 1);
  place(first[0], first[1], 0, 0, Math.random() < 0.5 ? "A" : "D");

  const used = new Set([first[0]]);
  for (let pass = 0; pass < 2 && placed.length < target; pass++) {
    for (const [word, clue] of pool) {
      if (placed.length >= target) break;
      if (used.has(word)) continue;
      let best = null;
      for (const [k, cell] of cells) {
        const [cr, cc] = k.split(",").map(Number);
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== cell.ch) continue;
          for (const dir of ["A", "D"]) {
            if (cell.dirs.has(dir)) continue;
            const [dr, dc] = DIRS[dir];
            const r = cr - dr * i, c = cc - dc * i;
            const s = evaluate(word, r, c, dir);
            if (s >= 0 && (!best || s > best.s)) best = { s, r, c, dir };
          }
        }
      }
      if (best) {
        place(word, clue, best.r, best.c, best.dir);
        used.add(word);
      }
    }
  }
  return { placed, minR, maxR, minC, maxC };
}

function generateCrossword(bank, target = 15, maxSize = 15, attempts = 60) {
  let best = null;
  for (let a = 0; a < attempts; a++) {
    const res = tryBuild(bank, target, maxSize);
    if (!best || res.placed.length > best.placed.length) best = res;
    if (res.placed.length >= target) break;
  }
  const { placed, minR, maxR, minC, maxC } = best;
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
  const words = placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }));
  for (const w of words) {
    const [dr, dc] = DIRS[w.dir];
    for (let i = 0; i < w.word.length; i++) grid[w.row + dr * i][w.col + dc * i] = w.word[i];
  }
  // Standard crossword numbering: scan row by row.
  const starts = new Map();
  let n = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (words.some((w) => w.row === r && w.col === c)) starts.set(r + "," + c, ++n);
  for (const w of words) w.number = starts.get(w.row + "," + w.col);
  words.sort((a, b) => a.number - b.number);
  return { rows, cols, grid, words, numbers: starts };
}

if (typeof module !== "undefined") module.exports = { generateCrossword, shuffle, DIRS };
