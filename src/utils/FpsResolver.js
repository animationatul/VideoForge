/**
 * @module FpsResolver
 * Canonical utility for reading frame rate and sequence dimensions from a
 * VideoForge Project instance.
 *
 * VideoForge stores fps/width/height/sampleRate/channels on the Timeline
 * object (project.timeline.*), NOT directly on the Project root.
 * All exporters and interchange code must use these helpers instead of
 * reading project.fps / project.width etc. directly.
 */

import { DEFAULTS } from './Constants.js';

/**
 * Resolve the frame rate from a Project.
 * @param {object} project - VideoForge Project instance.
 * @returns {number}
 */
function resolveFps(project) {
  return project?.timeline?.fps ?? project?.fps ?? DEFAULTS.FPS;
}

/**
 * Resolve the canvas width from a Project.
 * @param {object} project
 * @returns {number}
 */
function resolveWidth(project) {
  return project?.timeline?.width ?? project?.width ?? DEFAULTS.WIDTH;
}

/**
 * Resolve the canvas height from a Project.
 * @param {object} project
 * @returns {number}
 */
function resolveHeight(project) {
  return project?.timeline?.height ?? project?.height ?? DEFAULTS.HEIGHT;
}

/**
 * Resolve the audio sample rate from a Project.
 * @param {object} project
 * @returns {number}
 */
function resolveSampleRate(project) {
  return project?.timeline?.sampleRate ?? project?.sampleRate ?? DEFAULTS.SAMPLE_RATE;
}

/**
 * Resolve the number of audio channels from a Project.
 * @param {object} project
 * @returns {number}
 */
function resolveChannels(project) {
  return project?.timeline?.channels ?? project?.channels ?? 2;
}

/**
 * Resolve all sequence dimensions from a Project in one call.
 * @param {object} project
 * @returns {{ fps: number, width: number, height: number, sampleRate: number, channels: number }}
 */
function resolveSequenceParams(project) {
  return {
    fps:        resolveFps(project),
    width:      resolveWidth(project),
    height:     resolveHeight(project),
    sampleRate: resolveSampleRate(project),
    channels:   resolveChannels(project),
  };
}

export { resolveFps, resolveWidth, resolveHeight, resolveSampleRate, resolveChannels, resolveSequenceParams };
