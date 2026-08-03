(() => {
  const screens = {
    splash: document.getElementById('splash'),
    menu: document.getElementById('menu'),
    settings: document.getElementById('settings'),
    game: document.getElementById('game'),
    gameOver: document.getElementById('gameOver')
  };
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const menuBestEl = document.getElementById('menuBest');
  const finalScoreEl = document.getElementById('finalScore');
  const finalBestEl = document.getElementById('finalBest');
  const finalModeEl = document.getElementById('finalMode');
  const finalSpeedEl = document.getElementById('finalSpeed');
  const modeLabelEl = document.getElementById('modeLabel');
  const gameSpeedLabelEl = document.getElementById('gameSpeedLabel');
  const menuSpeedLabelEl = document.getElementById('menuSpeedLabel');
  const speedValueEl = document.getElementById('speedValue');
  const speedRangeEl = document.getElementById('speedRange');
  const touchHint = document.getElementById('touchHint');
  const pauseBtn = document.getElementById('pauseBtn');
  const easyBtn = document.getElementById('easyBtn');
  const hardBtn = document.getElementById('hardBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const volumeRangeEl = document.getElementById('volumeRange');
  const volumeValueEl = document.getElementById('volumeValue');
  const menuVolumeLabelEl = document.getElementById('menuVolumeLabel');
  const gameVolumeLabelEl = document.getElementById('gameVolumeLabel');
  const finalVolumeEl = document.getElementById('finalVolume');

  const KEY_EASY = 'promptla_snake_best_easy_v6';
  const KEY_HARD = 'promptla_snake_best_hard_v6';
  const MODE_KEY = 'promptla_snake_mode_v6';
  const SPEED_KEY = 'promptla_snake_speed_level_v1';
  const VOLUME_KEY = 'promptla_snake_volume_level_v1';
  let mode = localStorage.getItem(MODE_KEY) || 'easy';
  let speedLevel = clampNumber(Number(localStorage.getItem(SPEED_KEY) || 5), 1, 10);
  let volumeLevel = clampNumber(Number(localStorage.getItem(VOLUME_KEY) || 70), 0, 100);
  let bestEasy = Number(localStorage.getItem(KEY_EASY) || 0);
  let bestHard = Number(localStorage.getItem(KEY_HARD) || 0);

  let W = 0, H = 0, dpr = 1;
  const cols = 20;
  const rows = 20;
  let cell = 20, offsetX = 0, offsetY = 0;
  let snake = [], food = null;
  let dir = {x:1,y:0}, nextDir = {x:1,y:0};
  let score = 0, running = false, paused = false, stepMs = 96, timer = 0, last = 0, raf = 0;
  let touchStartX = 0, touchStartY = 0, touchActive = false, hintTimer = 0;
  let audioCtx = null;
  let lastTurnSound = 0;

  function clampNumber(v, min, max){ return Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)); }
  function show(name){
    Object.values(screens).forEach(s=>s && s.classList.remove('active'));
    screens[name].classList.add('active');
    if(name === 'game') setTimeout(resize, 40);
  }
  function modeName(){ return mode === 'easy' ? 'Kolay' : 'Zor'; }
  function activeBest(){ return mode === 'easy' ? bestEasy : bestHard; }
  function updateModeButtons(){
    easyBtn.classList.toggle('active', mode === 'easy');
    hardBtn.classList.toggle('active', mode === 'hard');
  }
  function updateSpeedUI(){
    const value = String(speedLevel);
    if(speedRangeEl) speedRangeEl.value = value;
    if(speedValueEl) speedValueEl.textContent = value;
    if(menuSpeedLabelEl) menuSpeedLabelEl.textContent = value;
    if(gameSpeedLabelEl) gameSpeedLabelEl.textContent = value;
    if(finalSpeedEl) finalSpeedEl.textContent = value;
  }
  function updateVolumeUI(){
    const value = String(volumeLevel);
    if(volumeRangeEl) volumeRangeEl.value = value;
    if(volumeValueEl) volumeValueEl.textContent = value;
    if(menuVolumeLabelEl) menuVolumeLabelEl.textContent = value;
    if(gameVolumeLabelEl) gameVolumeLabelEl.textContent = value + '%';
    if(finalVolumeEl) finalVolumeEl.textContent = value + '%';
  }
  function updateBestUI(){
    const b = activeBest();
    menuBestEl.textContent = b;
    bestEl.textContent = b;
    finalBestEl.textContent = b;
    modeLabelEl.textContent = modeName();
    finalModeEl.textContent = modeName();
    updateModeButtons();
    updateSpeedUI();
    updateVolumeUI();
  }
  function setMode(next){
    mode = next;
    localStorage.setItem(MODE_KEY, mode);
    updateBestUI();
  }
  function setSpeed(next){
    speedLevel = clampNumber(Math.round(Number(next)), 1, 10);
    localStorage.setItem(SPEED_KEY, String(speedLevel));
    updateSpeedUI();
    playSound('menu');
  }
  function setVolume(next){
    volumeLevel = clampNumber(Math.round(Number(next)), 0, 100);
    localStorage.setItem(VOLUME_KEY, String(volumeLevel));
    updateVolumeUI();
    playSound('menu');
  }
  function getAudioContext(){
    if(!audioCtx){
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return null;
      audioCtx = new Ctx();
    }
    if(audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
    return audioCtx;
  }
  function playTone(freq, duration, type='square', gain=0.08, delay=0){
    const ctx = getAudioContext();
    if(!ctx || volumeLevel <= 0) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    const now = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * (volumeLevel / 100)), now + 0.012);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.025);
  }
  function playSound(name){
    if(volumeLevel <= 0) return;
    if(name === 'turn'){
      const now = performance.now();
      if(now - lastTurnSound < 45) return;
      lastTurnSound = now;
      playTone(360, 0.035, 'square', 0.035);
    } else if(name === 'eat'){
      playTone(660, 0.055, 'square', 0.08);
      playTone(920, 0.07, 'square', 0.06, 0.055);
    } else if(name === 'start'){
      playTone(420, 0.055, 'square', 0.06);
      playTone(620, 0.08, 'square', 0.07, 0.06);
    } else if(name === 'over'){
      playTone(220, 0.09, 'sawtooth', 0.08);
      playTone(150, 0.14, 'sawtooth', 0.07, 0.09);
    } else {
      playTone(520, 0.035, 'square', 0.035);
    }
  }
  function speedScale(){
    // 5 = current speed. 4 is a little slower. 10 is very fast.
    return clampNumber(1 - (speedLevel - 5) * 0.11, 0.45, 1.55);
  }
  function baseStep(){
    return mode === 'easy' ? 94 : 82;
  }
  function minStep(){
    return (mode === 'easy' ? 62 : 52) * speedScale();
  }
  function initialStep(){
    return baseStep() * speedScale();
  }
  function stepDecrease(){
    return (mode === 'easy' ? 1.9 : 2.4) / speedScale();
  }

  easyBtn.addEventListener('click', () => setMode('easy'));
  hardBtn.addEventListener('click', () => setMode('hard'));
  speedRangeEl && speedRangeEl.addEventListener('input', e => setSpeed(e.target.value));
  volumeRangeEl && volumeRangeEl.addEventListener('input', e => setVolume(e.target.value));
  document.getElementById('settingsBtn').addEventListener('click', () => { playSound('menu'); show('settings'); });
  document.getElementById('settingsBackBtn').addEventListener('click', () => { playSound('menu'); updateBestUI(); show('menu'); });
  updateBestUI();
  setTimeout(() => show('menu'), 900);

  function resize(){
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(260, Math.floor(rect.width));
    H = Math.max(260, Math.floor(rect.height));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    cell = Math.floor(Math.min(W / cols, H / rows));
    offsetX = Math.floor((W - cols * cell) / 2);
    offsetY = Math.floor((H - rows * cell) / 2);
    draw();
  }
  window.addEventListener('resize', resize, {passive:true});
  window.addEventListener('orientationchange', () => setTimeout(resize, 160), {passive:true});
  resize();

  function start(){
    resize();
    const sx = Math.floor(cols / 2), sy = Math.floor(rows / 2);
    snake = [{x:sx,y:sy},{x:sx-1,y:sy},{x:sx-2,y:sy}];
    dir = {x:1,y:0};
    nextDir = {x:1,y:0};
    score = 0;
    stepMs = initialStep();
    timer = 0;
    last = performance.now();
    running = true;
    paused = false;
    pauseBtn.textContent = 'Duraklat';
    pauseOverlay.classList.add('hidden');
    food = spawnFood();
    scoreEl.textContent = '0';
    updateBestUI();
    playSound('start');
    show('game');
    touchHint.classList.remove('hide');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => touchHint.classList.add('hide'), 1600);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function spawnFood(){
    let f, guard = 0;
    do {
      f = {x:Math.floor(Math.random() * cols), y:Math.floor(Math.random() * rows)};
      guard++;
    } while(guard < 300 && snake.some(s => s.x === f.x && s.y === f.y));
    return f;
  }

  function setDir(x,y){
    if(!running) return;
    if(x === -dir.x && y === -dir.y) return;
    nextDir = {x,y};
    playSound('turn');
    touchHint.classList.add('hide');
  }

  function loop(now){
    if(!running) return;
    const dt = now - last;
    last = now;
    if(!paused){
      timer += dt;
      while(timer >= stepMs){ timer -= stepMs; tick(); }
    }
    draw();
    raf = requestAnimationFrame(loop);
  }

  function tick(){
    dir = nextDir;
    const head = snake[0];
    let nx = head.x + dir.x;
    let ny = head.y + dir.y;

    if(mode === 'easy'){
      nx = (nx + cols) % cols;
      ny = (ny + rows) % rows;
    } else if(nx < 0 || nx >= cols || ny < 0 || ny >= rows){
      end(); return;
    }

    const willEat = food && nx === food.x && ny === food.y;
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    if(bodyToCheck.some(s => s.x === nx && s.y === ny)){ end(); return; }

    snake.unshift({x:nx,y:ny});
    if(willEat){
      score += mode === 'easy' ? 10 : 15;
      playSound('eat');
      scoreEl.textContent = score;
      saveBestIfNeeded();
      food = spawnFood();
      stepMs = Math.max(minStep(), stepMs - stepDecrease());
    } else {
      snake.pop();
    }
  }

  function saveBestIfNeeded(){
    if(mode === 'easy' && score > bestEasy){ bestEasy = score; localStorage.setItem(KEY_EASY, String(bestEasy)); }
    if(mode === 'hard' && score > bestHard){ bestHard = score; localStorage.setItem(KEY_HARD, String(bestHard)); }
    updateBestUI();
  }

  function end(){
    running = false;
    cancelAnimationFrame(raf);
    saveBestIfNeeded();
    finalScoreEl.textContent = score;
    finalBestEl.textContent = activeBest();
    finalModeEl.textContent = modeName();
    finalSpeedEl.textContent = speedLevel;
    if(finalVolumeEl) finalVolumeEl.textContent = volumeLevel + '%';
    playSound('over');
    show('gameOver');
  }

  function togglePause(){
    if(!running) return;
    paused = !paused;
    pauseBtn.textContent = paused ? 'Devam Et' : 'Duraklat';
    pauseOverlay.classList.toggle('hidden', !paused);
  }

  function drawGrid(){
    ctx.fillStyle = '#06111c';
    ctx.fillRect(0,0,W,H);
    ctx.strokeStyle = 'rgba(0,217,255,.078)';
    ctx.lineWidth = 1;
    const boardW = cols * cell;
    const boardH = rows * cell;
    for(let x = 0; x <= cols; x++){
      const px = offsetX + x * cell + .5;
      ctx.beginPath(); ctx.moveTo(px, offsetY); ctx.lineTo(px, offsetY + boardH); ctx.stroke();
    }
    for(let y = 0; y <= rows; y++){
      const py = offsetY + y * cell + .5;
      ctx.beginPath(); ctx.moveTo(offsetX, py); ctx.lineTo(offsetX + boardW, py); ctx.stroke();
    }
  }

  function drawFood(){
    if(!food) return;
    const fx = offsetX + food.x * cell + cell / 2;
    const fy = offsetY + food.y * cell + cell / 2;
    const r = Math.max(5, cell * .32);
    ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fillStyle = '#ff5f7a'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(fx - r * .28, fy - r * .32, Math.max(1.5, r * .22), 0, Math.PI * 2); ctx.fill();
  }

  function drawSnake(){
    snake.forEach((s,i) => {
      const x = offsetX + s.x * cell;
      const y = offsetY + s.y * cell;
      const pad = Math.max(2, Math.floor(cell * .14));
      ctx.fillStyle = i === 0 ? '#7c5cff' : '#00d9ff';
      ctx.fillRect(x + pad, y + pad, cell - pad * 2, cell - pad * 2);
    });
  }

  function draw(){
    if(!ctx) return;
    ctx.clearRect(0,0,W,H);
    drawGrid();
    drawFood();
    drawSnake();
  }

  document.getElementById('startBtn').addEventListener('click', start);
  document.getElementById('restartBtn').addEventListener('click', start);
  document.getElementById('restartMiniBtn').addEventListener('click', start);
  document.getElementById('menuBtn').addEventListener('click', () => { playSound('menu'); updateBestUI(); show('menu'); });
  document.getElementById('menuMiniBtn').addEventListener('click', () => { playSound('menu'); running = false; cancelAnimationFrame(raf); updateBestUI(); show('menu'); });
  pauseBtn.addEventListener('click', () => { playSound('menu'); togglePause(); });

  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if(['arrowup','w',' '].includes(k)){ e.preventDefault(); if(!running && screens.menu.classList.contains('active')) start(); else setDir(0,-1); }
    if(['arrowdown','s'].includes(k)){ e.preventDefault(); setDir(0,1); }
    if(['arrowleft','a'].includes(k)){ e.preventDefault(); setDir(-1,0); }
    if(['arrowright','d'].includes(k)){ e.preventDefault(); setDir(1,0); }
    if(k === 'p') togglePause();
  });

  function isInteractiveTarget(target){
    return !!target.closest('button,input,a,textarea,select');
  }
  function canSwipe(){
    return screens.game.classList.contains('active') && running && !paused;
  }
  function handleSwipe(dx, dy){
    if(Math.max(Math.abs(dx), Math.abs(dy)) < 8) return false;
    if(Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0);
    else setDir(0, dy > 0 ? 1 : -1);
    return true;
  }
  document.addEventListener('touchstart', e => {
    if(!canSwipe() || isInteractiveTarget(e.target)) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchActive = true;
  }, {passive:false});
  document.addEventListener('touchmove', e => {
    if(!touchActive || !canSwipe()) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if(handleSwipe(dx, dy)){
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }
  }, {passive:false});
  document.addEventListener('touchend', e => {
    if(!touchActive) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    handleSwipe(t.clientX - touchStartX, t.clientY - touchStartY);
    touchActive = false;
  }, {passive:false});
})();
