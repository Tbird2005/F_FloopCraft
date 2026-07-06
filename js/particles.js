// ============================================================
// F_Floop Craft — tiny particle bursts (block breaks, explosions)
// ============================================================
const Particles = {
  list: [],
  scene: null,

  init(scene) { this.scene = scene; },

  sampleLight(x, y, z, minLight) {
    minLight = minLight == null ? 0.10 : minLight;
    if (typeof World === 'undefined' || !World || !World.getLightRaw) return 1;
    const raw = World.getLightRaw(Math.floor(x), Math.floor(y), Math.floor(z));
    const sky = (raw >> 4) * ((World.dayFUniform && World.dayFUniform.value != null) ? World.dayFUniform.value : 1);
    const block = raw & 15;
    return Math.max(minLight, Math.max(block, sky) / 15);
  },

  applyLitColor(colorAttr, i, baseRgb, x, y, z, minLight) {
    if (!colorAttr || !baseRgb) return;
    const l = this.sampleLight(x, y, z, minLight);
    colorAttr.array[i * 3] = baseRgb[0] * l;
    colorAttr.array[i * 3 + 1] = baseRgb[1] * l;
    colorAttr.array[i * 3 + 2] = baseRgb[2] * l;
  },

  burst(x, y, z, rgb, count, speed) {
    count = count || 12;
    speed = speed || 3;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      this.applyLitColor({ array: col }, i, rgb, x, y, z, 0.10);
      vels.push([
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.9,
        (Math.random() - 0.5) * speed,
      ]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, vertexColors: true,
      size: 0.16, sizeAttenuation: true, transparent: true, opacity: 1,
    });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.list.push({ pts, vels, baseRgb: rgb.slice ? rgb.slice() : [rgb[0], rgb[1], rgb[2]], life: 0.7 + Math.random() * 0.3, t: 0 });
  },

  blockBurst(x, y, z, blockId) {
    this.burst(x + 0.5, y + 0.5, z + 0.5, Atlas.blockColor(blockId), 14, 3.2);
  },

  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.scene.remove(p.pts);
        p.pts.geometry.dispose();
        p.pts.material.dispose();
        this.list.splice(i, 1);
        continue;
      }
      const attr = p.pts.geometry.getAttribute('position');
      const colorAttr = p.pts.geometry.getAttribute('color');
      for (let j = 0; j < p.vels.length; j++) {
        p.vels[j][1] -= 9 * dt;
        attr.array[j * 3] += p.vels[j][0] * dt;
        attr.array[j * 3 + 1] += p.vels[j][1] * dt;
        attr.array[j * 3 + 2] += p.vels[j][2] * dt;
        this.applyLitColor(colorAttr, j, p.baseRgb, attr.array[j * 3], attr.array[j * 3 + 1], attr.array[j * 3 + 2], 0.10);
      }
      attr.needsUpdate = true;
      if (colorAttr) colorAttr.needsUpdate = true;
      p.pts.material.opacity = 1 - p.t / p.life;
    }
  },
};
