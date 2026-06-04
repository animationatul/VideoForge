/**
 * @module FFmpegCommandBuilder
 * Assembles a complete FFmpeg argument array from an IntermediateTimeline (ITR).
 *
 * Delegates filter graph construction to FilterGraphBuilder and wraps the result
 * with codec/encoding flags.
 */

import FilterGraphBuilder from './FilterGraphBuilder.js';

class FFmpegCommandBuilder {
  /**
   * @param {import('../../interchange/IntermediateTimeline.js').default} itr
   * @param {object} [options={}]
   * @param {string}  [options.videoCodec='libx264']
   * @param {string}  [options.audioCodec='aac']
   * @param {string}  [options.preset='medium']
   * @param {number}  [options.crf=18]
   * @param {string}  [options.pixelFormat='yuv420p']
   * @param {string}  [options.audioBitrate='192k']
   */
  constructor(itr, options = {}) {
    this._itr  = itr;
    this._opts = options;
  }

  /**
   * Build the full FFmpeg argument list.
   * @param {string} outputPath
   * @returns {string[]}
   */
  build(outputPath) {
    const graph = new FilterGraphBuilder(this._itr).build();
    const args  = ['-y'];

    // Inputs
    args.push(...graph.inputArgs);

    // Filter complex
    if (graph.filterComplex) {
      args.push('-filter_complex', graph.filterComplex);
    }

    // Output stream mapping
    if (graph.videoMap) args.push('-map', graph.videoMap);
    if (graph.audioMap) args.push('-map', graph.audioMap);

    // Video codec
    if (graph.videoMap) {
      args.push(
        '-c:v',     this._opts.videoCodec  ?? 'libx264',
        '-preset',  this._opts.preset      ?? 'medium',
        '-crf',     String(this._opts.crf  ?? 18),
        '-pix_fmt', this._opts.pixelFormat ?? 'yuv420p',
      );
    }

    // Audio codec
    if (graph.audioMap) {
      args.push(
        '-c:a', this._opts.audioCodec  ?? 'aac',
        '-b:a', this._opts.audioBitrate ?? '192k',
      );
    }

    args.push(outputPath);
    return args;
  }
}

export default FFmpegCommandBuilder;
