// ============================================================
// F_Floop Craft — crafting recipes (shaped, auto-trimmed, with
// tag support: T_PLANKS / T_WOOL / T_LOG), smelting, fuel
// ============================================================
const Recipes = (() => {
  const all = [];

  function add(outId, outCount, grid, opts) {
    let rows = grid.map(r => r.slice());
    while (rows.length && rows[0].every(v => !v)) rows.shift();
    while (rows.length && rows[rows.length - 1].every(v => !v)) rows.pop();
    let w = Math.max(...rows.map(r => r.length));
    rows = rows.map(r => { while (r.length < w) r.push(0); return r; });
    while (w > 0 && rows.every(r => !r[0])) { rows.forEach(r => r.shift()); w--; }
    while (w > 0 && rows.every(r => !r[w - 1])) { rows.forEach(r => r.pop()); w--; }
    all.push({ out: outId, count: outCount, rows, w, h: rows.length, hide: !!(opts && opts.hide), keep: (opts && opts.keep) || [] });
  }

  function cellMatches(want, haveId) {
    if (!want) return !haveId;
    if (want < 0) return TAGS[want] && TAGS[want].includes(haveId);
    return want === haveId;
  }

  const _ = 0;
  const P = B.PLANKS, S = I.STICK, Fe = I.IRON_INGOT, Au = I.GOLD_INGOT, Di = I.DIAMOND, Em = I.EMERALD, OP = B.OASIS_PLANKS;
  const Gp = I.GUNPOWDER, Fl = I.FLOOPIUM, St = I.STAR, Df = I.DARK_FLOOPIUM;
  const AP = T_PLANKS, AW = T_WOOL, AJ = T_JELLY;
  const Jp = I.JELLY_GLOB_PINK, Jc = I.JELLY_GLOB_CYAN, Jl = I.JELLY_GLOB_LIME;
  const Jg = I.JELLY_GLOB_GRAPE, Jo = I.JELLY_GLOB_ORANGE, Jy = I.JELLY_GLOB_YELLOW, Ps = I.PATAPIM_SHARD;

  // --- basics ---
  add(B.PLANKS, 4, [[B.LOG]]);
  add(B.BIRCH_PLANKS, 4, [[B.BIRCH_LOG]]);
  add(B.SPRUCE_PLANKS, 4, [[B.SPRUCE_LOG]]);
  add(B.OASIS_PLANKS, 4, [[B.OASIS_LOG]]);
  add(I.STICK, 4, [[AP], [AP]]);
  add(B.CRAFT, 1, [[AP, AP], [AP, AP]]);
  add(B.EXTREME_CRAFT, 1, [[Fe, AP, Fe], [AP, B.CRAFT, AP], [Fe, AP, Fe]]);
  add(B.TORCH, 4, [[I.COAL], [S]]);
  add(B.TORCH, 4, [[I.CHARCOAL], [S]], { hide: true }); // works in the grid, but no duplicate book entry
  add(B.FURNACE, 1, [[B.COBBLE, B.COBBLE, B.COBBLE], [B.COBBLE, _, B.COBBLE], [B.COBBLE, B.COBBLE, B.COBBLE]]);
  add(B.STONE_BRICKS, 4, [[B.STONE, B.STONE], [B.STONE, B.STONE]]);
  add(B.LADDER_PX, 3, [[S, _, S], [S, S, S], [S, _, S]]);
  add(I.FLINT, 1, [[B.GRAVEL, B.GRAVEL, B.GRAVEL]]);
  add(I.FLINT_STEEL, 1, [[I.FLINT], [Fe]]);
  add(I.BUCKET, 1, [[Fe, _, Fe], [_, Fe, _]]);

  // --- tools ---
  const mats = { WOOD: P, STONE: B.COBBLE, IRON: Fe, DIAMOND: Di, EMERALD: Em };
  for (const key of Object.keys(mats)) {
    const m = key === 'WOOD' ? AP : mats[key];
    add(I[key + '_PICK'], 1, [[m, m, m], [_, S, _], [_, S, _]]);
    add(I[key + '_SWORD'], 1, [[m], [m], [S]]);
    add(I[key + '_AXE'], 1, [[m, m], [m, S], [_, S]]);
    add(I[key + '_SHOVEL'], 1, [[m], [S], [S]]);
  }
  add(I.PATAPIM_BLADE, 1, [[I.PATAPIM_SHARD], [I.PATAPIM_SHARD], [S]]);
  add(I.IRON_HAMMER, 1, [[Fe, Fe, Fe], [Fe, I.IRON_PICK, Fe], [Fe, Fe, Fe]]);
  add(I.DIAMOND_HAMMER, 1, [[Di, Di, Di], [Di, I.DIAMOND_PICK, Di], [Di, Di, Di]]);
  add(I.IRON_EXCAVATOR, 1, [[Fe, Fe, Fe], [Fe, I.IRON_SHOVEL, Fe], [_, Fe, _]]);
  add(I.DIAMOND_EXCAVATOR, 1, [[Di, Di, Di], [Di, I.DIAMOND_SHOVEL, Di], [_, Di, _]]);

  // --- bow & arrows ---
  add(I.BOW, 1, [[_, S, AW], [S, _, AW], [_, S, AW]]);
  add(I.ARROW, 4, [[I.FLINT], [S], [I.FEATHER]]);

  // --- armor ---
  for (const [key, m] of [['IRON', Fe], ['DIAMOND', Di], ['EMERALD', Em], ['PATAPIM', I.PATAPIM_SHARD]]) {
    add(I[key + '_HELMET'], 1, [[m, m, m], [m, _, m]]);
    add(I[key + '_CHEST'], 1, [[m, _, m], [m, m, m], [m, m, m]]);
    add(I[key + '_LEGS'], 1, [[m, m, m], [m, _, m], [m, _, m]]);
    add(I[key + '_BOOTS'], 1, [[m, _, m], [m, _, m]]);
  }

  // --- extreme farming ---
  add(B.PLANTATION_POT, 1, [
    [B.COBBLE, B.COBBLE, B.COBBLE, B.COBBLE, B.COBBLE],
    [B.COBBLE, B.DIRT, B.DIRT, B.DIRT, B.COBBLE],
    [B.COBBLE, B.DIRT, I.WATER_BUCKET, B.DIRT, B.COBBLE],
    [B.COBBLE, B.DIRT, B.DIRT, B.DIRT, B.COBBLE],
    [B.COBBLE, B.COBBLE, B.COBBLE, B.COBBLE, B.COBBLE],
  ], { keep: [I.WATER_BUCKET] });

  // --- festive ---
  add(B.PRESENT, 2, [[AP, AP, AP], [AP, St, AP], [AP, AP, AP]]);
  add(I.COOKIE, 4, [[I.SNOWBALL], [I.APPLE]]);
  add(B.CASINO, 1, [[Au, Au, Au], [Au, Di, Au], [AP, AP, AP]]);
  add(B.STOCKS, 1, [[Au, Di, Au], [Au, Di, Au], [AP, AP, AP]]);
  add(B.BONE_BLOCK, 1, [[I.BONE, I.BONE], [I.BONE, I.BONE]]);
  add(I.BONEMEAL, 3, [[I.BONE]]);
  add(B.FLOOP_LAMP, 2, [[Fl], [B.TORCH]]);
  add(B.FLOOP_METAL, 1, [[Fl, Fl], [Fl, Fl]]);
  add(B.SNOW, 1, [[I.SNOWBALL, B.DIRT]]);

  // --- emerald test content ---
  add(B.EMERALD_BLOCK, 1, [[Em, Em, Em], [Em, Em, Em], [Em, Em, Em]]);
  add(Em, 9, [[B.EMERALD_BLOCK]]);

  // --- furniture ---
  add(B.CHEST, 1, [[AP, AP, AP], [AP, _, AP], [AP, AP, AP]]);
  add(I.DOOR, 3, [[P, P], [P, P], [P, P]]);
  add(I.BIRCH_DOOR, 3, [[B.BIRCH_PLANKS, B.BIRCH_PLANKS], [B.BIRCH_PLANKS, B.BIRCH_PLANKS], [B.BIRCH_PLANKS, B.BIRCH_PLANKS]]);
  add(I.SPRUCE_DOOR, 3, [[B.SPRUCE_PLANKS, B.SPRUCE_PLANKS], [B.SPRUCE_PLANKS, B.SPRUCE_PLANKS], [B.SPRUCE_PLANKS, B.SPRUCE_PLANKS]]);
  add(I.OASIS_DOOR, 3, [[OP, OP], [OP, OP], [OP, OP]]);
  add(B.SIGN, 3, [[AP, AP, AP], [AP, AP, AP], [_, S, _]]);
  add(B.BED, 1, [[AW, AW, AW], [AP, AP, AP]]);
  add(I.SUN, 1, [[B.TORCH, Au, B.TORCH], [Au, B.FLOOP_LAMP, Au], [B.TORCH, Au, B.TORCH]]);
  add(B.SUNBED, 1, [[I.SUN], [B.BED]]);
  add(B.MEGA_TORCH, 1, [[I.STAR, I.SUN, I.STAR], [I.SUN, B.TORCH, I.SUN], [I.STAR, I.SUN, I.STAR]]);
  add(I.STAR, 1, [[B.STARDUST, B.STARDUST], [B.STARDUST, B.STARDUST]]);
  add(I.DUNGEON_KEY_GREEN, 1, [
    [_, B.STONE_BRICKS, I.EMERALD, B.STONE_BRICKS, _],
    [B.STONE_BRICKS, Fe, St, Fe, B.STONE_BRICKS],
    [I.EMERALD, I.GOLD_INGOT, B.FLOOP_METAL, I.GOLD_INGOT, I.EMERALD],
    [B.STONE_BRICKS, Fe, St, Fe, B.STONE_BRICKS],
    [_, B.STONE_BRICKS, I.EMERALD, B.STONE_BRICKS, _],
  ]);
  add(I.DUNGEON_KEY_BLUE, 1, [
    [B.FLOOP_METAL, I.DIAMOND, St, I.DIAMOND, B.FLOOP_METAL],
    [I.DIAMOND, I.CHARGE_CELL, B.EMERALD_BLOCK, I.CHARGE_CELL, I.DIAMOND],
    [St, B.EMERALD_BLOCK, I.DUNGEON_KEY_GREEN, B.EMERALD_BLOCK, St],
    [I.DIAMOND, I.CHARGE_CELL, B.EMERALD_BLOCK, I.CHARGE_CELL, I.DIAMOND],
    [B.FLOOP_METAL, I.DIAMOND, St, I.DIAMOND, B.FLOOP_METAL],
  ]);
  add(I.DUNGEON_KEY_GOLD, 1, [
    [B.FLOOP_METAL, I.GOLD_INGOT, St, I.GOLD_INGOT, B.FLOOP_METAL],
    [I.GOLD_INGOT, Df, B.EMERALD_BLOCK, Df, I.GOLD_INGOT],
    [St, B.EMERALD_BLOCK, I.DUNGEON_KEY_BLUE, B.EMERALD_BLOCK, St],
    [I.GOLD_INGOT, Df, B.EMERALD_BLOCK, Df, I.GOLD_INGOT],
    [B.FLOOP_METAL, I.GOLD_INGOT, St, I.GOLD_INGOT, B.FLOOP_METAL],
  ]);
  add(I.DUNGEON_KEY_DIAMOND, 1, [
    [Df, I.DIAMOND, St, I.DIAMOND, Df],
    [I.DIAMOND, B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL, I.DIAMOND],
    [St, I.CHARGE_CORE, I.DUNGEON_KEY_GOLD, I.CHARGE_CORE, St],
    [I.DIAMOND, B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL, I.DIAMOND],
    [Df, I.DIAMOND, St, I.DIAMOND, Df],
  ]);

  // --- dyes ---
  add(I.DYE_RED, 2, [[B.ROSE]]);
  add(I.DYE_YELLOW, 2, [[B.DANDELION]]);
  add(I.DYE_BLUE, 2, [[B.CORNFLOWER]]);
  add(I.DYE_PURPLE, 2, [[I.DYE_RED, I.DYE_BLUE]]);
  add(I.DYE_GREEN, 2, [[I.DYE_YELLOW, I.DYE_BLUE]]);
  // wool dyeing (any wool + dye -> colored wool)
  for (const [dyeId, color] of Object.entries(DYE_COLOR)) {
    add(WOOL_COLOR_BLOCKS[color], 1, [[AW, +dyeId]]);
  }

  // --- stairs & slabs (8 stairs per craft now) ---
  add(B.PLANK_STAIRS_PX, 8, [[P, _, _], [P, P, _], [P, P, P]]);
  add(B.COBBLE_STAIRS_PX, 8, [[B.COBBLE, _, _], [B.COBBLE, B.COBBLE, _], [B.COBBLE, B.COBBLE, B.COBBLE]]);
  add(B.WOOL_STAIRS_PX, 8, [[AW, _, _], [AW, AW, _], [AW, AW, AW]]);
  add(B.GLASS_STAIRS_PX, 8, [[B.GLASS, _, _], [B.GLASS, B.GLASS, _], [B.GLASS, B.GLASS, B.GLASS]]);
  add(B.PLANK_SLAB_B, 6, [[P, P, P]]);
  add(B.COBBLE_SLAB_B, 6, [[B.COBBLE, B.COBBLE, B.COBBLE]]);
  add(B.STONE_SLAB_B, 6, [[B.STONE, B.STONE, B.STONE]]);
  add(B.WOOL_SLAB_B, 6, [[B.WOOL, B.WOOL, B.WOOL]]);
  add(B.GLASS_SLAB_B, 6, [[B.GLASS, B.GLASS, B.GLASS]]);
  // colored wool stairs & slabs
  for (let ci = 0; ci < WOOL_STAIR_COLORS.length; ci++) {
    const w = WOOL_COLOR_BLOCKS[WOOL_STAIR_COLORS[ci]];
    add(B.WOOL_STAIRS_C0 + ci * 8, 8, [[w, _, _], [w, w, _], [w, w, w]]);
    add(B.WOOL_SLAB_C0 + ci * 2, 6, [[w, w, w]]);
  }
  // birch & spruce stairs/slabs
  add(B.BIRCH_STAIRS_PX, 8, [[B.BIRCH_PLANKS, _, _], [B.BIRCH_PLANKS, B.BIRCH_PLANKS, _], [B.BIRCH_PLANKS, B.BIRCH_PLANKS, B.BIRCH_PLANKS]]);
  add(B.SPRUCE_STAIRS_PX, 8, [[B.SPRUCE_PLANKS, _, _], [B.SPRUCE_PLANKS, B.SPRUCE_PLANKS, _], [B.SPRUCE_PLANKS, B.SPRUCE_PLANKS, B.SPRUCE_PLANKS]]);
  add(B.OASIS_STAIRS_PX, 8, [[OP, _, _], [OP, OP, _], [OP, OP, OP]]);
  add(B.BIRCH_SLAB_B, 6, [[B.BIRCH_PLANKS, B.BIRCH_PLANKS, B.BIRCH_PLANKS]]);
  add(B.SPRUCE_SLAB_B, 6, [[B.SPRUCE_PLANKS, B.SPRUCE_PLANKS, B.SPRUCE_PLANKS]]);
  add(B.OASIS_SLAB_B, 6, [[OP, OP, OP]]);
  // the legendary smoothie
  add(I.SMOOTHIE, 1, [
    [I.SNOWBALL, I.STAR, I.SNOWBALL],
    [I.BONE, I.COOKED_CHICKEN, I.BONE],
    [_, I.COAL, _]]);



  // --- jelly village loot/crafts ---
  for (const [color, globId] of Object.entries(JELLY_GLOB_BY_COLOR)) {
    add(JELLY_BLOCK_BY_COLOR[color], 1, [[globId, globId], [globId, globId]]);
  }
  // Reversible jelly block recipe: the block gives back the same 4 globs it costs.
  for (const [color, blockId] of Object.entries(JELLY_BLOCK_BY_COLOR)) {
    const globId = JELLY_GLOB_BY_COLOR[color];
    if (globId) add(globId, 4, [[blockId]]);
  }
  for (const [color, blockId] of Object.entries(JELLY_BLOCK_BY_COLOR)) {
    add(JELLY_LAMP_BY_COLOR[color], 1, [[blockId, blockId, blockId], [blockId, B.TORCH, blockId], [blockId, blockId, blockId]]);
  }
  add(B.JELLY_LAMP, 1, [[AJ, AJ, AJ], [AJ, B.TORCH, AJ], [AJ, AJ, AJ]]);
  add(I.JELLY_BOOTS, 1, [[AJ, _, AJ], [AJ, _, AJ]]);
  // Patapim diamond-infused jelly armor: every recipe uses all six jelly colors.
  add(I.PATAPIM_DIAMOND_JELLY_HELMET, 1, [
    [Jp, Jc, Ps, Jl, Jg],
    [Jo, Di, Di, Di, Jy],
    [Jp, Di, _, Di, Jc],
  ]);
  add(I.PATAPIM_DIAMOND_JELLY_CHEST, 1, [
    [Jp, _, Ps, _, Jc],
    [Jl, Di, Ps, Di, Jg],
    [Jo, Di, Di, Di, Jy],
    [Jp, Di, Ps, Di, Jc],
    [Jl, Jo, Jy, Jg, Jp],
  ]);
  add(I.PATAPIM_DIAMOND_JELLY_LEGS, 1, [
    [Jp, Jc, Ps, Jl, Jg],
    [Jo, Di, Di, Di, Jy],
    [Jp, Di, _, Di, Jc],
    [Jl, Di, _, Di, Jg],
    [Jo, Ps, _, Ps, Jy],
  ]);
  add(I.PATAPIM_DIAMOND_JELLY_BOOTS, 1, [
    [Jp, _, _, _, Jc],
    [Jl, Di, _, Di, Jg],
    [Jo, Di, _, Di, Jy],
    [Jp, Ps, _, Ps, Jc],
    [Jl, Jo, _, Jy, Jg],
  ]);
  // Extreme Crafting Table only: 5×5 recipe makes an actual placeable Jelly Person item, not a spawn egg.
  for (const [color, personId] of Object.entries(JELLY_PERSON_ITEM_BY_COLOR)) {
    const globId = JELLY_GLOB_BY_COLOR[color];
    const blockId = JELLY_BLOCK_BY_COLOR[color];
    if (!globId || !blockId || !personId) continue;
    add(personId, 1, [
      [_, _, globId, _, _],
      [_, globId, _, globId, _],
      [globId, _, blockId, _, globId],
      [_, globId, _, globId, _],
      [_, _, globId, _, _],
    ]);
  }

  // --- snow ---
  add(B.SNOW_SHEET_1, 1, [[I.SNOWBALL]]);
  add(I.SNOWBALL, 4, [[B.SNOW]]);

  // --- guns & ammo ---
  add(I.PISTOL, 1, [[Fe, Fe], [Gp, AP]]);
  add(I.SMG, 1, [[Fe, Fe, Fe], [Gp, AP, Fe]]);
  add(I.RIFLE, 1, [[Fe, Fe, Fe], [AP, Gp, _], [AP, _, _]]);
  add(I.SHOTGUN, 1, [[Fe, Fe, _], [AP, Gp, Fe], [AP, _, _]]);
  add(I.BAZOOKA, 1, [[Fe, Fe, Fe], [Gp, Di, Gp], [Fe, Fe, Fe]]);
  add(I.LIGHT_AMMO, 8, [[Gp], [Fe]]);
  add(I.HEAVY_AMMO, 6, [[Gp], [Fe], [Fe]]);
  add(I.SHELLS, 4, [[Gp, Fe], [B.SAND, _]]);
  add(I.ROCKET, 2, [[Gp], [Gp], [Fe]]);
  add(I.CHARGE_CELL, 6, [[Fl], [Gp]]);
  add(I.CHARGE_CORE, 1, [[Fl, Di, Fl], [Gp, St, Gp], [Fl, Di, Fl]]);
  add(I.FLOOP_RAY, 1, [[B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL], [St, I.RIFLE, St], [_, Df, _]]);
  add(I.PATAPIM_BEAM, 1, [[Df, I.CHARGE_CORE, Df], [I.PATAPIM_SHARD, I.BAZOOKA, I.PATAPIM_SHARD], [Df, I.CHARGE_CORE, Df]]);

  // --- vehicles ---
  add(I.CAR, 1, [[_, Fe, _], [Fe, Fl, Fe], [Fe, Fe, Fe]]);
  add(I.SUPER_CAR, 1, [
    [B.EMERALD_BLOCK, B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL, B.EMERALD_BLOCK],
    [B.FLOOP_METAL, B.GLASS, I.DIAMOND, B.GLASS, B.FLOOP_METAL],
    [I.DIAMOND, I.CAR, I.FLOOP_RAY, I.CAR, I.DIAMOND],
    [B.FLOOP_METAL, I.GOLD_INGOT, I.ROCKET, I.GOLD_INGOT, B.FLOOP_METAL],
    [B.EMERALD_BLOCK, I.DIAMOND, B.FLOOP_METAL, I.DIAMOND, B.EMERALD_BLOCK],
  ]);
  add(I.PLANE_WHEEL, 2, [
    [B.OBSIDIAN, Fe, B.FLOOP_METAL, Fe, B.OBSIDIAN],
    [Fe, Df, I.COAL, Df, Fe],
    [B.FLOOP_METAL, I.COAL, Fl, I.COAL, B.FLOOP_METAL],
    [Fe, Df, I.COAL, Df, Fe],
    [B.OBSIDIAN, Fe, B.FLOOP_METAL, Fe, B.OBSIDIAN],
  ]);
  add(I.PLANE_WING, 2, [
    [B.FLOOP_METAL, Fe, B.GLASS, Fe, B.FLOOP_METAL],
    [I.FEATHER, B.FLOOP_METAL, Fl, B.FLOOP_METAL, I.FEATHER],
    [Fe, B.FLOOP_METAL, I.CHARGE_CELL, B.FLOOP_METAL, Fe],
    [I.FEATHER, B.FLOOP_METAL, Fl, B.FLOOP_METAL, I.FEATHER],
    [B.FLOOP_METAL, Fe, B.GLASS, Fe, B.FLOOP_METAL],
  ]);
  add(I.PLANE_BODY, 1, [
    [B.FLOOP_METAL, Fe, B.GLASS, Fe, B.FLOOP_METAL],
    [Fe, B.GLASS, Di, B.GLASS, Fe],
    [B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL, I.CHARGE_CORE, B.FLOOP_METAL],
    [Fe, B.GLASS, Di, B.GLASS, Fe],
    [B.FLOOP_METAL, Fe, B.GLASS, Fe, B.FLOOP_METAL],
  ]);
  add(I.PLANE_ENGINE, 1, [
    [Df, B.FLOOP_METAL, I.ROCKET, B.FLOOP_METAL, Df],
    [B.FLOOP_METAL, I.CHARGE_CELL, I.CHARGE_CORE, I.CHARGE_CELL, B.FLOOP_METAL],
    [I.ROCKET, I.FLOOP_RAY, Ps, I.FLOOP_RAY, I.ROCKET],
    [B.FLOOP_METAL, I.CHARGE_CELL, I.CHARGE_CORE, I.CHARGE_CELL, B.FLOOP_METAL],
    [Df, B.FLOOP_METAL, I.ROCKET, B.FLOOP_METAL, Df],
  ]);
  add(I.PLANE_TAIL, 1, [
    [Fe, B.FLOOP_METAL, Fe, B.FLOOP_METAL, Fe],
    [I.FEATHER, Fe, Fl, Fe, I.FEATHER],
    [B.FLOOP_METAL, I.PLANE_WING, I.CHARGE_CELL, I.PLANE_WING, B.FLOOP_METAL],
    [I.FEATHER, Fe, Fl, Fe, I.FEATHER],
    [Fe, B.FLOOP_METAL, Fe, B.FLOOP_METAL, Fe],
  ]);
  add(I.PLANE, 1, [
    [B.FLOOP_METAL, I.PLANE_WING, I.PLANE_TAIL, I.PLANE_WING, B.FLOOP_METAL],
    [I.PLANE_WHEEL, I.PLANE_BODY, B.GLASS, I.PLANE_ENGINE, I.PLANE_WHEEL],
    [Au, I.CHARGE_CORE, I.SUPER_CAR, I.FLOOP_RAY, Au],
    [I.PLANE_WHEEL, B.FLOOP_METAL, I.PLANE_BODY, B.FLOOP_METAL, I.PLANE_WHEEL],
    [B.FLOOP_METAL, Di, B.FLOOP_METAL, Di, B.FLOOP_METAL],
  ]);
  add(I.SKATEBOARD, 1, [[AP, AP, AP], [S, _, S]]);
  add(I.BOAT, 1, [[AP, _, AP], [AP, AP, AP]]);
  add(I.OBSIDIAN_BOAT, 1, [[B.OBSIDIAN, _, B.OBSIDIAN], [B.OBSIDIAN, B.OBSIDIAN, B.OBSIDIAN]]);

  function match(cells, gw, gh) {
    let minX = gw, minY = gh, maxX = -1, maxY = -1;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      if (cells[y * gw + x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    if (maxX < 0) return null;
    const w = maxX - minX + 1, h = maxY - minY + 1;
    outer: for (const r of all) {
      if (r.w !== w || r.h !== h) continue;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const stack = cells[(y + minY) * gw + (x + minX)];
        if (!cellMatches(r.rows[y][x], stack ? stack.id : 0)) continue outer;
      }
      return r;
    }
    return null;
  }

  // aggregate needs; tags stay as negative keys
  function ingredients(r) {
    const need = {};
    for (const row of r.rows) for (const id of row) if (id) need[id] = (need[id] || 0) + 1;
    return need;
  }

  // tag-aware inventory affordability + payment (uses the Player inventory)
  function countOf(id) {
    if (id >= 0) return Player.countItem(+id);
    let n = 0;
    for (const m of TAGS[id] || []) n += Player.countItem(m);
    return n;
  }

  function canAfford(need) {
    return Object.keys(need).every(id => countOf(+id) >= need[id]);
  }

  function payCost(need, recipe) {
    if (!canAfford(need)) return false;
    for (const idStr of Object.keys(need)) {
      const id = +idStr;
      let left = need[idStr];
      if (id >= 0) {
        // Some recipes, like the Plantation Pot, use a water bucket as a tool/container.
        // It must be present, but crafting does not consume it.
        if (!(recipe && recipe.keep && recipe.keep.includes(id))) Player.removeItems(id, left);
        continue;
      }
      for (const m of TAGS[id]) {
        const have = Player.countItem(m);
        const take = Math.min(have, left);
        if (take > 0) { Player.removeItems(m, take); left -= take; }
        if (left <= 0) break;
      }
    }
    return true;
  }

  function displayId(want) {
    if (want >= 0) return want;
    return TAGS[want][0];
  }

  // ---------------- furnace ----------------
  const smelting = {
    [I.RAW_IRON]: { out: I.IRON_INGOT, count: 1 },
    [I.RAW_GOLD]: { out: I.GOLD_INGOT, count: 1 },
    [I.RAW_MUTTON]: { out: I.COOKED_MUTTON, count: 1 },
    [I.RAW_CHICKEN]: { out: I.COOKED_CHICKEN, count: 1 },
    [B.SAND]: { out: B.GLASS, count: 1 },
    [B.COBBLE]: { out: B.STONE, count: 1 },
    [B.LOG]: { out: I.CHARCOAL, count: 1 },
    [B.BIRCH_LOG]: { out: I.CHARCOAL, count: 1 },
    [B.SPRUCE_LOG]: { out: I.CHARCOAL, count: 1 },
    [B.OASIS_LOG]: { out: I.CHARCOAL, count: 1 },
    [B.GRAVEL]: { out: I.FLINT, count: 1 },
  };
  const SMELT_TIME = 5;

  const fuel = {
    [I.COAL]: 40, [I.CHARCOAL]: 40, [I.LAVA_BUCKET]: 200,
    [B.LOG]: 7.5, [B.BIRCH_LOG]: 7.5, [B.SPRUCE_LOG]: 7.5, [B.OASIS_LOG]: 7.5,
    [B.PLANKS]: 7.5, [B.BIRCH_PLANKS]: 7.5, [B.SPRUCE_PLANKS]: 7.5, [B.OASIS_PLANKS]: 7.5,
    [I.STICK]: 2.5,
    [B.PLANK_SLAB_B]: 3.5, [B.BIRCH_SLAB_B]: 3.5, [B.SPRUCE_SLAB_B]: 3.5, [B.OASIS_SLAB_B]: 3.5,
    [I.DOOR]: 5, [I.BIRCH_DOOR]: 5, [I.SPRUCE_DOOR]: 5, [I.OASIS_DOOR]: 5,
    [B.CRAFT]: 7.5, [B.SIGN]: 5, [B.SAPLING_OAK]: 2, [B.SAPLING_BIRCH]: 2, [B.SAPLING_SPRUCE]: 2, [B.SAPLING_OASIS]: 2,
  };

  return { all, match, ingredients, countOf, canAfford, payCost, displayId, smelting, fuel, SMELT_TIME };
})();
