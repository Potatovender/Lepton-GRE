import type { AnimationClock, AnimationClockOptions } from "./clock.js";

export type SceneClockOptions = Omit<AnimationClockOptions, "entries" | "evaluate" | "dependsOnTime">;

/**
 * Clones an applied Lepton scene, uses the shared compiler for scalar evaluation,
 * and resolves transitive time/coordinate dependencies with lexical parameter scopes.
 * scene.functions supplies actual time sliders; closed folders still participate.
 * Errors identify the time entry/start/rate/range being evaluated. No graph mutation,
 * DOM access or changes to source scene values, settings or playback state.
 */
export function createSceneClock(scene: object, options?: SceneClockOptions): AnimationClock;
