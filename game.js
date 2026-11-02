// Crossman: crossword + hangman (with a balloon cat instead of a gallows).
(() => {
  const MAX_LIVES = 6;
  const TOTAL_WORDS = 15;
  // clues = how many words get a clue; letters = letter guesses allowed (hits and misses both count)
  const DIFFICULTY = {
    easy: { clues: 8, letters: 10 },
    medium: { clues: 6, letters: 8 },
    hard: { clues: 4, letters: 6 },
  };
  const WORD_SOLVE_BONUS = 20;
  const UNUSED_LETTER_BONUS = 10;
  const LIFE_BONUS = 10;

  const $ = (id) => document.getElementById(id);
  const gridEl = $("grid"), keyboardEl = $("keyboard"), messageEl = $("message");
  const solveBox = $("solveBox"), solveLabel = $("solveLabel"), solveInput = $("solveInput");
  const solveForm = $("solveForm");

  let state;
  const CLUES = new Map(WORD_BANK.map(([word, quick, cryptic]) => [word, [quick, cryptic]]));
  const clueText = (w) => ($("clueStyle").value === "cryptic" ? w.cryptic : w.quick);

  // ---------- setup ----------
  function newGame() {
    const cw = generateCrossword(WORD_BANK, TOTAL_WORDS, 15);
    const diff = DIFFICULTY[$("difficulty").value];
    const nClues = diff.clues;
    const clueIdx = new Set(shuffle(cw.words.map((_, i) => i)).slice(0, nClues));
    cw.words.forEach((w, i) => {
      w.showClue = clueIdx.has(i);
      // keep both clue styles so the Clues menu can switch mid-game
      [w.quick, w.cryptic] = CLUES.get(w.word);
      w.solved = false;
      w.solvedByGuess = false;
      w.cells = [];
      const [dr, dc] = DIRS[w.dir];
      for (let k = 0; k < w.word.length; k++) w.cells.push([w.row + dr * k, w.col + dc * k]);
    });
    state = {
      ...cw,
      revealed: cw.grid.map((row) => row.map(() => false)),
      guessed: new Set(),
      letterBudget: diff.letters,
      mistakes: 0,
      wordsGuessed: 0,
      selected: null, // index into words
      over: false,
      result: null,
    };
    setMessage("");
    // Build the new grid before any render: rendering against the old grid's
    // cells with the new state crashes when the new puzzle is smaller.
    solveBox.classList.add("hidden");
    solveInput.blur();
    $("modal").classList.add("hidden");
    buildGrid();
    buildKeyboard();
    renderAll();
  }

  function buildGrid() {
    const { rows, cols, grid, numbers } = state;
    const avail = Math.min(window.innerWidth - 40, 640);
    const size = Math.max(22, Math.min(40, Math.floor(avail / cols) - 2));
    document.documentElement.style.setProperty("--cell", size + "px");
    gridEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
    gridEl.innerHTML = "";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const div = document.createElement("div");
        div.className = "cell";
        if (grid[r][c]) {
          div.classList.add("letter");
          div.dataset.r = r;
          div.dataset.c = c;
          const n = numbers.get(r + "," + c);
          if (n) div.innerHTML = `<span class="num">${n}</span>`;
          const ch = document.createElement("span");
          ch.className = "ch";
          div.appendChild(ch);
          div.addEventListener("click", () => onCellClick(r, c));
        }
        gridEl.appendChild(div);
      }
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    for (const L of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const b = document.createElement("button");
      b.className = "key";
      b.textContent = L;
      b.dataset.letter = L;
      b.addEventListener("click", () => guessLetter(L));
      keyboardEl.appendChild(b);
    }
  }

  // ---------- game actions ----------
  function guessLetter(L) {
    if (state.over || state.guessed.has(L)) return;
    if (lettersLeft() <= 0) {
      setMessage("No letter guesses left. Click a word and type it to solve.", "bad");
      return;
    }
    state.guessed.add(L);
    let count = 0;
    state.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (ch === L && !state.revealed[r][c]) {
          state.revealed[r][c] = true;
          count++;
          flash(r, c);
        }
      })
    );
    const inPuzzle = state.grid.some((row) => row.includes(L));
    if (inPuzzle) {
      setMessage(count ? `"${L}" fills ${count} square${count > 1 ? "s" : ""}!` : `"${L}" was already showing.`, "good");
    } else {
      state.mistakes++;
      setMessage(`No "${L}" in this puzzle. You lose a life.`, "bad");
    }
    if (lettersLeft() === 0) {
      messageEl.textContent += " That was your last letter: now solve the rest by typing words.";
    }
    afterMove();
  }

  function submitWord(e) {
    e.preventDefault();
    if (state.over || state.selected == null) return;
    const w = state.words[state.selected];
    const guess = solveInput.value.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!guess) return;
    if (guess.length !== w.word.length) {
      setMessage(`That word needs ${w.word.length} letters.`, "bad");
      shake(solveBox);
      return;
    }
    if (guess === w.word) {
      w.cells.forEach(([r, c]) => {
        if (!state.revealed[r][c]) { state.revealed[r][c] = true; flash(r, c); }
      });
      w.solvedByGuess = true;
      state.wordsGuessed++;
      setMessage(`Correct! "${w.word}" (+${WORD_SOLVE_BONUS})`, "good");
      closeSolve();
    } else {
      state.mistakes++;
      setMessage(`"${guess}" is wrong. You lose a life.`, "bad");
      shake(solveBox);
      solveInput.select();
    }
    afterMove();
  }

  function afterMove() {
    state.words.forEach((w) => {
      w.solved = w.cells.every(([r, c]) => state.revealed[r][c]);
    });
    if (state.selected != null && state.words[state.selected].solved) closeSolve();
    const allDone = state.words.every((w) => w.solved);
    if (allDone) endGame(true);
    else if (state.mistakes >= MAX_LIVES) endGame(false);
    renderAll();
  }

  function lettersLeft() {
    return state.letterBudget - state.guessed.size;
  }

  // ---------- balloon cat ----------
  // Pop order leaves the middle balloon for last.
  const POP_ORDER = [3, 4, 0, 1, 2, 5];
  const CAT_LINES = [
    "Purr-fect day for floating.",
    "Hey! That was my favourite balloon.",
    "Um… are we sinking?",
    "Cats. Do. Not. Swim.",
    "Please guess better 🙏",
    "LAST BALLOON!! 😱",
  ];

  function renderCat() {
    const scene = $("catScene");
    const m = state.mistakes;
    const lost = state.result === "lost", won = state.result === "won";
    scene.classList.toggle("lost", lost);
    scene.classList.toggle("won", won);
    scene.style.setProperty("--stage", Math.min(m, MAX_LIVES - 1));
    const popped = lost ? MAX_LIVES : m;
    const poppedSet = new Set(POP_ORDER.slice(0, popped));
    scene.querySelectorAll(".balloon").forEach((b) => b.classList.toggle("popped", poppedSet.has(+b.dataset.i)));
    scene.dataset.mood = won ? "joy" : lost ? "grumpy" : m >= 4 ? "scared" : m >= 2 ? "worried" : "happy";
    $("catSay").textContent = won
      ? "Wheee! Thanks, friend! 😻"
      : lost
      ? "Splash. I'm judging you. 😾"
      : CAT_LINES[Math.min(m, CAT_LINES.length - 1)];
  }

  function score() {
    return (
      state.wordsGuessed * WORD_SOLVE_BONUS +
      lettersLeft() * UNUSED_LETTER_BONUS +
      (MAX_LIVES - state.mistakes) * LIFE_BONUS
    );
  }

  function endGame(won, gaveUp = false) {
    state.over = true;
    state.result = won ? "won" : "lost";
    closeSolve();
    if (!won) {
      state.grid.forEach((row, r) =>
        row.forEach((ch, c) => {
          if (ch && !state.revealed[r][c]) {
            state.revealed[r][c] = true;
            cellEl(r, c).classList.add("lost");
          }
        })
      );
    }
    const missed = state.words.filter((w) => !w.solved).length;
    const thisGame = state;
    setTimeout(() => {
      if (state !== thisGame) return; // a new game was started meanwhile
      showModal(
        won ? "🎉 You solved it!" : gaveUp ? "🏳️ You gave up" : "💦 The cat sank!",
        won
          ? `<ul>
               <li>Letters guessed: <b>${state.guessed.size}</b> of ${state.letterBudget}</li>
               <li>Words solved by typing them: <b>${state.wordsGuessed}</b></li>
               <li>Lives left: <b>${MAX_LIVES - state.mistakes}</b></li>
             </ul><p>Final score: <b>${score()}</b></p>`
          : `<p>${gaveUp ? "You gave up" : "You ran out of lives"} with ${missed} word${missed === 1 ? "" : "s"} unsolved. The missing letters are shown in red.</p>`,
        "Play again",
        newGame
      );
    }, 2300); // let the cat animation play first
  }

  // ---------- selection / solve box ----------
  function onCellClick(r, c) {
    if (state.over) return;
    const idxs = state.words
      .map((w, i) => (w.cells.some(([rr, cc]) => rr === r && cc === c) ? i : -1))
      .filter((i) => i >= 0 && !state.words[i].solved);
    if (!idxs.length) return;
    // clicking again on a crossing cell toggles direction
    let next = idxs[0];
    if (state.selected != null && idxs.includes(state.selected) && idxs.length > 1) {
      next = idxs.find((i) => i !== state.selected);
    }
    selectWord(next);
  }

  function selectWord(i) {
    if (state.over || state.words[i].solved) return;
    state.selected = i;
    const w = state.words[i];
    updateSolveLabel();
    solveBox.classList.remove("hidden");
    solveInput.value = "";
    solveInput.maxLength = w.word.length;
    solveInput.focus();
    renderAll();
  }

  function updateSolveLabel() {
    const w = state.words[state.selected];
    solveLabel.innerHTML = `<b>${w.number} ${w.dir === "A" ? "Across" : "Down"}</b> (${w.word.length}) — ${
      w.showClue ? escapeHtml(clueText(w)) : "<i>no clue for this one</i>"
    }<br><span class="pattern">${pattern(w)}</span>`;
  }

  function closeSolve() {
    if (state) state.selected = null;
    solveBox.classList.add("hidden");
    solveInput.blur();
    if (state) renderAll();
  }

  // ---------- rendering ----------
  function renderAll() {
    const sel = state.selected != null ? state.words[state.selected] : null;
    const selCells = new Set(sel ? sel.cells.map(([r, c]) => r + "," + c) : []);
    const solvedByGuessCells = new Set();
    state.words.forEach((w) => w.solvedByGuess && w.cells.forEach(([r, c]) => solvedByGuessCells.add(r + "," + c)));

    gridEl.querySelectorAll(".cell.letter").forEach((el) => {
      const r = +el.dataset.r, c = +el.dataset.c, k = r + "," + c;
      el.querySelector(".ch").textContent = state.revealed[r][c] ? state.grid[r][c] : "";
      el.classList.toggle("sel", selCells.has(k));
      el.classList.toggle("solved-word", solvedByGuessCells.has(k));
    });

    keyboardEl.querySelectorAll(".key").forEach((b) => {
      const L = b.dataset.letter;
      const g = state.guessed.has(L);
      const inPuzzle = state.grid.some((row) => row.includes(L));
      b.classList.toggle("hit", g && inPuzzle);
      b.classList.toggle("miss", g && !inPuzzle);
      b.disabled = g || state.over || lettersLeft() <= 0;
    });
    keyboardEl.classList.toggle("spent", lettersLeft() <= 0);

    renderCat();
    $("lives").textContent = MAX_LIVES - state.mistakes;
    $("lettersLeft").textContent = lettersLeft();
    $("letterBudget").textContent = state.letterBudget;
    $("wordsLeft").textContent = state.words.filter((w) => !w.solved).length;
    $("score").textContent = score();

    renderClues();
    if (sel) solveLabel.querySelector(".pattern").textContent = pattern(sel);
  }

  function renderClues() {
    for (const [dir, listId] of [["A", "acrossList"], ["D", "downList"]]) {
      const ol = $(listId);
      ol.innerHTML = "";
      state.words.forEach((w, i) => {
        if (w.dir !== dir) return;
        const li = document.createElement("li");
        if (w.solved) li.classList.add("done");
        if (state.selected === i) li.classList.add("active");
        li.innerHTML = `<span class="n">${w.number}</span><span class="body">
          <span class="txt ${w.showClue ? "" : "noclue"}">${w.showClue ? escapeHtml(clueText(w)) : "No clue"} (${w.word.length})</span>
          <span class="pat">${pattern(w)}</span></span>`;
        li.addEventListener("click", () => selectWord(i));
        ol.appendChild(li);
      });
    }
  }

  function pattern(w) {
    return w.cells.map(([r, c]) => (state.revealed[r][c] ? state.grid[r][c] : "_")).join(" ");
  }

  // ---------- helpers ----------
  const cellEl = (r, c) => gridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

  function flash(r, c) {
    const el = cellEl(r, c);
    el.classList.remove("revealed");
    void el.offsetWidth;
    el.classList.add("revealed");
  }

  function shake(el) {
    el.classList.remove("shake");
    void el.offsetWidth;
    el.classList.add("shake");
  }

  function setMessage(text, kind = "") {
    messageEl.textContent = text;
    messageEl.className = "message " + kind;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  }

  function showModal(title, html, btnText, onClose) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = html;
    $("modalBtn").textContent = btnText;
    $("modal").classList.remove("hidden");
    $("modalBtn").onclick = () => {
      $("modal").classList.add("hidden");
      if (onClose) onClose();
    };
  }

  function showHowTo() {
    showModal(
      "How to play Crossman",
      `<ul>
        <li><b>Guess a letter</b> with the on-screen keys or your keyboard. Every square with that letter fills in, across and down.</li>
        <li>You get only a few <b>letter guesses</b> (10 on Easy, 8 on Medium, 6 on Hard). Every guess uses one up, right or wrong, so choose carefully.</li>
        <li>A letter that isn't anywhere in the puzzle also costs a <b>life</b>. You have ${MAX_LIVES} lives.</li>
        <li>Only some words have <b>clues</b>. Use the clues and the crossing letters to work out the rest.</li>
        <li><b>Cryptic clues</b> (the default) work like newspaper cryptics: a plain definition at the start or end, plus wordplay that builds the same answer. Watch for anagrams ("broken", "wildly", "cooked"), hidden words ("found in", "seen in"), sound-alikes ("we hear"), reversals ("returning") and answers built from parts. For example, "Canoe capsized in the deep (5)" is OCEAN: an anagram of CANOE, with "the deep" as the definition. Prefer plain clues? Switch to <b>Quick</b>.</li>
        <li><b>Click a word</b> in the grid or the clue list and type the whole word to solve it. You'll need to do this to finish the grid. A wrong word costs a life.</li>
        <li>Score: +${WORD_SOLVE_BONUS} for each word you type correctly, +${UNUSED_LETTER_BONUS} for each letter guess you don't use, +${LIFE_BONUS} for each life left.</li>
        <li>Fill the whole grid to win. Six mistakes will sink the cat!</li>
      </ul>`,
      "Let's play"
    );
  }

  // ---------- events ----------
  solveForm.addEventListener("submit", submitWord);
  $("solveCancel").addEventListener("click", closeSolve);
  $("newGame").addEventListener("click", newGame);
  $("difficulty").addEventListener("change", newGame);
  $("clueStyle").value = localStorage.getItem("crossman-clue-style") || "cryptic";
  $("clueStyle").addEventListener("change", () => {
    localStorage.setItem("crossman-clue-style", $("clueStyle").value);
    // same puzzle, same progress: just swap the clue wording
    if (state.selected != null) updateSolveLabel();
    renderAll();
    $("clueStyle").blur(); // so letter keys guess letters again
  });
  $("howTo").addEventListener("click", showHowTo);
  $("giveUp").addEventListener("click", () => {
    if (state.over) return;
    endGame(false, true);
    renderAll();
  });

  document.addEventListener("keydown", (e) => {
    if (!$("modal").classList.contains("hidden")) {
      if (e.key === "Enter" || e.key === "Escape") $("modalBtn").click();
      return;
    }
    if (document.activeElement === solveInput) {
      if (e.key === "Escape") closeSolve();
      return;
    }
    if (document.activeElement && document.activeElement.tagName === "SELECT") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      guessLetter(e.key.toUpperCase());
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { buildGrid(); renderAll(); }, 150);
  });

  newGame();
  if (!localStorage.getItem("crossman-seen-howto")) {
    localStorage.setItem("crossman-seen-howto", "1");
    showHowTo();
  }
})();
