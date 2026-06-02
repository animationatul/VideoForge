/**
 * @module IntermediateTimeline
 * Canonical Intermediate Timeline Representation (ITR).
 *
 * All exporters (Premiere, FCPXML, EDL, etc.) consume this format rather than
 * reading from Project directly, ensuring a single conversion path and
 * consistent treatment of unsupported features.
 *
 * Structure:
 *   IntermediateTimeline
 *     ├── assets[]        → AssetReference
 *     ├── tracks[]        → TrackRepresentation
 *     │     └── clips[]  → ClipRepresentation
 *     │           ├── effects[]    → EffectRepresentation
 *     │           ├── transitions  → TransitionRepresentation
 *     │           └── captionData → CaptionRepresentation
 *     ├── markers[]
 *     └── metadata        (videoForge namespace payload)
 */

const ITR_VERSION = '1.0';

class IntermediateTimeline {
  /**
   * @param {object} [options={}]
   * @param {string}  [options.projectId='']
   * @param {string}  [options.name='Untitled']
   * @param {number}  [options.fps=30]
   * @param {number}  [options.width=1920]
   * @param {number}  [options.height=1080]
   * @param {number}  [options.sampleRate=48000]
   * @param {number}  [options.channels=2]
   * @param {number}  [options.duration=0]
   * @param {object}  [options.metadata={}]
   */
  constructor(options = {}) {
    /** @type {string} */
    this.version = ITR_VERSION;

    /** @type {string} */
    this.projectId = options.projectId ?? '';

    /** @type {string} */
    this.name = options.name ?? 'Untitled';

    /** @type {number} */
    this.fps = options.fps ?? 30;

    /** @type {number} */
    this.width = options.width ?? 1920;

    /** @type {number} */
    this.height = options.height ?? 1080;

    /** @type {number} */
    this.sampleRate = options.sampleRate ?? 48000;

    /** @type {number} */
    this.channels = options.channels ?? 2;

    /** @type {number} */
    this.duration = options.duration ?? 0;

    /** @type {import('./AssetReference.js').default[]} */
    this.assets = [];

    /** @type {import('./TrackRepresentation.js').default[]} */
    this.tracks = [];

    /**
     * Timeline markers.
     * @type {Array<{id: string, time: number, name: string, color: string, type: string}>}
     */
    this.markers = [];

    /**
     * Metadata bag — includes videoForge namespace payload for unsupported features.
     * @type {object}
     */
    this.metadata = options.metadata ?? {};
  }

  // ─── Asset management ─────────────────────────────────────────────────────────

  /**
   * Add or replace an asset.
   * @param {import('./AssetReference.js').default} asset
   * @returns {IntermediateTimeline}
   */
  addAsset(asset) {
    const existing = this.assets.findIndex((a) => a.uid === asset.uid);
    if (existing >= 0) {
      this.assets[existing] = asset;
    } else {
      this.assets.push(asset);
    }
    return this;
  }

  /**
   * Look up an asset by ID.
   * @param {string} id
   * @returns {import('./AssetReference.js').default|undefined}
   */
  getAsset(id) {
    return this.assets.find((a) => a.id === id);
  }

  // ─── Track accessors ──────────────────────────────────────────────────────────

  /**
   * @returns {import('./TrackRepresentation.js').default[]}
   */
  getVideoTracks() {
    return this.tracks.filter((t) => t.type === 'video' || t.type === 'image');
  }

  /**
   * @returns {import('./TrackRepresentation.js').default[]}
   */
  getAudioTracks() {
    return this.tracks.filter((t) => t.type === 'audio');
  }

  /**
   * @returns {import('./TrackRepresentation.js').default[]}
   */
  getCaptionTracks() {
    return this.tracks.filter((t) => t.type === 'caption');
  }

  /**
   * @returns {import('./TrackRepresentation.js').default[]}
   */
  getTextTracks() {
    return this.tracks.filter((t) => t.type === 'text' || t.type === 'shape');
  }

  // ─── Computed properties ──────────────────────────────────────────────────────

  /**
   * Recompute and cache the total timeline duration.
   * @returns {number}
   */
  computeDuration() {
    if (this.tracks.length === 0) return 0;
    const max = Math.max(0, ...this.tracks.map((t) => t.duration));
    this.duration = max;
    return max;
  }

  /**
   * Collect all unique asset IDs referenced by clips in this timeline.
   * @returns {Set<string>}
   */
  getReferencedAssetIds() {
    const ids = new Set();
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        if (clip.assetId) ids.add(clip.assetId);
      }
    }
    return ids;
  }

  /**
   * Return a flat array of all ClipRepresentations across all tracks.
   * @returns {import('./ClipRepresentation.js').default[]}
   */
  getAllClips() {
    return this.tracks.flatMap((t) => t.clips);
  }

  // ─── Serialization ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      version:    this.version,
      projectId:  this.projectId,
      name:       this.name,
      fps:        this.fps,
      width:      this.width,
      height:     this.height,
      sampleRate: this.sampleRate,
      channels:   this.channels,
      duration:   this.duration,
      assets:     this.assets.map((a) => a.toJSON()),
      tracks:     this.tracks.map((t) => t.toJSON()),
      markers:    this.markers,
      metadata:   this.metadata,
    };
  }
}

export default IntermediateTimeline;
export { ITR_VERSION };
