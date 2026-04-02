(() => {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("c");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const speedEl = document.getElementById("speed");
  const overlayEl = document.getElementById("overlay");
  const overlayTitleEl = document.getElementById("overlayTitle");
  const overlayHintEl = document.getElementById("overlayHint");

  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) {
    overlayTitleEl.textContent = "WebGL 不可用";
    overlayHintEl.textContent =
      "请换一个支持 WebGL 的浏览器或开启硬件加速。";
    return;
  }

  // ---------- WebGL helpers ----------
  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(s) || "shader compile failed";
      gl.deleteShader(s);
      throw new Error(msg);
    }
    return s;
  }

  function createProgram(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, createShader(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const msg = gl.getProgramInfoLog(p) || "program link failed";
      gl.deleteProgram(p);
      throw new Error(msg);
    }
    return p;
  }

  const VS = `
  attribute vec2 a_pos;
  attribute vec3 a_col;
  varying vec3 v_col;
  void main() {
    v_col = a_col;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  const FS = `
  precision mediump float;
  varying vec3 v_col;
  void main() {
    gl_FragColor = vec4(v_col, 1.0);
  }`;

  const program = createProgram(VS, FS);
  const aPos = gl.getAttribLocation(program, "a_pos");
  const aCol = gl.getAttribLocation(program, "a_col");

  const vbo = gl.createBuffer();

  // ---------- Textured program (for bomb penalty point) ----------
  const VS_TEX = `
  attribute vec2 a_pos;
  attribute vec2 a_uv;
  varying vec2 v_uv;
  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }`;

  const FS_TEX = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_tex;
  void main() {
    gl_FragColor = texture2D(u_tex, v_uv);
  }`;

  const texProgram = createProgram(VS_TEX, FS_TEX);
  const aPosTex = gl.getAttribLocation(texProgram, "a_pos");
  const aUv = gl.getAttribLocation(texProgram, "a_uv");
  const uTex = gl.getUniformLocation(texProgram, "u_tex");
  const texVbo = gl.createBuffer();

  // Load bomb texture from local file (placed next to index.html).
  // Use a 1x1 white fallback so the game never crashes before image load.
  let bombTexReady = false;
  const bombTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, bombTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255])
  );

  const bombImg = new Image();
  bombImg.crossOrigin = "anonymous";
  bombImg.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, bombTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bombImg);
    bombTexReady = true;
  };
  bombImg.onerror = () => {
    bombTexReady = false;
  };
  bombImg.src = "./bomb.png";

  function resizeCanvas() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  // ---------- Game config ----------
  const GRID_W = 30;
  const GRID_H = 20;
  const PADDING = 18; // pixels
  const CORNER_RADIUS = 0; // reserved for future

  const COLORS = {
    bg: [0.02, 0.04, 0.10],
    grid: [0.10, 0.14, 0.26],
    snakeHead: [0.25, 0.95, 0.65],
    snakeBody: [0.15, 0.70, 0.52],
    food: [0.98, 0.42, 0.45],
    wall: [0.20, 0.24, 0.36],
  };

  // ---------- Game state ----------
  let running = false;
  let gameOver = false;
  let score = 0;
  let best = 0;
  try {
    best = Number(localStorage.getItem("snake_best") || "0") || 0;
  } catch (_) {}

  /** @type {{x:number,y:number}[]} */
  let snake = [];
  /** @type {{x:number,y:number}} */
  let food = { x: 0, y: 0 };
  /** @type {{x:number,y:number}} */
  let penalty = { x: -1, y: -1 };
  /** @type {{x:number,y:number}} */
  let dir = { x: 1, y: 0 };
  /** @type {{x:number,y:number}[]} */
  let dirQueue = [];

  let tickMsBase = 140;
  let tickMs = tickMsBase;
  let lastTickAt = performance.now();

  function setOverlay(visible, title, hint) {
    overlayEl.classList.toggle("hidden", !visible);
    overlayTitleEl.textContent = title;
    overlayHintEl.textContent = hint;
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    speedEl.textContent = `${(tickMsBase / tickMs).toFixed(1)}x`;
  }

  function resetGame() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = { x: 1, y: 0 };
    dirQueue = [];
    score = 0;
    tickMs = tickMsBase;
    gameOver = false;
    running = false;
    spawnFood();
    spawnPenalty();
    updateHud();
    setOverlay(
      true,
      "准备开始",
      "按 Space 开始/暂停，R 重开。避开炸弹惩罚点。"
    );
  }

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function cellKey(x, y) {
    return `${x},${y}`;
  }

  function spawnFood() {
    const occupied = new Set(snake.map((p) => cellKey(p.x, p.y)));
    while (true) {
      const x = randInt(GRID_W);
      const y = randInt(GRID_H);
      if (!occupied.has(cellKey(x, y))) {
        food = { x, y };
        return;
      }
    }
  }

  function spawnPenalty() {
    // Penalty point is always one-at-a-time and never shares a cell with snake or food.
    const occupied = new Set(snake.map((p) => cellKey(p.x, p.y)));
    occupied.add(cellKey(food.x, food.y));
    while (true) {
      const x = randInt(GRID_W);
      const y = randInt(GRID_H);
      if (!occupied.has(cellKey(x, y))) {
        penalty = { x, y };
        return;
      }
    }
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function enqueueDir(next) {
    const last =
      dirQueue.length > 0 ? dirQueue[dirQueue.length - 1] : dir;
    if (isOpposite(last, next)) return;
    dirQueue.push(next);
    if (dirQueue.length > 3) dirQueue.shift();
  }

  function toggleRun() {
    if (gameOver) return;
    running = !running;
    setOverlay(!running, running ? "" : "已暂停", "按 Space 继续，R 重开。");
  }

  function endGame() {
    running = false;
    gameOver = true;
    if (score > best) {
      best = score;
      try {
        localStorage.setItem("snake_best", String(best));
      } catch (_) {}
    }
    updateHud();
    setOverlay(true, "游戏结束", "按 R 重开。");
  }

  function step() {
    if (!running || gameOver) return;

    if (dirQueue.length > 0) {
      dir = dirQueue.shift();
    }

    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // wall collision
    if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
      endGame();
      return;
    }

    const nextKey = cellKey(nx, ny);
    const bodyKeys = new Set(snake.map((p) => cellKey(p.x, p.y)));

    // allow moving into the tail cell if we are not growing this turn
    const tail = snake[snake.length - 1];
    const tailKey = cellKey(tail.x, tail.y);
    const willEat = nx === food.x && ny === food.y;
    const hitsPenalty = nx === penalty.x && ny === penalty.y;
    const hitsSelf =
      bodyKeys.has(nextKey) && !(nextKey === tailKey && !willEat);
    if (hitsSelf) {
      endGame();
      return;
    }

    if (hitsPenalty) {
      endGame();
      return;
    }

    snake.unshift({ x: nx, y: ny });
    if (willEat) {
      score += 10;
      // mild speed-up
      tickMs = Math.max(70, Math.floor(tickMs * 0.975));
      spawnFood();
      spawnPenalty();
      updateHud();
    } else {
      snake.pop();
    }
  }

  // ---------- Rendering ----------
  function getBoardRect() {
    const w = canvas.width;
    const h = canvas.height;

    const boardW = w - PADDING * 2;
    const boardH = h - PADDING * 2;
    const cell = Math.floor(Math.min(boardW / GRID_W, boardH / GRID_H));

    const bw = cell * GRID_W;
    const bh = cell * GRID_H;
    const bx = Math.floor((w - bw) / 2);
    const by = Math.floor((h - bh) / 2);

    return { bx, by, bw, bh, cell };
  }

  function pxToClip(x, y) {
    // Convert pixel coordinates (origin top-left) to clip space
    const cx = (x / canvas.width) * 2 - 1;
    const cy = 1 - (y / canvas.height) * 2;
    return [cx, cy];
  }

  /**
   * Push a colored axis-aligned rectangle (in pixels) into interleaved vertex array.
   * Layout per-vertex: x, y, r, g, b
   */
  function pushRect(verts, x, y, w, h, col) {
    const [r, g, b] = col;
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;

    const p00 = pxToClip(x0, y0);
    const p10 = pxToClip(x1, y0);
    const p01 = pxToClip(x0, y1);
    const p11 = pxToClip(x1, y1);

    // two triangles: (00,10,01) and (10,11,01)
    verts.push(
      p00[0],
      p00[1],
      r,
      g,
      b,
      p10[0],
      p10[1],
      r,
      g,
      b,
      p01[0],
      p01[1],
      r,
      g,
      b,
      p10[0],
      p10[1],
      r,
      g,
      b,
      p11[0],
      p11[1],
      r,
      g,
      b,
      p01[0],
      p01[1],
      r,
      g,
      b
    );
  }

  /**
   * Push a textured axis-aligned rectangle (in pixels) into vertex array.
   * Layout per-vertex: x, y, u, v
   */
  function pushTexRect(verts, x, y, w, h) {
    const x0 = x;
    const y0 = y;
    const x1 = x + w;
    const y1 = y + h;

    const p00 = pxToClip(x0, y0);
    const p10 = pxToClip(x1, y0);
    const p01 = pxToClip(x0, y1);
    const p11 = pxToClip(x1, y1);

    // two triangles: (00,10,01) and (10,11,01)
    verts.push(
      p00[0],
      p00[1],
      0,
      0,
      p10[0],
      p10[1],
      1,
      0,
      p01[0],
      p01[1],
      0,
      1,
      p10[0],
      p10[1],
      1,
      0,
      p11[0],
      p11[1],
      1,
      1,
      p01[0],
      p01[1],
      0,
      1
    );
  }

  function drawPenalty(bx, by, cell, inset) {
    if (penalty.x < 0 || penalty.y < 0) return;

    // If texture isn't ready yet, still draw with the 1x1 white fallback.
    const x = bx + penalty.x * cell + inset;
    const y = by + penalty.y * cell + inset;
    const w = cell - inset * 2;
    const h = cell - inset * 2;

    const verts = [];
    pushTexRect(verts, x, y, w, h);

    gl.useProgram(texProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, texVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);

    const stride = 4 * 4;
    gl.enableVertexAttribArray(aPosTex);
    gl.vertexAttribPointer(aPosTex, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, stride, 2 * 4);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bombTexture);
    gl.uniform1i(uTex, 0);

    // Enable alpha blending so PNG transparency works correctly.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 4);
    gl.disable(gl.BLEND);
  }

  function render() {
    resizeCanvas();
    const { bx, by, bw, bh, cell } = getBoardRect();

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(COLORS.bg[0], COLORS.bg[1], COLORS.bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    /** @type {number[]} */
    const verts = [];

    // board backdrop
    pushRect(verts, bx - 2, by - 2, bw + 4, bh + 4, COLORS.wall);
    pushRect(verts, bx, by, bw, bh, [0.03, 0.05, 0.12]);

    // grid lines (subtle)
    const line = Math.max(1, Math.floor(cell * 0.06));
    for (let x = 1; x < GRID_W; x++) {
      pushRect(
        verts,
        bx + x * cell - Math.floor(line / 2),
        by,
        line,
        bh,
        COLORS.grid
      );
    }
    for (let y = 1; y < GRID_H; y++) {
      pushRect(
        verts,
        bx,
        by + y * cell - Math.floor(line / 2),
        bw,
        line,
        COLORS.grid
      );
    }

    // food
    const inset = Math.max(1, Math.floor(cell * 0.12));
    pushRect(
      verts,
      bx + food.x * cell + inset,
      by + food.y * cell + inset,
      cell - inset * 2,
      cell - inset * 2,
      COLORS.food
    );

    // penalty (bomb)
    // Draw after the colored pass so it can use a different shader.
    // It will be placed below snake rectangles because snake is drawn right after.

    // snake
    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      const col = i === 0 ? COLORS.snakeHead : COLORS.snakeBody;
      pushRect(
        verts,
        bx + p.x * cell + inset,
        by + p.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2,
        col
      );
    }

    // draw
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);

    const stride = 5 * 4;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aCol);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, stride, 2 * 4);

    gl.drawArrays(gl.TRIANGLES, 0, verts.length / 5);

    drawPenalty(bx, by, cell, inset);
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = now - lastTickAt;
    if (dt >= tickMs) {
      lastTickAt = now;
      step();
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- Input ----------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "arrowup" || k === "w") enqueueDir({ x: 0, y: -1 });
    else if (k === "arrowdown" || k === "s") enqueueDir({ x: 0, y: 1 });
    else if (k === "arrowleft" || k === "a") enqueueDir({ x: -1, y: 0 });
    else if (k === "arrowright" || k === "d") enqueueDir({ x: 1, y: 0 });
    else if (k === " ") toggleRun();
    else if (k === "r") resetGame();

    // prevent scrolling for arrows/space
    if (
      k === "arrowup" ||
      k === "arrowdown" ||
      k === "arrowleft" ||
      k === "arrowright" ||
      k === " "
    ) {
      e.preventDefault();
    }
  });

  // ---------- Boot ----------
  updateHud();
  resetGame();
  requestAnimationFrame((t) => {
    lastTickAt = t;
    requestAnimationFrame(frame);
  });
})();

