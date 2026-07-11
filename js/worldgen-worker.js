// ============================================================
// F_Floop Craft — worldgen worker DRIVER
// Loaded as a normal page script; it defines (but does not run) the function
// whose source gets shipped into a Blob Worker by World.initGenWorkers().
// Blob workers are the one worker type file:// pages may construct, and they
// cannot importScripts — so the page donates ALL the code the worker needs:
//   NoiseGenFactory (noise.js) + BLOCKS_WORLDGEN_SRC (blocks.js) +
//   WORLD_SRC/WORLD_LORE_SRC (world.js) + this driver.
// The worker runs genChunkBlocks (terrain/ores/features/dungeons/diffs/border)
// plus the first computeChunkLight pass, transfers the arrays back, and keeps
// zero authoritative state (every request carries seed + conquered list).
// ============================================================
function WORLDGEN_WORKER_DRIVER() {
  onmessage = (e) => {
    const m = e.data;
    if (!m || m.type !== 'gen') return;

    if (World.seed !== m.seed) {
      World.seed = m.seed;
      World.featureCache.clear();
      World.dungeonCache.clear();
      if (World.structCellCache) World.structCellCache.clear();
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
    World.computeChunkLight(ch); // interior light; the main thread border-blends at mesh time

    const out = {
      type: 'chunk', cx: m.cx, cz: m.cz, seed: m.seed,
      blocks: data.blocks.buffer,
      light: ch.light.buffer,
      blockRGB: ch.blockRGB.buffer,
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

    postMessage(out, [out.blocks, out.light, out.blockRGB]);
  };
}
