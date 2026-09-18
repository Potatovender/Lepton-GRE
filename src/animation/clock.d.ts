export type ScalarExpression = string | number;
export type TimeMode = "unbounded" | "bounded_looped" | "bounded";
export type Direction = 1 | -1;
export type Overrides<T> = ReadonlyMap<string, T> | Readonly<Record<string, T>>;

/** Pre-filter scene functions to actual time sliders before passing them here. */
export interface TimeEntry {
  id: string;
  expression: ScalarExpression;
  timeMode?: TimeMode;
  timeRate?: ScalarExpression;
  sliderMin?: ScalarExpression;
  sliderMax?: ScalarExpression;
}

export interface AnimationClockOptions {
  entries: readonly TimeEntry[];
  /** Finite numeric/scalar starts; defaults to entry.expression. Bounded starts must be in range. */
  starts?: Overrides<ScalarExpression>;
  /** A multiplier of the signed rate, used only for bouncing clocks. Default 1. */
  directions?: Overrides<Direction>;
  /** Omit to advance all clocks; [] freezes all clocks. Others remain visible at their starts. */
  selected?: Iterable<string>;
  /**
   * Synchronous, deterministic evaluator over the parent's frozen scene and random seed.
   * Reject coordinates and non-scalars here. Numeric literals do not call the evaluator.
   * Start resolution is lazy: use values.get(id) for referenced IDs instead of eagerly
   * spreading the whole map. Circular starting dependencies throw CIRCULAR_START.
   * The map implements ReadonlyMap but is not a mutable native Map.
   */
  evaluate?: (expression: ScalarExpression, values: ReadonlyMap<string, number>) => number;
  /**
   * Must include transitive dependencies and return true if uncertain. Selected IDs only
   * are changing; unselected IDs remain frozen. If omitted, all non-literal rates/bounds
   * conservatively use fixed steps. This callback must also use the frozen scene.
   */
  dependsOnTime?: (expression: ScalarExpression, selected: ReadonlySet<string>) => boolean;
  /** Fixed Euler step in seconds, default 1/120. Never derived from output FPS. */
  stepSeconds?: number;
  /** Maximum step evaluations per synchronous call, default 10,000. */
  maxSyncSteps?: number;
  /** Maximum step evaluations per asynchronous call, default 1,000,000. */
  maxAsyncSteps?: number;
  /** Save intermediate lattice states this often, default 120 steps. */
  checkpointInterval?: number;
  /** Total retained states, INCLUDING frame zero, default 32. */
  maxCheckpoints?: number;
}

export interface QueryOptions {
  /** Override the per-call simulation budget; no simulation is required for constant clocks. */
  maxSteps?: number;
}

export interface ClockProgress {
  completedSteps: number;
  totalSteps: number;
  secondsCompleted: number;
  secondsTarget: number;
}

export interface AsyncQueryOptions extends QueryOptions {
  signal?: AbortSignal;
  /** Yield after at most this many steps, default 240. */
  yieldEverySteps?: number;
  /** Also yield after this many milliseconds, default 8. A whole simulation step remains atomic. */
  yieldAfterMs?: number;
  /** Defaults to a setTimeout(0) task, not just a microtask. */
  yieldControl?: () => void | Promise<void>;
  onProgress?: (progress: ClockProgress) => void;
}

export interface ClockState {
  /** Detached native Maps, safe for caller edits; all time IDs are included. */
  values: Map<string, number>;
  directions: Map<string, Direction>;
}

export interface AnimationClock {
  valuesAt(seconds: number, options?: QueryOptions): Map<string, number>;
  valuesAtAsync(seconds: number, options?: AsyncQueryOptions): Promise<Map<string, number>>;
  stateAt(seconds: number, options?: QueryOptions): ClockState;
  stateAtAsync(seconds: number, options?: AsyncQueryOptions): Promise<ClockState>;
  /** Clear checkpoints and invalidate pending async seeks; keep the original starts/selection. */
  reset(): void;
  readonly info: Readonly<{
    mode: "closed-form" | "fixed-step";
    stepSeconds: number;
    clockCount: number;
    selectedCount: number;
    checkpointCount: number;
    maxCheckpoints: number;
  }>;
}

/**
 * Errors have a stable code and, where applicable, an entryId/property for diagnostics.
 * STEP_BUDGET does not return a partial frame. ABORTED and RESET cancel async seeks.
 */
export class AnimationClockError extends Error {
  readonly code: string;
  readonly entryId?: string;
  readonly property?: string;
  readonly requiredSteps?: number;
  readonly maxSteps?: number;
  constructor(code: string, message: string, details?: Record<string, unknown>);
}

/**
 * Constant rates/ranges use direct evaluation from the snapshot. Dynamic rates/ranges
 * use simultaneous forward Euler from the previous fixed-step state. Shrinking bounce
 * ranges clamp before motion; loops wrap into the sampled range; zero-width ranges hold.
 * Off-lattice queries use an uncached partial step. Output FPS/query order cannot change
 * future states. Invalid ranges, non-finite results and unsafe tick indices throw.
 * No source mutation, display rounding, wall-clock integration, DOM or rendering access.
 */
export function createAnimationClock(options: AnimationClockOptions): AnimationClock;
