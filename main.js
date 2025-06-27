(() => {
  const WORD_LENGTH = 5;
  const FLIP_ANIMATION_DURATION = 500;
  const DANCE_ANIMATION_DURATION = 500;
  const keyboard = document.querySelector("[data-keyboard]");
  const alertContainer = document.querySelector("[data-alert-container]");
  const guessGrid = document.querySelector("[data-guess-grid]");
  const referenceDate = new Date(1970, 0, 1);
  const msOffsetFromRefDate = Date.now() - referenceDate;
  const dayOffsetFromRefDate = msOffsetFromRefDate / 1000 / 60 / 60 / 24;

  let targetWord = "";
  let dictionary = [];

  function normalize(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("words/random.json");
      if (!res.ok) throw new Error("Could not load word list");
      const words = await res.json();
      dictionary = words.map((word) => word.toLowerCase());
      window.normalizedDictionary = dictionary.map(normalize);

      // Get today's date string (YYYY-MM-DD)
      const today = new Date().toISOString().slice(0, 10);

      // Try to restore state
      const saved = JSON.parse(localStorage.getItem("terma-state") || "{}");
      if (saved.date !== today) {
        // New day: clear state
        localStorage.removeItem("terma-state");
        targetWord =
          dictionary[Math.floor(dayOffsetFromRefDate % dictionary.length)];
        restoreGrid(); // clear grid
        startInteraction();
      } else {
        if (saved.targetWord && dictionary.includes(saved.targetWord)) {
          targetWord = saved.targetWord;
        } else {
          targetWord =
            dictionary[Math.floor(dayOffsetFromRefDate % dictionary.length)];
        }
        restoreGrid(saved.grid);

        if (saved.status === "win" || saved.status === "lose") {
          stopInteraction();
          showAlert(
            saved.status === "win"
              ? "Já venceu! Aguarde a próxima palavra."
              : "Já perdeu! Aguarde a próxima palavra.",
            5000
          );
        } else {
          startInteraction();
        }
      }
    } catch (err) {
      showAlert("Failed to start game", 5000);
      console.error(err);
    }
  });

  function startInteraction() {
    document.addEventListener("click", handleMouseClick);
    document.addEventListener("keydown", handleKeyPress);
  }

  function stopInteraction() {
    document.removeEventListener("click", handleMouseClick);
    document.removeEventListener("keydown", handleKeyPress);
  }

  function handleMouseClick(e) {
    if (e.target.matches("[data-key]")) {
      pressKey(e.target.dataset.key);
      return;
    }

    if (e.target.matches("[data-enter]")) {
      submitGuess();
      return;
    }

    if (e.target.matches("[data-delete]")) {
      deleteKey();
      return;
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter") {
      submitGuess();
      return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      deleteKey();
      return;
    }

    if (e.key.match(/^[a-zç]$/)) {
      pressKey(e.key);
      return;
    }
  }

  function pressKey(key) {
    const activeTiles = getActiveTiles();
    if (activeTiles.length >= WORD_LENGTH) {
      return;
    }
    const nextTile = guessGrid.querySelector(":not([data-letter])");
    nextTile.dataset.letter = key.toLowerCase();
    nextTile.textContent = key;
    nextTile.dataset.state = "active";
  }

  function deleteKey() {
    const activeTiles = getActiveTiles();
    const lastTile = activeTiles[activeTiles.length - 1];
    if (lastTile == null) {
      return;
    }
    lastTile.textContent = "";
    delete lastTile.dataset.state;
    delete lastTile.dataset.letter;
  }

  function submitGuess() {
    const activeTiles = [...getActiveTiles()];
    if (activeTiles.length !== WORD_LENGTH) {
      showAlert("Faltam letras, Tente novamente!");
      shakeTiles(activeTiles);
      return;
    }

    const guess = activeTiles
      .reduce((word, tile) => word + tile.dataset.letter, "")
      .toLowerCase();

    if (!window.normalizedDictionary.includes(normalize(guess))) {
      showAlert(`"${guess}" não é uma palavra válida, Tente novamente!`);
      shakeTiles(activeTiles);
      return;
    }

    stopInteraction();

    const states = Array(WORD_LENGTH).fill("wrong");
    const letterCount = {};

    const normalizedTarget = normalize(targetWord);
    const normalizedGuess = normalize(guess);

    for (const l of normalizedTarget) {
      letterCount[l] = (letterCount[l] || 0) + 1;
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (normalizedGuess[i] === normalizedTarget[i]) {
        states[i] = "correct";
        letterCount[normalizedGuess[i]]--;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (states[i] === "correct") continue;
      const letter = normalizedGuess[i];
      if (letterCount[letter] > 0) {
        states[i] = "wrong-location";
        letterCount[letter]--;
      }
    }

    activeTiles.forEach((tile, idx, arr) =>
      flipTile(tile, idx, arr, guess, states)
    );

    setTimeout(() => saveState(), FLIP_ANIMATION_DURATION * WORD_LENGTH);
  }

  function flipTile(tile, index, array, guess, states) {
    const letter = tile.dataset.letter;
    const key = keyboard.querySelector(`[data-key="${letter}"i]`);
    setTimeout(() => {
      tile.classList.add("flip");
    }, (index * FLIP_ANIMATION_DURATION) / 2);

    tile.addEventListener(
      "transitionend",
      () => {
        tile.classList.remove("flip");
        tile.dataset.state = states[index];
        if (states[index] === "correct") {
          key?.classList.add("correct");
        } else if (states[index] === "wrong-location") {
          key?.classList.add("wrong-location");
        } else {
          key?.classList.add("wrong");
        }

        if (index === array.length - 1) {
          tile.addEventListener(
            "transitionend",
            () => {
              startInteraction();
              checkWinLose(guess, array);
            },
            { once: true }
          );
        }
      },
      { once: true }
    );
  }

  function getActiveTiles() {
    return guessGrid.querySelectorAll('[data-state="active"]');
  }

  function showAlert(message, duration = 1000) {
    const alert = document.createElement("div");
    alert.textContent = message;
    alert.classList.add("alert");
    alertContainer.prepend(alert);
    if (duration == null) {
      return;
    }

    setTimeout(() => {
      alert.classList.add("hide");
      alert.addEventListener("transitionend", () => {
        alert.remove();
      });
    }, duration);
  }

  function shakeTiles(tiles) {
    tiles.forEach((tile) => {
      tile.classList.add("shake");
      tile.addEventListener(
        "animationend",
        () => {
          tile.classList.remove("shake");
        },
        { once: true }
      );
    });
  }

  function checkWinLose(guess, tiles) {
    if (guess === targetWord) {
      showAlert("Incrivel! É o maior champino da sua aldeia", 5000);
      danceTiles(tiles);
      stopInteraction();
      saveState("win");
      return;
    }

    const remainingTiles = guessGrid.querySelectorAll(":not([data-letter])");
    if (remainingTiles.length === 0) {
      showAlert(targetWord.toUpperCase(), null);
      stopInteraction();
      saveState("lose");
    }
  }

  function danceTiles(tiles) {
    tiles.forEach((tile, index) => {
      setTimeout(() => {
        tile.classList.add("dance");
        tile.addEventListener(
          "animationend",
          () => {
            tile.classList.remove("dance");
          },
          { once: true }
        );
      }, (index * DANCE_ANIMATION_DURATION) / 5);
    });
  }

  function saveState(status) {
    const grid = [];
    guessGrid.querySelectorAll("[data-letter]").forEach((tile) => {
      grid.push({
        letter: tile.dataset.letter,
        state: tile.dataset.state,
        index: [...tile.parentNode.children].indexOf(tile),
        row: [...guessGrid.children].indexOf(tile.parentNode),
      });
    });
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      "terma-state",
      JSON.stringify({
        targetWord,
        grid,
        status,
        date: today,
      })
    );
  }

  function restoreGrid(grid = []) {
    if (!Array.isArray(grid)) return;
    grid.forEach(({ letter, state }, i) => {
      const tile = guessGrid.querySelectorAll(
        "[data-letter], :not([data-letter])"
      )[i];
      if (tile) {
        tile.dataset.letter = letter;
        tile.textContent = letter.toUpperCase();
        tile.dataset.state = state;
      }
    });
  }
})();
