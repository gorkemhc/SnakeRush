(() => {
  'use strict';

  const screens = {
    splash: document.getElementById('splash'),
    menu: document.getElementById('menu'),
    settings: document.getElementById('settings'),
    game: document.getElementById('game'),
    gameOver: document.getElementById('gameOver')
  };
  const app = document.getElementById('app');
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', {alpha: false});

  const ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    menuBest: document.getElementById('menuBest'),
    finalScore: document.getElementById('finalScore'),
    finalBest: document.getElementById('finalBest'),
    finalMode: document.getElementById('finalMode'),
    finalSpeed: document.getElementById('finalSpeed'),
    modeLabel: document.getElementById('modeLabel'),
    gameSpeed: document.getElementById('gameSpeedLabel'),
    menuSpeed: document.getElementById('menuSpeedLabel'),
    speedValue: document.getElementById('speedValue'),
    speedRange: document.getElementById('speedRange'),
    volumeValue: document.getElementById('volumeValue'),
    volumeRange: document.getElementById('volumeRange'),
    menuVolume: document.getElementById('menuVolumeLabel'),
    touchHint: document.getElementById('touchHint'),
    pauseBtn: document.getElementById('pauseBtn'),
    pauseOverlay: document.getElementById('pauseOverlay'),
    easyBtn: document.getElementById('easyBtn'),
    hardBtn: document.getElementById('hardBtn'),
    musicToggle: document.getElementById('musicToggle'),
    sfxToggle: document.getElementById('sfxToggle'),
    vibrationToggle: document.getElementById('vibrationToggle'),
    themeMeta: document.getElementById('themeMeta'),
    confirmDialog: document.getElementById('confirmDialog'),
    confirmText: document.getElementById('confirmText'),
    confirmCancel: document.getElementById('confirmCancelBtn'),
    confirmOk: document.getElementById('confirmOkBtn')
  };

  const KEYS = {
    theme: 'snake_rush_theme_v1',
    mode: 'snake_rush_mode_v1',
    speed: 'snake_rush_speed_v1',
    volume: 'snake_rush_volume_v1',
    music: 'snake_rush_music_v1',
    sfx: 'snake_rush_sfx_v1',
    vibration: 'snake_rush_vibration_v1',
    controls: 'snake_rush_controls_v1',
    bestEasy: 'snake_rush_best_easy_v1',
    bestHard: 'snake_rush_best_hard_v1'
  };
  const THEMES = ['blue', 'purple', 'red', 'green'];
  const CONTROL_MODES = ['swipe', 'buttons'];
  const DEFAULTS = {theme: 'blue', mode: 'easy', speed: 5, volume: 70, music: false, sfx: true, vibration: true, controls: 'swipe'};

  function storedString(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  }
  function storedBoolean(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  }
  function clampNumber(value, min, max) {
    const number = Number(value);
    return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
  }
  function storedNumber(key, fallback, min, max) {
    return clampNumber(localStorage.getItem(key) ?? fallback, min, max);
  }

  let theme = THEMES.includes(storedString(KEYS.theme, DEFAULTS.theme)) ? storedString(KEYS.theme, DEFAULTS.theme) : DEFAULTS.theme;
  let mode = ['easy', 'hard'].includes(storedString(KEYS.mode, DEFAULTS.mode)) ? storedString(KEYS.mode, DEFAULTS.mode) : DEFAULTS.mode;
  let speedLevel = storedNumber(KEYS.speed, DEFAULTS.speed, 1, 10);
  let volumeLevel = storedNumber(KEYS.volume, DEFAULTS.volume, 0, 100);
  let musicEnabled = storedBoolean(KEYS.music, DEFAULTS.music);
  let sfxEnabled = storedBoolean(KEYS.sfx, DEFAULTS.sfx);
  let vibrationEnabled = storedBoolean(KEYS.vibration, DEFAULTS.vibration);
  let controls = CONTROL_MODES.includes(storedString(KEYS.controls, DEFAULTS.controls)) ? storedString(KEYS.controls, DEFAULTS.controls) : DEFAULTS.controls;

  let bestEasy = storedNumber(KEYS.bestEasy, 0, 0, Number.MAX_SAFE_INTEGER);
  let bestHard = storedNumber(KEYS.bestHard, 0, 0, Number.MAX_SAFE_INTEGER);

  const cols = 20;
  const rows = 20;
  const MAX_FRAME_MS = 120;
  const MAX_STEPS_PER_FRAME = 4;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let cell = 20;
  let offsetX = 0;
  let offsetY = 0;
  let snake = [];
  let previousSnake = [];
  let food = null;
  let direction = {x: 1, y: 0};
  let directionQueue = [];
  let score = 0;
  let running = false;
  let paused = false;
  let stepMs = 96;
  let accumulator = 0;
  let lastFrame = 0;
  let animationFrame = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;
  let hintTimer = 0;
  let confirmAction = null;
  let canvasPalette = null;

  let audioContext = null;
  let musicTimer = 0;
  let musicStep = 0;
  let lastTurnSound = 0;

  function show(name) {
    Object.values(screens).forEach(screen => screen?.classList.remove('active'));
    screens[name]?.classList.add('active');
    document.documentElement.dataset.screen = name;
    if (name === 'game') requestAnimationFrame(resize);
  }

  function activeScreenName() {
    return Object.keys(screens).find(name => screens[name]?.classList.contains('active')) || 'menu';
  }

  function modeName() {
    return mode === 'easy' ? 'Kolay' : 'Zor';
  }

  function activeBest() {
    return mode === 'easy' ? bestEasy : bestHard;
  }

  function publishGameState() {
    const head = snake[0];
    canvas.dataset.running = String(running);
    canvas.dataset.paused = String(paused);
    canvas.dataset.direction = `${direction.x},${direction.y}`;
    canvas.dataset.head = head ? `${head.x},${head.y}` : '';
    canvas.dataset.score = String(score);
    canvas.dataset.snakeLength = String(snake.length);
    canvas.dataset.stepMs = String(Math.round(stepMs * 100) / 100);
  }

  function readCanvasPalette() {
    const style = getComputedStyle(document.documentElement);
    canvasPalette = {
      background: style.getPropertyValue('--theme-background').trim(),
      surface: style.getPropertyValue('--theme-surface').trim(),
      grid: style.getPropertyValue('--theme-grid').trim(),
      snake: style.getPropertyValue('--theme-primary').trim(),
      head: style.getPropertyValue('--theme-head').trim(),
      food: style.getPropertyValue('--theme-food').trim(),
      text: style.getPropertyValue('--theme-text').trim(),
      glow: style.getPropertyValue('--theme-glow').trim()
    };
    ui.themeMeta?.setAttribute('content', canvasPalette.background);
  }

  function applyTheme(nextTheme, persist = true) {
    theme = THEMES.includes(nextTheme) ? nextTheme : DEFAULTS.theme;
    document.documentElement.dataset.theme = theme;
    if (persist) localStorage.setItem(KEYS.theme, theme);
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      const active = button.dataset.themeChoice === theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    readCanvasPalette();
    draw(accumulator / Math.max(stepMs, 1), performance.now());
  }

  function applyControls(nextControls, persist = true) {
    controls = CONTROL_MODES.includes(nextControls) ? nextControls : DEFAULTS.controls;
    app.classList.toggle('controls-buttons', controls === 'buttons');
    ui.touchHint.textContent = controls === 'buttons' ? 'Yön tuşlarını kullan' : 'Kaydırarak yön değiştir';
    document.querySelectorAll('[data-control-choice]').forEach(button => {
      const active = button.dataset.controlChoice === controls;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    if (persist) localStorage.setItem(KEYS.controls, controls);
    if (screens.game.classList.contains('active')) requestAnimationFrame(resize);
  }

  function updateModeButtons() {
    ui.easyBtn.classList.toggle('active', mode === 'easy');
    ui.hardBtn.classList.toggle('active', mode === 'hard');
  }

  function updateSpeedUI() {
    const value = String(speedLevel);
    ui.speedRange.value = value;
    ui.speedValue.textContent = value;
    ui.menuSpeed.textContent = value;
    ui.gameSpeed.textContent = value;
    ui.finalSpeed.textContent = value;
  }

  function updateVolumeUI() {
    const value = String(volumeLevel);
    ui.volumeRange.value = value;
    ui.volumeValue.textContent = value;
    ui.menuVolume.textContent = value;
  }

  function updateSettingsUI() {
    ui.musicToggle.checked = musicEnabled;
    ui.sfxToggle.checked = sfxEnabled;
    ui.vibrationToggle.checked = vibrationEnabled;
    applyTheme(theme, false);
    applyControls(controls, false);
  }

  function updateBestUI() {
    const best = activeBest();
    ui.menuBest.textContent = String(best);
    ui.best.textContent = String(best);
    ui.finalBest.textContent = String(best);
    ui.modeLabel.textContent = modeName();
    ui.finalMode.textContent = modeName();
    updateModeButtons();
    updateSpeedUI();
    updateVolumeUI();
  }

  function setMode(nextMode) {
    mode = nextMode === 'hard' ? 'hard' : 'easy';
    localStorage.setItem(KEYS.mode, mode);
    updateBestUI();
    playSound('menu');
  }

  function setSpeed(nextSpeed, play = true) {
    speedLevel = clampNumber(Math.round(Number(nextSpeed)), 1, 10);
    localStorage.setItem(KEYS.speed, String(speedLevel));
    updateSpeedUI();
    publishGameState();
    if (play) playSound('menu');
  }

  function setVolume(nextVolume, play = true) {
    volumeLevel = clampNumber(Math.round(Number(nextVolume)), 0, 100);
    localStorage.setItem(KEYS.volume, String(volumeLevel));
    updateVolumeUI();
    syncMusic();
    if (play) playSound('menu');
  }

  function setToggle(name, enabled) {
    const value = Boolean(enabled);
    if (name === 'music') {
      musicEnabled = value;
      localStorage.setItem(KEYS.music, String(value));
      syncMusic();
    } else if (name === 'sfx') {
      sfxEnabled = value;
      localStorage.setItem(KEYS.sfx, String(value));
    } else if (name === 'vibration') {
      vibrationEnabled = value;
      localStorage.setItem(KEYS.vibration, String(value));
    }
  }

  function getAudioContext() {
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(frequency, duration, type = 'square', gain = 0.05, delay = 0) {
    const context = getAudioContext();
    if (!context || volumeLevel <= 0) return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const startAt = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    volume.gain.setValueAtTime(0.0001, startAt);
    volume.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * (volumeLevel / 100)), startAt + 0.012);
    volume.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.025);
  }

  function playSound(name) {
    if (!sfxEnabled || volumeLevel <= 0) return;
    if (name === 'turn') {
      const now = performance.now();
      if (now - lastTurnSound < 45) return;
      lastTurnSound = now;
      playTone(350, 0.032, 'square', 0.025);
    } else if (name === 'eat') {
      playTone(650, 0.05, 'square', 0.06);
      playTone(900, 0.065, 'square', 0.045, 0.05);
    } else if (name === 'start') {
      playTone(420, 0.05, 'square', 0.045);
      playTone(620, 0.075, 'square', 0.055, 0.055);
    } else if (name === 'over') {
      playTone(215, 0.085, 'sawtooth', 0.055);
      playTone(145, 0.13, 'sawtooth', 0.045, 0.085);
    } else {
      playTone(520, 0.03, 'square', 0.025);
    }
  }

  function vibrate(pattern) {
    if (vibrationEnabled && navigator.vibrate) navigator.vibrate(pattern);
  }

  function playMusicNote() {
    if (!musicEnabled || !running || paused || document.hidden || volumeLevel <= 0) return;
    const notes = [196, 247, 294, 247, 220, 262, 330, 262];
    playTone(notes[musicStep % notes.length], 0.16, 'triangle', 0.012);
    musicStep++;
  }

  function syncMusic() {
    const shouldPlay = musicEnabled && running && !paused && !document.hidden && volumeLevel > 0;
    if (shouldPlay && !musicTimer) {
      playMusicNote();
      musicTimer = window.setInterval(playMusicNote, 520);
    } else if (!shouldPlay && musicTimer) {
      clearInterval(musicTimer);
      musicTimer = 0;
    }
  }

  function speedScale() {
    return clampNumber(1 - (speedLevel - 5) * 0.11, 0.45, 1.55);
  }

  function initialStep() {
    return (mode === 'easy' ? 94 : 82) * speedScale();
  }

  function minStep() {
    return (mode === 'easy' ? 62 : 52) * speedScale();
  }

  function stepDecrease() {
    return (mode === 'easy' ? 1.9 : 2.4) / speedScale();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.floor(rect.width);
    height = Math.floor(rect.height);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.min(width / cols, height / rows);
    offsetX = (width - cols * cell) / 2;
    offsetY = (height - rows * cell) / 2;
    draw(accumulator / Math.max(stepMs, 1), performance.now());
  }

  function spawnFood() {
    let candidate;
    let guard = 0;
    do {
      candidate = {x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows)};
      guard++;
    } while (guard < 400 && snake.some(segment => segment.x === candidate.x && segment.y === candidate.y));
    return candidate;
  }

  function start() {
    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    snake = [{x: startX, y: startY}, {x: startX - 1, y: startY}, {x: startX - 2, y: startY}];
    previousSnake = snake.map(segment => ({...segment}));
    direction = {x: 1, y: 0};
    directionQueue = [];
    score = 0;
    stepMs = initialStep();
    accumulator = 0;
    lastFrame = performance.now();
    running = true;
    paused = false;
    ui.pauseBtn.textContent = 'Duraklat';
    ui.pauseOverlay.classList.add('hidden');
    food = spawnFood();
    publishGameState();
    ui.score.textContent = '0';
    updateBestUI();
    show('game');
    playSound('start');
    syncMusic();
    ui.touchHint.classList.remove('hide');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => ui.touchHint.classList.add('hide'), 1700);
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(loop);
  }

  function enqueueDirection(x, y) {
    if (!running || paused) return;
    const reference = directionQueue.length ? directionQueue[directionQueue.length - 1] : direction;
    if ((x === reference.x && y === reference.y) || (x === -reference.x && y === -reference.y)) return;
    if (directionQueue.length >= 2) return;
    directionQueue.push({x, y});
    playSound('turn');
    ui.touchHint.classList.add('hide');
  }

  function placeFoodAheadForLocalTest() {
    if (!running || !snake.length || !['127.0.0.1', 'localhost'].includes(location.hostname)) return false;
    food = {
      x: (snake[0].x + direction.x + cols) % cols,
      y: (snake[0].y + direction.y + rows) % rows
    };
    return true;
  }

  function tick() {
    previousSnake = snake.map(segment => ({...segment}));
    if (directionQueue.length) direction = directionQueue.shift();

    const head = snake[0];
    let nextX = head.x + direction.x;
    let nextY = head.y + direction.y;

    if (mode === 'easy') {
      nextX = (nextX + cols) % cols;
      nextY = (nextY + rows) % rows;
    } else if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) {
      endGame();
      return;
    }

    const willEat = food && nextX === food.x && nextY === food.y;
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    if (bodyToCheck.some(segment => segment.x === nextX && segment.y === nextY)) {
      endGame();
      return;
    }

    snake.unshift({x: nextX, y: nextY});
    if (willEat) {
      score += mode === 'easy' ? 10 : 15;
      ui.score.textContent = String(score);
      playSound('eat');
      vibrate(20);
      saveBestIfNeeded();
      food = spawnFood();
      stepMs = Math.max(minStep(), stepMs - stepDecrease());
    } else {
      snake.pop();
    }
    publishGameState();
  }

  function loop(now) {
    if (!running) return;
    if (!lastFrame) lastFrame = now;
    const frameDelta = Math.min(MAX_FRAME_MS, Math.max(0, now - lastFrame));
    lastFrame = now;

    if (!paused) {
      accumulator += frameDelta;
      let steps = 0;
      while (accumulator >= stepMs && steps < MAX_STEPS_PER_FRAME && running) {
        accumulator -= stepMs;
        tick();
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME && accumulator >= stepMs) accumulator = stepMs * 0.5;
    }

    if (!running) return;
    draw(paused ? 1 : accumulator / Math.max(stepMs, 1), now);
    animationFrame = requestAnimationFrame(loop);
  }

  function saveBestIfNeeded() {
    if (mode === 'easy' && score > bestEasy) {
      bestEasy = score;
      localStorage.setItem(KEYS.bestEasy, String(bestEasy));
    }
    if (mode === 'hard' && score > bestHard) {
      bestHard = score;
      localStorage.setItem(KEYS.bestHard, String(bestHard));
    }
    updateBestUI();
  }

  function endGame() {
    if (!running) return;
    running = false;
    paused = false;
    cancelAnimationFrame(animationFrame);
    syncMusic();
    saveBestIfNeeded();
    ui.finalScore.textContent = String(score);
    ui.finalBest.textContent = String(activeBest());
    ui.finalMode.textContent = modeName();
    ui.finalSpeed.textContent = String(speedLevel);
    publishGameState();
    playSound('over');
    vibrate([35, 45, 70]);
    show('gameOver');
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    accumulator = 0;
    lastFrame = performance.now();
    ui.pauseBtn.textContent = paused ? 'Devam Et' : 'Duraklat';
    ui.pauseOverlay.classList.toggle('hidden', !paused);
    publishGameState();
    syncMusic();
  }

  function interpolateAxis(previous, current, limit, alpha) {
    let delta = current - previous;
    if (mode === 'easy') {
      if (delta > limit / 2) delta -= limit;
      if (delta < -limit / 2) delta += limit;
    }
    let value = previous + delta * alpha;
    if (mode === 'easy') value = ((value % limit) + limit) % limit;
    return value;
  }

  function visualSnake(alpha) {
    const safeAlpha = clampNumber(alpha, 0, 1);
    return snake.map((segment, index) => {
      const previous = previousSnake[index] || previousSnake[previousSnake.length - 1] || segment;
      return {
        x: interpolateAxis(previous.x, segment.x, cols, safeAlpha),
        y: interpolateAxis(previous.y, segment.y, rows, safeAlpha)
      };
    });
  }

  function roundedRectPath(x, y, size, radius) {
    const r = Math.min(radius, size / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + size - r, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + r);
    ctx.lineTo(x + size, y + size - r);
    ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
    ctx.lineTo(x + r, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawGrid() {
    ctx.fillStyle = canvasPalette.background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = canvasPalette.grid;
    ctx.lineWidth = 1;
    const boardWidth = cols * cell;
    const boardHeight = rows * cell;
    for (let x = 0; x <= cols; x++) {
      const px = offsetX + x * cell;
      ctx.beginPath();
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + boardHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      const py = offsetY + y * cell;
      ctx.beginPath();
      ctx.moveTo(offsetX, py);
      ctx.lineTo(offsetX + boardWidth, py);
      ctx.stroke();
    }
  }

  function drawFood(now) {
    if (!food) return;
    const centerX = offsetX + (food.x + 0.5) * cell;
    const centerY = offsetY + (food.y + 0.5) * cell;
    const pulse = 1 + Math.sin(now / 420) * 0.055;
    const size = Math.max(6, cell * 0.54 * pulse);
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    ctx.fillStyle = canvasPalette.food;
    roundedRectPath(x, y, size, Math.max(2, size * 0.24));
    ctx.fill();
    ctx.fillStyle = canvasPalette.head;
    ctx.fillRect(centerX + size * 0.13, y - size * 0.16, Math.max(2, size * 0.17), Math.max(2, size * 0.22));
    ctx.fillStyle = 'rgba(255,255,255,.58)';
    ctx.fillRect(x + size * 0.2, y + size * 0.18, Math.max(1.5, size * 0.17), Math.max(1.5, size * 0.17));
  }

  function unwrapNear(value, anchor, limit) {
    let result = value;
    if (mode === 'easy') {
      if (result - anchor > limit / 2) result -= limit;
      if (result - anchor < -limit / 2) result += limit;
    }
    return result;
  }

  function drawSnake(alpha) {
    const visual = visualSnake(alpha);
    if (!visual.length) return;
    const center = point => ({x: offsetX + (point.x + 0.5) * cell, y: offsetY + (point.y + 0.5) * cell});
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(5, cell * 0.58);
    ctx.strokeStyle = canvasPalette.snake;
    for (let index = 1; index < visual.length; index++) {
      const previous = visual[index - 1];
      const current = {
        x: unwrapNear(visual[index].x, previous.x, cols),
        y: unwrapNear(visual[index].y, previous.y, rows)
      };
      if (Math.abs(current.x - previous.x) > 1.65 || Math.abs(current.y - previous.y) > 1.65) continue;
      const a = center(previous);
      const b = center(current);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    const segmentSize = Math.max(6, cell * 0.7);
    const pad = (cell - segmentSize) / 2;
    for (let index = visual.length - 1; index >= 0; index--) {
      const segment = visual[index];
      const x = offsetX + segment.x * cell + pad;
      const y = offsetY + segment.y * cell + pad;
      ctx.fillStyle = index === 0 ? canvasPalette.head : canvasPalette.snake;
      if (index === 0) {
        ctx.shadowColor = canvasPalette.glow;
        ctx.shadowBlur = Math.min(6, cell * 0.25);
      }
      roundedRectPath(x, y, segmentSize, Math.max(2, cell * 0.18));
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const head = visual[0];
    const eyeSize = Math.max(1.5, cell * 0.11);
    const headCenterX = offsetX + (head.x + 0.5) * cell;
    const headCenterY = offsetY + (head.y + 0.5) * cell;
    const sideX = direction.y * cell * 0.17;
    const sideY = -direction.x * cell * 0.17;
    const forwardX = direction.x * cell * 0.18;
    const forwardY = direction.y * cell * 0.18;
    ctx.fillStyle = canvasPalette.background;
    ctx.beginPath();
    ctx.arc(headCenterX + forwardX + sideX, headCenterY + forwardY + sideY, eyeSize, 0, Math.PI * 2);
    ctx.arc(headCenterX + forwardX - sideX, headCenterY + forwardY - sideY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(alpha = 1, now = performance.now()) {
    if (!ctx || !canvasPalette || width < 1 || height < 1) return;
    ctx.clearRect(0, 0, width, height);
    drawGrid();
    drawFood(now);
    drawSnake(alpha);
  }

  function openConfirm(message, action) {
    confirmAction = action;
    ui.confirmText.textContent = message;
    ui.confirmDialog.classList.remove('hidden');
    ui.confirmCancel.focus();
  }

  function closeConfirm() {
    confirmAction = null;
    ui.confirmDialog.classList.add('hidden');
  }

  function resetBestScores() {
    bestEasy = 0;
    bestHard = 0;
    localStorage.setItem(KEYS.bestEasy, '0');
    localStorage.setItem(KEYS.bestHard, '0');
    updateBestUI();
  }

  function resetSettings() {
    theme = DEFAULTS.theme;
    mode = DEFAULTS.mode;
    speedLevel = DEFAULTS.speed;
    volumeLevel = DEFAULTS.volume;
    musicEnabled = DEFAULTS.music;
    sfxEnabled = DEFAULTS.sfx;
    vibrationEnabled = DEFAULTS.vibration;
    controls = DEFAULTS.controls;
    [KEYS.theme, KEYS.mode, KEYS.speed, KEYS.volume, KEYS.music, KEYS.sfx, KEYS.vibration, KEYS.controls].forEach(key => localStorage.removeItem(key));
    updateSettingsUI();
    updateBestUI();
    syncMusic();
  }

  ui.easyBtn.addEventListener('click', () => setMode('easy'));
  ui.hardBtn.addEventListener('click', () => setMode('hard'));
  ui.speedRange.addEventListener('input', event => setSpeed(event.target.value));
  ui.volumeRange.addEventListener('input', event => setVolume(event.target.value));
  ui.musicToggle.addEventListener('change', event => setToggle('music', event.target.checked));
  ui.sfxToggle.addEventListener('change', event => setToggle('sfx', event.target.checked));
  ui.vibrationToggle.addEventListener('change', event => setToggle('vibration', event.target.checked));
  document.querySelectorAll('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
    applyTheme(button.dataset.themeChoice);
    playSound('menu');
  }));
  document.querySelectorAll('[data-control-choice]').forEach(button => button.addEventListener('click', () => {
    applyControls(button.dataset.controlChoice);
    playSound('menu');
  }));

  document.getElementById('settingsBtn').addEventListener('click', () => {
    playSound('menu');
    updateSettingsUI();
    show('settings');
  });
  document.getElementById('settingsBackBtn').addEventListener('click', () => {
    playSound('menu');
    updateBestUI();
    show('menu');
  });
  document.getElementById('resetBestBtn').addEventListener('click', () => openConfirm('Kolay ve zor mod rekorlarının tamamı silinecek.', resetBestScores));
  document.getElementById('resetSettingsBtn').addEventListener('click', () => openConfirm('Tema, ses, hız ve kontrol tercihleri varsayılan değerlere dönecek.', resetSettings));
  ui.confirmCancel.addEventListener('click', closeConfirm);
  ui.confirmOk.addEventListener('click', () => {
    const action = confirmAction;
    closeConfirm();
    action?.();
    playSound('menu');
  });

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartBtn').addEventListener('click', start);
  document.getElementById('restartMiniBtn').addEventListener('click', start);
  document.getElementById('menuBtn').addEventListener('click', () => {
    playSound('menu');
    updateBestUI();
    show('menu');
  });
  document.getElementById('menuMiniBtn').addEventListener('click', () => {
    playSound('menu');
    running = false;
    paused = false;
    cancelAnimationFrame(animationFrame);
    syncMusic();
    updateBestUI();
    show('menu');
  });
  ui.pauseBtn.addEventListener('click', () => {
    playSound('menu');
    togglePause();
  });

  document.querySelectorAll('[data-direction]').forEach(button => button.addEventListener('click', () => {
    const map = {up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0]};
    const [x, y] = map[button.dataset.direction];
    enqueueDirection(x, y);
  }));

  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) { event.preventDefault(); enqueueDirection(0, -1); }
    if (['arrowdown', 's'].includes(key)) { event.preventDefault(); enqueueDirection(0, 1); }
    if (['arrowleft', 'a'].includes(key)) { event.preventDefault(); enqueueDirection(-1, 0); }
    if (['arrowright', 'd'].includes(key)) { event.preventDefault(); enqueueDirection(1, 0); }
    if (key === 'p' || key === ' ') {
      event.preventDefault();
      if (!running && screens.menu.classList.contains('active')) start();
      else togglePause();
    }
    if (key === 'f') placeFoodAheadForLocalTest();
    if (key === 'escape') window.snakeRushHandleBack();
  });

  function isInteractiveTarget(target) {
    return Boolean(target.closest('button,input,a,textarea,select,label'));
  }

  function canSwipe() {
    return controls === 'swipe' && screens.game.classList.contains('active') && running && !paused;
  }

  function handleSwipe(deltaX, deltaY) {
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 10) return false;
    if (Math.abs(deltaX) > Math.abs(deltaY)) enqueueDirection(deltaX > 0 ? 1 : -1, 0);
    else enqueueDirection(0, deltaY > 0 ? 1 : -1);
    return true;
  }

  document.addEventListener('touchstart', event => {
    if (!canSwipe() || isInteractiveTarget(event.target)) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchActive = true;
  }, {passive: false});

  document.addEventListener('touchmove', event => {
    if (!touchActive || !canSwipe()) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (handleSwipe(deltaX, deltaY)) {
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }
  }, {passive: false});

  document.addEventListener('touchend', event => {
    if (!touchActive) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    handleSwipe(touch.clientX - touchStartX, touch.clientY - touchStartY);
    touchActive = false;
  }, {passive: false});

  window.addEventListener('resize', resize, {passive: true});
  window.addEventListener('orientationchange', () => setTimeout(resize, 140), {passive: true});
  document.addEventListener('visibilitychange', () => {
    accumulator = 0;
    lastFrame = document.hidden ? 0 : performance.now();
    syncMusic();
  });

  window.snakeRushHandleBack = () => {
    if (!ui.confirmDialog.classList.contains('hidden')) {
      closeConfirm();
      return true;
    }
    const current = activeScreenName();
    if (current === 'settings' || current === 'gameOver') {
      show('menu');
      return true;
    }
    if (current === 'game') {
      if (running && !paused) togglePause();
      else {
        running = false;
        paused = false;
        cancelAnimationFrame(animationFrame);
        syncMusic();
        show('menu');
      }
      return true;
    }
    return false;
  };

  window.__snakeRushTest = {
    start,
    endGame,
    setTheme: next => applyTheme(next),
    setSpeed: next => setSpeed(next, false),
    placeFoodAhead: placeFoodAheadForLocalTest,
    snapshot: () => ({theme, mode, speedLevel, controls, score, running, paused, snakeLength: snake.length, stepMs})
  };

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  applyTheme(theme, false);
  applyControls(controls, false);
  updateSettingsUI();
  updateBestUI();
  setTimeout(() => {
    if (screens.splash.classList.contains('active')) show('menu');
  }, 1100);
})();
