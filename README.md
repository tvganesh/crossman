# Crossman

A word game that crosses a crossword with hangman.

- **Guess a letter** and it fills in everywhere it appears in the grid, across and down.
- Letter guesses are limited (10 / 8 / 6 by difficulty), so you have to finish by **solving words**: tap a word and type it.
- Only some words get a clue. Pick **cryptic** clues (newspaper style: a definition plus wordplay) or **quick** ones, and switch any time without losing your progress.
- Wrong letters and wrong words cost a life. Six mistakes and the balloon cat lands in the pond.

Every game is a new 15-word grid generated from the word bank.

## Play

Open `index.html` in a browser. There's no build step and nothing to install. It works on phones too.

## Deploy

It's a static site: point Vercel (or any static host) at this repo with the "Other" preset and no build command.

## Files

| File | What it does |
|---|---|
| `index.html` | Page layout and the balloon-cat scene (SVG) |
| `style.css` | Styles, animations and phone layout |
| `game.js` | Game rules, input and rendering |
| `generator.js` | Builds a valid crossword grid from the word bank |
| `words.js` | Word bank: `[WORD, quick clue, cryptic clue]`; add your own |
