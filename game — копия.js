// ============================
//  НАСТРОЙКИ И КОНСТАНТЫ
// ============================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Пиксели должны быть четкими (без размытия)
ctx.imageSmoothingEnabled = false;

canvas.width = 1280;
canvas.height = 720;

// ==========================================
// 1. НАСТРОЙКИ КАРТЫ (Land_tiles.jpeg)
// ==========================================
// Размер вырезаемой части
const TILE_SRC_SIZE = 96;
// Шаг сетки (расстояние между соседями)
const CELL_STEP = 124;
// Отступ первого тайла
const OFFSET_X = 28;
const OFFSET_Y = 29;

// ==========================================
// 2. НАСТРОЙКИ ИГРОКА (player.png 1024x1024)
// ==========================================
// Сетка 3x3. Шаг: 1024 / 3 = 341.33 px
const P_GRID_W = 341;
const P_GRID_H = 341;

// Размер "мякоти" игрока (вырезаем центр ячейки)
const P_SRC_W = 320;
const P_SRC_H = 300;

// Смещение к центру ячейки
const P_OFFSET_X = 50;
const P_OFFSET_Y = 50;

const ANIM_SPEED = 3; // Скорость смены кадров

// ==========================================
//  ИГРОВЫЕ ПЕРЕМЕННЫЕ
// ==========================================
const TILE_SIZE = 96;
const gravity = 1;
let cameraX = 0;

// Объект игрока
const player = {
  x: 200,
  y: 200,
  w: 60,  // Ширина хитбокса
  h: 90,  // Высота хитбокса
  vx: 0,
  vy: 0,
  speed: 7,
  jump: 22,
  onGround: false,

  facingRight: true,
  frame: 0,          // Кадр от 0 до 8
  timer: 0
};

const keys = { left: false, right: false, up: false };

// ============================
//  ЗАГРУЗКА РЕСУРСОВ
// ============================
const bgImage = new Image();
bgImage.src = "img/bg_sky.png";

const tilesImage = new Image();
tilesImage.src = "img/Land_tiles.jpeg";

const playerImage = new Image();
playerImage.src = "img/player.png";

let currentLevel = null;

// Карта тайлов: какой ID = какая картинка (ряд, колонка)
const tileMap = {
  1: { row: 2, col: 8 }, // Трава
  2: { row: 1, col: 0 }, // Камень
  3: { row: 1, col: 2 }, // Кирпич
  4: { row: 7, col: 6 }, // Плитка
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
    alert("Ошибка загрузки уровня! Проверь имя файла .lvl");
    return null;
  }
}

Promise.all([
  new Promise(r => bgImage.onload = r),
  new Promise(r => tilesImage.onload = r),
  new Promise(r => playerImage.onload = r),
  loadLevel("lvl/level1.lvl") // <--- ИСПРАВЛЕНО НА .lvl
]).then(v => {
  currentLevel = v[3];
  if (currentLevel) requestAnimationFrame(gameLoop);
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

      // Расчет координат в тайлсете
      const sx = OFFSET_X + (t.col * CELL_STEP);
      const sy = OFFSET_Y + (t.row * CELL_STEP);

      const dx = col * TILE_SIZE - cameraX;
      const dy = row * TILE_SIZE;

      // Рисуем только то, что в кадре
      if (dx > -TILE_SIZE && dx < canvas.width) {
        ctx.drawImage(tilesImage, sx, sy, TILE_SRC_SIZE, TILE_SRC_SIZE, dx, dy, TILE_SIZE + 1, TILE_SIZE + 1);
      }
    }
  }
}

// ============================
//  ОТРИСОВКА ИГРОКА (9 КАДРОВ)
// ============================
function drawPlayer() {
  // Превращаем номер кадра (0-8) в координаты сетки 3x3
  const col = player.frame % 3;
  const row = Math.floor(player.frame / 3);

  const sx = P_OFFSET_X + (col * P_GRID_W);
  const sy = P_OFFSET_Y + (row * P_GRID_H);

  const drawW = player.w + 60;
  const drawH = player.h + 40;
  const drawX = player.x - cameraX - 30;
  const drawY = player.y - 30;

  ctx.save();

  if (!player.facingRight) {
    // Отражение по горизонтали
    ctx.translate(drawX + drawW / 2, drawY + drawH / 2);
    ctx.scale(-1, 1);
    ctx.drawImage(playerImage, sx, sy, P_SRC_W, P_SRC_H, -drawW / 2, -drawH / 2, drawW, drawH);
  } else {
    ctx.drawImage(playerImage, sx, sy, P_SRC_W, P_SRC_H, drawX, drawY, drawW, drawH);
  }
  ctx.restore();
}

// ============================
//  ЛОГИКА
// ============================
function updatePlayer() {
  if (keys.left) {
    player.vx = -player.speed;
    player.facingRight = false;
  } else if (keys.right) {
    player.vx = player.speed;
    player.facingRight = true;
  } else {
    player.vx = 0;
  }

  player.x += player.vx;
  player.y += player.vy;
  player.vy += gravity;

  // --- АНИМАЦИЯ (Бег) ---
  if (player.vx !== 0 && player.onGround) {
    player.timer++;
    if (player.timer > ANIM_SPEED) {
      player.frame++;
      if (player.frame > 8) player.frame = 0; // Круг 0..8
      player.timer = 0;
    }
  } else if (!player.onGround) {
    // В прыжке можно поставить конкретный кадр, например 1
    player.frame = 1;
  } else {
    // Стоим
    player.frame = 0;
  }

  // --- ВРЕМЕННЫЙ ПОЛ (576px) ---
  const GROUND_Y = 576;
  if (player.y + player.h > GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
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
  updatePlayer();
  drawPlayer();
  requestAnimationFrame(gameLoop);
}

// ============================
//  УПРАВЛЕНИЕ
// ============================
window.addEventListener("keydown", e => {
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