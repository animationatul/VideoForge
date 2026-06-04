/**
 * @module FilterGraphBuilder
 * Builds the FFmpeg -filter_complex string and corresponding -i input flags
 * from an IntermediateTimeline (ITR).
 *
 * V1 scope: trim (via input-side seeking), speed, reverse, fadeIn, fadeOut,
 * volume, mute.  Gaps between clips are not padded — clips play back-to-back.
 */

class FilterGraphBuilder {
  /**
   * @param {import('../../interchange/IntermediateTimeline.js').default} itr
   */
  constructor(itr) {
    this._itr = itr;
  }

  /**
   * Build the filter graph.
   * @returns {{
   *   inputArgs: string[],
   *   filterComplex: string,
   *   videoMap: string|null,
   *   audioMap: string|null,
   * }}
   */
  build() {
    const videoClips = this._itr.getVideoTracks()
      .flatMap(t => t.getSortedClips());
    const audioClips = this._itr.getAudioTracks()
      .flatMap(t => t.getSortedClips());

    const inputArgs  = [];
    const filterParts = [];
    let inputIdx = 0;

    // ── Video segments ────────────────────────────────────────────────────────

    const vLabels = [];
    for (const clip of videoClips) {
      const asset = this._itr.getAsset(clip.assetId);
      if (!asset) continue;

      inputArgs.push(...this._inputFlags(clip, asset.path));

      const label = `v${vLabels.length}`;
      const filters = this._videoFilters(clip);
      filterParts.push(`[${inputIdx}:v]${filters.join(',')}[${label}]`);
      vLabels.push(`[${label}]`);
      inputIdx++;
    }

    // ── Audio segments ────────────────────────────────────────────────────────

    const aLabels = [];
    for (const clip of audioClips) {
      const asset = this._itr.getAsset(clip.assetId);
      if (!asset) continue;

      inputArgs.push(...this._inputFlags(clip, asset.path));

      const label = `a${aLabels.length}`;
      const filters = this._audioFilters(clip);
      filterParts.push(`[${inputIdx}:a]${filters.join(',')}[${label}]`);
      aLabels.push(`[${label}]`);
      inputIdx++;
    }

    // ── Concat / mix ──────────────────────────────────────────────────────────

    let videoMap = null;
    if (vLabels.length > 1) {
      filterParts.push(
        `${vLabels.join('')}concat=n=${vLabels.length}:v=1:a=0[vout]`,
      );
      videoMap = '[vout]';
    } else if (vLabels.length === 1) {
      videoMap = vLabels[0];
    }

    let audioMap = null;
    if (aLabels.length > 1) {
      filterParts.push(
        `${aLabels.join('')}amix=inputs=${aLabels.length}:duration=longest[aout]`,
      );
      audioMap = '[aout]';
    } else if (aLabels.length === 1) {
      audioMap = aLabels[0];
    }

    return {
      inputArgs,
      filterComplex: filterParts.join(';'),
      videoMap,
      audioMap,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Build -ss/-t/-i flags for one clip. */
  _inputFlags(clip, filePath) {
    const args = ['-ss', String(clip.sourceStart)];
    const srcDur = clip.sourceEnd - clip.sourceStart;
    if (isFinite(srcDur) && srcDur > 0) {
      args.push('-t', String(srcDur));
    }
    args.push('-i', filePath);
    return args;
  }

  /** Filter chain for a video clip. */
  _videoFilters(clip) {
    const srcDur = clip.sourceEnd - clip.sourceStart;
    const filters = ['setpts=PTS-STARTPTS'];

    if (clip.reverse) {
      filters.push('reverse', 'setpts=PTS-STARTPTS');
    }

    const speed = clip.speed || 1;
    if (speed !== 1) {
      filters.push(`setpts=PTS/${speed}`);
    }

    const outputDur = isFinite(srcDur) ? srcDur / speed : null;

    const fadeIn = this._findEffect(clip, 'fadeIn');
    if (fadeIn) {
      const d = fadeIn.getParam('duration') ?? 1;
      filters.push(`fade=t=in:st=0:d=${d}`);
    }

    const fadeOut = this._findEffect(clip, 'fadeOut');
    if (fadeOut && outputDur !== null) {
      const d = fadeOut.getParam('duration') ?? 1;
      filters.push(`fade=t=out:st=${Math.max(0, outputDur - d)}:d=${d}`);
    }

    return filters;
  }

  /** Filter chain for an audio clip. */
  _audioFilters(clip) {
    const srcDur = clip.sourceEnd - clip.sourceStart;
    const filters = ['asetpts=PTS-STARTPTS'];

    if (clip.reverse) {
      filters.push('areverse', 'asetpts=PTS-STARTPTS');
    }

    const speed = clip.speed || 1;
    if (speed !== 1) {
      filters.push(..._atempoChain(speed));
    }

    if (clip.mute) {
      filters.push('volume=0');
    } else if (clip.volume != null && clip.volume !== 1) {
      filters.push(`volume=${clip.volume}`);
    }

    const outputDur = isFinite(srcDur) ? srcDur / speed : null;

    const fadeIn = this._findEffect(clip, 'fadeIn');
    if (fadeIn) {
      const d = fadeIn.getParam('duration') ?? 1;
      filters.push(`afade=t=in:st=0:d=${d}`);
    }

    const fadeOut = this._findEffect(clip, 'fadeOut');
    if (fadeOut && outputDur !== null) {
      const d = fadeOut.getParam('duration') ?? 1;
      filters.push(`afade=t=out:st=${Math.max(0, outputDur - d)}:d=${d}`);
    }

    return filters;
  }

  _findEffect(clip, type) {
    if (!Array.isArray(clip.effects)) return null;
    return clip.effects.find(e => e.type === type) ?? null;
  }
}

/**
 * Build an atempo filter chain for the given rate.
 * atempo only accepts [0.5, 2.0]; chain multiple filters for values outside that range.
 * @param {number} rate
 * @returns {string[]}
 */
function _atempoChain(rate) {
  const filters = [];
  let r = rate;
  while (r > 2.0) {
    filters.push('atempo=2.0');
    r /= 2.0;
  }
  while (r < 0.5) {
    filters.push('atempo=0.5');
    r /= 0.5;
  }
  if (Math.abs(r - 1.0) > 1e-9) {
    filters.push(`atempo=${Number(r.toFixed(6))}`);
  }
  return filters;
}

export default FilterGraphBuilder;
