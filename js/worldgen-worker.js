// ============================================================
// F_Floop Craft — worldgen Web Worker
// Runs the REAL generator (noise.js + blocks.js + world.js via importScripts)
// off the main thread: genChunkBlocks (terrain/ores/features/dungeons/diffs/
// border) + the first computeChunkLight pass. The main thread adopts the
// transferred arrays and keeps every live registry (js/world.js
// _adoptWorkerChunk). Requests are stateless: each one carries the seed and
// the conquered-dungeon list, so nothing here can drift out of sync.
// ============================================================

// blocks.js touches a few browser APIs at load (PhotoBlocks preload, lazy
// canvases). Stub just enough for the script to parse and run; none of the
// stubbed paths are used by generation.
self.window = self;
self.document = {
  createElement: () => ({ getContext: () => null, style: {}, width: 0, height: 0 }),
  getElementById: () => null,
};
self.Image = class { set src(_) { /* photo decode is main-thread only */ } };
self.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
self.Multiplayer = { role: 'solo' }; // initChest checks this to skip client-side loot rolls

const q = self.location.search || '';
importScripts('noise.js' + q, 'blocks.js' + q, 'world.js' + q);

onmessage = (e) => {
  const m = e.data;
  if (!m || m.type !== 'gen') return;

  if (World.seed !== m.seed) {
    World.seed = m.seed;
    World.featureCache.clear();
    World.dungeonCache.clear();
    World.structCellCache && World.structCellCache.clear();
    if (World._borderSurfMemo) World._borderSurfMemo.clear();
  }
  World.dungeonConquered = new Set(m.conquered || []);
  Multiplayer.role = m.client ? 'client' : 'solo';

  const k = World.key(m.cx, m.cz);
  if (m.diffs && m.diffs.length) World.diffIndex.set(k, new Map(m.diffs));

  // gen-time registry writes land in this worker's (empty) maps; harvest the
  // new entries for the main thread, then clear so nothing accumulates here
  const preChests = World.chests.size, preSpawn = World.spawners.size, preLore = World.loreMap.size;
  const preFloop = World.floopSpots.length, preDgn = World.dungeonSpots.length;

  const data = World.genChunkBlocks(m.cx, m.cz);
  const ch = { cx: m.cx, cz: m.cz, blocks: data.blocks };
  World.computeChunkLight(ch); // interior light; the main thread border-pushes both ways

  const out = {
    type: 'chunk', cx: m.cx, cz: m.cz, seed: m.seed,
    blocks: data.blocks.buffer,
    light: ch.light.buffer,
    extraBlocks: data.extraBlocks && data.extraBlocks.size ? [...data.extraBlocks.entries()] : null,
    worldBorderColumns: data.worldBorderColumns,
    chests: [...World.chests.entries()].slice(preChests),
    spawners: [...World.spawners.entries()].slice(preSpawn),
    lore: [...World.loreMap.entries()].slice(preLore),
    floopSpots: World.floopSpots.slice(preFloop),
    dungeonSpots: World.dungeonSpots.slice(preDgn),
  };

  World.diffIndex.delete(k);
  World.chests.clear(); World.spawners.clear(); World.loreMap.clear();
  World.floopSpots.length = 0; World.dungeonSpots.length = 0;
  if (World.featureCache.size > 600) World.featureCache.clear();
  if (World.dungeonCache.size > 200) World.dungeonCache.clear();

  postMessage(out, [out.blocks, out.light]);
};
