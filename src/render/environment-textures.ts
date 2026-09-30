/**
 * Procedural textures for the scene backdrops (environment.ts). Everything is
 * drawn at runtime on a 2D canvas from a fixed seed, so the site ships no image
 * assets for them, captures are reproducible and nothing is fetched. Every
 * ground texture tiles seamlessly: features that cross an edge are drawn again
 * on the opposite side.
 */
type Ctx = CanvasRenderingContext2D;

/** Small deterministic PRNG (mulberry32). */
export function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return { canvas: c, ctx: c.getContext("2d")! };
}

/** Draw `fn` at (x, y) and at every wrapped copy that can reach the tile. */
function wrapped(
  size: number,
  x: number,
  y: number,
  reach: number,
  fn: (x: number, y: number) => void,
) {
  for (const dx of [-size, 0, size])
    for (const dy of [-size, 0, size]) {
      const px = x + dx,
        py = y + dy;
      if (
        px + reach < 0 ||
        py + reach < 0 ||
        px - reach > size ||
        py - reach > size
      )
        continue;
      fn(px, py);
    }
}

function blob(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Grass: blades, clover patches, daisies and buttercups (tileable). */
export function grassTexture(size = 512, seed = 7) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  ctx.fillStyle = "#5c9a39";
  ctx.fillRect(0, 0, size, size);
  // Soft darker and lighter patches.
  for (let i = 0; i < 26; i++) {
    const x = rand() * size,
      y = rand() * size,
      r = 30 + rand() * 70,
      dark = rand() < 0.5;
    wrapped(size, x, y, r, (px, py) =>
      blob(
        ctx,
        px,
        py,
        r,
        dark ? "rgba(46,98,34,0.35)" : "rgba(150,190,80,0.28)",
      ),
    );
  }
  // Blades: short strokes in several greens.
  const greens = ["#4b8a2e", "#6aab41", "#78b84a", "#3f7a28", "#8cc257"];
  ctx.lineWidth = 1.3;
  for (let i = 0; i < size * size * 0.045; i++) {
    const x = rand() * size,
      y = rand() * size,
      length = 3 + rand() * 5,
      angle = -Math.PI / 2 + (rand() - 0.5) * 1.2;
    ctx.strokeStyle = greens[(rand() * greens.length) | 0];
    wrapped(size, x, y, 10, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + Math.cos(angle) * length, py + Math.sin(angle) * length);
      ctx.stroke();
    });
  }
  // Flowers: a clear repeating feature for motion.
  for (let i = 0; i < 22; i++) {
    const x = rand() * size,
      y = rand() * size,
      yellow = rand() < 0.35;
    wrapped(size, x, y, 6, (px, py) => {
      ctx.fillStyle = yellow ? "#f2d33b" : "#f7f7f2";
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(px + Math.cos(a) * 2.2, py + Math.sin(a) * 2.2, 1.7, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = yellow ? "#c98a18" : "#f0c43a";
      ctx.beginPath();
      ctx.arc(px, py, 1.4, 0, 7);
      ctx.fill();
    });
  }
  return c;
}

/** Low-frequency brightness variation (grey, tileable) that breaks up repeats. */
export function variationTexture(size = 128, seed = 11) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  ctx.fillStyle = "rgb(128,128,128)";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) {
    const x = rand() * size,
      y = rand() * size,
      r = 10 + rand() * 30,
      v = rand() < 0.5 ? 0 : 255;
    wrapped(size, x, y, r, (px, py) =>
      blob(ctx, px, py, r, `rgba(${v},${v},${v},0.35)`),
    );
  }
  return c;
}

/** Palette of the play-mat street map (day or night). */
function streetPalette(night: boolean) {
  return night
    ? {
        grass: "#1f3a24",
        grassDark: "#173020",
        road: "#23262c",
        line: "#b8a24a",
        white: "#a9adb6",
        pavement: "#4a4c55",
        curb: "#61636b",
        parking: "#2c2f36",
        roofs: ["#4a3b52", "#3c4a5c", "#523c3c", "#3f4f45"],
        water: "#1b3350",
        tree: "#1d4a2a",
        treeDark: "#123620",
        field: "#3a4630",
        cars: ["#7a2c2c", "#2c4a7a", "#7a6a2c", "#3a6a3a"],
        window: "#f6d77a",
      }
    : {
        grass: "#71b04b",
        grassDark: "#5f9c3e",
        road: "#5a5e66",
        line: "#f4d23c",
        white: "#f4f4f0",
        pavement: "#cfc8b8",
        curb: "#ece6d8",
        parking: "#6a6e76",
        roofs: ["#d0523f", "#4f78b8", "#e0a431", "#8c5aa8"],
        water: "#4fa3d9",
        tree: "#3f8a35",
        treeDark: "#2f6e2a",
        field: "#c9a85a",
        cars: ["#d8392b", "#2f6fd0", "#f3c21b", "#3aa54a"],
        window: "#f6d77a",
      };
}

/**
 * Toy street map: a 2 × 2 grid of blocks per tile with roads on the tile's
 * edges and centre lines, zebra crossings at every junction, and four
 * different blocks: a park with a pond, a car park, houses and a sports field.
 * One tile is `size` px square; road bands are centred on x,y = 0 and size/2.
 */
export function streetTexture(size = 1024, night = false, seed = 5) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  const P = streetPalette(night);
  const half = size / 2,
    road = size * 0.12, // 120 px at 1024
    walk = size * 0.022,
    s = size / 1024;
  ctx.fillStyle = P.grass;
  ctx.fillRect(0, 0, size, size);
  // Pavements under the road bands.
  ctx.fillStyle = P.curb;
  for (const at of [0, half, size]) {
    ctx.fillRect(at - road / 2 - walk, 0, road + walk * 2, size);
    ctx.fillRect(0, at - road / 2 - walk, size, road + walk * 2);
  }
  ctx.fillStyle = P.pavement;
  for (const at of [0, half, size]) {
    ctx.fillRect(
      at - road / 2 - walk + 3 * s,
      0,
      road + walk * 2 - 6 * s,
      size,
    );
    ctx.fillRect(
      0,
      at - road / 2 - walk + 3 * s,
      size,
      road + walk * 2 - 6 * s,
    );
  }
  // Paving joints: a fine repeating feature for motion.
  ctx.strokeStyle = night ? "rgba(0,0,0,0.25)" : "rgba(120,110,90,0.35)";
  ctx.lineWidth = 1;
  for (const at of [0, half, size])
    for (let t = 0; t < size; t += 10 * s) {
      for (const side of [-1, 1]) {
        const edge = at + side * (road / 2 + walk / 2);
        ctx.beginPath();
        ctx.moveTo(edge - walk / 2, t);
        ctx.lineTo(edge + walk / 2, t);
        ctx.moveTo(t, edge - walk / 2);
        ctx.lineTo(t, edge + walk / 2);
        ctx.stroke();
      }
    }
  // Roads.
  ctx.fillStyle = P.road;
  for (const at of [0, half, size]) {
    ctx.fillRect(at - road / 2, 0, road, size);
    ctx.fillRect(0, at - road / 2, size, road);
  }
  // Asphalt speckle.
  for (let i = 0; i < 9000 * s * s; i++) {
    const x = rand() * size,
      y = rand() * size;
    const onRoad = [0, half, size].some(
      (at) => Math.abs(x - at) < road / 2 || Math.abs(y - at) < road / 2,
    );
    if (!onRoad) continue;
    ctx.fillStyle =
      rand() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(x, y, 2 * s, 2 * s);
  }
  // Dashed centre lines, broken at junctions.
  ctx.fillStyle = P.line;
  const dash = 34 * s,
    gap = 26 * s,
    lineW = 4 * s;
  for (const at of [0, half, size])
    for (let t = 0; t < size; t += dash + gap) {
      const nearJunction = (u: number) =>
        [0, half, size].some((j) => Math.abs(u - j) < road / 2 + walk + 22 * s);
      if (!nearJunction(t) && !nearJunction(t + dash)) {
        ctx.fillRect(at - lineW / 2, t, lineW, dash);
        ctx.fillRect(t, at - lineW / 2, dash, lineW);
      }
    }
  // Zebra crossings and stop lines on every approach to each junction.
  ctx.fillStyle = P.white;
  const stripe = 7 * s,
    zebraDepth = 22 * s;
  for (const jx of [0, half, size])
    for (const jy of [0, half, size])
      for (const side of [-1, 1]) {
        const offset = road / 2 + 4 * s;
        // Crossings on the vertical road (north/south of the junction).
        for (let k = -road / 2 + 4 * s; k < road / 2 - 4 * s; k += stripe * 2)
          ctx.fillRect(
            jx + k,
            jy + side * offset - (side < 0 ? zebraDepth : 0),
            stripe,
            zebraDepth,
          );
        // Crossings on the horizontal road (east/west).
        for (let k = -road / 2 + 4 * s; k < road / 2 - 4 * s; k += stripe * 2)
          ctx.fillRect(
            jx + side * offset - (side < 0 ? zebraDepth : 0),
            jy + k,
            zebraDepth,
            stripe,
          );
        // Stop lines across the incoming lane.
        ctx.fillRect(
          jx + (side < 0 ? -road / 2 : 0),
          jy + side * (offset + zebraDepth + 6 * s) - (side < 0 ? 4 * s : 0),
          road / 2,
          4 * s,
        );
      }
  // Blocks: interior of each quadrant, inside the pavements.
  const inset = road / 2 + walk;
  const blocks = [
    [inset, inset],
    [half + inset, inset],
    [inset, half + inset],
    [half + inset, half + inset],
  ];
  const blockSize = half - inset * 2;
  const tree = (x: number, y: number, r: number) => {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y + r * 0.35, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = P.treeDark;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.fillStyle = P.tree;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.7, 0, 7);
    ctx.fill();
  };
  const car = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 2 * s, y + 2 * s, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = night ? "rgba(120,140,170,0.6)" : "rgba(200,230,250,0.9)";
    const vertical = h > w;
    if (vertical) ctx.fillRect(x + 2 * s, y + h * 0.22, w - 4 * s, h * 0.18);
    else ctx.fillRect(x + w * 0.6, y + 2 * s, w * 0.18, h - 4 * s);
  };
  // 1. Park: paths, a pond, trees and flower beds.
  {
    const [x, y] = blocks[0];
    ctx.fillStyle = P.grassDark;
    ctx.fillRect(x, y, blockSize, blockSize);
    ctx.fillStyle = P.pavement;
    ctx.fillRect(x, y + blockSize / 2 - 8 * s, blockSize, 16 * s);
    ctx.fillRect(x + blockSize / 2 - 8 * s, y, 16 * s, blockSize);
    ctx.fillStyle = P.water;
    ctx.beginPath();
    ctx.ellipse(
      x + blockSize * 0.27,
      y + blockSize * 0.27,
      blockSize * 0.16,
      blockSize * 0.11,
      0.4,
      0,
      7,
    );
    ctx.fill();
    ctx.fillStyle = night ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.ellipse(
      x + blockSize * 0.24,
      y + blockSize * 0.24,
      blockSize * 0.06,
      blockSize * 0.025,
      0.4,
      0,
      7,
    );
    ctx.fill();
    for (let i = 0; i < 16; i++) {
      const tx = x + 20 * s + rand() * (blockSize - 40 * s),
        ty = y + 20 * s + rand() * (blockSize - 40 * s);
      if (Math.abs(tx - (x + blockSize / 2)) < 26 * s) continue;
      if (Math.abs(ty - (y + blockSize / 2)) < 26 * s) continue;
      if (tx < x + blockSize * 0.47 && ty < y + blockSize * 0.47) continue;
      tree(tx, ty, (12 + rand() * 8) * s);
    }
    ctx.fillStyle = night ? "#6a3050" : "#e2508a";
    ctx.beginPath();
    ctx.arc(x + blockSize / 2, y + blockSize / 2, 20 * s, 0, 7);
    ctx.fill();
    ctx.fillStyle = night ? "#8a7a30" : "#f7d64a";
    ctx.beginPath();
    ctx.arc(x + blockSize / 2, y + blockSize / 2, 9 * s, 0, 7);
    ctx.fill();
  }
  // 2. Car park with painted bays and parked toy cars.
  {
    const [x, y] = blocks[1];
    ctx.fillStyle = P.parking;
    ctx.fillRect(x + 8 * s, y + 8 * s, blockSize - 16 * s, blockSize - 16 * s);
    ctx.strokeStyle = P.white;
    ctx.lineWidth = 3 * s;
    const bay = 30 * s,
      depth = 62 * s;
    const colors = P.cars;
    for (const row of [0, 1, 2]) {
      const ry = y + 16 * s + row * (depth * 2 + 12 * s);
      for (let bx = x + 16 * s; bx + bay < x + blockSize - 16 * s; bx += bay) {
        for (const flip of [0, 1]) {
          const top = ry + flip * depth;
          if (top + depth > y + blockSize - 12 * s) continue;
          ctx.beginPath();
          ctx.moveTo(bx, top);
          ctx.lineTo(bx, top + depth);
          ctx.stroke();
          if (rand() < 0.45)
            car(
              bx + 5 * s,
              top + 8 * s,
              bay - 10 * s,
              depth - 16 * s,
              colors[(rand() * colors.length) | 0],
            );
        }
      }
    }
    // A big "P".
    ctx.fillStyle = night ? "rgba(90,130,200,0.8)" : "#2f6fd0";
    ctx.fillRect(
      x + blockSize - 70 * s,
      y + blockSize - 70 * s,
      50 * s,
      50 * s,
    );
    ctx.fillStyle = P.white;
    ctx.font = `bold ${40 * s}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("P", x + blockSize - 45 * s, y + blockSize - 43 * s);
  }
  // 3. Houses: roofs with ridges, gardens and driveways.
  {
    const [x, y] = blocks[2];
    const lot = blockSize / 3;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        if (i === 1 && j === 1) {
          tree(x + lot * 1.5, y + lot * 1.5, 22 * s);
          continue;
        }
        const lx = x + i * lot,
          ly = y + j * lot;
        ctx.fillStyle = (i + j) % 2 ? P.grass : P.grassDark;
        ctx.fillRect(lx + 3 * s, ly + 3 * s, lot - 6 * s, lot - 6 * s);
        const w = lot * 0.55,
          h = lot * 0.45,
          hx = lx + (lot - w) / 2,
          hy = ly + (lot - h) / 2;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(hx + 5 * s, hy + 5 * s, w, h);
        const roof = P.roofs[(i * 3 + j) % P.roofs.length];
        ctx.fillStyle = roof;
        ctx.fillRect(hx, hy, w, h);
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(hx, hy + h / 2, w, h / 2);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(hx, hy + h / 2 - 1.5 * s, w, 3 * s);
        if (night) {
          ctx.fillStyle = P.window;
          ctx.fillRect(hx - 3 * s, hy + h * 0.3, 3 * s, 6 * s);
          ctx.fillRect(hx + w, hy + h * 0.6, 3 * s, 6 * s);
        }
        ctx.fillStyle = P.pavement;
        ctx.fillRect(hx + w * 0.7, hy + h, 14 * s, ly + lot - hy - h);
      }
  }
  // 4. Sports field with a running track.
  {
    const [x, y] = blocks[3];
    ctx.fillStyle = night ? "#5a3530" : "#c7654a";
    ctx.beginPath();
    ctx.roundRect(
      x + 10 * s,
      y + 10 * s,
      blockSize - 20 * s,
      blockSize - 20 * s,
      90 * s,
    );
    ctx.fill();
    ctx.fillStyle = night ? "#24472a" : "#57a342";
    ctx.beginPath();
    ctx.roundRect(
      x + 38 * s,
      y + 38 * s,
      blockSize - 76 * s,
      blockSize - 76 * s,
      62 * s,
    );
    ctx.fill();
    // Mown stripes.
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    for (let k = 0; k < 8; k += 2)
      ctx.fillRect(
        x + 60 * s + k * ((blockSize - 120 * s) / 8),
        y + 60 * s,
        (blockSize - 120 * s) / 8,
        blockSize - 120 * s,
      );
    ctx.strokeStyle = P.white;
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(
      x + 60 * s,
      y + 60 * s,
      blockSize - 120 * s,
      blockSize - 120 * s,
    );
    ctx.beginPath();
    ctx.moveTo(x + 60 * s, y + blockSize / 2);
    ctx.lineTo(x + blockSize - 60 * s, y + blockSize / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + blockSize / 2, y + blockSize / 2, 32 * s, 0, 7);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1.5 * s;
    for (const lane of [1, 2]) {
      ctx.beginPath();
      ctx.roundRect(
        x + (10 + lane * 9) * s,
        y + (10 + lane * 9) * s,
        blockSize - (20 + lane * 18) * s,
        blockSize - (20 + lane * 18) * s,
        (90 - lane * 9) * s,
      );
      ctx.stroke();
    }
  }
  // Night: warm pools of light from street lamps along the pavements.
  if (night)
    for (const at of [0, half, size])
      for (let t = 40 * s; t < size; t += 128 * s)
        for (const side of [-1, 1]) {
          const edge = at + side * (road / 2 + walk * 0.5);
          wrapped(size, edge, t, 60 * s, (px, py) =>
            blob(ctx, px, py, 60 * s, "rgba(255,210,120,0.32)"),
          );
          wrapped(size, t, edge, 60 * s, (px, py) =>
            blob(ctx, px, py, 60 * s, "rgba(255,210,120,0.32)"),
          );
        }
  return c;
}

/** Sand: grains, wind ripples, shells and pebbles (tileable). */
export function sandTexture(size = 256, seed = 3) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  ctx.fillStyle = "#e4cf98";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 14; i++) {
    const x = rand() * size,
      y = rand() * size,
      r = 20 + rand() * 40,
      color = rand() < 0.5 ? "rgba(200,170,110,0.35)" : "rgba(250,236,196,0.4)";
    wrapped(size, x, y, r, (px, py) => blob(ctx, px, py, r, color));
  }
  // Ripples: wavy lines that tile across the width.
  ctx.strokeStyle = "rgba(175,145,90,0.35)";
  ctx.lineWidth = 1.6;
  for (let row = 0; row < 12; row++) {
    const y0 = (row + 0.5) * (size / 12);
    ctx.beginPath();
    for (let x = 0; x <= size; x += 4) {
      const y =
        y0 +
        Math.sin((x / size) * Math.PI * 4 + row) * 3 +
        Math.sin((x / size) * Math.PI * 2 * 3 + row * 2) * 1.5;
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < size * size * 0.08; i++) {
    const x = rand() * size,
      y = rand() * size;
    ctx.fillStyle =
      rand() < 0.5 ? "rgba(150,120,70,0.35)" : "rgba(255,250,230,0.5)";
    ctx.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 9; i++) {
    const x = rand() * size,
      y = rand() * size;
    const shell = rand() < 0.5,
      turn = rand() * 3;
    wrapped(size, x, y, 5, (px, py) => {
      ctx.fillStyle = shell ? "#f6e9e0" : "#9a9086";
      ctx.beginPath();
      ctx.ellipse(px, py, shell ? 3.5 : 2.6, shell ? 2.6 : 2, turn, 0, 7);
      ctx.fill();
      if (shell) {
        ctx.strokeStyle = "#d8a898";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
  }
  return c;
}

/** Sea: deep blue with sparkling wave crests (tileable). */
export function seaTexture(size = 256, seed = 9) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  ctx.fillStyle = "#2f86b8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    const x = rand() * size,
      y = rand() * size,
      r = 20 + rand() * 50,
      color = rand() < 0.5 ? "rgba(30,90,150,0.45)" : "rgba(90,180,220,0.35)";
    wrapped(size, x, y, r, (px, py) => blob(ctx, px, py, r, color));
  }
  ctx.strokeStyle = "rgba(235,248,255,0.75)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 60; i++) {
    const x = rand() * size,
      y = rand() * size,
      w = 6 + rand() * 12;
    wrapped(size, x, y, w, (px, py) => {
      ctx.beginPath();
      ctx.moveTo(px - w / 2, py);
      ctx.quadraticCurveTo(px, py - 3, px + w / 2, py);
      ctx.stroke();
    });
  }
  return c;
}

/** Studio floor: a faint two-tone chequer (motion cue) with soft grain. */
export function studioTexture(size = 128, seed = 13) {
  const { canvas: c, ctx } = canvas(size, size);
  const rand = random(seed);
  ctx.fillStyle = "#e1e3e5";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#d8dadc";
  ctx.fillRect(0, 0, size / 2, size / 2);
  ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
  for (let i = 0; i < size * size * 0.1; i++) {
    ctx.fillStyle =
      rand() < 0.5 ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(rand() * size, rand() * size, 1, 1);
  }
  return c;
}

/** Colour `hex` hazed towards `haze` by `amount` (0 = unchanged). */
function hazed(hex: string, haze: string, amount: number) {
  const parse = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = parse(hex),
    b = parse(haze);
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `rgb(${mixed.join(",")})`;
}

export type HorizonKind = "hills" | "town" | "islands" | "skyline";

/**
 * Horizon silhouettes wrapped round the view (a cylinder texture with alpha).
 * The width tiles horizontally; the bottom row is fully opaque in the haze
 * colour so the band meets the faded ground without a seam.
 */
export function horizonTexture(
  kind: HorizonKind,
  haze: string,
  outWidth = 2048,
  outHeight = 256,
  seed = 17,
) {
  // Drawn at full size, then scaled down for phones.
  const width = 2048,
    height = 256;
  const { canvas: c, ctx } = canvas(width, height);
  const rand = random(seed);
  const base = height; // the ground line
  const ridge = (
    amplitude: number,
    level: number,
    color: string,
    waves: number[],
  ) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, base);
    for (let x = 0; x <= width; x += 4) {
      let y = level;
      waves.forEach((w, i) => {
        y -=
          Math.sin((x / width) * Math.PI * 2 * w + i * 1.7) *
          amplitude *
          (1 / (i + 1));
      });
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, base);
    ctx.closePath();
    ctx.fill();
  };
  const wrap = (x: number, reach: number, fn: (x: number) => void) => {
    fn(x);
    if (x - reach < 0) fn(x + width);
    if (x + reach > width) fn(x - width);
  };
  if (kind === "hills") {
    ridge(26, height * 0.52, hazed("#6f9a6a", haze, 0.55), [3, 7, 13]);
    ridge(20, height * 0.66, hazed("#5f8f4a", haze, 0.35), [5, 11, 17]);
    // Tree clumps and pines along the nearer ridge.
    for (let i = 0; i < 70; i++) {
      const x = rand() * width,
        pine = rand() < 0.4,
        h = 14 + rand() * 22,
        y = height * 0.66 + (rand() - 0.5) * 16;
      const color = hazed(pine ? "#2f5a34" : "#3f7236", haze, 0.3);
      wrap(x, 30, (px) => {
        ctx.fillStyle = color;
        if (pine) {
          ctx.beginPath();
          ctx.moveTo(px, y - h * 1.6);
          ctx.lineTo(px - h * 0.45, y + 2);
          ctx.lineTo(px + h * 0.45, y + 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(px, y - h * 0.5, h * 0.6, 0, 7);
          ctx.arc(px - h * 0.45, y - h * 0.2, h * 0.45, 0, 7);
          ctx.arc(px + h * 0.45, y - h * 0.2, h * 0.45, 0, 7);
          ctx.fill();
        }
      });
    }
    ridge(8, height * 0.8, hazed("#6a9e45", haze, 0.25), [9, 19]);
  } else if (kind === "town" || kind === "skyline") {
    const night = kind === "skyline";
    ridge(
      10,
      height * 0.62,
      hazed(night ? "#1c2440" : "#7f9f7a", haze, 0.5),
      [4, 9],
    );
    // Buildings.
    let x = 0;
    while (x < width) {
      const w = 26 + rand() * 60,
        h = (night ? 40 : 24) + rand() * (night ? 120 : 70),
        gapAfter = rand() < 0.3 ? 20 + rand() * 60 : 2;
      const top = height * 0.86 - h;
      const colors = night
        ? ["#141a30", "#18203a", "#10162a"]
        : ["#c9b8a4", "#b7c3cf", "#d6c6a8", "#a9b9c4", "#c7a99a"];
      ctx.fillStyle = hazed(
        colors[(rand() * colors.length) | 0],
        haze,
        night ? 0.1 : 0.45,
      );
      ctx.fillRect(x, top, w, height - top);
      if (!night && rand() < 0.5) {
        ctx.fillStyle = hazed("#b0584a", haze, 0.45);
        ctx.beginPath();
        ctx.moveTo(x - 2, top);
        ctx.lineTo(x + w / 2, top - w * 0.35);
        ctx.lineTo(x + w + 2, top);
        ctx.fill();
      }
      if (night)
        for (let wy = top + 6; wy < height * 0.86 - 6; wy += 9)
          for (let wx = x + 4; wx < x + w - 5; wx += 8)
            if (rand() < 0.35) {
              ctx.fillStyle = rand() < 0.8 ? "#f6d77a" : "#9fd0ff";
              ctx.fillRect(wx, wy, 3, 4);
            }
      x += w + gapAfter;
    }
    // Trees in front.
    for (let i = 0; i < 50; i++) {
      const tx = rand() * width,
        r = 7 + rand() * 9,
        y = height * 0.9;
      wrap(tx, 20, (px) => {
        ctx.fillStyle = hazed(
          night ? "#0c1420" : "#4c7a42",
          haze,
          night ? 0.1 : 0.35,
        );
        ctx.beginPath();
        ctx.arc(px, y - r, r, 0, 7);
        ctx.fill();
      });
    }
    ctx.fillStyle = hazed(
      night ? "#0c1420" : "#5a7c50",
      haze,
      night ? 0.2 : 0.4,
    );
    ctx.fillRect(0, height * 0.9, width, height * 0.1);
  } else if (kind === "islands") {
    for (let i = 0; i < 5; i++) {
      const x = rand() * width,
        w = 120 + rand() * 200,
        h = 18 + rand() * 30;
      wrap(x, w, (px) => {
        ctx.fillStyle = hazed("#5f8a66", haze, 0.6);
        ctx.beginPath();
        ctx.moveTo(px - w / 2, base);
        ctx.quadraticCurveTo(px - w * 0.2, base - h * 1.4, px, base - h);
        ctx.quadraticCurveTo(px + w * 0.25, base - h * 1.6, px + w / 2, base);
        ctx.fill();
      });
    }
    // Sailing boats.
    for (let i = 0; i < 4; i++) {
      const x = rand() * width;
      wrap(x, 20, (px) => {
        ctx.fillStyle = hazed("#ffffff", haze, 0.2);
        ctx.beginPath();
        ctx.moveTo(px, base - 34);
        ctx.lineTo(px, base - 8);
        ctx.lineTo(px + 14, base - 8);
        ctx.fill();
        ctx.fillStyle = hazed("#c0503a", haze, 0.3);
        ctx.fillRect(px - 8, base - 8, 26, 5);
      });
    }
  }
  // Blend the foot into the haze colour.
  const foot = ctx.createLinearGradient(0, height * 0.8, 0, height);
  foot.addColorStop(
    0,
    hazed(haze, haze, 0).replace("rgb", "rgba").replace(")", ",0)"),
  );
  foot.addColorStop(
    1,
    hazed(haze, haze, 0).replace("rgb", "rgba").replace(")", ",1)"),
  );
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = foot;
  ctx.fillRect(0, height * 0.8, width, height * 0.2);
  ctx.globalCompositeOperation = "source-over";
  if (outWidth === width && outHeight === height) return c;
  const small = canvas(outWidth, outHeight);
  small.ctx.drawImage(c, 0, 0, outWidth, outHeight);
  return small.canvas;
}
