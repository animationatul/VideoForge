/**
 * @module Mp4Exporter
 * Renders a VideoForge Project to an MP4 file using FFmpeg.
 *
 * Pipeline:
 *   Project → TimelineConverter → ITR → FFmpegCommandBuilder → ffmpeg → output.mp4
 *
 * V1 supported features (per clip):
 *   VideoClip: trim, move, speed, reverse, fadeIn, fadeOut
 *   AudioClip: trim, move, speed, volume, mute
 *
 * V1 limitations:
 *   - Gaps between clips are not padded; clips are placed back-to-back in output.
 *   - Embedded audio in video clips is ignored; add explicit AudioClips for audio.
 *   - CaptionClip, TextClip, ShapeClip are skipped entirely.
 *   - No transitions, keyframes, or custom effects.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import Exporter from '../Exporter.js';
import TimelineConverter from '../../interchange/TimelineConverter.js';
import FFmpegCommandBuilder from './FFmpegCommandBuilder.js';
import ProgressParser from './ProgressParser.js';
import { DEFAULTS } from '../../utils/Constants.js';

class Mp4Exporter extends Exporter {
  /**
   * Supports two calling conventions:
   *   new Mp4Exporter(project, options)  — used by Project.export()
   *   new Mp4Exporter()                  — standalone; pass project to export()
   *
   * @param {import('../../core/Project.js').default|null} [project]
   * @param {object} [options={}]
   * @param {string}  [options.videoCodec='libx264']
   * @param {string}  [options.audioCodec='aac']
   * @param {string}  [options.preset='medium']
   * @param {number}  [options.crf=18]
   * @param {string}  [options.pixelFormat='yuv420p']
   * @param {string}  [options.videoBitrate='8000k']
   * @param {string}  [options.audioBitrate='192k']
   * @param {Function}[options.onProgress] - (percent: number) => void
   */
  constructor(project = null, options = {}) {
    // Provide a dummy project when none is given so the abstract Exporter
    // constructor is satisfied; the real project is supplied in export().
    super(project ?? _emptyProject(), options);

    this.videoCodec   = options.videoCodec   ?? 'libx264';
    this.audioCodec   = options.audioCodec   ?? 'aac';
    this.preset       = options.preset       ?? 'medium';
    this.crf          = options.crf          ?? 18;
    this.pixelFormat  = options.pixelFormat  ?? 'yuv420p';
    this.videoBitrate = options.videoBitrate ?? DEFAULTS.VIDEO_BITRATE;
    this.audioBitrate = options.audioBitrate ?? DEFAULTS.AUDIO_BITRATE;
    this.onProgress   = options.onProgress   ?? null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Export the project to an MP4 file.
   *
   * Accepts two calling conventions:
   *   export(outputPath)          — standard, called by Project.export()
   *   export(project, options)    — standalone shorthand
   *
   * @param {string|import('../../core/Project.js').default} outputPathOrProject
   * @param {object} [standAloneOptions={}]
   * @returns {Promise<{ success: boolean, output: string, duration: number, fileSize: number }>}
   */
  async export(outputPathOrProject, standAloneOptions = {}) {
    // Detect standalone calling convention: first arg is a Project object.
    if (outputPathOrProject && typeof outputPathOrProject === 'object' &&
        typeof outputPathOrProject.getTracks === 'function') {
      this.project = outputPathOrProject;
      Object.assign(this.options, standAloneOptions);
      if (standAloneOptions.onProgress) this.onProgress = standAloneOptions.onProgress;
      return this.export(standAloneOptions.output);
    }

    const outputPath = outputPathOrProject;
    this.validate();

    const dest = this.resolveOutputPath(outputPath, '.mp4');
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const itr  = new TimelineConverter().convert(this.project);
    await this._detectEmbeddedAudio(itr);
    const args = new FFmpegCommandBuilder(itr, this._encoderOpts()).build(dest);

    await this._runFfmpeg(args, itr.duration);

    return {
      success:  true,
      output:   dest,
      duration: itr.duration,
      fileSize: await this._getFileSize(dest),
    };
  }

  /**
   * Build the FFmpeg command without executing it.
   * Useful for testing and debugging.
   * @param {string} [outputPath='/dev/null']
   * @returns {string[]}
   */
  buildCommand(outputPath = '/dev/null') {
    const itr = new TimelineConverter().convert(this.project);
    return new FFmpegCommandBuilder(itr, this._encoderOpts()).build(outputPath);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * For each video asset in the ITR whose audioChannels is unknown (0), probe
   * the source file with ffprobe and update audioChannels in-place.
   * Silently skips assets whose files are missing or where ffprobe fails.
   * @param {import('../../interchange/IntermediateTimeline.js').default} itr
   */
  async _detectEmbeddedAudio(itr) {
    const execFileAsync = promisify(execFile);
    for (const asset of itr.assets) {
      if (!asset.isVideo || asset.audioChannels > 0 || !asset.path) continue;
      const channels = await this._probeAudioChannels(asset.path, execFileAsync);
      if (channels > 0) asset.audioChannels = channels;
    }
  }

  /**
   * Run ffprobe on a file and return the channel count of its first audio stream.
   * Returns 0 if the file has no audio or if ffprobe cannot be executed.
   * @param {string} filePath
   * @param {Function} execFileAsync
   * @returns {Promise<number>}
   */
  async _probeAudioChannels(filePath, execFileAsync) {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-select_streams', 'a:0',
        '-show_entries', 'stream=channels',
        '-of', 'csv=p=0',
        filePath,
      ]);
      const n = parseInt(stdout.trim(), 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  _encoderOpts() {
    return {
      videoCodec:   this.videoCodec,
      audioCodec:   this.audioCodec,
      preset:       this.preset,
      crf:          this.crf,
      pixelFormat:  this.pixelFormat,
      audioBitrate: this.audioBitrate,
    };
  }

  /**
   * Spawn FFmpeg and wait for it to finish.
   * @param {string[]} args
   * @param {number} totalDuration
   * @returns {Promise<void>}
   */
  _runFfmpeg(args, totalDuration = 0) {
    return new Promise((resolve, reject) => {
      const proc   = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      const parser = new ProgressParser(totalDuration);

      proc.stderr.on('data', (chunk) => {
        for (const line of chunk.toString().split('\n')) {
          const progress = parser.parse(line);
          if (progress && this.onProgress) {
            this.onProgress(progress.progress);
          }
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
      });
    });
  }

  async _getFileSize(filePath) {
    const stat = await fs.stat(filePath);
    return stat.size;
  }
}

/** Minimal stand-in so the Exporter base class constructor does not throw. */
function _emptyProject() {
  return {
    id:         'pending',
    name:       '',
    getTracks:  () => [],
    timeline:   { getTotalDuration: () => 0 },
  };
}

export default Mp4Exporter;
