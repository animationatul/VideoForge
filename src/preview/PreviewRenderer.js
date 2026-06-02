/**
 * @module PreviewRenderer
 * Composites a single timeline frame from the active clip stack.
 *
 * PreviewRenderer is environment-agnostic by design: the actual pixel
 * operations are delegated to a pluggable `backend` (Canvas2D, WebGL,
 * node-canvas, OffscreenCanvas, etc.).  This class provides the compositing
 * logic and effect pipeline dispatch.
 */

class PreviewRenderer {
  /**
   * @param {import('../core/Timeline.js').default} timeline
   * @param {object} [options={}]
   * @param {object} [options.backend=null] - Rendering backend instance.
   *        Expected interface: { clear(), drawVideo(), drawImage(), drawText(),
   *          drawShape(), applyEffect(), getFrame() }
   */
  constructor(timeline, options = {}) {
    /** @type {import('../core/Timeline.js').default} */
    this.timeline = timeline;

    /** @type {object|null} */
    this.backend = options.backend ?? null;

    /** @type {number} Last rendered frame number. */
    this._lastFrame = -1;

    /** @type {boolean} */
    this._rendering = false;
  }

  // ─── Core render API ─────────────────────────────────────────────────────────

  /**
   * Composite all active clips at `time` and return a frame.
   *
   * @param {number} time - Timeline position in seconds.
   * @returns {Promise<object>} Resolves to a backend-specific frame object.
   */
  async render(time) {
    if (this._rendering) {
      throw new Error('PreviewRenderer.render() called while a render is already in progress.');
    }

    // TODO: Implement the compositing pipeline:
    //   1. Resolve clips active at `time` via this.timeline.getClipsAtTime(time).
    //   2. Sort by track z-order (bottom → top).
    //   3. For each clip:
    //      a. Determine effective in-source time: inPoint + (time - startTime).
    //      b. Invoke the appropriate backend draw method (drawVideo, drawImage, etc.).
    //      c. Apply all enabled effects in clip.effects order.
    //   4. Composite audio levels from audio clips.
    //   5. Return the backend frame object.

    this._rendering = true;
    try {
      this._ensureBackend();
      this.backend.clear();

      const clips = this.timeline.getClipsAtTime(time);
      // TODO: Iterate clips and dispatch to backend.

      this._lastFrame = this.timeline.timeToFrame(time);
      return this.backend.getFrame();
    } finally {
      this._rendering = false;
    }
  }

  /**
   * Render every frame in the range [startTime, endTime) and invoke the
   * callback with each frame.
   *
   * @param {number} startTime
   * @param {number} endTime
   * @param {function(object, number): Promise<void>} onFrame - Called per frame with (frame, frameNumber).
   * @returns {Promise<void>}
   */
  async renderRange(startTime, endTime, onFrame) {
    const fps = this.timeline.fps;
    const startFrame = this.timeline.timeToFrame(startTime);
    const endFrame = this.timeline.timeToFrame(endTime);

    for (let f = startFrame; f < endFrame; f++) {
      const t = this.timeline.frameToTime(f);
      const frame = await this.render(t);
      await onFrame(frame, f);
    }
  }

  /**
   * Return the composited frame at `time` without invoking a full render cycle.
   * Intended for thumbnail / seek-preview use.
   *
   * @param {number} time
   * @returns {Promise<object>}
   */
  async getFrame(time) {
    // TODO: Implement fast thumbnail extraction.
    //       For video clips this might seek to the nearest keyframe.
    return this.render(time);
  }

  // ─── Backend management ───────────────────────────────────────────────────────

  /**
   * Attach or replace the rendering backend.
   * @param {object} backend
   * @returns {PreviewRenderer} this (chainable)
   */
  setBackend(backend) {
    this.backend = backend;
    return this;
  }

  _ensureBackend() {
    if (!this.backend) {
      throw new Error(
        'PreviewRenderer has no backend. Call setBackend() before rendering.\n' +
        'Available backends: Canvas2DBackend (browser), NodeCanvasBackend (Node.js), WebGLBackend.'
      );
    }
  }
}

export default PreviewRenderer;
