/**
 * @module CaptionRepresentation
 * Canonical representation of a CaptionClip's data in the ITR.
 *
 * Includes flat text helpers and format-specific title generators for
 * Premiere (Motion Titles) and FCPXML (Connected Titles / Basic Title).
 * The full CaptionClip JSON is preserved in videoForgePayload for round-trips.
 */

class CaptionRepresentation {
  /**
   * @param {object} [data={}]
   * @param {string} [data.transcript='']
   * @param {Array}  [data.segments=[]]      - CaptionSegment plain objects.
   * @param {object} [data.style={}]         - CaptionStyle plain object.
   * @param {object} [data.layout={}]        - CaptionLayout plain object.
   * @param {Array}  [data.animations=[]]    - CaptionAnimation plain objects.
   * @param {Array}  [data.effects=[]]       - CaptionEffect plain objects.
   * @param {string} [data.presetName=null]
   * @param {Array}  [data.highlightRules=[]]
   * @param {object} [data.karaokeRules=null]
   * @param {object} [data.motionTypographyRules=null]
   * @param {object} [data.videoForgePayload={}] - Full CaptionClip.toJSON() for round-trip.
   */
  constructor(data = {}) {
    this.transcript           = data.transcript           ?? '';
    this.segments             = data.segments             ?? [];
    this.style                = data.style                ?? {};
    this.layout               = data.layout               ?? {};
    this.animations           = data.animations           ?? [];
    this.effects              = data.effects              ?? [];
    this.presetName           = data.presetName           ?? null;
    this.highlightRules       = data.highlightRules       ?? [];
    this.karaokeRules         = data.karaokeRules         ?? null;
    this.motionTypographyRules = data.motionTypographyRules ?? null;
    this.videoForgePayload    = data.videoForgePayload    ?? {};
  }

  // ─── Text helpers ─────────────────────────────────────────────────────────────

  /**
   * Return the transcript as plain text.
   * @returns {string}
   */
  flattenToText() {
    if (this.transcript) return this.transcript;
    if (this.segments.length === 0) return '';
    return this.segments
      .map((seg) =>
        (seg.words ?? []).map((w) => w.text ?? w.word ?? '').join(' '),
      )
      .join('\n');
  }

  /**
   * Return a WebVTT subtitle file string from segment timing.
   * Falls back to block-level start/end times if word-level is unavailable.
   * @returns {string}
   */
  toWebVtt() {
    const lines = ['WEBVTT', ''];
    let cueIndex = 1;

    for (const seg of this.segments) {
      const startTime = seg.startTime ?? 0;
      const endTime   = seg.endTime   ?? (startTime + 2);
      const text      = (seg.words ?? []).map((w) => w.text ?? w.word ?? '').join(' ');

      if (!text.trim()) continue;

      lines.push(String(cueIndex++));
      lines.push(`${_vttTime(startTime)} --> ${_vttTime(endTime)}`);
      lines.push(text.trim());
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate a simplified Premiere Motion Title descriptor.
   * Returns a plain object that PremiereXmlExporter renders as a <generatoritem>.
   * @param {number} timelineStart - Clip start time on the timeline (seconds).
   * @param {number} timelineEnd
   * @returns {object}
   */
  toPremiereTitle(timelineStart, timelineEnd) {
    const fontSize  = this.style.fontSize  ?? 72;
    const fontColor = _hexToPremiereColor(this.style.color ?? '#FFFFFF');
    const text      = this.flattenToText();
    const x         = _anchorToPremiereX(this.layout);
    const y         = _anchorToPremiereY(this.layout);

    return {
      type:        'motionTitle',
      text,
      fontSize,
      fontColor,
      x,
      y,
      bold:        this.style.bold   ?? false,
      italic:      this.style.italic ?? false,
      timelineStart,
      timelineEnd,
      presetName:  this.presetName,
    };
  }

  /**
   * Generate a simplified FCPXML title descriptor.
   * Returns a plain object that FcpxmlExporter renders as a connected <title>.
   * @param {number} timelineStart
   * @param {number} timelineEnd
   * @param {string} [laneOffset='-1'] - FCPXML lane for connected clip.
   * @returns {object}
   */
  toFcpTitle(timelineStart, timelineEnd, laneOffset = '-1') {
    const text     = this.flattenToText();
    const fontSize = this.style.fontSize ?? 72;
    const color    = this.style.color    ?? '#FFFFFF';

    return {
      type:          'title',
      name:          this.presetName ? `${this.presetName} Title` : 'Basic Title',
      text,
      fontSize,
      color,
      bold:          this.style.bold   ?? false,
      italic:        this.style.italic ?? false,
      timelineStart,
      timelineEnd,
      lane:          laneOffset,
      verticalAlign: _layoutToFcpVertical(this.layout),
      horizontalAlign: _layoutToFcpHorizontal(this.layout),
      presetName:    this.presetName,
    };
  }

  /**
   * Build from a VideoForge CaptionClip instance.
   * @param {import('../captions/CaptionClip.js').default} captionClip
   * @returns {CaptionRepresentation}
   */
  static fromCaptionClip(captionClip) {
    const json = typeof captionClip.toJSON === 'function' ? captionClip.toJSON() : {};

    return new CaptionRepresentation({
      transcript:    captionClip.transcript ?? '',
      segments:      (captionClip.segments ?? []).map((s) =>
        typeof s.toJSON === 'function' ? s.toJSON() : s,
      ),
      style:         typeof captionClip.style?.toJSON === 'function'
        ? captionClip.style.toJSON()
        : (captionClip.style ?? {}),
      layout:        typeof captionClip.layout?.toJSON === 'function'
        ? captionClip.layout.toJSON()
        : (captionClip.layout ?? {}),
      animations:    (captionClip.captionAnimations ?? []).map((a) =>
        typeof a.toJSON === 'function' ? a.toJSON() : a,
      ),
      effects:       (captionClip.captionEffects ?? []).map((e) =>
        typeof e.toJSON === 'function' ? e.toJSON() : e,
      ),
      presetName:    captionClip.presetName ?? null,
      videoForgePayload: json,
    });
  }

  toJSON() {
    return {
      transcript:            this.transcript,
      segments:              this.segments,
      style:                 this.style,
      layout:                this.layout,
      animations:            this.animations,
      effects:               this.effects,
      presetName:            this.presetName,
      highlightRules:        this.highlightRules,
      karaokeRules:          this.karaokeRules,
      motionTypographyRules: this.motionTypographyRules,
      videoForgePayload:     this.videoForgePayload,
    };
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _vttTime(seconds) {
  const h  = Math.floor(seconds / 3600);
  const m  = Math.floor((seconds % 3600) / 60);
  const s  = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
}

function _hexToPremiereColor(hex) {
  const m = String(hex).replace('#', '').match(/([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})/);
  if (!m) return { r: 1, g: 1, b: 1 };
  return {
    r: parseInt(m[1], 16) / 255,
    g: parseInt(m[2], 16) / 255,
    b: parseInt(m[3], 16) / 255,
  };
}

function _anchorToPremiereX(layout) {
  const anchor = layout.anchorPoint ?? 'center';
  if (anchor.includes('left'))  return 0.2;
  if (anchor.includes('right')) return 0.8;
  return 0.5;
}

function _anchorToPremiereY(layout) {
  const anchor = layout.anchorPoint ?? 'center';
  if (anchor.includes('top'))    return 0.15;
  if (anchor.includes('bottom')) return 0.85;
  return 0.5;
}

function _layoutToFcpVertical(layout) {
  const anchor = layout.anchorPoint ?? 'center';
  if (anchor.includes('top'))    return 'top';
  if (anchor.includes('bottom')) return 'bottom';
  return 'center';
}

function _layoutToFcpHorizontal(layout) {
  const anchor = layout.anchorPoint ?? 'center';
  if (anchor.includes('left'))  return 'left';
  if (anchor.includes('right')) return 'right';
  return 'center';
}

export default CaptionRepresentation;
