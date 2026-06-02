/**
 * @module InterchangeValidator
 * Validates a VideoForge Project and IntermediateTimeline before export.
 *
 * Returns structured { valid, errors[], warnings[] } objects at every level.
 */

import { CLIP_TYPES, TRACK_TYPES, ASSET_TYPES } from '../../utils/Constants.js';

/**
 * @typedef {object} ValidationResult
 * @property {boolean}   valid
 * @property {string[]}  errors
 * @property {string[]}  warnings
 */

class InterchangeValidator {
  // ─── Top-level project validation ────────────────────────────────────────────

  /**
   * Validate a VideoForge Project instance.
   * @param {object} project
   * @returns {ValidationResult}
   */
  validateProject(project) {
    const errors = [];
    const warnings = [];

    if (!project) {
      return { valid: false, errors: ['Project is null or undefined'], warnings: [] };
    }

    if (!project.id) warnings.push('Project is missing an ID');
    if (!project.name) warnings.push('Project has no name');

    const fps = project.fps ?? 30;
    if (fps <= 0 || fps > 240) {
      errors.push(`Invalid project fps: ${fps}. Expected value in range (0, 240].`);
    }

    const width  = project.width  ?? 1920;
    const height = project.height ?? 1080;
    if (width <= 0 || height <= 0) {
      errors.push(`Invalid project dimensions: ${width}×${height}`);
    }

    const tracks = this._getTracks(project);
    if (tracks.length === 0) {
      warnings.push('Project has no tracks');
    }

    // Recurse into tracks
    for (const track of tracks) {
      const tr = this.validateTrack(track, project);
      errors.push(...tr.errors);
      warnings.push(...tr.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── IntermediateTimeline validation ─────────────────────────────────────────

  /**
   * Validate an IntermediateTimeline instance.
   * @param {object} itr
   * @returns {ValidationResult}
   */
  validateTimeline(itr) {
    const errors = [];
    const warnings = [];

    if (!itr) {
      return { valid: false, errors: ['IntermediateTimeline is null or undefined'], warnings: [] };
    }

    if (itr.fps <= 0) errors.push(`ITR fps must be > 0, got: ${itr.fps}`);
    if (itr.width <= 0 || itr.height <= 0) errors.push(`ITR dimensions invalid: ${itr.width}×${itr.height}`);
    if (itr.duration < 0) errors.push(`ITR duration is negative: ${itr.duration}`);

    const assetResult = this.validateAssets(itr.assets);
    errors.push(...assetResult.errors);
    warnings.push(...assetResult.warnings);

    const trackResult = this.validateTracks(itr.tracks, itr);
    errors.push(...trackResult.errors);
    warnings.push(...trackResult.warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Asset validation ─────────────────────────────────────────────────────────

  /**
   * @param {import('../AssetReference.js').default[]} assets
   * @returns {ValidationResult}
   */
  validateAssets(assets) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(assets)) {
      return { valid: false, errors: ['Assets must be an array'], warnings: [] };
    }

    const seenIds = new Set();
    for (const asset of assets) {
      if (!asset.id) {
        errors.push('Asset is missing an ID');
        continue;
      }
      if (seenIds.has(asset.id)) {
        errors.push(`Duplicate asset ID: "${asset.id}"`);
      }
      seenIds.add(asset.id);

      if (!asset.path) {
        warnings.push(`Asset "${asset.id}" has no file path`);
      }
      if (!asset.type) {
        warnings.push(`Asset "${asset.id}" has no type`);
      }
      if (asset.type === ASSET_TYPES.VIDEO && asset.fps === 0) {
        warnings.push(`Video asset "${asset.id}" has fps=0; export may use project fps`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Track validation ─────────────────────────────────────────────────────────

  /**
   * @param {import('../TrackRepresentation.js').default[]} tracks
   * @param {object} [itr] - Parent ITR for cross-reference checks.
   * @returns {ValidationResult}
   */
  validateTracks(tracks, itr) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(tracks)) {
      return { valid: false, errors: ['Tracks must be an array'], warnings: [] };
    }

    const seenIds = new Set();
    for (const track of tracks) {
      if (!track.id) errors.push('Track is missing an ID');
      if (seenIds.has(track.id)) errors.push(`Duplicate track ID: "${track.id}"`);
      seenIds.add(track.id);

      if (!track.type) errors.push(`Track "${track.id}" has no type`);

      const clipResult = this.validateClips(track.clips ?? [], itr);
      errors.push(...clipResult.errors.map((e) => `Track "${track.name || track.id}": ${e}`));
      warnings.push(...clipResult.warnings.map((w) => `Track "${track.name || track.id}": ${w}`));
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single VideoForge Track instance.
   * @param {object} track
   * @param {object} project
   * @returns {ValidationResult}
   */
  validateTrack(track, project) {
    const errors = [];
    const warnings = [];

    if (!track.id) warnings.push('Track missing id');
    if (!track.type) warnings.push(`Track "${track.id}" missing type`);

    const clips = typeof track.getClips === 'function' ? track.getClips() : track._clips ?? [];
    for (const clip of clips) {
      const cr = this.validateClip(clip, project);
      errors.push(...cr.errors.map((e) => `Clip "${clip.id}": ${e}`));
      warnings.push(...cr.warnings.map((w) => `Clip "${clip.id}": ${w}`));
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Clip validation ──────────────────────────────────────────────────────────

  /**
   * @param {import('../ClipRepresentation.js').default[]} clips
   * @param {object} [itr]
   * @returns {ValidationResult}
   */
  validateClips(clips, itr) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(clips)) {
      return { valid: false, errors: ['Clips must be an array'], warnings: [] };
    }

    const seenIds = new Set();
    for (const clip of clips) {
      if (!clip.id) errors.push('Clip is missing an ID');
      if (seenIds.has(clip.id)) errors.push(`Duplicate clip ID: "${clip.id}"`);
      seenIds.add(clip.id);

      if (clip.timelineEnd <= clip.timelineStart) {
        errors.push(`Clip "${clip.id}" has zero or negative timeline duration (${clip.timelineStart} → ${clip.timelineEnd})`);
      }

      if (clip.assetId && itr) {
        const asset = itr.assets.find((a) => a.id === clip.assetId);
        if (!asset) {
          warnings.push(`Clip "${clip.id}" references unknown asset ID "${clip.assetId}"`);
        }
      }

      if (clip.captionData) {
        const cr = this.validateCaptions(clip.captionData);
        errors.push(...cr.errors.map((e) => `Caption: ${e}`));
        warnings.push(...cr.warnings.map((w) => `Caption: ${w}`));
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single VideoForge Clip instance.
   * @param {object} clip
   * @param {object} project
   * @returns {ValidationResult}
   */
  validateClip(clip, project) {
    const errors = [];
    const warnings = [];

    if (clip.startTime < 0) {
      errors.push('startTime is negative');
    }
    if (clip.duration != null && clip.duration <= 0) {
      warnings.push('Clip has zero or negative duration');
    }
    if (clip.inPoint > clip.outPoint) {
      errors.push(`inPoint (${clip.inPoint}) > outPoint (${clip.outPoint})`);
    }
    if (clip.asset) {
      if (!clip.asset.src && !clip.asset.path) {
        warnings.push('Asset has no file path');
      }
    }

    const effectResult = this.validateEffects(clip.effects ?? [], project);
    errors.push(...effectResult.errors);
    warnings.push(...effectResult.warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Effect validation ────────────────────────────────────────────────────────

  /**
   * @param {Array} effects
   * @param {object} [context]
   * @returns {ValidationResult}
   */
  validateEffects(effects, context) {
    const errors = [];
    const warnings = [];

    if (!Array.isArray(effects)) return { valid: true, errors, warnings };

    for (const effect of effects) {
      if (!effect.id) warnings.push('Effect missing id');
      if (!effect.type) warnings.push(`Effect "${effect.id}" missing type`);
      if (effect.duration != null && effect.duration < 0) {
        errors.push(`Effect "${effect.id}" has negative duration`);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Caption validation ───────────────────────────────────────────────────────

  /**
   * @param {import('../CaptionRepresentation.js').default} captionRep
   * @returns {ValidationResult}
   */
  validateCaptions(captionRep) {
    const errors = [];
    const warnings = [];

    if (!captionRep) return { valid: true, errors, warnings };

    if (!captionRep.transcript && captionRep.segments.length === 0) {
      warnings.push('Caption has no transcript and no segments');
    }

    for (const seg of captionRep.segments) {
      if (seg.startTime != null && seg.endTime != null && seg.endTime <= seg.startTime) {
        errors.push(`Segment has non-positive duration (${seg.startTime} → ${seg.endTime})`);
      }
    }

    if (captionRep.animations.length > 0) {
      warnings.push(
        `Caption has ${captionRep.animations.length} VideoForge-specific animation(s) that will be ` +
        'preserved in metadata but not natively exported',
      );
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _getTracks(project) {
    if (typeof project.getTracks === 'function') return project.getTracks();
    if (project.timeline && typeof project.timeline.getTracks === 'function') return project.timeline.getTracks();
    return project._tracks ?? [];
  }
}

export default InterchangeValidator;
