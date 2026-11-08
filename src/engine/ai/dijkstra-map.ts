/**
 * Pure Dijkstra Map Solver & Grid Algebra
 * High-performance Float32Array multi-goal distance/influence field solver for roguelike ECS.
 */

export const DIJKSTRA_IMPASSABLE = Infinity;
export const DIJKSTRA_UNSET = 1e9;

export interface DijkstraSeed {
  x: number;
  y: number;
  /** Goal weight (default 0; negative values create stronger attraction sinks). */
  value?: number;
}

export interface DijkstraPassabilityFn {
  /**
   * Returns traversal cost for entering (x, y), or Infinity if impassable.
   * Standard walkable floor = 1.0; DeadZone hazard = 6.0; destructible prop = 3.0.
   */
  (x: number, y: number): number;
}

export class DijkstraMap {
  public readonly width: number;
  public readonly height: number;
  public readonly data: Float32Array;

  constructor(width: number, height: number, initialData?: Float32Array) {
    this.width = width;
    this.height = height;
    this.data = initialData ?? new Float32Array(width * height).fill(DIJKSTRA_UNSET);
  }

  public index(x: number, y: number): number {
    return y * this.width + x;
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return DIJKSTRA_IMPASSABLE;
    return this.data[this.index(x, y)];
  }

  public set(x: number, y: number, value: number): void {
    if (this.inBounds(x, y)) {
      this.data[this.index(x, y)] = value;
    }
  }

  /**
   * Computes the Dijkstra map from a set of seed coordinates using a fast,
   * bounded-memory Shortest Path Faster Algorithm (SPFA) with Small Label to First (SLF) optimization.
   */
  public compute(seeds: DijkstraSeed[], getStepCost: DijkstraPassabilityFn): this {
    this.data.fill(DIJKSTRA_UNSET);
    const len = this.width * this.height;
    const queueCapacity = len * 2;
    const queue = new Int32Array(queueCapacity);
    const inQueue = new Uint8Array(len);
    let head = 0;
    let tail = 0;

    for (const seed of seeds) {
      if (!this.inBounds(seed.x, seed.y)) continue;
      const idx = this.index(seed.x, seed.y);
      const val = seed.value ?? 0;
      if (val < this.data[idx]) {
        this.data[idx] = val;
        if (!inQueue[idx]) {
          queue[tail] = idx;
          tail = (tail + 1) % queueCapacity;
          inQueue[idx] = 1;
        }
      }
    }

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;

    while (head !== tail) {
      const currIdx = queue[head];
      head = (head + 1) % queueCapacity;
      inQueue[currIdx] = 0;

      const currVal = this.data[currIdx];
      const cx = currIdx % this.width;
      const cy = (currIdx - cx) / this.width;

      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;

        const stepCost = getStepCost(nx, ny);
        if (!Number.isFinite(stepCost) || stepCost < 0) continue;

        const nIdx = this.index(nx, ny);
        const candidate = currVal + stepCost;
        if (candidate < this.data[nIdx]) {
          this.data[nIdx] = candidate;
          if (!inQueue[nIdx]) {
            if (head !== tail && candidate < this.data[queue[head]]) {
              // Small Label to First (SLF) optimization: push lower values to front
              head = (head - 1 + queueCapacity) % queueCapacity;
              queue[head] = nIdx;
            } else {
              queue[tail] = nIdx;
              tail = (tail + 1) % queueCapacity;
            }
            inQueue[nIdx] = 1;
          }
        }
      }
    }

    return this;
  }

  /**
   * Produces a flee/kite map by multiplying finite values by a negative coefficient
   * (typically -1.2) and re-running relaxation so agents smoothly navigate around corners
   * and out of dead-ends rather than backing into walls.
   */
  public createFleeMap(
    getStepCost: DijkstraPassabilityFn,
    fleeCoefficient: number = -1.2,
  ): DijkstraMap {
    const inverted = new DijkstraMap(this.width, this.height);
    const seeds: DijkstraSeed[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const v = this.get(x, y);
        if (v > 0 && v < DIJKSTRA_UNSET && Number.isFinite(v)) {
          seeds.push({ x, y, value: v * fleeCoefficient });
        }
      }
    }
    return inverted.compute(seeds, getStepCost);
  }

  /**
   * Linearly combines multiple Dijkstra maps with weights:
   * result[i] = sum_k (maps[k].data[i] * weights[k])
   */
  public static combine(
    width: number,
    height: number,
    layers: Array<{ map: DijkstraMap; weight: number }>,
  ): DijkstraMap {
    const out = new DijkstraMap(width, height);
    const len = width * height;
    for (let i = 0; i < len; i++) {
      let sum = 0;
      let unreachable = false;
      for (const { map, weight } of layers) {
        const v = map.data[i];
        if (v >= DIJKSTRA_UNSET || !Number.isFinite(v)) {
          unreachable = true;
          break;
        }
        sum += v * weight;
      }
      out.data[i] = unreachable ? DIJKSTRA_UNSET : sum;
    }
    return out;
  }

  /**
   * Picks the best orthogonal step (dx, dy) from (fromX, fromY) by rolling downhill.
   * Uses a deterministic tie-breaker function `random()` when multiple neighbors tie.
   */
  public getBestStep(
    fromX: number,
    fromY: number,
    getDynamicPenalty?: (nx: number, ny: number) => number,
    random: () => number = () => 0,
  ): { dx: number; dy: number; targetScore: number } | null {
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    let bestScore = this.get(fromX, fromY);
    let candidates: Array<{ dx: number; dy: number; targetScore: number }> = [];

    for (const { dx, dy } of dirs) {
      const nx = fromX + dx;
      const ny = fromY + dy;
      const base = this.get(nx, ny);
      if (base >= DIJKSTRA_UNSET || !Number.isFinite(base)) continue;

      const penalty = getDynamicPenalty ? getDynamicPenalty(nx, ny) : 0;
      if (!Number.isFinite(penalty)) continue;

      const score = base + penalty;
      if (score < bestScore - 1e-5) {
        bestScore = score;
        candidates = [{ dx, dy, targetScore: score }];
      } else if (Math.abs(score - bestScore) <= 1e-5 && candidates.length > 0) {
        candidates.push({ dx, dy, targetScore: score });
      }
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];
    const idx = Math.floor(random() * candidates.length);
    return candidates[Math.min(idx, candidates.length - 1)];
  }
}
