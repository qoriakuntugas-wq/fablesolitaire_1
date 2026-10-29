
const suits = [
  { symbol: "♥", color: "red", creatures: ["🦄","🧚","🐉","🦋"] },
  { symbol: "♦", color: "red", creatures: ["🦊","🐲","🦌","🔥"] },
  { symbol: "♣", color: "black", creatures: ["🐸","🍄","🧙","🌿"] },
  { symbol: "♠", color: "black", creatures: ["🐺","🦉","🐈‍⬛","🌙"] }
];

const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

let stock, waste, tableau, foundations;
let moves = 0;
let selected = null;
let history = [];
let startTime = Date.now();

const $ = id => document.getElementById(id);

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createDeck() {
  const deck = [];

  suits.forEach((s, suitIndex) => {
    ranks.forEach((rank, i) => {
      deck.push({
        id: `${suitIndex}-${rank}`,
        suit: s.symbol,
        color: s.color,
        rank,
        value: i + 1,
        creature: s.creatures[i % s.creatures.length],
        faceUp: false
      });
    });
  });

  return shuffle(deck);
}

function newGame() {
  const deck = createDeck();

  tableau = Array.from({ length: 7 }, () => []);
  foundations = { "♥": [], "♦": [], "♣": [], "♠": [] };
  waste = [];
  history = [];
  selected = null;
  moves = 0;
  startTime = Date.now();

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      card.faceUp = row === col;
      tableau[col].push(card);
    }
  }

  stock = deck;
  $("win").classList.remove("show");
  status("Pilih kartu terbuka untuk mulai bermain.");
  render();
}

function status(text) {
  $("status").textContent = text;
}

function saveHistory() {
  history.push(JSON.stringify({
    stock, waste, tableau, foundations, moves
  }));
}

function undo() {
  if (!history.length) {
    status("Belum ada langkah yang bisa dibatalkan.");
    return;
  }

  const old = JSON.parse(history.pop());
  stock = old.stock;
  waste = old.waste;
  tableau = old.tableau;
  foundations = old.foundations;
  moves = old.moves;
  selected = null;
  $("win").classList.remove("show");
  render();
  status("Langkah terakhir dibatalkan.");
}

function cardElement(card, source, index) {
  const el = document.createElement("div");

  el.className = "card" +
    (card.faceUp ? "" : " back") +
    (card.color === "red" ? " red" : "") +
    (selected?.id === card.id ? " selected" : "");

  el.draggable = card.faceUp;

  if (card.faceUp) {
    el.innerHTML = `
      <div class="corner">
        ${card.rank}<span class="suit">${card.suit}</span>
      </div>
      <div class="creature">${card.creature}</div>
      <div class="label">${card.value >= 11 ? "FABLE CREATURE" : "ENCHANTED"}</div>
      <div class="corner bottom-corner">
        ${card.rank}<span class="suit">${card.suit}</span>
      </div>
    `;
  }

  el.addEventListener("click", e => {
    e.stopPropagation();
    if (source.type === "stock") drawStock();
    else clickCard(card, source, index);
  });

  el.addEventListener("dragstart", e => {
    if (!card.faceUp) {
      e.preventDefault();
      return;
    }

    selected = { id: card.id, source, index };
    e.dataTransfer.setData("text/plain", card.id);
    e.dataTransfer.effectAllowed = "move";
  });

  return el;
}

function drawStock() {
  if (stock.length) {
    saveHistory();
    const card = stock.pop();
    card.faceUp = true;
    waste.push(card);
    moves++;
    selected = null;
    status("Kartu dibuka. Coba tempatkan di kolom yang cocok.");
  } else if (waste.length) {
    saveHistory();
    stock = waste.reverse();
    stock.forEach(c => c.faceUp = false);
    waste = [];
    moves++;
    selected = null;
    status("Tumpukan diulang.");
  }

  render();
}

function clickCard(card, source, index) {
  if (!card.faceUp) {
    if (source.type === "tableau" &&
        index === tableau[source.col].length - 1) {
      saveHistory();
      card.faceUp = true;
      moves++;
      selected = null;
      render();
    }
    return;
  }

  if (selected?.id === card.id) {
    selected = null;
    render();
    return;
  }

  if (selected) {
    const target = source.type === "tableau"
      ? { type: "tableau", col: source.col }
      : source.type === "foundation"
        ? { type: "foundation", suit: source.suit }
        : null;

    if (target && moveCard(selected, target)) return;
  }

  selected = { id: card.id, source, index };
  render();
  status("Kartu dipilih. Klik kolom atau fondasi tujuan.");
}

function getSource(from) {
  if (!from) return null;

  if (from.source.type === "tableau") {
    const col = from.source.col;
    const pile = tableau[col];
    const idx = pile.findIndex(c => c.id === from.id);
    if (idx < 0 || !pile[idx].faceUp) return null;

    return {
      cards: pile.slice(idx),
      type: "tableau",
      col,
      idx
    };
  }

  if (from.source.type === "waste") {
    const card = waste[waste.length - 1];
    if (!card || card.id !== from.id) return null;
    return { cards: [card], type: "waste" };
  }

  if (from.source.type === "foundation") {
    const pile = foundations[from.source.suit];
    const card = pile[pile.length - 1];
    if (!card || card.id !== from.id) return null;
    return { cards: [card], type: "foundation", suit: from.source.suit };
  }

  return null;
}

function moveCard(from, target) {
  const info = getSource(from);
  if (!info) {
    selected = null;
    render();
    return false;
  }

  const card = info.cards[0];
  let valid = false;

  if (target.type === "tableau") {
    const dest = tableau[target.col];
    const top = dest[dest.length - 1];

    valid = top
      ? top.faceUp && top.color !== card.color &&
        top.value === card.value + 1
      : card.value === 13;

    if (info.type === "tableau" && info.col === target.col) {
      return false;
    }
  }

  if (target.type === "foundation" && info.cards.length === 1) {
    const pile = foundations[target.suit];
    const top = pile[pile.length - 1];

    valid = card.suit === target.suit &&
      (top ? card.value === top.value + 1 : card.value === 1);
  }

  if (!valid) {
    status("Kartu tidak cocok. Coba warna bergantian atau mulai dari As.");
    return false;
  }

  saveHistory();

  let moving;

  if (info.type === "tableau") {
    moving = tableau[info.col].splice(info.idx);

    const oldTop = tableau[info.col].at(-1);
    if (oldTop && !oldTop.faceUp) oldTop.faceUp = true;
  } else if (info.type === "waste") {
    moving = [waste.pop()];
  } else {
    moving = [foundations[info.suit].pop()];
  }

  if (target.type === "tableau") {
    tableau[target.col].push(...moving);
  } else {
    foundations[target.suit].push(...moving);
  }

  moves++;
  selected = null;
  render();
  status("Bagus! Kartu berhasil dipindahkan.");
  return true;
}

function hint() {
  const sources = [];

  tableau.forEach((pile, col) => {
    pile.forEach((card, index) => {
      if (card.faceUp) {
        sources.push({ id: card.id, source: { type: "tableau", col }, index });
      }
    });
  });

  if (waste.length) {
    const card = waste[waste.length - 1];
    sources.push({ id: card.id, source: { type: "waste" } });
  }

  Object.entries(foundations).forEach(([suit, pile]) => {
    if (pile.length) {
      const card = pile[pile.length - 1];
      sources.push({ id: card.id, source: { type: "foundation", suit } });
    }
  });

  // Prefer moves to foundations, then moves between tableau columns.
  for (const destinationType of ["foundation", "tableau"]) {
    for (const from of sources) {
      const info = getSource(from);
      if (!info) continue;
      const card = info.cards[0];

      if (destinationType === "foundation" && info.cards.length === 1) {
        const pile = foundations[card.suit];
        const top = pile[pile.length - 1];
        if (!top ? card.value === 1 : card.value === top.value + 1) {
          selected = from;
          render();
          status(`Petunjuk: pindahkan ${card.rank}${card.suit} ke fondasi ${card.suit}.`);
          return;
        }
      }

      if (destinationType === "tableau") {
        for (let col = 0; col < tableau.length; col++) {
          if (info.type === "tableau" && info.col === col) continue;
          const pile = tableau[col];
          const top = pile[pile.length - 1];
          const valid = top
            ? top.faceUp && top.color !== card.color && top.value === card.value + 1
            : card.value === 13;

          if (valid) {
            selected = from;
            render();
            status(`Petunjuk: pindahkan ${card.rank}${card.suit} ke kolom ${col + 1}.`);
            return;
          }
        }
      }
    }
  }

  selected = null;
  render();
  status(stock.length || waste.length
    ? "Belum ada langkah terbuka. Klik tumpukan kartu untuk membuka kartu berikutnya."
    : "Tidak ada langkah yang tersedia. Coba Undo atau mulai permainan baru.");
}

function renderPile(container, cards, source, overlap = 0) {
  container.innerHTML = "";

  if (!cards.length) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.textContent = source.type === "tableau" ? "K" :
      source.type === "foundation" ? source.suit : "✧";
    slot.addEventListener("click", () => {
      if (selected && source.type !== "stock") moveCard(selected, source);
    });
    container.appendChild(slot);
  } else {
    const visibleCards = source.type === "stock" || source.type === "waste"
      ? [cards[cards.length - 1]]
      : cards;

    visibleCards.forEach((card, index) => {
      const el = cardElement(card, source, source.type === "stock" || source.type === "waste"
        ? cards.length - 1
        : index);
      container.appendChild(el);
      if (overlap && index < visibleCards.length - 1) {
        el.style.marginBottom = `${-(el.offsetHeight - overlap)}px`;
      }
    });
  }

  container.ondragover = e => e.preventDefault();
  container.ondrop = e => {
    e.preventDefault();
    if (!selected) return;
    moveCard(selected, source);
  };

  if (source.type !== "tableau") {
    container.onclick = e => {
      if (e.target === container && selected) {
        moveCard(selected, source);
      }
    };
  }
}

function render() {
  renderPile($("stock"), stock, { type: "stock" });
  $("stock").onclick = drawStock;

  renderPile($("waste"), waste, {
    type: "waste"
  });

  document.querySelectorAll(".foundation").forEach(el => {
    const suit = el.dataset.suit;
    renderPile(el, foundations[suit], {
      type: "foundation",
      suit
    });
  });

  $("tableau").innerHTML = "";

  tableau.forEach((pile, col) => {
    const el = document.createElement("div");
    el.className = "pile";

    renderPile(el, pile, {
      type: "tableau",
      col
    }, window.innerWidth < 600 ? 10 : 24);

    el.ondragover = e => e.preventDefault();
    el.ondrop = e => {
      e.preventDefault();
      if (selected) moveCard(selected, { type: "tableau", col });
    };

    $("tableau").appendChild(el);
  });

  $("moves").textContent = moves;
  $("undo").disabled = history.length === 0;

  const total = Object.values(foundations)
    .reduce((sum, pile) => sum + pile.length, 0);

  if (total === 52) {
    $("win").classList.add("show");
    status("Kamu berhasil menyelesaikan Fable Solitaire!");
  }
}

$("newGame").addEventListener("click", newGame);
$("undo").addEventListener("click", undo);
$("hint").addEventListener("click", hint);

setInterval(() => {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  $("timer").textContent =
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:` +
    `${String(seconds % 60).padStart(2, "0")}`;
}, 1000);

newGame();
