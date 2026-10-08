/* AI 时序预测 · three.js WebGL 时序图（UMD 自托管 vendor/three.min.js，双击 file:// 可直接打开）
   多变量立体管线曲线 + 流动数据点 + 预测置信通道 + “现在”分隔面，GPU 渲染替代原 SVG 静态图。 */
(function () {
  const THREE = window.THREE;
  const container = document.getElementById("predict-canvas");
  if (!container || !THREE) return;

  const width = container.clientWidth || 920;
  const height = container.clientHeight || 560;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  /* 五条关键指标曲线（颜色由青到紫渐变；各指标垂直错开，直观对比） */
  const LANES = [
    { name: "OD", color: 0x22d3ee },
    { name: "葡萄糖", color: 0x38bdf8 },
    { name: "溶氧", color: 0x60a5fa },
    { name: "pH", color: 0x818cf8 },
    { name: "温度", color: 0xa78bfa },
  ];
  const LANE_Z = [-2, -1, 0, 1, 2];
  const HIST_STEPS = 24; // 历史段采样点数
  const FORE_STEPS = 12; // 预测段采样点数

  /* 每个变量的走势：S 型增长 + 双正弦波动，历史与预测共享同一函数保证在“现在”处连续 */
  function value(i, x) {
    const base = 0.7 + i * 0.35;       // 各变量垂直分层
    const amp = 0.9 + i * 0.12;        // 波幅随层递增
    const k = 0.5 + i * 0.09;
    const x0 = -3 + i * 0.5;
    const sig = amp / (1 + Math.exp(-k * (x - x0)));
    const wobble = Math.sin(x * 0.9 + i * 1.3) * 0.1 + Math.sin(x * 0.4 + i * 2.1) * 0.07;
    return base + sig + wobble;
  }

  const curves = LANES.map((lane, i) => {
    const z = LANE_Z[i];
    const hist = [];
    const fore = [];
    for (let s = 0; s <= HIST_STEPS; s++) {
      const x = -7 + (7 / HIST_STEPS) * s;
      hist.push(new THREE.Vector3(x, value(i, x), z));
    }
    for (let s = 0; s <= FORE_STEPS; s++) {
      const x = (4.6 / FORE_STEPS) * s;
      fore.push(new THREE.Vector3(x, value(i, x), z));
    }
    return {
      lane,
      histCurve: new THREE.CatmullRomCurve3(hist),
      foreCurve: new THREE.CatmullRomCurve3(fore),
      fullCurve: new THREE.CatmullRomCurve3(hist.concat(fore.slice(1))),
    };
  });

  /* 历史 / 预测用细线描边（不抢粒子流的视觉），预测段再套一层半透明置信通道 */
  curves.forEach(({ lane, histCurve, foreCurve }) => {
    const color = lane.color;

    const histLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(histCurve.getPoints(120)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    root.add(histLine);

    const foreLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(foreCurve.getPoints(80)),
      new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.75, dashSize: 0.18, gapSize: 0.14 })
    );
    foreLine.computeLineDistances();
    root.add(foreLine);

    const band = new THREE.Mesh(
      new THREE.TubeGeometry(foreCurve, 64, 0.22, 8, false),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
    );
    root.add(band);
  });

  /* “现在”分隔面 + 中心亮线 */
  const nowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 3.2),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false })
  );
  nowPlane.rotation.y = Math.PI / 2;
  nowPlane.position.set(0, 2.0, 0);
  root.add(nowPlane);

  const nowLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 3.6, 0)]),
    new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 })
  );
  root.add(nowLine);

  /* 地面网格 */
  const grid = new THREE.GridHelper(13, 26, 0x22d3ee, 0x173450);
  grid.position.set(-0.8, 0.35, 0);
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  root.add(grid);

  /* 沿曲线流动的数据点 */
  const PER_LANE = 30;
  const total = PER_LANE * LANES.length;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const parts = [];

  curves.forEach(({ lane, fullCurve }, li) => {
    const c = new THREE.Color(lane.color);
    for (let p = 0; p < PER_LANE; p++) {
      const idx = li * PER_LANE + p;
      parts.push({ curve: fullCurve, t: p / PER_LANE, speed: 0.05 + (p % 5) * 0.006 });
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;
    }
  });

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })
  );
  root.add(particles);

  const clock = new THREE.Clock();
  const posAttr = pGeo.getAttribute("position");
  let elapsed = 0;
  let rafId = null;

  function animate() {
    rafId = requestAnimationFrame(animate);
    /* dt 封顶 100ms：即使出现后台时间差没被清掉的情况，单帧最多补 100ms，杜绝“快进补帧” */
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;

    /* 镜头缓慢左右摇摆，保持曲线可读 */
    const ang = Math.sin(elapsed * 0.12) * 0.4;
    const R = 8.5;
    camera.position.set(Math.sin(ang) * R, 3.1 + Math.sin(elapsed * 0.3) * 0.2, Math.cos(ang) * R);
    camera.lookAt(-1.1, 2.0, 0);

    /* 数据点沿历史 → 预测持续流动 */
    const arr = posAttr.array;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      p.t += dt * p.speed;
      if (p.t > 1) p.t -= 1;
      const v = p.curve.getPoint(p.t);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    posAttr.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", resize);

  /* 页面切到后台时暂停渲染省电；切回时清空累积时间差，避免画面“快进补帧” */
  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  function start() {
    stop(); // 防重复调度
    rafId = requestAnimationFrame(animate);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else {
      clock.getDelta(); // 丢弃后台期间累积的时间差
      start();
    }
  });

  start();
})();
