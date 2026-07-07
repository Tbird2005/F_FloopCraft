// Procedural WebAudio sound effects — no audio files needed
const SFX = (() => {
  let ctx = null;
  let master = null;
  let volumes = { master: 0.70, sfx: 1.00, music: 0.70 };

  function applyMasterVolume() {
    if (master) master.gain.value = Math.max(0, Math.min(1, volumes.master)) * 0.5;
  }

  function setVolumes(v) {
    if (!v) return;
    if (Number.isFinite(+v.master)) volumes.master = Math.max(0, Math.min(1, +v.master));
    if (Number.isFinite(+v.sfx)) volumes.sfx = Math.max(0, Math.min(1, +v.sfx));
    if (Number.isFinite(+v.music)) volumes.music = Math.max(0, Math.min(1, +v.music));
    applyMasterVolume();
  }

  function getVolumes() { return { ...volumes }; }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      applyMasterVolume();
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  }

  function ready() { return ctx && ctx.state === 'running'; }

  function listenerPos() {
    try {
      if (typeof Player !== 'undefined' && Player.body) {
        return { x: Player.body.x, y: (typeof Player.eyeY === 'function' ? Player.eyeY() : Player.body.y + 1.6), z: Player.body.z };
      }
    } catch (e) {}
    return null;
  }

  function sourceXYZ(pos) {
    if (!pos) return null;
    if (Array.isArray(pos)) return { x: +pos[0] || 0, y: +pos[1] || 0, z: +pos[2] || 0 };
    if (typeof pos === 'object') return { x: +pos.x || 0, y: +pos.y || 0, z: +pos.z || 0 };
    return null;
  }

  function spatialize(vol, pos, maxDist) {
    const gain = ctx.createGain();
    const src = sourceXYZ(pos);
    const lis = listenerPos();
    const md = Math.max(4, maxDist || 28);
    let finalVol = (vol || 0.15) * volumes.sfx;
    if (src && lis) {
      const dx = src.x - lis.x, dy = src.y - lis.y, dz = src.z - lis.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const t = Math.max(0, 1 - Math.min(1, dist / md));
      finalVol *= t * t;
      if (finalVol <= 0.0008) return null;
      gain.gain.setValueAtTime(finalVol, ctx.currentTime);
      if (ctx.createStereoPanner && typeof Game !== 'undefined' && Game.camera) {
        const fwd = new THREE.Vector3();
        Game.camera.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() < 0.0001) fwd.set(0, 0, -1); else fwd.normalize();
        const right = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
        const rel = new THREE.Vector3(dx, 0, dz);
        const flat = Math.max(0.001, rel.length());
        const pan = Math.max(-1, Math.min(1, -right.dot(rel) / flat));
        const panner = ctx.createStereoPanner();
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        gain.connect(panner);
        panner.connect(master);
        return gain;
      }
    } else {
      gain.gain.setValueAtTime(finalVol, ctx.currentTime);
    }
    gain.connect(master);
    return gain;
  }

  function tone(freq, dur, type, vol, slide, pos, maxDist) {
    if (!ready()) return;
    const o = ctx.createOscillator();
    const out = spatialize(vol || 0.15, pos, maxDist);
    if (!out) return;
    o.type = type || 'square';
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    out.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(out);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function noise(dur, filterFreq, vol, slideTo, pos, maxDist) {
    if (!ready()) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + dur);
    const out = spatialize(vol || 0.2, pos, maxDist);
    if (!out) return;
    out.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(out);
    src.start();
  }

  return {
    init, ready, setVolumes, getVolumes,
    dig()      { noise(0.09, 900, 0.22); },
    breakBlk() { noise(0.16, 1400, 0.3, 300); },
    place()    { noise(0.07, 700, 0.2); tone(180, 0.06, 'square', 0.06); },
    pop()      { tone(520, 0.09, 'square', 0.12, 420); },
    hurt(pos)  { tone(160, 0.18, 'sawtooth', 0.2, -70, pos, 24); },
    mobHurt(pos) { tone(220, 0.14, 'square', 0.12, -90, pos, 34); },
    boom(pos)  { noise(0.9, 900, 0.6, 60, pos, 70); tone(60, 0.5, 'sine', 0.4, -30, pos, 70); },
    hiss(pos)  { noise(1.4, 3500, 0.14, 5500, pos, 26); },
    arrow(pos) { noise(0.12, 3000, 0.1, 800, pos, 34); },
    eat()      { noise(0.08, 600, 0.15); setTimeout(() => noise(0.08, 500, 0.15), 120); setTimeout(() => noise(0.1, 450, 0.15), 260); },
    splash(pos){ noise(0.3, 1100, 0.25, 250, pos, 30); },
    click()    { tone(700, 0.04, 'square', 0.08); },
    craft()    { tone(300, 0.08, 'square', 0.1); setTimeout(() => tone(450, 0.08, 'square', 0.1), 80); },
    win()      { [440, 550, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.15, 'square', 0.12), i * 110)); },
    lose()     { tone(300, 0.2, 'sawtooth', 0.1, -120); setTimeout(() => tone(200, 0.3, 'sawtooth', 0.1, -80), 180); },
    spinTick() { tone(900, 0.03, 'square', 0.04); },
    floop(pos) {
      // Mr Floop's silly two-tone alien voice
      const f1 = 250 + Math.random() * 250;
      tone(f1, 0.12, 'square', 0.09, 120, pos, 34);
      setTimeout(() => tone(f1 * 1.4, 0.14, 'square', 0.09, -80, pos, 34), 130);
      setTimeout(() => tone(f1 * 0.8, 0.1, 'square', 0.07, 60, pos, 34), 290);
    },
    xp(pos)    { tone(880, 0.08, 'sine', 0.1, 200, pos, 28); },
    starImpact(pos) {
      noise(0.22, 1800, 0.24, 450, pos, 46);
      tone(980, 0.16, 'sine', 0.13, -420, pos, 46);
      setTimeout(() => tone(1480, 0.11, 'triangle', 0.08, -300, pos, 46), 75);
    },
    levelUp()  { [660, 880, 1100].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'sine', 0.12), i * 90)); },
    gunshot(gunId, pos) {
      if (gunId === (typeof I !== 'undefined' && I.FLOOP_RAY) || gunId === (typeof I !== 'undefined' && I.PATAPIM_BEAM)) {
        tone(1400, 0.18, 'sawtooth', 0.12, -900, pos, 75); tone(700, 0.22, 'square', 0.06, -300, pos, 75);
      } else if (gunId === (typeof I !== 'undefined' && I.SHOTGUN)) {
        noise(0.25, 1600, 0.4, 200, pos, 75);
      } else if (gunId === (typeof I !== 'undefined' && I.RIFLE)) {
        noise(0.18, 2400, 0.35, 300, pos, 75); tone(180, 0.1, 'square', 0.1, -60, pos, 75);
      } else {
        noise(0.09, 2200, 0.28, 400, pos, 75);
      }
    },
    rocketLaunch(pos) { noise(0.4, 800, 0.3, 2500, pos, 75); },
    // bright metallic "sheen" for hitting an invincible/creative player
    shielded(pos) { tone(1200, 0.14, 'sine', 0.12, 900, pos, 30); setTimeout(() => tone(1900, 0.10, 'triangle', 0.08, 600, pos, 30), 55); },
    doorSound(pos){ noise(0.09, 500, 0.2, null, pos, 18); tone(140, 0.1, 'square', 0.08, 40, pos, 18); },
    sleep()    { [520, 390, 260].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.08), i * 250)); },
    furnace()  { noise(0.15, 400, 0.12); },
    sheep(pos) { tone(430, 0.25, 'sawtooth', 0.1, -60, pos, 28); setTimeout(() => tone(410, 0.2, 'sawtooth', 0.08, -40, pos, 28), 260); },
    cash()     { [880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'square', 0.1), i * 90)); },
    screech(pos){ tone(1800, 0.7, 'sawtooth', 0.16, -1200, pos, 45); noise(0.6, 4000, 0.12, 800, pos, 45); },
    tung(pos) {
      [0, 160, 320].forEach(d => setTimeout(() => { tone(90, 0.14, 'square', 0.22, -20, pos, 34); noise(0.08, 300, 0.18, null, pos, 34); }, d));
    },
  };
})();
