/**
 * VideoForge — JavaScript library for building video editors,
 * automation tools, and AI-powered editing systems.
 *
 * @module videoforge
 *
 * @example
 * import { Project, TRACK_TYPES } from 'videoforge';
 *
 * const project = new Project({ name: 'My Edit' });
 * const track   = project.addTrack('video');
 * const clip    = track.addVideo('./intro.mp4');
 *
 * clip.trim(5, 20).fadeIn(1);
 *
 * await project.export({ type: 'json', output: './project.vfp' });
 */

// ─── Core ────────────────────────────────────────────────────────────────────
export { default as Project }  from './core/Project.js';
export { default as Track }    from './core/Track.js';
export { default as Clip }     from './core/Clip.js';
export { default as Asset }    from './core/Asset.js';
export { default as Timeline } from './core/Timeline.js';

// ─── Clip types ───────────────────────────────────────────────────────────────
export { default as VideoClip } from './clips/VideoClip.js';
export { default as AudioClip } from './clips/AudioClip.js';
export { default as ImageClip } from './clips/ImageClip.js';
export { default as TextClip }  from './clips/TextClip.js';
export { default as ShapeClip } from './clips/ShapeClip.js';

// ─── Effects ──────────────────────────────────────────────────────────────────
export { default as Effect }     from './effects/Effect.js';
export { default as FadeEffect } from './effects/FadeEffect.js';
export { default as Transition } from './effects/Transition.js';

// ─── Exporters ────────────────────────────────────────────────────────────────
export { default as Exporter }            from './exporters/Exporter.js';
export { default as JsonExporter }        from './exporters/JsonExporter.js';
export { default as PremiereXmlExporter } from './exporters/PremiereXmlExporter.js';
export { default as FcpxmlExporter }      from './exporters/FcpxmlExporter.js';
export { default as Mp4Exporter }         from './exporters/Mp4Exporter.js';

// ─── Preview ─────────────────────────────────────────────────────────────────
export { default as PreviewPlayer }   from './preview/PreviewPlayer.js';
export { default as PreviewRenderer } from './preview/PreviewRenderer.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { default as IdGenerator } from './utils/IdGenerator.js';

export {
  TRACK_TYPES,
  CLIP_TYPES,
  ASSET_TYPES,
  EFFECT_TYPES,
  TRANSITION_TYPES,
  EXPORT_TYPES,
  TEXT_ALIGN,
  SHAPE_TYPES,
  PLAYER_STATE,
  EASING,
  DEFAULTS,
} from './utils/Constants.js';
