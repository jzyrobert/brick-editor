/**
 * Random numbers for the photo path tracer (three-gpu-pathtracer's
 * "stratified list" mode: every pixel reads the same per-sample tuples, offset
 * by a per-pixel blue-noise value). The library's own sampler, once reset,
 * walks its 8⁴ strata in order: the third and fourth dimension of every tuple
 * stay in the first eighth of [0, 1) for 64 and 512 samples, which biases a
 * still until 64 samples and makes it look noisy for longer than it needs to.
 * This sampler replaces it: each tuple is a pair of R2 low-discrepancy
 * sequences (well stratified at every sample count, not only at powers of the
 * strata count) with seeded offsets, whose sample order is permuted within
 * blocks so different tuples (bounces, lobes) stay uncorrelated. Seeded:
 * reset() restarts the same sequence (repeatable captures).
 */

/** The plastic constant: R2 uses its reciprocal powers (Roberts, 2018). */
const PLASTIC = 1.324717957244746;
const A1 = 1 / PLASTIC,
  A2 = 1 / (PLASTIC * PLASTIC);
/** Samples whose order is permuted per tuple (a block keeps its points). */
export const SAMPLE_BLOCK = 16;

/** Small seeded PRNG (mulberry32), floats in [0, 1). */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Point `index` of the R2 sequence with an offset, in [0, 1)². */
export function r2(index: number, ox: number, oy: number): [number, number] {
  const x = ox + index * A1,
    y = oy + index * A2;
  return [x - Math.floor(x), y - Math.floor(y)];
}

/** Sampler with the interface three-gpu-pathtracer's StratifiedSamplesTexture
 * expects (`samples`, next, reset, reshuffle). */
export class PhotoSampler {
  private sample = 0;
  private random = seededRandom(1);
  private offsets: Float32Array;
  private orders: Uint8Array;
  constructor(
    readonly samples: Float32Array,
    private seed = 0x5eed,
  ) {
    const tuples = samples.length / 4;
    this.offsets = new Float32Array(tuples * 4);
    this.orders = new Uint8Array(tuples * 2 * SAMPLE_BLOCK);
    this.reset();
  }
  get tuples() {
    return this.samples.length / 4;
  }
  reset() {
    this.sample = 0;
    this.random = seededRandom(this.seed);
    for (let i = 0; i < this.offsets.length; i++)
      this.offsets[i] = this.random();
    this.shuffleBlock();
    this.write();
  }
  /** A new permutation of each tuple's order within the next block. */
  private shuffleBlock() {
    const orders = this.orders;
    for (let start = 0; start < orders.length; start += SAMPLE_BLOCK) {
      for (let i = 0; i < SAMPLE_BLOCK; i++) orders[start + i] = i;
      for (let i = SAMPLE_BLOCK - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        const t = orders[start + i];
        orders[start + i] = orders[start + j];
        orders[start + j] = t;
      }
    }
  }
  private write() {
    const block = Math.floor(this.sample / SAMPLE_BLOCK) * SAMPLE_BLOCK;
    const within = this.sample % SAMPLE_BLOCK;
    const { samples, offsets, orders } = this;
    for (let t = 0; t < this.tuples; t++) {
      const o = t * 4;
      const first = block + orders[t * 2 * SAMPLE_BLOCK + within];
      const second =
        block + orders[t * 2 * SAMPLE_BLOCK + SAMPLE_BLOCK + within];
      const [x, y] = r2(first, offsets[o], offsets[o + 1]);
      const [z, w] = r2(second, offsets[o + 2], offsets[o + 3]);
      samples[o] = x;
      samples[o + 1] = y;
      samples[o + 2] = z;
      samples[o + 3] = w;
    }
  }
  next() {
    this.sample++;
    if (this.sample % SAMPLE_BLOCK === 0) this.shuffleBlock();
    this.write();
    return this.samples;
  }
  reshuffle() {}
}

/** Highest sample-tuple index `v` the tracer's shader reads (`rand*( v )`). */
export function highestTupleIndex(fragmentShader: string) {
  let highest = -1;
  for (const match of fragmentShader.matchAll(/\brand[234]?\(\s*(\d+)\s*\)/g))
    highest = Math.max(highest, Number(match[1]));
  return highest;
}

/**
 * Size of the per-sample tuple texture. The shader reads tuple `v` of bounce
 * `b` at texel (v, b), but three-gpu-pathtracer 0.0.23 sizes the texture
 * `bounces + transmissiveBounces + 5` texels wide and 20 high: with 4 bounces
 * and 6 transmission bounces (15 wide) tuples 15 and 16 read outside it, and
 * with the phone's 4 + 4 (13 wide) tuples 13–16 do. Those random numbers are
 * then zero plus the pixel's fixed offset in every sample, which leaves a
 * per-pixel pattern that never converges. Width is at least one more than the
 * highest tuple index, height one more than the most bounces.
 */
export function tupleTextureSize(
  requested: { count: number; depth: number },
  highestTuple: number,
  bounces: number,
) {
  return {
    count: Math.max(requested.count, bounces + 1),
    depth: Math.max(requested.depth, highestTuple + 1),
  };
}

/** Offsets (in noise-texture widths) of the four copies of the blue noise that
 * rotate a pixel's four sample dimensions. */
const DIMENSION_SHIFTS = [
  [0, 0],
  [0.5, 0.25],
  [0.25, 0.625],
  [0.75, 0.875],
];

/**
 * Patch the path tracer's fragment shader (three-gpu-pathtracer 0.0.23) so
 * each pixel rotates every dimension of the shared sample tuples by its own
 * blue-noise value (four shifted copies of the noise texture), instead of all
 * four by the same value. With one value, neighbouring pixels differ only
 * along the diagonal of the sample space: their errors stay correlated, which
 * shows as tinted patches at low sample counts that no spatial filter can
 * remove. Returns the shader unchanged if it does not have the expected code.
 */
export function decorrelatePixels(fragmentShader: string) {
  const seed = "pixelSeed = texture( stratifiedOffsetTexture, uv );";
  const use = "return fract( stratifiedSample + pixelSeed.r );";
  if (!fragmentShader.includes(seed) || !fragmentShader.includes(use))
    return fragmentShader;
  const channel = ([x, y]: number[]) =>
    `texture( stratifiedOffsetTexture, fract( uv + vec2( ${x.toFixed(3)}, ${y.toFixed(3)} ) ) ).r`;
  return fragmentShader
    .replace(
      seed,
      `pixelSeed = vec4( ${DIMENSION_SHIFTS.map(channel).join(", ")} );`,
    )
    .replace(use, "return fract( stratifiedSample + pixelSeed );");
}
