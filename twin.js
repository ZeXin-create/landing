/* 数字孪生 · three.js WebGL 可视化（UMD 自托管 vendor/three.min.js，双击 file:// 可直接打开）
   展示完整发酵流程：进料 → 罐内发酵（粒子旋流 + 上升气泡）→ 产物出料，GPU 渲染。 */
(function () {
  const THREE = window.THREE;
  const container = document.getElementById("twin-canvas");
  if (!container || !THREE) return;

  const width = container.clientWidth || 920;
  const height = container.clientHeight || 560;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 1.5, 9.0);
  camera.lookAt(0, 0.2, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const root = new THREE.Group();
  scene.add(root);

  const CYAN = 0x22d3ee;
  const BLUE = 0x7dd3fc;
  const GREEN = 0x34d399;

  /* 罐体线框（玻璃质感） */
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 4.4, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.26 })
  );
  glass.position.y = 0.2;
  root.add(glass);

  /* 顶部穹顶线框 */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: CYAN, wireframe: true, transparent: true, opacity: 0.26 })
  );
  dome.position.y = 2.4;
  root.add(dome);

  /* 上下环 */
  const ringGeo = new THREE.TorusGeometry(2.1, 0.05, 12, 72);
  const ringMat = new THREE.MeshBasicMaterial({ color: CYAN });
  const topRing = new THREE.Mesh(ringGeo, ringMat);
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = 2.4;
  root.add(topRing);
  const botRing = new THREE.Mesh(ringGeo, ringMat);
  botRing.rotation.x = Math.PI / 2;
  botRing.position.y = -2.0;
  root.add(botRing);

  /* 进料路径（右上方进入罐顶，粒子流表示） */
  const feedCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.4, 3.5, 1.0),
    new THREE.Vector3(1.8, 3.1, 0.5),
    new THREE.Vector3(0.4, 2.5, 0),
  ]);

  /* 补料路径（左侧中段补入，粒子流表示） */
  const suppCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.4, 1.1, 0.8),
    new THREE.Vector3(-2.0, 0.6, 0.3),
    new THREE.Vector3(-1.1, 0.2, 0.1),
  ]);

  /* 出料路径（罐底左下方排出，粒子流表示） */
  const outCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.2, -2.0, 0.5),
    new THREE.Vector3(-2.3, -2.4, 0.1),
    new THREE.Vector3(-3.3, -2.6, -0.3),
  ]);

  /* 罐内粒子（生物量 / 数据点，旋流） */
  const pCount = 320;
  const positions = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const r = 1.9 * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = -1.9 + Math.random() * 4.2;
    positions[i * 3 + 2] = Math.sin(a) * r;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: BLUE, size: 0.07, transparent: true, opacity: 0.85, depthWrite: false })
  );
  root.add(particles);

  /* 上升气泡（发酵产气） */
  const bCount = 70;
  const bPos = new Float32Array(bCount * 3);
  const bSpeed = new Float32Array(bCount);
  for (let i = 0; i < bCount; i++) {
    const r = 1.6 * Math.sqrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    bPos[i * 3] = Math.cos(a) * r;
    bPos[i * 3 + 1] = -1.8 + Math.random() * 4.0;
    bPos[i * 3 + 2] = Math.sin(a) * r;
    bSpeed[i] = 0.25 + Math.random() * 0.45;
  }
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  const bubbles = new THREE.Points(
    bGeo,
    new THREE.PointsMaterial({ color: 0x67e8f9, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false })
  );
  root.add(bubbles);

  /* 环绕数据环 */
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(3.1, 0.02, 8, 88),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.5 })
  );
  orbit.rotation.x = Math.PI / 2.6;
  root.add(orbit);

  /* 沿管道流动的粒子：进料（蓝）与出料产物（绿） */
  function makeFlow(curve, color, count, speed) {
    const fPos = new Float32Array(count * 3);
    const ts = [];
    for (let i = 0; i < count; i++) ts.push({ t: i / count, speed });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size: 0.18, transparent: true, opacity: 0.95, depthWrite: false })
    );
    root.add(points);
    const attr = geo.getAttribute("position");
    return function update(dt) {
      const arr = attr.array;
      for (let i = 0; i < ts.length; i++) {
        const p = ts[i];
        p.t += dt * p.speed;
        if (p.t > 1) p.t -= 1;
        const v = curve.getPoint(p.t);
        arr[i * 3] = v.x;
        arr[i * 3 + 1] = v.y;
        arr[i * 3 + 2] = v.z;
      }
      attr.needsUpdate = true;
    };
  }
  const AMBER = 0xfbbf24;
  const feedFlow = makeFlow(feedCurve, BLUE, 24, 0.34);
  const suppFlow = makeFlow(suppCurve, AMBER, 16, 0.26);
  const outFlow = makeFlow(outCurve, GREEN, 24, 0.3);

  const clock = new THREE.Clock();
  let elapsed = 0;
  let rafId = null;

  function animate() {
    rafId = requestAnimationFrame(animate);
    /* dt 封顶 100ms：即使出现后台时间差没被清掉的情况，单帧最多补 100ms，杜绝“快进补帧” */
    const dt = Math.min(clock.getDelta(), 0.1);
    elapsed += dt;
    const t = elapsed;

    root.rotation.y = t * 0.1;        // 整体缓慢旋转
    particles.rotation.y = -t * 0.28; // 罐内粒子反向旋流
    orbit.rotation.z = t * 0.35;      // 数据环环绕

    feedFlow(dt); // 进料流动
    suppFlow(dt); // 补料流动
    outFlow(dt);  // 出料流动

    /* 气泡上升，到顶后回到底部 */
    const barr = bGeo.getAttribute("position").array;
    for (let i = 0; i < bCount; i++) {
      let y = barr[i * 3 + 1] + dt * bSpeed[i];
      if (y > 2.3) y = -1.9;
      barr[i * 3 + 1] = y;
    }
    bGeo.getAttribute("position").needsUpdate = true;

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
