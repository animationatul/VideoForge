/**
 * @module TimeCode
 * Universal time conversion utilities for video interchange formats.
 *
 * Supports: seconds ↔ frames ↔ SMPTE timecodes ↔ FCPXML rational time ↔ Premiere ticks.
 *
 * Rational frame rates:
 *   23.976 = 24000/1001
 *   29.97  = 30000/1001
 *   59.94  = 60000/1001
 *   All others are integers (24, 25, 30, 50, 60).
 */

/** @type {Map<number|string, {num: number, den: number, dropFrame: boolean}>} */
const RATE_TABLE = new Map([
  [23.976, { num: 24000, den: 1001, dropFrame: false }],
  ['23.976', { num: 24000, den: 1001, dropFrame: false }],
  [24,      { num: 24,   den: 1,    dropFrame: false }],
  [25,      { num: 25,   den: 1,    dropFrame: false }],
  [29.97,   { num: 30000, den: 1001, dropFrame: true  }],
  ['29.97', { num: 30000, den: 1001, dropFrame: true  }],
  [30,      { num: 30,   den: 1,    dropFrame: false }],
  [50,      { num: 50,   den: 1,    dropFrame: false }],
  [59.94,   { num: 60000, den: 1001, dropFrame: true  }],
  ['59.94', { num: 60000, den: 1001, dropFrame: true  }],
  [60,      { num: 60,   den: 1,    dropFrame: false }],
]);

/** Premiere Pro internal tick rate: 254,016,000,000 ticks per second. */
const PREMIERE_TICKS_PER_SECOND = 254016000000n;

/**
 * Resolve frame-rate entry or throw.
 * @param {number|string} fps
 * @returns {{num:number, den:number, dropFrame:boolean}}
 */
function resolveRate(fps) {
  const entry = RATE_TABLE.get(fps) ?? RATE_TABLE.get(Number(fps));
  if (!entry) {
    throw new RangeError(
      `Unsupported frame rate: ${fps}. Supported: ${[...new Set(RATE_TABLE.keys())].filter(k => typeof k === 'number').join(', ')}`,
    );
  }
  return entry;
}

class TimeCode {
  /**
   * @param {number} seconds - Absolute time in seconds.
   * @param {number|string} fps - Frame rate (23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60).
   */
  constructor(seconds, fps = 30) {
    this.seconds = seconds;
    this.fps = fps;
    this._rate = resolveRate(fps);
  }

  // ─── Factory helpers ──────────────────────────────────────────────────────────

  static fromSeconds(seconds, fps = 30) {
    return new TimeCode(seconds, fps);
  }

  static fromFrames(frames, fps = 30) {
    const rate = resolveRate(fps);
    const seconds = (frames * rate.den) / rate.num;
    return new TimeCode(seconds, fps);
  }

  /**
   * Parse a SMPTE timecode string (HH:MM:SS:FF or HH:MM:SS;FF).
   * @param {string} tc
   * @param {number|string} fps
   * @returns {TimeCode}
   */
  static fromSmpte(tc, fps = 30) {
    const dfSep = tc.includes(';');
    const sep = dfSep ? ';' : ':';
    const parts = tc.split(sep.length > 1 ? /[:;]/ : sep);
    if (parts.length !== 4) throw new SyntaxError(`Invalid SMPTE timecode: "${tc}"`);
    const [hh, mm, ss, ff] = parts.map(Number);
    const rate = resolveRate(fps);

    if (dfSep && rate.dropFrame) {
      const seconds = TimeCode._dfToSeconds(hh, mm, ss, ff, rate.num / rate.den);
      return new TimeCode(seconds, fps);
    }

    const totalFrames = ff + ss * Math.round(rate.num / rate.den) + mm * 60 * Math.round(rate.num / rate.den) + hh * 3600 * Math.round(rate.num / rate.den);
    return TimeCode.fromFrames(totalFrames, fps);
  }

  /**
   * Parse FCPXML rational time string ("N/Ds" or "Ns").
   * @param {string} rational - e.g. "7533/30000s" or "100s"
   * @returns {number} Seconds
   */
  static fromFcpRational(rational) {
    const m = String(rational).match(/^(\d+)(?:\/(\d+))?s$/);
    if (!m) throw new SyntaxError(`Invalid FCPXML rational time: "${rational}"`);
    const num = parseInt(m[1], 10);
    const den = m[2] ? parseInt(m[2], 10) : 1;
    return num / den;
  }

  /**
   * Parse Premiere ticks (BigInt or string).
   * @param {bigint|string|number} ticks
   * @returns {number} Seconds
   */
  static fromPremiereTicks(ticks) {
    const t = BigInt(ticks);
    return Number(t) / Number(PREMIERE_TICKS_PER_SECOND);
  }

  // ─── Conversion methods ────────────────────────────────────────────────────────

  /**
   * Convert to integer frame count.
   * @returns {number}
   */
  toFrames() {
    const nominalFps = this._rate.num / this._rate.den;
    return Math.round(this.seconds * nominalFps);
  }

  /**
   * Format as SMPTE NDF timecode: HH:MM:SS:FF
   * @returns {string}
   */
  toSmpteNdf() {
    const nominalFps = Math.round(this._rate.num / this._rate.den);
    let totalFrames = Math.round(this.seconds * (this._rate.num / this._rate.den));
    const ff = totalFrames % nominalFps;
    totalFrames = Math.floor(totalFrames / nominalFps);
    const ss = totalFrames % 60;
    totalFrames = Math.floor(totalFrames / 60);
    const mm = totalFrames % 60;
    const hh = Math.floor(totalFrames / 60);
    return `${_pad(hh)}:${_pad(mm)}:${_pad(ss)}:${_pad(ff)}`;
  }

  /**
   * Format as SMPTE drop-frame timecode: HH:MM:SS;FF
   * Only valid for 29.97 and 59.94. Falls back to NDF for other rates.
   * @returns {string}
   */
  toSmpteDf() {
    if (!this._rate.dropFrame) return this.toSmpteNdf();
    const nominalFps = Math.round(this._rate.num / this._rate.den);
    const dropRate = nominalFps === 30 ? 2 : 4;
    const framesPerMin = nominalFps * 60 - dropRate;
    const framesPer10Min = nominalFps * 60 * 10 - dropRate * 9;
    const framesPerHour = framesPer10Min * 6;

    let totalFrames = Math.round(this.seconds * (this._rate.num / this._rate.den));
    const d = Math.floor(totalFrames / framesPerHour);
    totalFrames -= framesPerHour * d;
    const m10 = Math.floor(totalFrames / framesPer10Min);
    totalFrames -= framesPer10Min * m10;
    const m = Math.floor(totalFrames / framesPerMin);
    totalFrames -= framesPerMin * m;
    const s = Math.floor(totalFrames / nominalFps);
    const f = totalFrames - s * nominalFps;
    const mm = m10 * 10 + m;
    return `${_pad(d)}:${_pad(mm)}:${_pad(s)};${_pad(f)}`;
  }

  /**
   * Format as FCPXML rational time string ("N/Ds").
   * The denominator is chosen for exact representation of rational rates.
   * @returns {string}
   */
  toFcpRational() {
    // FCPXML expects exact rational representation.
    // Use rate denominator to avoid floating-point error.
    const den = this._rate.den === 1 ? this._rate.num : this._rate.num;
    // Use (seconds * num) / den expressed as integer fraction.
    // E.g. 29.97fps: den=1001, num=30000 → N = seconds * 30000, D = 1001
    const num = Math.round(this.seconds * this._rate.num);
    if (this._rate.den === 1) {
      // Integer fps: "Ns" where N = frames
      return `${num}/${this._rate.num}s`;
    }
    return `${num}/${this._rate.num}s`;
  }

  /**
   * Duration version: simplify "0/30000s" to "0s".
   * @returns {string}
   */
  toFcpRationalDuration() {
    if (this.seconds === 0) return '0s';
    return this.toFcpRational();
  }

  /**
   * Convert to Premiere Pro ticks (BigInt).
   * @returns {bigint}
   */
  toPremiereTicks() {
    const wholeSec = Math.floor(this.seconds);
    const fracSec = this.seconds - wholeSec;
    const ticks = BigInt(wholeSec) * PREMIERE_TICKS_PER_SECOND +
                  BigInt(Math.round(fracSec * Number(PREMIERE_TICKS_PER_SECOND)));
    return ticks;
  }

  /**
   * Convert to Premiere ticks as string (for XML attribute values).
   * @returns {string}
   */
  toPremiereTicks_s() {
    return String(this.toPremiereTicks());
  }

  // ─── Static helpers ────────────────────────────────────────────────────────────

  /**
   * Convert seconds to FCPXML rational string without creating a TimeCode instance.
   * @param {number} seconds
   * @param {number|string} fps
   * @returns {string}
   */
  static secondsToFcp(seconds, fps = 30) {
    return new TimeCode(seconds, fps).toFcpRational();
  }

  /**
   * Convert seconds to SMPTE NDF timecode.
   * @param {number} seconds
   * @param {number|string} fps
   * @returns {string}
   */
  static secondsToSmpte(seconds, fps = 30) {
    return new TimeCode(seconds, fps).toSmpteNdf();
  }

  /**
   * Convert seconds to Premiere ticks string.
   * @param {number} seconds
   * @returns {string}
   */
  static secondsToPremiereTicks(seconds) {
    return new TimeCode(seconds, 30).toPremiereTicks_s();
  }

  /**
   * Get the FCPXML <format> frameDuration string for a given fps.
   * E.g. 29.97 → "1001/30000s", 24 → "100/2400s" (simplified: "1/24s").
   * @param {number|string} fps
   * @returns {string}
   */
  static fcpFrameDuration(fps) {
    const rate = resolveRate(fps);
    return `${rate.den}/${rate.num}s`;
  }

  /**
   * Get the Premiere <rate> element fields.
   * @param {number|string} fps
   * @returns {{timebase: number, ntsc: boolean}}
   */
  static premiereRate(fps) {
    const rate = resolveRate(fps);
    const timebase = Math.round(rate.num / rate.den);
    const ntsc = rate.den !== 1;
    return { timebase, ntsc };
  }

  /**
   * Drop-frame seconds → total frame count.
   * @private
   */
  static _dfToSeconds(hh, mm, ss, ff, nominalFps) {
    const dropRate = nominalFps >= 59 ? 4 : 2;
    const totalFrames = ff
      + ss * nominalFps
      + mm * nominalFps * 60 - dropRate * (mm - Math.floor(mm / 10))
      + hh * nominalFps * 3600 - dropRate * (hh * 54);
    const rate = resolveRate(nominalFps);
    return (totalFrames * rate.den) / rate.num;
  }

  toString() {
    return this.toSmpteNdf();
  }
}

function _pad(n, w = 2) {
  return String(Math.abs(n)).padStart(w, '0');
}

export default TimeCode;
export { PREMIERE_TICKS_PER_SECOND, RATE_TABLE, resolveRate };
