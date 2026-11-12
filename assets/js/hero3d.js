/* LumaGuard hero — 3D facility: cutaway building with sweeping cameras,
   smoke detectors, access-controlled doors, live power conduit and a tracked visitor.
   Requires THREE (r128, classic build). Falls back to the SVG plan if WebGL is unavailable. */
(() => {
  const fig = document.querySelector('.plan');
  if (!fig || !window.THREE) return;
  const T = window.THREE;

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (_) { return; }
  if (!renderer.getContext()) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ORANGE = 0xf28a25, EMBER = 0xff5a36, OK = 0x57d18a;

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'plan__3d';
  canvas.setAttribute('aria-hidden', 'true');
  fig.insertBefore(canvas, fig.firstChild);
  fig.classList.add('plan--3d');

  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(34, 4 / 3, 0.1, 100);

  /* ---------- plan coordinates (same as the SVG: x 30..530, y 30..390) ---------- */
  const P = (x, y) => [(x - 280) / 50, (y - 210) / 50];
  const H = 0.95, TH = 0.09;

  /* ---------- lights ---------- */
  scene.add(new T.HemisphereLight(0xffffff, 0x1a1012, 0.55));
  const key = new T.DirectionalLight(0xffe2c4, 0.9);
  key.position.set(-6, 10, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new T.PointLight(ORANGE, 0.9, 18);
  rim.position.set(5, 4, -5);
  scene.add(rim);

  /* ---------- floor (canvas texture with grid + room labels) ---------- */
  const fc = document.createElement('canvas');
  fc.width = 1100; fc.height = 820;
  const g = fc.getContext('2d');
  g.fillStyle = '#141418'; g.fillRect(0, 0, 1100, 820);
  g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 2;
  for (let i = 0; i <= 1100; i += 25) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 820); g.stroke(); }
  for (let i = 0; i <= 820; i += 25) { g.beginPath(); g.moveTo(0, i); g.lineTo(1100, i); g.stroke(); }
  g.font = '600 22px Menlo, monospace'; g.fillStyle = 'rgba(255,255,255,0.38)';
  const lbl = (t, x, y) => g.fillText(t, (x - 280) * 2 + 550, (y - 210) * 2 + 410);
  lbl('OFFICE', 50, 64); lbl('WAREHOUSE', 350, 64); lbl('LOBBY', 50, 240); lbl('SERVER', 200, 240); lbl('YARD GATE', 440, 240);
  const ftex = new T.CanvasTexture(fc);
  ftex.encoding = T.sRGBEncoding;
  ftex.anisotropy = 4;
  const floor = new T.Mesh(new T.PlaneGeometry(11, 8.2), new T.MeshStandardMaterial({ map: ftex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const slab = new T.Mesh(new T.BoxGeometry(11, 0.3, 8.2), new T.MeshStandardMaterial({ color: 0x0f0f12, roughness: 1 }));
  slab.position.y = -0.151;
  scene.add(slab);
  const slabEdge = new T.LineSegments(new T.EdgesGeometry(slab.geometry), new T.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.35 }));
  slabEdge.position.copy(slab.position);
  scene.add(slabEdge);

  /* ---------- walls ---------- */
  const wallMat = new T.MeshStandardMaterial({ color: 0x9a968f, roughness: 0.8, transparent: true, opacity: 0.92 });
  const capMat = new T.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.8 });
  const wall = (x1, y1, x2, y2) => {
    const [ax, az] = P(x1, y1), [bx, bz] = P(x2, y2);
    const len = Math.hypot(bx - ax, bz - az) + TH;
    const geo = new T.BoxGeometry(len, H, TH);
    const m = new T.Mesh(geo, wallMat);
    m.position.set((ax + bx) / 2, H / 2, (az + bz) / 2);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    const e = new T.LineSegments(new T.EdgesGeometry(geo), capMat);
    e.position.copy(m.position); e.rotation.copy(m.rotation);
    scene.add(e);
  };
  // outer shell (front entrance gap in the lobby at x 80..130)
  wall(30, 30, 530, 30); wall(530, 30, 530, 390); wall(530, 390, 130, 390); wall(80, 390, 30, 390); wall(30, 390, 30, 30);
  // interior
  wall(30, 210, 190, 210); wall(240, 210, 330, 210); wall(330, 30, 330, 150); wall(330, 190, 330, 390);
  wall(190, 210, 190, 390); wall(420, 210, 530, 210);

  /* ---------- electrical panel + conduit with travelling pulses ---------- */
  const panel = new T.Mesh(new T.BoxGeometry(0.5, 0.7, 0.18), new T.MeshStandardMaterial({ color: 0x24242b, roughness: 0.5, metalness: 0.4 }));
  { const [x, z] = P(224, 378); panel.position.set(x, 0.35, z); panel.castShadow = true; scene.add(panel); }
  const panelLed = new T.Mesh(new T.SphereGeometry(0.04, 12, 12), new T.MeshBasicMaterial({ color: ORANGE }));
  panelLed.position.set(panel.position.x + 0.15, 0.6, panel.position.z - 0.1);
  scene.add(panelLed);

  const runs = [
    [[224, 368], [224, 300], [120, 300], [120, 120], [260, 120]],
    [[224, 300], [300, 300], [300, 260], [460, 260], [460, 120]],
  ].map(pts => pts.map(([x, y]) => { const [a, b] = P(x, y); return new T.Vector3(a, 0.03, b); }));
  const conduitMat = new T.LineBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.55 });
  const pulses = [];
  runs.forEach((pts, ri) => {
    scene.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), conduitMat));
    let total = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); segs.push(l); total += l; }
    for (let k = 0; k < 3; k++) {
      const s = new T.Mesh(new T.SphereGeometry(0.06, 12, 12), new T.MeshBasicMaterial({ color: 0xffb066 }));
      scene.add(s);
      pulses.push({ s, pts, segs, total, off: k / 3 + ri * 0.17 });
    }
  });
  const along = (p, u) => {
    let d = (u % 1) * p.total;
    for (let i = 0; i < p.segs.length; i++) {
      if (d <= p.segs[i]) return p.s.position.lerpVectors(p.pts[i], p.pts[i + 1], d / p.segs[i]);
      d -= p.segs[i];
    }
  };

  /* ---------- smoke detectors with pulse rings ---------- */
  const dets = [[180, 120], [430, 110], [110, 300], [260, 300]].map(([x, y], i) => {
    const [px, pz] = P(x, y);
    const puck = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.06, 24), new T.MeshStandardMaterial({ color: 0xf4f3f1, roughness: 0.4 }));
    puck.position.set(px, H + 0.25, pz);
    scene.add(puck);
    const dot = new T.Mesh(new T.SphereGeometry(0.035, 10, 10), new T.MeshBasicMaterial({ color: EMBER }));
    dot.position.set(px + 0.09, H + 0.22, pz);
    scene.add(dot);
    const ring = new T.Mesh(new T.RingGeometry(0.2, 0.24, 40), new T.MeshBasicMaterial({ color: EMBER, transparent: true, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(px, H + 0.24, pz);
    scene.add(ring);
    // faint drop line so it reads as ceiling-mounted
    const drop = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(px, H + 0.22, pz), new T.Vector3(px, 0.02, pz)]),
      new T.LineDashedMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, dashSize: 0.08, gapSize: 0.08 }));
    drop.computeLineDistances();
    scene.add(drop);
    return { ring, delay: i * 0.8 };
  });

  /* ---------- access-controlled doors ---------- */
  const doorMat = new T.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.6, metalness: 0.2 });
  const doors = {};
  const mkDoor = (id, x1, y1, x2, y2) => {
    const [ax, az] = P(x1, y1), [bx, bz] = P(x2, y2);
    const len = Math.hypot(bx - ax, bz - az);
    const pivot = new T.Group();
    pivot.position.set(ax, 0, az);
    pivot.rotation.y = -Math.atan2(bz - az, bx - ax);
    const slabM = new T.Mesh(new T.BoxGeometry(len - 0.04, H * 0.86, 0.05), doorMat);
    slabM.position.set(len / 2, H * 0.43, 0);
    slabM.castShadow = true;
    pivot.add(slabM);
    scene.add(pivot);
    // reader on the wall beside the door
    const reader = new T.Mesh(new T.BoxGeometry(0.1, 0.16, 0.04), new T.MeshStandardMaterial({ color: 0x111114 }));
    const dir = new T.Vector3(bx - ax, 0, bz - az).normalize();
    const nrm = new T.Vector3(-dir.z, 0, dir.x);
    reader.position.set(ax - dir.x * 0.18 + nrm.x * 0.08, 0.85, az - dir.z * 0.18 + nrm.z * 0.08);
    reader.rotation.y = pivot.rotation.y;
    scene.add(reader);
    const led = new T.Mesh(new T.SphereGeometry(0.035, 10, 10), new T.MeshBasicMaterial({ color: OK }));
    led.position.copy(reader.position).add(new T.Vector3(0, 0.12, 0));
    scene.add(led);
    doors[id] = { pivot, led, base: pivot.rotation.y, open: 0, target: 0, until: 0, center: new T.Vector3((ax + bx) / 2, 0, (az + bz) / 2) };
  };
  mkDoor(1, 190, 210, 240, 210);   // office ↔ lobby
  mkDoor(2, 330, 150, 330, 190);   // office ↔ warehouse
  mkDoor(3, 330, 210, 420, 210);   // warehouse ↔ yard gate
  mkDoor(4, 80, 390, 130, 390);    // front entrance
  addEventListener('lg:door', e => { const d = doors[e.detail.id]; if (d) d.until = performance.now() + 1800; });

  /* ---------- visitor walking a route, tracked by a detection box ---------- */
  const person = new T.Group();
  const bodyMat = new T.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.7 });
  const torso = new T.Mesh(new T.CylinderGeometry(0.13, 0.16, 0.6, 16), bodyMat);
  torso.position.y = 0.5; torso.castShadow = true;
  const head = new T.Mesh(new T.SphereGeometry(0.11, 16, 16), new T.MeshStandardMaterial({ color: 0xc89a7a, roughness: 0.6 }));
  head.position.y = 0.92; head.castShadow = true;
  const legs = new T.Mesh(new T.CylinderGeometry(0.12, 0.1, 0.22, 12), bodyMat);
  legs.position.y = 0.11;
  person.add(torso, head, legs);
  person.scale.setScalar(0.72);
  scene.add(person);
  const boxGeo = new T.EdgesGeometry(new T.BoxGeometry(0.4, 0.85, 0.4));
  const detBox = new T.LineSegments(boxGeo, new T.LineBasicMaterial({ color: ORANGE }));
  scene.add(detBox);

  const route = [[105, 470], [105, 330], [215, 250], [215, 160], [120, 100], [270, 90], [310, 170], [400, 170], [470, 100], [470, 300], [375, 250], [300, 170], [215, 170], [215, 260], [105, 340], [105, 470]]
    .map(([x, y]) => { const [a, b] = P(x, y); return new T.Vector3(a, 0, b); });
  let rTotal = 0; const rSegs = [];
  for (let i = 1; i < route.length; i++) { const l = route[i].distanceTo(route[i - 1]); rSegs.push(l); rTotal += l; }
  const walkTmp = new T.Vector3(), lookTmp = new T.Vector3();
  const walkAt = u => {
    let d = (u % 1) * rTotal;
    for (let i = 0; i < rSegs.length; i++) {
      if (d <= rSegs[i]) { walkTmp.lerpVectors(route[i], route[i + 1], d / rSegs[i]); lookTmp.subVectors(route[i + 1], route[i]); return; }
      d -= rSegs[i];
    }
  };

  /* ---------- cameras with volumetric view cones ---------- */
  const coneMat = () => new T.MeshBasicMaterial({ color: ORANGE, transparent: true, opacity: 0.16, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  const DOWN = new T.Vector3(0, -1, 0);
  const cams = [[38, 38, 180, 120], [522, 38, 430, 110], [38, 382, 110, 300], [522, 382, 430, 300]].map(([x, y, tx, ty], i) => {
    const [px, pz] = P(x, y), [qx, qz] = P(tx, ty);
    const pos = new T.Vector3(px, H + 0.35, pz);
    const mount = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.35, 8), new T.MeshStandardMaterial({ color: 0x888888 }));
    mount.position.set(px, H + 0.17, pz);
    scene.add(mount);
    const body = new T.Group();
    const shell = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 0.34), new T.MeshStandardMaterial({ color: 0xf4f3f1, roughness: 0.35 }));
    const lens = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.04, 16), new T.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.2 }));
    lens.rotation.x = Math.PI / 2; lens.position.z = 0.18;
    const ring = new T.Mesh(new T.TorusGeometry(0.06, 0.012, 8, 24), new T.MeshBasicMaterial({ color: ORANGE }));
    ring.position.z = 0.2;
    body.add(shell, lens, ring);
    body.position.copy(pos);
    scene.add(body);
    const pivot = new T.Group();
    pivot.position.copy(pos);
    const len = 4.4;
    const cone = new T.Mesh(new T.ConeGeometry(1.25, len, 40, 1, true), coneMat());
    cone.position.y = -len / 2;
    pivot.add(cone);
    scene.add(pivot);
    return { pos, body, pivot, cone, home: new T.Vector3(qx, 0, qz), phase: i * 1.7, aim: new T.Vector3(qx, 0, qz) };
  });

  /* ---------- camera framing + interaction ---------- */
  const look = new T.Vector3(0.25, 0, 0.5);
  let px = 0, py = 0, tx = 0, ty = 0;
  fig.addEventListener('pointermove', e => {
    const r = fig.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  fig.addEventListener('pointerleave', () => { tx = 0; ty = 0; });

  const resize = () => {
    const w = Math.max(200, canvas.clientWidth || fig.clientWidth - 28);
    const h = Math.round(w * 0.75);
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  new ResizeObserver(() => { resize(); if (reduce) frame(performance.now()); }).observe(fig);
  resize();

  /* ---------- loop ---------- */
  let visible = true, last = performance.now(), t = 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(fig);
  const q = new T.Quaternion(), dirV = new T.Vector3();

  const frame = now => {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!reduce) t += dt;

    // camera orbit: slow sway + pointer parallax
    px += (tx - px) * 0.05; py += (ty - py) * 0.05;
    const ang = 0.62 + Math.sin(t * 0.12) * 0.12 + px * 0.28;
    const rad = 11.9, elev = 12.9 - py * 1.8;
    cam.position.set(Math.sin(ang) * rad, elev, Math.cos(ang) * rad);
    cam.lookAt(look);

    // visitor
    walkAt(t * 0.018);
    person.position.copy(walkTmp);
    if (lookTmp.lengthSq() > 1e-6) person.rotation.y = Math.atan2(lookTmp.x, lookTmp.z);
    person.position.y = Math.abs(Math.sin(t * 9)) * 0.03;
    detBox.position.set(walkTmp.x, 0.43, walkTmp.z);
    detBox.rotation.y = person.rotation.y;
    detBox.material.opacity = 1;

    // cameras: sweep, but lock on to the visitor when close
    cams.forEach(c => {
      const sweep = new T.Vector3(c.home.x + Math.sin(t * 0.5 + c.phase) * 1.6, 0, c.home.z + Math.cos(t * 0.4 + c.phase) * 0.9);
      const dist = c.pos.distanceTo(walkTmp);
      const lock = dist < 4.6 ? 1 : 0;
      const goal = lock ? walkTmp : sweep;
      c.aim.lerp(goal, 0.06);
      dirV.subVectors(c.aim, c.pos).normalize();
      q.setFromUnitVectors(DOWN, dirV);
      c.pivot.quaternion.slerp(q, 0.25);
      c.body.lookAt(c.aim);
      c.cone.material.opacity += ((lock ? 0.3 : 0.16) - c.cone.material.opacity) * 0.08;
    });

    // detectors
    dets.forEach(d => {
      const k = ((t + d.delay) % 3.2) / 3.2;
      const s = 1 + k * 5;
      d.ring.scale.set(s, s, s);
      d.ring.material.opacity = (1 - k) * 0.8;
    });

    // power pulses
    pulses.forEach(p => along(p, t * 0.12 + p.off));
    panelLed.material.color.setHex(Math.sin(t * 6) > 0 ? ORANGE : 0x5a2a08);

    // doors: open for the visitor, or when the console logs a badge event
    Object.values(doors).forEach(d => {
      const near = d.center.distanceTo(walkTmp) < 0.9;
      d.target = near || now < d.until ? 1 : 0;
      d.open += (d.target - d.open) * 0.12;
      d.pivot.rotation.y = d.base - d.open * 1.45;
      d.led.material.color.setHex(d.target ? ORANGE : OK);
    });

    renderer.render(scene, cam);
  };

  const loop = now => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) { last = now; return; }
    frame(now);
  };
  if (reduce) { t = 6; frame(performance.now()); }
  else requestAnimationFrame(loop);
})();
