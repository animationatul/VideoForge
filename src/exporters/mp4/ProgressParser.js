/**
 * @module ProgressParser
 * Parses FFmpeg stderr output lines into structured progress objects.
 *
 * FFmpeg emits progress lines like:
 *   frame=  150 fps= 30 q=18.0 size=    256kB time=00:00:05.00 bitrate=3145.7kbits/s speed=2.00x
 */

class ProgressParser {
  /**
   * @param {number} [totalDuration=0] - Total expected output duration in seconds.
   */
  constructor(totalDuration = 0) {
    this._total = totalDuration;
  }

  /**
   * Parse one line of FFmpeg stderr.
   * @param {string} line
   * @returns {{ progress: number, frame: number, fps: number, speed: number } | null}
   */
  parse(line) {
    const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (!timeMatch) return null;

    const currentTime =
      parseInt(timeMatch[1], 10) * 3600 +
      parseInt(timeMatch[2], 10) * 60 +
      parseFloat(timeMatch[3]);

    const frameMatch = line.match(/frame=\s*(\d+)/);
    const fpsMatch   = line.match(/\bfps=\s*([\d.]+)/);
    const speedMatch = line.match(/speed=\s*([\d.]+)x/);

    return {
      progress: this._total > 0 ? Math.min(currentTime / this._total, 1) : 0,
      frame:    frameMatch ? parseInt(frameMatch[1], 10) : 0,
      fps:      fpsMatch   ? parseFloat(fpsMatch[1])    : 0,
      speed:    speedMatch ? parseFloat(speedMatch[1])  : 0,
    };
  }
}

export default ProgressParser;
