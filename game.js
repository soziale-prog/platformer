// ============================
//  НАСТРОЙКИ И КОНСТАНТЫ
// ============================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Пиксели должны быть четкими
ctx.imageSmoothingEnabled = false;

canvas.width = 1280;
canvas.height = 720;

// ==========================================
// 1. НАСТРОЙКИ КАРТЫ
// ==========================================
const TILE_SRC_SIZE = 96;
const CELL_STEP = 124;
const OFFSET_X = 28;
const OFFSET_Y = 29;

// ==========================================
// 2. НАСТРОЙКИ ИГРОКА
// ==========================================
const ANIM_SPEED = 8;

// ==========================================
//  ИГРОВЫЕ ПЕРЕМЕННЫЕ
// ==========================================
const TILE_SIZE = 96;
const gravity = 1;
let cameraX = 0;
let score = 0;

const player = {
  x: 200,
  y: 200,
  w: 50,
  h: 130,
  vx: 0,
  vy: 0,
  speed: 7,
  jump: 22,
  onGround: false,
  facingRight: true,
  frame: 0,
  timer: 0
};

const keys = { left: false, right: false, up: false };

// Массив монеток (заполнится при загрузке уровня)
let coins = [];

// ============================
//  ЗАГРУЗКА РЕСУРСОВ
// ============================
const bgImage = new Image();
bgImage.src = "img/bg_sky.png";

const tilesImage = new Image();
tilesImage.src = "img/Land_tiles.jpeg";

const playerImage = new Image();
playerImage.src = "img/player_Vova.png";

const coinImage = new Image();
coinImage.src = "img/coin.png";

// Фоновая музыка
const bgMusic = new Audio("snd/ONL - Without me.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;

// --- НОВОЕ: Звук монетки ---
const coinSound = new Audio("snd/coin.mp3");
coinSound.volume = 0.6; // Чуть громче фона, чтобы хорошо было слышно

let currentLevel = null;

const tileMap = {
  1: { row: 2, col: 8 },
  2: { row: 1, col: 0 },
  3: { row: 1, col: 2 },
  4: { row: 7, col: 6 },
  5: { row: 0, col: 0 },
  6: { row: 3, col: 3 },
  7: { row: 6, col: 5 },
};

// ============================
//  ФУНКЦИИ ЗАГРУЗКИ
// ============================
async function loadLevel(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("Не удалось загрузить " + path);
    return await response.json();
  } catch (e) {
    console.error(e);
    return null;
  }
}

Promise.all([
  new Promise(r => bgImage.onload = r),
  new Promise(r => tilesImage.onload = r),
  new Promise(r => playerImage.onload = r),
  new Promise(r => coinImage.onload = r),
  loadLevel("lvl/level1.lvl")
]).then(v => {
  currentLevel = v[4];

  // Загружаем монетки из файла уровня
  if (currentLevel && currentLevel.coins) {
    coins = currentLevel.coins.map(c => ({
      x: c.x,
      y: c.y,
      w: 50,
      h: 50,
      collected: false
    }));
  }

  if (currentLevel) {
    requestAnimationFrame(gameLoop);
  }
});

// ============================
//  ОТРИСОВКА ФОНА
// ============================
function drawBackground() {
  const h = canvas.height;
  const scale = canvas.height / bgImage.height;
  const w = bgImage.width * scale;

  let offset = - (cameraX * 0.3) % w;
  if (offset > 0) offset -= w;

  for (let x = offset; x < canvas.width; x += w) {
    ctx.drawImage(bgImage, x, 0, w, h);
  }
}

// ============================
//  ОТРИСОВКА УРОВНЯ
// ============================
function drawLevel(level) {
  if (!level || !level.tiles) return;
  const tiles = level.tiles;

  for (let row = 0; row < tiles.length; row++) {
    for (let col = 0; col < tiles[row].length; col++) {
      const tile = tiles[row][col];
      if (tile === 0 || !tileMap[tile]) continue;

      const t = tileMap[tile];
      const sx = OFFSET_X + (t.col * CELL_STEP);
      const sy = OFFSET_Y + (t.row * CELL_STEP);
      const dx = col * TILE_SIZE - cameraX;
      const dy = row * TILE_SIZE;

      if (dx > -TILE_SIZE && dx < canvas.width) {
        ctx.drawImage(tilesImage, sx, sy, TILE_SRC_SIZE, TILE_SRC_SIZE, dx, dy, TILE_SIZE + 1, TILE_SIZE + 1);
      }
    }
  }
}

// ============================
//  ЛОГИКА И ОТРИСОВКА МОНЕТОК
// ============================
function updateAndDrawCoins() {
  coins.forEach(coin => {
    if (coin.collected) return;

    // 1. Отрисовка
    const drawX = coin.x - cameraX;
    if (drawX > -100 && drawX < canvas.width + 100) {
      ctx.drawImage(coinImage, drawX, coin.y, coin.w, coin.h);
    }

    // 2. Столкновение с игроком
    if (
      player.x < coin.x + coin.w &&
      player.x + player.w > coin.x &&
      player.y < coin.y + coin.h &&
      player.y + player.h > coin.y
    ) {
      coin.collected = true;
      score++;

      // --- НОВОЕ: Играем звук ---
      coinSound.currentTime = 0; // Сбрасываем звук в начало, чтобы можно было быстро собирать монеты
      coinSound.play().catch(e => console.log("Sound error:", e));
    }
  });
}

// ============================
//  ОТРИСОВКА ИНТЕРФЕЙСА (СЧЕТ)
// ============================
function drawUI() {
  const text = "Coins: " + score;

  ctx.font = "bold 26px Arial";
  ctx.textAlign = "right";

  ctx.strokeStyle = "black";
  ctx.lineWidth = 4;
  ctx.strokeText(text, canvas.width - 30, 50);

  ctx.fillStyle = "orange";
  ctx.fillText(text, canvas.width - 30, 50);
}

// ============================
//  ОТРИСОВКА ИГРОКА
// ============================
function drawPlayer() {
  if (!playerImage.complete || playerImage.width === 0) return;

  const frameWidth = Math.floor(playerImage.width / 4);
  const frameHeight = playerImage.height;
  const sx = player.frame * frameWidth;
  const sy = 0;
  const drawH = player.h + 20;
  const scaleRatio = frameWidth / frameHeight;
  const drawW = Math.floor(drawH * scaleRatio);

  let drawX = player.x - cameraX - (drawW - player.w) / 2;
  let drawY = player.y - 20;

  drawX = Math.floor(drawX);
  drawY = Math.floor(drawY);

  ctx.save();
  if (!player.facingRight) {
    ctx.translate(Math.floor(drawX + drawW / 2), Math.floor(drawY + drawH / 2));
    ctx.scale(-1, 1);
    ctx.drawImage(playerImage, sx, sy, frameWidth, frameHeight, -Math.floor(drawW / 2), -Math.floor(drawH / 2), drawW, drawH);
  } else {
    ctx.drawImage(playerImage, sx, sy, frameWidth, frameHeight, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
}

// ============================
//  ФИЗИКА ИГРОКА
// ============================
function updatePlayer() {
  player.vx = 0;
  let isMoving = false;

  if (keys.left) {
    player.vx = -player.speed;
    player.facingRight = false;
    isMoving = true;
  } else if (keys.right) {
    player.vx = player.speed;
    player.facingRight = true;
    isMoving = true;
  }

  player.x += player.vx;
  player.y += player.vy;
  player.vy += gravity;

  const GROUND_Y = 582;

  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  if (!player.onGround) {
    player.frame = 2;
  }
  else if (isMoving) {
    player.timer++;
    if (player.timer > ANIM_SPEED) {
      player.frame++;
      if (player.frame > 3) player.frame = 1;
      if (player.frame < 1) player.frame = 1;
      player.timer = 0;
    }
  }
  else {
    player.frame = 0;
    player.timer = 0;
  }

  cameraX = player.x - canvas.width / 2;
  if (cameraX < 0) cameraX = 0;
}

// ============================
//  ИГРОВОЙ ЦИКЛ
// ============================
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();
  drawLevel(currentLevel);
  updateAndDrawCoins();
  updatePlayer();
  drawPlayer();
  drawUI();

  requestAnimationFrame(gameLoop);
}

// ============================
//  УПРАВЛЕНИЕ
// ============================
let musicStarted = false;

window.addEventListener("keydown", e => {
  if (!musicStarted) {
    bgMusic.play().then(() => { musicStarted = true; }).catch(() => { });
  }

  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if ((e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") && player.onGround) {
    player.vy = -player.jump;
    player.onGround = false;
  }
});

window.addEventListener("keyup", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});