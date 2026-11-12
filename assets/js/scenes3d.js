/* LumaGuard — small live 3D scenes for the service cards and the access section.
   <div data-scene="fire|keypad|entry"> … <img fallback> </div>
   Requires THREE (r128 classic). If WebGL is unavailable the <img> fallback stays. */
(() => {
  if (!window.THREE) return;
  const T = window.THREE;
  const hosts = [...document.querySelectorAll('[data-scene]')];
  if (!hosts.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fixedT = parseFloat(new URLSearchParams(location.search).get('scene-t')); // freeze a moment (screenshots)
  const ORANGE = 0xf28a25, RED = 0xff3b30, GREEN = 0x57d18a;
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const SANS = 'Archivo, "Helvetica Neue", Arial, sans-serif';

  /* ---------------- helpers ---------------- */
  const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.6, metalness: 0.05 }, o));

  function rbox(w, h, d, r, mat) {
    const s = new T.Shape(), x0 = -w / 2, y0 = -h / 2, x1 = w / 2, y1 = h / 2;
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    const bev = Math.min(r * 0.6, d * 0.3);
    const g = new T.ExtrudeGeometry(s, { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.7, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(d - 2 * bev) / 2);
    const m = new T.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function ctex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding; tex.anisotropy = 4;
    const api = { tex, key: null, draw(state) { g.clearRect(0, 0, w, h); draw(g, w, h, state); tex.needsUpdate = true; } };
    api.draw();
    return api;
  }

  function face(w, h, tex, z, emissive = false) {
    const mat = emissive
      ? new T.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
      : new T.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55 });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    m.position.z = z;
    return m;
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function rod(a, b, r, mat) {
    const A = new T.Vector3(...a), B = new T.Vector3(...b), len = A.distanceTo(B);
    const m = new T.Mesh(new T.CylinderGeometry(r, r, len, 10), mat);
    m.position.copy(A).add(B).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize());
    m.castShadow = true;
    return m;
  }

  // fires timeline events whose time is crossed (handles the loop wrap)
  function timeline(period, events) {
    let prev = -1;
    return t => {
      const tt = t % period;
      if (tt < prev) { events.forEach(e => e[0] > prev && e[1](e[0], period + tt)); prev = -1; }
      events.forEach(e => e[0] > prev && e[0] <= tt && e[1](e[0], tt));
      prev = tt;
      return tt;
    };
  }

  const smokeTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  })();

  function room(scene, { wall = 0x24242a, floor = true, ceiling = false } = {}) {
    const w = new T.Mesh(new T.PlaneGeometry(14, 8), std(wall, { roughness: 0.92 }));
    w.position.set(0, 1.5, 0); w.receiveShadow = true; scene.add(w);
    if (floor) {
      const f = new T.Mesh(new T.PlaneGeometry(14, 8), std(0x17171b, { roughness: 0.85 }));
      f.rotation.x = -Math.PI / 2; f.position.set(0, -0.45, 3.9); f.receiveShadow = true; scene.add(f);
    }
    if (ceiling) {
      const c = new T.Mesh(new T.PlaneGeometry(14, 8), std(0x2c2c33, { roughness: 0.95 }));
      c.rotation.x = Math.PI / 2; c.position.set(0, 2.45, 3.9); c.receiveShadow = true; scene.add(c);
    }
  }

  function lights(scene, keyPos = [-3, 5, 5]) {
    scene.add(new T.HemisphereLight(0xffffff, 0x221418, 0.42));
    const key = new T.DirectionalLight(0xfff0e0, 0.85);
    key.position.set(...keyPos); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4; key.shadow.bias = -0.0008;
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 20 });
    scene.add(key);
    const rim = new T.PointLight(ORANGE, 0.9, 9, 2); rim.position.set(3, 2.2, 2.4); scene.add(rim);
  }

  /* ---------------- security keypad (shared by "keypad" and "entry") ---------------- */
  function makeKeypad() {
    const G = new T.Group();
    const W = 1.25, H = 1.98;
    const shell = rbox(W, H, 0.14, 0.09, std(0xeceae5, { roughness: 0.42 }));
    shell.position.z = 0.07; G.add(shell);
    const front = 0.142;

    // screen
    const scr = ctex(640, 300, drawScreen);
    const bezel = rbox(1.08, 0.56, 0.02, 0.04, std(0x0c0d10, { roughness: 0.25, metalness: 0.3 }));
    bezel.position.set(0, 0.62, front); G.add(bezel);
    const screen = face(1.0, 0.47, scr.tex, front + 0.012, true);
    screen.position.y = 0.62; G.add(screen);
    const glass = new T.Mesh(new T.PlaneGeometry(1.0, 0.47), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.9 }));
    glass.position.set(0, 0.62, front + 0.014); G.add(glass);

    // status LEDs
    const leds = {};
    [['armed', -0.42], ['ready', -0.3], ['power', -0.18]].forEach(([k, x]) => {
      const m = new T.Mesh(new T.SphereGeometry(0.018, 12, 8), new T.MeshBasicMaterial({ color: 0x333333 }));
      m.position.set(x, 0.94, front); G.add(m); leds[k] = m;
    });
    leds.power.material.color.setHex(GREEN);

    // keys
    const labels = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', ''], ['#', '']];
    const keys = {};
    const mk = (id, txt, sub, x, y, w, accent) => {
      const k = new T.Group();
      const mat = std(accent ? ORANGE : 0xd9d6cf, { roughness: 0.5, emissive: new T.Color(ORANGE), emissiveIntensity: 0 });
      const cap = rbox(w, 0.15, 0.05, 0.035, mat); k.add(cap);
      const t = ctex(256, 128, g => {
        g.fillStyle = accent ? '#1a0d02' : '#22242a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (sub !== null) {
          g.font = `700 ${sub ? 64 : 72}px ${SANS}`; g.fillText(txt, 128, sub ? 50 : 64);
          if (sub) { g.font = `600 26px ${MONO}`; g.fillStyle = accent ? '#3a1a04' : '#6b6c72'; g.fillText(sub, 128, 100); }
        }
      });
      const lab = face(w * 0.92, 0.14, t.tex, 0.027); k.add(lab);
      k.position.set(x, y, front + 0.01);
      k.userData = { z: k.position.z, mat, pressed: -9 };
      G.add(k); keys[id] = k;
    };
    labels.forEach(([n, s], i) => mk(n, n, s, (i % 3 - 1) * 0.33, 0.18 - Math.floor(i / 3) * 0.2, 0.29));
    [['AWAY', -0.33, true], ['STAY', 0, false], ['OFF', 0.33, false]].forEach(([n, x, a]) => mk(n, n, '', x, -0.68, 0.29, a));

    // brand label
    const brand = ctex(512, 64, g => {
      g.fillStyle = '#8b8a86'; g.font = `600 30px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('LUMAGUARD  SECURE', 256, 34);
    });
    const b = face(0.7, 0.088, brand.tex, front + 0.002); b.position.y = -0.88; G.add(b);

    const press = (id, t) => { if (keys[id]) keys[id].userData.pressed = t; };
    const update = t => Object.values(keys).forEach(k => {
      const p = Math.max(0, 1 - (t - k.userData.pressed) / 0.32);
      k.position.z = k.userData.z - 0.022 * Math.sin(Math.min(1, p) * Math.PI / 2);
      k.userData.mat.emissiveIntensity = p * 0.85;
    });
    const set = s => { const key = JSON.stringify(s); if (key !== scr.key) { scr.key = key; scr.draw(s); } };
    set({ title: 'DISARMED', sub: 'Ready to arm', color: '#57d18a' });
    return { group: G, press, update, set, leds };
  }

  function drawScreen(g, w, h, s) {
    if (!s) return;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#141820'); bg.addColorStop(1, '#0a0c10');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // status bar
    g.fillStyle = '#6f7480'; g.font = `600 22px ${MONO}`; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillText('LUMAGUARD', 28, 30);
    g.textAlign = 'right'; g.fillText(s.clock || '08:42', w - 28, 30);
    g.strokeStyle = '#232833'; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 54); g.lineTo(w - 24, 54); g.stroke();
    // icon
    const cx = 92, cy = 150;
    g.fillStyle = s.color; g.globalAlpha = 0.15; g.beginPath(); g.arc(cx, cy, 58, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = s.color; g.lineWidth = 7; g.lineCap = 'round';
    if (s.icon === 'lock' || s.icon === 'unlock') {
      g.beginPath(); g.moveTo(cx - 18, cy); g.lineTo(cx - 18, cy - 14);
      if (s.icon === 'lock') { g.arc(cx, cy - 14, 18, Math.PI, 0); g.lineTo(cx + 18, cy); } else { g.arc(cx, cy - 14, 18, Math.PI, Math.PI * 1.85); }
      g.stroke();
      g.fillStyle = s.color; rr(g, cx - 28, cy - 2, 56, 42, 8); g.fill();
    } else if (s.icon === 'key') {
      g.beginPath(); g.arc(cx - 14, cy, 16, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx + 2, cy); g.lineTo(cx + 34, cy); g.moveTo(cx + 24, cy); g.lineTo(cx + 24, cy + 14); g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx, cy - 34); g.lineTo(cx + 30, cy - 22); g.lineTo(cx + 30, cy + 2);
      g.quadraticCurveTo(cx + 28, cy + 26, cx, cy + 38); g.quadraticCurveTo(cx - 28, cy + 26, cx - 30, cy + 2);
      g.lineTo(cx - 30, cy - 22); g.closePath(); g.stroke();
      g.beginPath(); g.moveTo(cx - 12, cy + 2); g.lineTo(cx - 2, cy + 12); g.lineTo(cx + 14, cy - 8); g.stroke();
    }
    // text
    g.textAlign = 'left'; g.fillStyle = s.color; g.font = `800 54px ${SANS}`; g.fillText(s.title, 176, 128);
    g.fillStyle = '#c9ccd4'; g.font = `500 26px ${MONO}`; g.fillText(s.sub || '', 178, 182);
    if (s.dots != null) {
      for (let i = 0; i < 4; i++) {
        g.beginPath(); g.arc(196 + i * 46, 232, 13, 0, Math.PI * 2);
        if (i < s.dots) { g.fillStyle = '#f28a25'; g.fill(); } else { g.strokeStyle = '#4a505c'; g.lineWidth = 3; g.stroke(); }
      }
    } else {
      g.font = `600 21px ${MONO}`;
      (s.chips || ['DOORS', 'WINDOWS', 'MOTION', 'SMOKE']).forEach((c, i) => {
        const x = 178 + i * 106;
        g.fillStyle = '#1c212b'; rr(g, x, 214, 98, 38, 8); g.fill();
        g.fillStyle = s.chipColor || '#8fd9ad'; g.textAlign = 'center'; g.fillText(c, x + 49, 234); g.textAlign = 'left';
      });
    }
  }

  /* ---------------- scene: fire alarm ---------------- */
  function buildFire(scene) {
    room(scene, { ceiling: true, wall: 0x18181c });
    lights(scene, [-3, 6, 6]);
    const redMat = std(0xb01e26, { roughness: 0.4, metalness: 0.15 });

    // control panel
    const panel = new T.Group(); panel.position.set(-1.0, 1.15, 0); scene.add(panel);
    const cab = rbox(1.05, 1.4, 0.24, 0.05, redMat); cab.position.z = 0.12; panel.add(cab);
    const pf = ctex(512, 682, drawPanel);
    const pface = face(0.94, 1.25, pf.tex, 0.245); panel.add(pface);
    const alarmLed = new T.PointLight(RED, 0, 1.6, 2); alarmLed.position.set(0, 0.2, 0.5); panel.add(alarmLed);

    // conduit
    const cMat = std(0x8d8c88, { roughness: 0.35, metalness: 0.7 });
    [[[-1.0, 1.86, 0.06], [-1.0, 2.4, 0.06]], [[-1.0, 2.4, 0.06], [-1.0, 2.4, 0.95]], [[-1.0, 2.4, 0.95], [0.75, 2.4, 0.95]],
     [[-0.48, 1.6, 0.06], [0.62, 1.6, 0.06]], [[0.62, 1.6, 0.06], [0.62, 1.42, 0.06]]]
      .forEach(([a, b]) => scene.add(rod(a, b, 0.018, cMat)));

    // horn / strobe
    const hs = new T.Group(); hs.position.set(0.62, 1.15, 0); scene.add(hs);
    const hsBody = rbox(0.4, 0.52, 0.13, 0.04, redMat); hsBody.position.z = 0.065; hs.add(hsBody);
    const hsT = ctex(256, 332, g => {
      g.fillStyle = 'rgba(0,0,0,.28)';
      for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) { g.beginPath(); g.arc(46 + x * 27, 196 + y * 22, 5, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = `800 64px ${SANS}`; g.textAlign = 'center'; g.fillText('FIRE', 128, 160);
    });
    hs.add(face(0.38, 0.49, hsT.tex, 0.132));
    const lensMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.05, transparent: true, opacity: 0.9, roughness: 0.15 });
    const lens = rbox(0.2, 0.1, 0.07, 0.025, lensMat); lens.position.set(0, 0.17, 0.15); hs.add(lens);
    const strobe = new T.PointLight(0xffffff, 0, 5, 1.6); strobe.position.set(0, 0.2, 0.5); hs.add(strobe);

    // pull station
    const ps = new T.Group(); ps.position.set(0.62, 0.38, 0); scene.add(ps);
    const psBody = rbox(0.34, 0.46, 0.1, 0.03, redMat); psBody.position.z = 0.05; ps.add(psBody);
    const psT = ctex(256, 346, g => {
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 58px ${SANS}`; g.fillText('FIRE', 128, 76);
      g.font = `700 26px ${MONO}`; g.fillText('PULL DOWN', 128, 300);
    });
    ps.add(face(0.32, 0.44, psT.tex, 0.102));
    const handle = rbox(0.22, 0.07, 0.06, 0.02, std(0xf4f2ee, { roughness: 0.35 })); handle.position.set(0, 0.0, 0.13); ps.add(handle);

    // smoke detector (ceiling)
    const det = new T.Group(); det.position.set(0.95, 2.45, 1.05); scene.add(det);
    const dBase = new T.Mesh(new T.CylinderGeometry(0.2, 0.22, 0.05, 32), std(0xf2f1ed, { roughness: 0.4 })); dBase.position.y = -0.025; det.add(dBase);
    const dDome = new T.Mesh(new T.CylinderGeometry(0.14, 0.19, 0.06, 32), std(0xe6e4df, { roughness: 0.45 })); dDome.position.y = -0.08; det.add(dDome);
    const vents = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.03, 32, 1, true), std(0x9c9a95)); vents.position.y = -0.065; det.add(vents);
    const dLed = new T.Mesh(new T.SphereGeometry(0.02, 10, 8), new T.MeshBasicMaterial({ color: 0x3a1010 })); dLed.position.set(0.1, -0.11, 0.06); det.add(dLed);
    const ring = new T.Mesh(new T.RingGeometry(0.22, 0.25, 48), new T.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.12; det.add(ring);

    // smoke particles
    const smoke = [];
    for (let i = 0; i < 46; i++) {
      const sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: 0xc9c4bd, transparent: true, opacity: 0, depthWrite: false }));
      sp.userData = { life: 2.6 + Math.random() * 1.6, off: Math.random() * 4, x: 0.3 + Math.random() * 1.6, z: 0.9 + Math.random() * 1.2 };
      scene.add(sp); smoke.push(sp);
    }

    let state = 'normal', smokeLvl = 0, alarmAt = 0;
    const tl = timeline(15, [
      [0, () => { state = 'normal'; }],
      [3.2, () => { state = 'smoke'; }],
      [6.4, () => { state = 'alarm'; }],
      [11.2, () => { state = 'silenced'; }],
      [13.2, () => { state = 'normal'; }],
    ]);

    return {
      cam: { pos: [1.7, 1.1, 4.6], look: [-0.1, 1.3, 0.45], fov: 36, box: [4.1, 3.2] },
      update(t) {
        const tt = tl(t);
        const alarm = state === 'alarm';
        const smokeGoal = state === 'smoke' || alarm ? 1 : 0;
        smokeLvl += (smokeGoal - smokeLvl) * (smokeGoal ? 0.02 : 0.03);
        smoke.forEach(sp => {
          const u = sp.userData, a = ((t + u.off) % u.life) / u.life;
          const tx = 0.95, tz = 1.05;
          sp.position.set(u.x + (tx - u.x) * a * a, -0.3 + a * 2.6, u.z + (tz - u.z) * a * a);
          const s = 0.35 + a * 0.9; sp.scale.set(s, s, s);
          sp.material.opacity = smokeLvl * Math.sin(Math.PI * a) * 0.26;
        });
        const blink = Math.floor(t * 2.4) % 2 === 0;
        const flash = alarm && (tt * 1.15) % 1 < 0.09;
        strobe.intensity = flash ? 4.2 : 0;
        lensMat.emissiveIntensity = flash ? 3 : 0.05;
        alarmLed.intensity = alarm && blink ? 1.4 : 0;
        dLed.material.color.setHex(alarm ? (blink ? RED : 0x3a1010) : (Math.floor(t) % 4 === 0 && (t % 1) < 0.12 ? GREEN : 0x1a3020));
        if (alarm) {
          const k = ((t - alarmAt) % 1.2) / 1.2;
          ring.scale.setScalar(1 + k * 4); ring.material.opacity = (1 - k) * 0.85;
        } else { ring.material.opacity = 0; alarmAt = t; }
        const key = JSON.stringify([state, alarm && blink]);
        if (key !== pf.key) { pf.key = key; pf.draw({ state, blink }); }
      },
    };
  }

  function drawPanel(g, w, h, s) {
    s = s || { state: 'normal', blink: false };
    g.fillStyle = '#9c1a21'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 54px ${SANS}`; g.fillText('FIRE ALARM', w / 2, 66);
    g.font = `600 20px ${MONO}`; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText('CONTROL PANEL · 4 ZONES', w / 2, 106);
    // LCD
    const alarm = s.state === 'alarm', sil = s.state === 'silenced';
    g.fillStyle = '#111'; rr(g, 34, 132, w - 68, 168, 12); g.fill();
    g.fillStyle = alarm ? '#2b0707' : sil ? '#2a1a06' : '#0b1d14'; rr(g, 44, 142, w - 88, 148, 8); g.fill();
    g.textAlign = 'left'; g.font = `700 34px ${MONO}`;
    const lines = alarm ? [['FIRE ALARM', s.blink ? '#ff5a4f' : '#7a1d18'], ['ZONE 2 · SMOKE DET', '#ffb3ad'], ['LOBBY CEILING', '#ffb3ad']]
      : sil ? [['ALARM SILENCED', '#ffb066'], ['FIRE DEPT NOTIFIED', '#ffd2a6'], ['RESET PENDING', '#ffd2a6']]
      : s.state === 'smoke' ? [['SYSTEM NORMAL', '#7cffb2'], ['ZONE 2 · ANALOG 38%', '#b9f5d2'], ['MONITORING', '#b9f5d2']]
      : [['SYSTEM NORMAL', '#7cffb2'], ['4 ZONES · 0 TROUBLE', '#b9f5d2'], ['AC POWER OK', '#b9f5d2']];
    lines.forEach(([t, c], i) => { g.fillStyle = c; g.font = `700 ${i ? 24 : 34}px ${MONO}`; g.fillText(t, 64, 178 + i * 44); });
    // LEDs
    const leds = [['AC POWER', '#57d18a', true], ['FIRE ALARM', '#ff3b30', alarm && s.blink], ['SUPERVISORY', '#ffb020', false], ['TROUBLE', '#ffb020', false], ['SILENCED', '#ffb020', sil]];
    leds.forEach(([t, c, on], i) => {
      const y = 342 + i * 42;
      g.fillStyle = on ? c : 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(70, y, 12, 0, 7); g.fill();
      if (on) { g.fillStyle = c; g.globalAlpha = .35; g.beginPath(); g.arc(70, y, 22, 0, 7); g.fill(); g.globalAlpha = 1; }
      g.fillStyle = '#fff'; g.font = `600 22px ${MONO}`; g.fillText(t, 98, y + 1);
    });
    // buttons
    ['ACK', 'SILENCE', 'RESET', 'DRILL'].forEach((t, i) => {
      const x = 34 + i * 113;
      g.fillStyle = 'rgba(0,0,0,.4)'; rr(g, x, 572, 104, 54, 10); g.fill();
      g.fillStyle = '#f4e9e9'; g.font = `700 19px ${MONO}`; g.textAlign = 'center'; g.fillText(t, x + 52, 600); g.textAlign = 'left';
    });
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(w - 70, 370, 22, 0, 7); g.fill();
    g.fillStyle = '#d8c9a0'; g.beginPath(); g.arc(w - 70, 370, 12, 0, 7); g.fill();
  }

  /* ---------------- scene: arm / disarm keypad ---------------- */
  function buildKeypad(scene) {
    room(scene, { floor: false, wall: 0x18181c });
    lights(scene, [-3, 5, 6]);
    const kp = makeKeypad();
    kp.group.position.set(0, 1.2, 0); scene.add(kp.group);
    // wall plate shadow-catcher + small motion sensor & door contact for context
    const sensor = rbox(0.28, 0.4, 0.14, 0.06, std(0xeceae5, { roughness: 0.4 }));
    sensor.position.set(1.35, 2.35, 0.07); scene.add(sensor);
    const lensM = new T.Mesh(new T.SphereGeometry(0.08, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd9d4c8, { roughness: 0.2, transparent: true, opacity: 0.85 }));
    lensM.rotation.x = Math.PI / 2; lensM.position.set(1.35, 2.3, 0.14); scene.add(lensM);
    const sLed = new T.Mesh(new T.SphereGeometry(0.014, 8, 6), new T.MeshBasicMaterial({ color: 0x331111 }));
    sLed.position.set(1.35, 2.48, 0.145); scene.add(sLed);

    const code = ['1', '9', '7', '4'];
    let st = 'off', dots = 0, armT = 0;
    const S = {
      off: () => ({ title: 'DISARMED', sub: 'Ready to arm · all closed', color: '#57d18a', icon: 'shield', chips: ['DOORS', 'WINDOWS', 'MOTION', 'SMOKE'] }),
      code: d => ({ title: 'ENTER CODE', sub: st === 'armed-code' ? 'to disarm the system' : 'to arm the system', color: '#f28a25', icon: 'key', dots: d }),
      arming: n => ({ title: 'ARMING AWAY', sub: `Exit delay · ${n}s`, color: '#f28a25', icon: 'lock', chips: ['DOORS', 'WINDOWS', 'MOTION', 'SMOKE'], chipColor: '#ffc58a' }),
      armed: () => ({ title: 'ARMED AWAY', sub: '16 zones secured', color: '#ff5a4f', icon: 'lock', chips: ['DOORS', 'WINDOWS', 'MOTION', 'CAMS'], chipColor: '#ffb3ad' }),
      welcome: () => ({ title: 'DISARMED', sub: 'Welcome back', color: '#57d18a', icon: 'unlock', chips: ['DOORS', 'WINDOWS', 'MOTION', 'SMOKE'] }),
    };
    const ev = [[0, () => { st = 'off'; dots = 0; }]];
    code.forEach((k, i) => ev.push([2.2 + i * 0.45, at => { st = 'code'; dots = i + 1; kp.press(k, at); }]));
    ev.push([4.3, at => { kp.press('AWAY', at); st = 'arming'; armT = at; }]);
    ev.push([7.4, () => { st = 'armed'; }]);
    code.forEach((k, i) => ev.push([11 + i * 0.45, at => { st = 'armed-code'; dots = i + 1; kp.press(k, at); }]));
    ev.push([13.1, at => { kp.press('OFF', at); st = 'welcome'; }]);
    let now = 0;
    // event time -> absolute time it happened (keeps key glow/countdown right in frozen frames)
    const tl = timeline(16, ev.map(([tm, fn]) => [tm, (et, tt) => fn(now - (tt - et))]));

    return {
      cam: { pos: [1.15, 1.05, 4.1], look: [0.12, 1.32, 0], fov: 30, box: [2.7, 2.5] },
      update(t) {
        now = t; tl(t); kp.update(t);
        const blink = Math.floor(t * 2) % 2 === 0;
        const armed = st === 'armed' || st === 'armed-code';
        kp.leds.armed.material.color.setHex(armed || (st === 'arming' && blink) ? RED : 0x3a1414);
        kp.leds.ready.material.color.setHex(!armed && st !== 'arming' ? GREEN : 0x14301e);
        sLed.material.color.setHex(armed && (t % 2.4) < 0.15 ? RED : 0x331111);
        if (st === 'off') kp.set(S.off());
        else if (st === 'code' || st === 'armed-code') kp.set(S.code(dots));
        else if (st === 'arming') kp.set(S.arming(Math.max(0, 30 - Math.floor((t - armT) / 3.1 * 30))));
        else if (st === 'armed') kp.set(S.armed());
        else kp.set(S.welcome());
      },
    };
  }

  /* ---------------- scene: keypad at a door ---------------- */
  function buildEntry(scene) {
    lights(scene, [-2.5, 5, 6]);
    const wallMat = std(0x18181c, { roughness: 0.92 });
    const DW = 1.1, DH = 2.15, dx = -0.35;
    const wallPart = (w, h, x, y) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 0.2), wallMat); m.position.set(x, y, -0.1); m.receiveShadow = true; m.castShadow = true; scene.add(m); };
    wallPart(6, 6, dx - DW / 2 - 3, 1.5);           // left
    wallPart(6, 6, dx + DW / 2 + 3, 1.5);           // right
    wallPart(DW, 3, dx, DH - 0.45 + 1.5);           // above
    const floor = new T.Mesh(new T.PlaneGeometry(14, 10), std(0x17171b, { roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.45, 0); floor.receiveShadow = true; scene.add(floor);

    // warm room behind the door
    const inside = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ color: 0x5a3714 }));
    inside.position.set(dx, 1, -2.2); scene.add(inside);
    const glow = new T.PointLight(0xffb066, 0, 4, 2); glow.position.set(dx, 1.2, -0.9); scene.add(glow);

    // frame
    const fMat = std(0x55555c, { roughness: 0.35, metalness: 0.7 });
    const fy = -0.45 + DH / 2;
    [[0.06, DH, dx - DW / 2 + 0.03, fy], [0.06, DH, dx + DW / 2 - 0.03, fy], [DW, 0.06, dx, -0.45 + DH - 0.03]].forEach(([w, h, x, y]) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, 0.24), fMat); m.position.set(x, y, 0); m.castShadow = true; scene.add(m);
    });
    // door leaf on a hinge (left)
    const hinge = new T.Group(); hinge.position.set(dx - DW / 2 + 0.06, -0.45, -0.02); scene.add(hinge);
    const LW = DW - 0.12, LH = DH - 0.08;
    const leaf = new T.Group(); leaf.position.x = LW / 2; hinge.add(leaf);
    const lMat = std(0x34343b, { roughness: 0.4, metalness: 0.6 });
    [[LW, 0.12, LH - 0.06], [LW, 0.12, 0.06], [0.1, LH, LH / 2], [0.1, LH, LH / 2]].forEach(([w, h, y], i) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, 0.05), lMat);
      m.position.set(i === 2 ? -LW / 2 + 0.05 : i === 3 ? LW / 2 - 0.05 : 0, y, 0); m.castShadow = true; leaf.add(m);
    });
    const glass = new T.Mesh(new T.PlaneGeometry(LW - 0.2, LH - 0.18), new T.MeshStandardMaterial({ color: 0x8fa3b8, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.9 }));
    glass.position.set(0, LH / 2, 0); leaf.add(glass);
    const bar = rod([-LW / 2 + 0.2, 1.05, 0.08], [LW / 2 - 0.12, 1.05, 0.08], 0.02, std(0xb9b9be, { metalness: 0.9, roughness: 0.25 }));
    leaf.add(bar);
    // mag lock
    const mag = new T.Mesh(new T.BoxGeometry(0.42, 0.08, 0.1), std(0x9a9aa0, { metalness: 0.7, roughness: 0.3 }));
    mag.position.set(dx + DW / 2 - 0.3, -0.45 + DH - 0.1, 0.07); scene.add(mag);
    const magLed = new T.Mesh(new T.SphereGeometry(0.016, 8, 6), new T.MeshBasicMaterial({ color: RED }));
    magLed.position.set(dx + DW / 2 - 0.12, -0.45 + DH - 0.1, 0.125); scene.add(magLed);

    // keypad beside the door
    const kp = makeKeypad();
    kp.group.scale.setScalar(0.44); kp.group.position.set(dx + DW / 2 + 0.46, 1.0, 0); scene.add(kp.group);

    const code = ['2', '5', '8', '0'];
    let st = 'locked', dots = 0, open = 0;
    let now = 0;
    const ev = [[0, () => { st = 'locked'; dots = 0; }]];
    code.forEach((k, i) => ev.push([1.6 + i * 0.4, (et, tt) => { st = 'code'; dots = i + 1; kp.press(k, now - (tt - et)); }]));
    ev.push([3.3, (et, tt) => { kp.press('#', now - (tt - et)); st = 'granted'; }]);
    ev.push([7.6, () => { st = 'locked'; }]);
    const tl = timeline(10, ev);

    return {
      cam: { pos: [1.9, 1.35, 4.3], look: [0.2, 0.75, 0], fov: 36, box: [2.7, 2.75] },
      update(t) {
        now = t; tl(t); kp.update(t);
        const goal = st === 'granted' ? 1 : 0;
        open += (goal - open) * (goal ? 0.05 : 0.07);
        hinge.rotation.y = open * 1.3; // swings inward, away from the viewer
        glow.intensity = open * 2.2;
        magLed.material.color.setHex(st === 'granted' ? GREEN : RED);
        kp.leds.ready.material.color.setHex(st === 'granted' ? GREEN : 0x14301e);
        kp.leds.armed.material.color.setHex(st !== 'granted' ? 0xff6a5f : 0x3a1414);
        if (st === 'locked') kp.set({ title: 'LOCKED', sub: 'Enter PIN to open', color: '#ff5a4f', icon: 'lock', chips: ['FRONT', 'REAR', 'GATE', 'SUITE'], chipColor: '#ffb3ad' });
        else if (st === 'code') kp.set({ title: 'ENTER PIN', sub: 'Front entrance', color: '#f28a25', icon: 'key', dots });
        else kp.set({ title: 'GRANTED', sub: 'Welcome, Maria · 08:42', color: '#57d18a', icon: 'unlock', chips: ['FRONT', 'REAR', 'GATE', 'SUITE'] });
      },
    };
  }

  const builders = { fire: buildFire, keypad: buildKeypad, entry: buildEntry };

  /* ---------------- mount ---------------- */
  function mount(host) {
    const build = builders[host.dataset.scene];
    if (!build) return;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (_) { return; }
    if (!renderer.getContext()) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.className = 'scene3d'; canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    host.classList.add('has-3d');

    const scene = new T.Scene();
    const api = build(scene);
    const c = api.cam;
    const cam = new T.PerspectiveCamera(c.fov, 1, 0.1, 60);
    const look = new T.Vector3(...c.look), base = new T.Vector3(...c.pos), dir = base.clone().sub(look).normalize();
    let dist = base.distanceTo(look);
    const px = { x: 0, y: 0, tx: 0, ty: 0 };

    const fit = () => {
      const w = host.clientWidth || 1, h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      const tan = Math.tan(T.MathUtils.degToRad(c.fov / 2));
      dist = Math.max(c.box[1] / 2 / tan, c.box[0] / 2 / (tan * cam.aspect));
      cam.updateProjectionMatrix();
    };
    fit();
    if ('ResizeObserver' in window) new ResizeObserver(() => { fit(); if (reduce || !visible) draw(); }).observe(host);

    host.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      px.tx = (e.clientX - r.left) / r.width - 0.5; px.ty = (e.clientY - r.top) / r.height - 0.5;
    });
    host.addEventListener('pointerleave', () => { px.tx = 0; px.ty = 0; });

    let visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { rootMargin: '120px' }).observe(host);

    const t0 = performance.now();
    const tmp = new T.Vector3();
    function draw(t = !isNaN(fixedT) ? fixedT : reduce ? 9 : (performance.now() - t0) / 1000) {
      px.x += (px.tx - px.x) * 0.06; px.y += (px.ty - px.y) * 0.06;
      tmp.copy(dir).multiplyScalar(dist);
      tmp.applyAxisAngle(new T.Vector3(0, 1, 0), -px.x * 0.28);
      cam.position.copy(look).add(tmp); cam.position.y += -px.y * 0.5;
      cam.lookAt(look);
      api.update(t);
      renderer.render(scene, cam);
    }
    const loop = () => { requestAnimationFrame(loop); if (visible && !document.hidden) draw(); };
    if (reduce) draw(); else loop();
  }

  const go = () => hosts.forEach(h => { try { mount(h); } catch (e) { console.warn('scene3d', e); } });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(go);
})();
