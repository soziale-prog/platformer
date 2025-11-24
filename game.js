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
// 1. НАСТРОЙКИ КАРТЫ (Land_tiles.jpeg)
// ==========================================
const TILE_SRC_SIZE = 96;
const CELL_STEP = 124;
const OFFSET_X = 28;
const OFFSET_Y = 29;

// ==========================================
// 2. НАСТРОЙКИ ИГРОКА (player_Vova.png)
// ==========================================
// У нас теперь полоска из 4 кадров.
// Размеры вычислим автоматически при отрисовке (width / 4).
const ANIM_SPEED = 8; // Чуть замедлим, чтобы ходьба была плавной

// ==========================================
//  ИГРОВЫЕ ПЕРЕМЕННЫЕ
// ==========================================
const TILE_SIZE = 96;
const gravity = 1;
let cameraX = 0;

const player = {
  x: 200,
  y: 200,
  w: 50,   // Ширина хитбокса (чуть уже для Вовы)
  h: 130,  // Высота хитбокса (Вова высокий)
  vx: 0,
  vy: 0,
  speed: 7,
  jump: 22,
  onGround: false,
  facingRight: true,
  frame: 0,  // Текущий кадр (0 - стоит, 1-3 - идет)
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

// --- ИЗМЕНЕНО: Загружаем Вову ---
const playerImage = new Image();
playerImage.src = "img/player_Vova.png";

// Музыка
const bgMusic = new Audio("snd/ONL - Without me.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;

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
    alert("Ошибка загрузки уровня! Проверь имя файла .lvl");
    return null;
  }
}

Promise.all([
  new Promise(r => bgImage.onload = r),
  new Promise(r => tilesImage.onload = r),
  new Promise(r => playerImage.onload = r),
  loadLevel("lvl/level1.lvl")
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
//  ОТРИСОВКА ИГРОКА (ИСПРАВЛЕНА: УБРАНО ДЁРГАНЬЕ)
// ============================
function drawPlayer() {
  // Проверка, загрузилась ли картинка, чтобы не было ошибок
  if (!playerImage.complete || playerImage.width === 0) return;

  // Округляем ширину кадра, чтобы не было дробей
  const frameWidth = Math.floor(playerImage.width / 4);
  const frameHeight = playerImage.height;

  // Координаты источника (sx всегда целое число)
  const sx = player.frame * frameWidth;
  const sy = 0;

  // Размеры при отрисовке
  const drawH = player.h + 20;
  // Сохраняем пропорции и сразу округляем ширину
  const scaleRatio = frameWidth / frameHeight;
  const drawW = Math.floor(drawH * scaleRatio);

  // Считаем координаты на экране
  // Важно: Math.floor в конце убирает "дробные пиксели" и дёрганье
  let drawX = player.x - cameraX - (drawW - player.w) / 2;
  let drawY = player.y - 20;

  drawX = Math.floor(drawX);
  drawY = Math.floor(drawY);

  ctx.save();

  if (!player.facingRight) {
    // Отражение по горизонтали
    // Сдвигаем точку рисования в центр спрайта (тоже округляем)
    ctx.translate(Math.floor(drawX + drawW / 2), Math.floor(drawY + drawH / 2));
    ctx.scale(-1, 1);
    // Рисуем от центра (-drawW / 2)
    ctx.drawImage(playerImage, sx, sy, frameWidth, frameHeight, -Math.floor(drawW / 2), -Math.floor(drawH / 2), drawW, drawH);
  } else {
    // Обычная отрисовка
    ctx.drawImage(playerImage, sx, sy, frameWidth, frameHeight, drawX, drawY, drawW, drawH);
  }
  ctx.restore();

  // Раскомментируй для проверки границ
  // ctx.strokeStyle = "red";
  // ctx.strokeRect(Math.floor(player.x - cameraX), Math.floor(player.y), player.w, player.h);
}


// ============================
function updatePlayer() {
  // 1. СБРОС СКОРОСТИ
  player.vx = 0;
  let isMoving = false;

  // 2. УПРАВЛЕНИЕ
  if (keys.left) {
    player.vx = -player.speed;
    player.facingRight = false;
    isMoving = true;
  } else if (keys.right) {
    player.vx = player.speed;
    player.facingRight = true;
    isMoving = true;
  }

  // 3. ФИЗИКА
  player.x += player.vx;
  player.y += player.vy;
  player.vy += gravity;

  // 4. КОЛЛИЗИЯ С ПОЛОМ
  const GROUND_Y = 582;

  // --- ВАЖНОЕ ИСПРАВЛЕНИЕ ТУТ: ---
  // Используем '>=', чтобы когда мы стоим РОВНО на полу, 
  // игра считала, что мы на земле, а не в воздухе.
  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // 5. АНИМАЦИЯ
  if (!player.onGround) {
    // В ВОЗДУХЕ (используем кадр шага, чтобы ноги были врозь)
    player.frame = 2;
  }
  else if (isMoving) {
    // ИДЕМ
    player.timer++;
    if (player.timer > ANIM_SPEED) {
      player.frame++;
      if (player.frame > 3) player.frame = 1;
      if (player.frame < 1) player.frame = 1;
      player.timer = 0;
    }
  }
  else {
    // СТОИМ (ЖЕЛЕЗОБЕТОННО)
    player.frame = 0;
    player.timer = 0;
  }

  // 6. КАМЕРА
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