/**
 * @module TransitionRepresentation
 * Canonical representation of a clip-to-clip transition in the ITR.
 */

import IdGenerator from '../utils/IdGenerator.js';

/** Transition alignment relative to the cut point. */
const TRANSITION_ALIGNMENT = Object.freeze({
  START_BLACK:  'startBlack',   // transition starts at the cut (outgoing is black for first half)
  END_BLACK:    'endBlack',     // transition ends at the cut
  CENTER:       'center',       // centered on the cut (requires handles on both clips)
  CUSTOM:       'custom',
});

class TransitionRepresentation {
  /**
   * @param {object} [data={}]
   * @param {string} [data.id]
   * @param {string} [data.type='crossDissolve']  - Interchange transition type.
   * @param {string} [data.videoForgeType='']     - Original VideoForge class name.
   * @param {number} [data.duration=0.5]          - Duration in seconds.
   * @param {string} [data.fromClipId='']         - ID of the outgoing clip.
   * @param {string} [data.toClipId='']           - ID of the incoming clip.
   * @param {string} [data.alignment]             - One of TRANSITION_ALIGNMENT.*
   * @param {object} [data.parameters={}]
   */
  constructor(data = {}) {
    this.id = data.id ?? IdGenerator.generate('trans');
    this.type = data.type ?? 'crossDissolve';
    this.videoForgeType = data.videoForgeType ?? '';
    this.duration = data.duration ?? 0.5;
    this.fromClipId = data.fromClipId ?? '';
    this.toClipId = data.toClipId ?? '';
    this.alignment = data.alignment ?? TRANSITION_ALIGNMENT.CENTER;
    this.parameters = data.parameters ?? {};
  }

  /**
   * Build from a VideoForge Transition effect instance.
   * @param {object} transition
   * @param {string} [fromClipId]
   * @param {string} [toClipId]
   * @returns {TransitionRepresentation}
   */
  static fromTransition(transition, fromClipId = '', toClipId = '') {
    return new TransitionRepresentation({
      id: transition.id,
      type: _mapTransitionType(transition.type ?? transition.transitionType ?? 'crossDissolve'),
      videoForgeType: transition.type ?? transition.transitionType ?? '',
      duration: transition.duration ?? 0.5,
      fromClipId,
      toClipId,
      alignment: transition.alignment ?? TRANSITION_ALIGNMENT.CENTER,
      parameters: transition.params ?? {},
    });
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      videoForgeType: this.videoForgeType,
      duration: this.duration,
      fromClipId: this.fromClipId,
      toClipId: this.toClipId,
      alignment: this.alignment,
      parameters: this.parameters,
    };
  }
}

function _mapTransitionType(vfType) {
  const map = {
    crossDissolve: 'crossDissolve',
    fade:          'crossDissolve',
    wipe:          'wipe',
    push:          'push',
    slide:         'slide',
    zoom:          'zoom',
    spin:          'spin',
    dip:           'dipToColor',
    dipToBlack:    'dipToBlack',
    dipToWhite:    'dipToWhite',
  };
  return map[String(vfType).toLowerCase()] ?? 'crossDissolve';
}

export default TransitionRepresentation;
export { TRANSITION_ALIGNMENT };
