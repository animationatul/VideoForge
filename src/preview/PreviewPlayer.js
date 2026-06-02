/**
 * @module PreviewPlayer
 * Drives playback of a project's preview by advancing the playhead in
 * real-time and triggering PreviewRenderer on each frame.
 *
 * PreviewPlayer is intentionally decoupled from any specific timing mechanism:
 * it uses `requestAnimationFrame` when available (browser) and falls back to
 * `setInterval`/`performance.now` in Node.js, allowing the same class to run
 * in both environments.
 */

import { PLAYER_STATE } from '../utils/Constants.js';

class PreviewPlayer {
  /**
   * @param {import('./PreviewRenderer.js').default} renderer
   * @param {import('../core/Timeline.js').default} timeline
   * @param {object} [options={}]
   * @param {number}  [options.startTime=0]    - Initial playhead position (s).
   * @param {boolean} [options.loop=false]     - Loop when the end is reached.
   * @param {Function}[options.onFrame]        - Called each frame: (time, frame) => void.
   * @param {Function}[options.onStateChange]  - Called on state transitions.
   * @param {Function}[options.onEnded]        - Called when playback ends.
   */
  constructor(renderer, timeline, options = {}) {
    /** @type {import('./PreviewRenderer.js').default} */
    this.renderer = renderer;

    /** @type {import('../core/Timeline.js').default} */
    this.timeline = timeline;

    /** @type {number} Current playhead time in seconds. */
    this._currentTime = options.startTime ?? 0;

    /** @type {string} One of PLAYER_STATE.* */
    this._state = PLAYER_STATE.IDLE;

    /** @type {boolean} */
    this.loop = options.loop ?? false;

    /** @type {Function|null} */
    this.onFrame = options.onFrame ?? null;

    /** @type {Function|null} */
    this.onStateChange = options.onStateChange ?? null;

    /** @type {Function|null} */
    this.onEnded = options.onEnded ?? null;

    /** @type {number|null} Interval or rAF handle. */
    this._timerHandle = null;

    /** @type {number} Wall-clock time when play() was last called (ms). */
    this._playStartWallClock = 0;

    /** @type {number} Playhead time when play() was last called (s). */
    this._playStartTime = 0;
  }

  // ─── Playback controls ────────────────────────────────────────────────────────

  /**
   * Start or resume playback from the current time.
   * @returns {PreviewPlayer} this (chainable)
   */
  play() {
    if (this._state === PLAYER_STATE.PLAYING) return this;

    this._playStartWallClock = this._now();
    this._playStartTime = this._currentTime;
    this._setState(PLAYER_STATE.PLAYING);
    this._scheduleNextFrame();
    return this;
  }

  /**
   * Pause playback at the current position.
   * @returns {PreviewPlayer} this (chainable)
   */
  pause() {
    if (this._state !== PLAYER_STATE.PLAYING) return this;
    this._cancelTimer();
    this._setState(PLAYER_STATE.PAUSED);
    return this;
  }

  /**
   * Stop playback and reset the playhead to 0.
   * @returns {PreviewPlayer} this (chainable)
   */
  stop() {
    this._cancelTimer();
    this._currentTime = 0;
    this._setState(PLAYER_STATE.IDLE);
    return this;
  }

  /**
   * Move the playhead to an absolute time.
   * @param {number} time - Seconds.
   * @returns {PreviewPlayer} this (chainable)
   */
  seek(time) {
    const duration = this.timeline.getTotalDuration();
    this._currentTime = Math.min(Math.max(time, 0), duration);

    if (this._state === PLAYER_STATE.PLAYING) {
      // Re-anchor wall-clock so speed stays correct after a seek.
      this._playStartWallClock = this._now();
      this._playStartTime = this._currentTime;
    }
    return this;
  }

  // ─── State queries ────────────────────────────────────────────────────────────

  /** @returns {number} Current playhead position in seconds. */
  get currentTime() {
    if (this._state === PLAYER_STATE.PLAYING) {
      const elapsed = (this._now() - this._playStartWallClock) / 1000;
      return this._playStartTime + elapsed;
    }
    return this._currentTime;
  }

  /** @returns {string} One of PLAYER_STATE.* */
  get state() {
    return this._state;
  }

  /** @returns {boolean} */
  get isPlaying() {
    return this._state === PLAYER_STATE.PLAYING;
  }

  /** @returns {boolean} */
  get isPaused() {
    return this._state === PLAYER_STATE.PAUSED;
  }

  // ─── Internal tick loop ───────────────────────────────────────────────────────

  _scheduleNextFrame() {
    if (typeof requestAnimationFrame !== 'undefined') {
      // Browser environment.
      this._timerHandle = requestAnimationFrame(() => this._tick());
    } else {
      // Node.js environment — approximate at the project fps.
      const interval = Math.round(1000 / this.timeline.fps);
      this._timerHandle = setInterval(() => this._tick(), interval);
    }
  }

  _cancelTimer() {
    if (this._timerHandle === null) return;
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._timerHandle);
    } else {
      clearInterval(this._timerHandle);
    }
    this._timerHandle = null;
  }

  async _tick() {
    if (this._state !== PLAYER_STATE.PLAYING) return;

    const t = this.currentTime;
    const duration = this.timeline.getTotalDuration();

    if (t >= duration) {
      this._currentTime = duration;
      if (this.loop) {
        this.seek(0).play();
      } else {
        this._cancelTimer();
        this._setState(PLAYER_STATE.ENDED);
        this.onEnded?.();
      }
      return;
    }

    this._currentTime = t;

    // TODO: Await renderer.render(t), then pass frame to onFrame.
    try {
      const frame = await this.renderer.render(t);
      this.onFrame?.(t, frame);
    } catch {
      // TODO: Emit render errors rather than swallowing them.
    }

    if (this._state === PLAYER_STATE.PLAYING) {
      // Only re-schedule for rAF; setInterval is self-repeating.
      if (typeof requestAnimationFrame !== 'undefined') {
        this._scheduleNextFrame();
      }
    }
  }

  _setState(newState) {
    if (this._state === newState) return;
    const prev = this._state;
    this._state = newState;
    this.onStateChange?.(newState, prev);
  }

  _now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}

export default PreviewPlayer;
