/**
 * Energy voice-activity detector for the optional hands-free mode (client-safe, pure).
 *
 * Input is a loudness level in 0..1 (RMS of the microphone's time-domain samples), one reading every ~40 ms.
 *  - The start threshold follows the room: `max(minLevel, noiseFloor * startRatio)`; the noise floor is a slow average of
 *    the quiet frames, so a fan or a keyboard does not trigger it and a quiet room stays sensitive.
 *  - Speech starts only after `minSpeechMs` of loudness is accumulated (a leaky counter: short dips between syllables do not
 *    reset it, a single click never reaches it).
 *  - Hysteresis: speech continues while the level stays above a lower "stop" threshold, and ends after `hangoverMs` below it.
 *  - `scale` raises both thresholds (used while the Director is speaking, so its own voice leaking into the mic does not
 *    count as the founder interrupting).
 */

export interface VadConfig {
  /** Start threshold = noiseFloor * startRatio (but never below minLevel). */
  startRatio: number;
  /** Stop threshold = noiseFloor * stopRatio (but never below minLevel * 0.5); lower than the start threshold. */
  stopRatio: number;
  /** Absolute floor for the start threshold (RMS 0..1). */
  minLevel: number;
  /** Loudness that must accumulate before speech starts. */
  minSpeechMs: number;
  /** Quiet time that ends speech. */
  hangoverMs: number;
  /** Speech is ended by force after this long. */
  maxSpeechMs: number;
  /** Starting estimate of the room's noise level. */
  initialNoiseFloor: number;
  /** How fast the noise floor follows the quiet frames, per second (0..1). */
  noiseAdaptPerSecond: number;
  /** The noise floor never rises above this (a loud room is not "silence"). */
  maxNoiseFloor: number;
  /**
   * The first moments only measure the room (no speech is detected), so a constant hum that is already there when hands-free
   * starts is learned as noise instead of being taken for speech that never ends.
   */
  warmupMs: number;
}

export const DEFAULT_VAD: VadConfig = {
  startRatio: 3,
  stopRatio: 1.6,
  minLevel: 0.02,
  minSpeechMs: 160,
  hangoverMs: 900,
  maxSpeechMs: 120_000,
  initialNoiseFloor: 0.008,
  noiseAdaptPerSecond: 0.5,
  maxNoiseFloor: 0.05,
  warmupMs: 500,
};

/** Threshold multiplier while the Director is speaking (hands-free barge-in must be a clearly louder, deliberate voice). */
export const BARGE_IN_SCALE = 2.2;
/** Barge-in needs longer sustained speech than starting from silence. */
export const BARGE_IN_MIN_SPEECH_MS = 280;

export type VadEvent = "speech_start" | "speech_end";

export class EnergyVad {
  readonly cfg: VadConfig;
  private _speaking = false;
  private noise: number;
  private loudMs = 0;
  private lastLoud = 0;
  private speechStart = 0;
  private lastNow: number | null = null;
  private firstNow: number | null = null;

  constructor(cfg: Partial<VadConfig> = {}) {
    this.cfg = { ...DEFAULT_VAD, ...cfg };
    this.noise = this.cfg.initialNoiseFloor;
  }

  get speaking(): boolean {
    return this._speaking;
  }
  get noiseFloor(): number {
    return this.noise;
  }
  /** The level a frame must exceed to count as loud right now. */
  startThreshold(scale = 1): number {
    return Math.max(this.cfg.minLevel, this.noise * this.cfg.startRatio) * scale;
  }
  stopThreshold(scale = 1): number {
    return Math.max(this.cfg.minLevel * 0.5, this.noise * this.cfg.stopRatio) * scale;
  }

  reset(): void {
    this._speaking = false;
    this.loudMs = 0;
    this.lastNow = null;
    this.firstNow = null;
  }

  /**
   * Feed one reading. `now` is a millisecond clock (monotonic). Returns an event when speech starts or ends.
   * `minSpeechMs` overrides the config for this frame (barge-in uses a longer one).
   */
  process(level: number, now: number, scale = 1, minSpeechMs = this.cfg.minSpeechMs): VadEvent | null {
    const lvl = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    const dt = this.lastNow === null ? 0 : Math.max(0, Math.min(200, now - this.lastNow));
    this.lastNow = now;
    if (this.firstNow === null) this.firstNow = now;

    if (!this._speaking && now - this.firstNow < this.cfg.warmupMs) {
      // Measuring the room: everything counts as noise, and the estimate moves fast.
      this.noise = Math.min(this.cfg.maxNoiseFloor, this.noise + (lvl - this.noise) * 0.35);
      return null;
    }

    if (!this._speaking) {
      const start = this.startThreshold(scale);
      if (lvl >= start) {
        this.loudMs += dt || 40;
        if (this.loudMs >= minSpeechMs) {
          this._speaking = true;
          this.speechStart = now;
          this.lastLoud = now;
          this.loudMs = 0;
          return "speech_start";
        }
      } else {
        // Leaky: gaps between syllables erode the count slowly; sustained quiet clears it.
        this.loudMs = Math.max(0, this.loudMs - dt * 0.5);
        // Only quiet frames teach the noise floor.
        const a = Math.min(1, this.cfg.noiseAdaptPerSecond * (dt / 1000));
        this.noise = Math.min(this.cfg.maxNoiseFloor, this.noise + (lvl - this.noise) * a);
      }
      return null;
    }

    if (lvl >= this.stopThreshold(scale)) this.lastLoud = now;
    if (now - this.lastLoud >= this.cfg.hangoverMs || now - this.speechStart >= this.cfg.maxSpeechMs) {
      this._speaking = false;
      this.loudMs = 0;
      return "speech_end";
    }
    return null;
  }
}

// ------------------------------------------------------------------------------------------------ level math

/** RMS (0..1) of float samples in -1..1. */
export function rmsFloat(samples: ArrayLike<number>): number {
  const n = samples.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = samples[i]!;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

/** RMS (0..1) of an AnalyserNode `getByteTimeDomainData` buffer (unsigned bytes centred on 128). */
export function rmsByteTimeDomain(bytes: ArrayLike<number>): number {
  const n = bytes.length;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (bytes[i]! - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / n);
}

/**
 * Map a speech RMS to a mouth opening 0..1. Speech sits around 0.03..0.25; below `gate` the mouth is closed.
 * The curve is gentle so quiet syllables still move the beak.
 */
export function mouthFromLevel(level: number, gate = 0.012, full = 0.18): number {
  if (!Number.isFinite(level) || level <= gate) return 0;
  const t = Math.min(1, (level - gate) / (full - gate));
  return Math.pow(t, 0.75);
}

/** A level that rises fast and falls slowly (for meters and the mouth). `dtMs` is the time since the last reading. */
export function smoothLevel(prev: number, next: number, dtMs: number, attackPerSec = 30, releasePerSec = 12): number {
  const rate = next > prev ? attackPerSec : releasePerSec;
  const k = 1 - Math.exp((-rate * Math.max(0, dtMs)) / 1000);
  return prev + (next - prev) * k;
}
