/**
 * @module PremiereXmlExporter
 * Exports a VideoForge Project to Adobe Premiere Pro FCP7XML (XMEML v5) format.
 *
 * Pipeline:
 *   Project → TimelineConverter → IntermediateTimeline → PremiereXmlExporter → .xml file
 *
 * Format reference: Adobe Premiere Pro FCP7 XML Interchange (XMEML version 5).
 * Time is expressed as integer frames. Rates use <timebase> + <ntsc> elements.
 * Each unique media file gets one <file> element; clips reference it by id.
 */

import { promises as fs } from 'fs';
import path from 'path';
import Exporter from './Exporter.js';
import TimelineConverter    from '../interchange/TimelineConverter.js';
import InterchangeValidator from '../interchange/validation/InterchangeValidator.js';
import XmlBuilder           from '../interchange/utils/XmlBuilder.js';
import { escapeAttr, escapeText } from '../interchange/utils/XmlEscaper.js';
import XmlValidator         from '../interchange/utils/XmlValidator.js';
import XmlNamespaceManager  from '../interchange/utils/XmlNamespaceManager.js';
import TimeCode             from '../interchange/utils/TimeCode.js';

class PremiereXmlExporter extends Exporter {
  /**
   * @param {import('../core/Project.js').default} project
   * @param {object} [options={}]
   * @param {boolean} [options.pretty=true]              - Indent output XML.
   * @param {boolean} [options.validateInput=true]       - Run ITR validation before exporting.
   * @param {boolean} [options.validateOutput=true]      - Run XML structural validation after generating.
   * @param {boolean} [options.includeVfMetadata=true]   - Embed VideoForge namespace metadata.
   * @param {string}  [options.sequenceName]             - Override the sequence name.
   */
  constructor(project, options = {}) {
    super(project, options);
    this.pretty            = options.pretty           ?? true;
    this.validateInput     = options.validateInput    ?? true;
    this.validateOutput    = options.validateOutput   ?? true;
    this.includeVfMetadata = options.includeVfMetadata ?? true;
    this.sequenceName      = options.sequenceName     ?? null;
    this._converter        = new TimelineConverter();
    this._itrValidator     = new InterchangeValidator();
    this._xmlValidator     = new XmlValidator();
    this._nsMgr            = new XmlNamespaceManager();
  }

  // ─── Exporter contract ────────────────────────────────────────────────────────

  async export(outputPath) {
    const dest = this.resolveOutputPath(outputPath, '.xml');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const xml = this.toString();
    await fs.writeFile(dest, xml, 'utf8');
    return dest;
  }

  /**
   * Generate and return the XMEML XML string without writing to disk.
   * @returns {string}
   */
  toString() {
    const itr = this._converter.convert(this.project);

    if (this.validateInput) {
      const result = this._itrValidator.validateTimeline(itr);
      if (!result.valid) {
        throw new Error(
          `PremiereXmlExporter: ITR validation failed:\n${result.errors.join('\n')}`,
        );
      }
    }

    const xml = this._buildXmeml(itr);

    if (this.validateOutput) {
      const xmlResult = this._xmlValidator.validatePremiereXml(xml);
      if (!xmlResult.valid) {
        throw new Error(
          `PremiereXmlExporter: generated XML failed validation:\n${xmlResult.errors.join('\n')}`,
        );
      }
    }

    return xml;
  }

  // ─── XMEML document ──────────────────────────────────────────────────────────

  _buildXmeml(itr) {
    const b = new XmlBuilder({ pretty: this.pretty });
    b.declaration('1.0', 'UTF-8');
    b.doctype('xmeml');

    b.open('xmeml', { version: '5' });
      b.open('sequence', { id: escapeAttr(`seq_${itr.projectId || 'main'}`) });
        b.leaf('name', {}, escapeText(this.sequenceName ?? itr.name));
        b.leaf('duration', {}, String(this._totalFrames(itr)));
        this._emitRate(b, itr.fps);

        b.open('timecode');
          this._emitRate(b, itr.fps);
          b.leaf('string',        {}, TimeCode.secondsToSmpte(0, itr.fps));
          b.leaf('frame',         {}, '0');
          b.leaf('displayformat', {}, this._isNtsc(itr.fps) ? 'DF' : 'NDF');
        b.close(); // timecode

        b.open('media');
          this._emitVideoSection(b, itr);
          this._emitAudioSection(b, itr);
        b.close(); // media

        if (this.includeVfMetadata) {
          this._emitVfMetadata(b, itr);
        }

      b.close(); // sequence
    b.close(); // xmeml

    return b.toString();
  }

  // ─── Video section ────────────────────────────────────────────────────────────

  _emitVideoSection(b, itr) {
    b.open('video');
      b.open('format');
        b.open('samplecharacteristics');
          b.leaf('width',  {}, String(itr.width));
          b.leaf('height', {}, String(itr.height));
          this._emitRate(b, itr.fps);
          b.leaf('codec',         {}, 'Apple ProRes 422');
          b.leaf('fielddominance', {}, 'none');
          b.leaf('colordepth',    {}, '24');
        b.close(); // samplecharacteristics
      b.close(); // format

      // Deduplicated file pool: uid → assetId (used to detect first-use).
      const emittedFiles = new Map();

      const videoTracks = itr.getVideoTracks();
      if (videoTracks.length === 0) {
        // Premiere requires at least one <track> element.
        b.open('track'); b.close();
      } else {
        for (const track of videoTracks) {
          this._emitVideoTrack(b, track, itr, emittedFiles);
        }
      }

      // Caption tracks → dedicated video tracks whose clips are <generatoritem>s.
      for (const captionTrack of itr.getCaptionTracks()) {
        this._emitCaptionTrack(b, captionTrack, itr);
      }
    b.close(); // video
  }

  _emitVideoTrack(b, track, itr, emittedFiles) {
    b.open('track');
      const clips = track.getSortedClips();
      for (let i = 0; i < clips.length; i++) {
        const clip  = clips[i];
        const asset = itr.getAsset(clip.assetId);
        this._emitClipItem(b, clip, asset, itr, i + 1, 'video', emittedFiles);
      }
      b.leaf('enabled', {}, 'TRUE');
      b.leaf('locked',  {}, track.locked ? 'TRUE' : 'FALSE');
    b.close(); // track
  }

  // ─── Caption track (as video generator track) ─────────────────────────────────

  _emitCaptionTrack(b, track, itr) {
    b.open('track');
      const clips = track.getSortedClips();
      for (const clip of clips) {
        if (clip.captionData) {
          this._emitCaptionGeneratorItem(b, clip, itr);
        }
      }
      b.leaf('enabled', {}, 'TRUE');
      b.leaf('locked',  {}, track.locked ? 'TRUE' : 'FALSE');
    b.close(); // track
  }

  // ─── Audio section ────────────────────────────────────────────────────────────

  _emitAudioSection(b, itr) {
    b.open('audio');
      b.open('format');
        b.open('samplecharacteristics');
          b.leaf('depth',      {}, '16');
          b.leaf('samplerate', {}, String(itr.sampleRate));
        b.close();
      b.close(); // format

      const audioTracks = itr.getAudioTracks();
      if (audioTracks.length === 0) {
        b.open('track'); b.close();
      } else {
        for (const track of audioTracks) {
          this._emitAudioTrack(b, track, itr);
        }
      }
    b.close(); // audio
  }

  _emitAudioTrack(b, track, itr) {
    const emittedFiles = new Map();
    b.open('track');
      const clips = track.getSortedClips();
      for (let i = 0; i < clips.length; i++) {
        const clip  = clips[i];
        const asset = itr.getAsset(clip.assetId);
        this._emitClipItem(b, clip, asset, itr, i + 1, 'audio', emittedFiles);
      }
      b.leaf('enabled',     {}, 'TRUE');
      b.leaf('locked',      {}, track.locked ? 'TRUE' : 'FALSE');
      b.leaf('outputlevel', {}, String(this._linearToDb(track.volume)));
    b.close(); // track
  }

  // ─── <file> element ────────────────────────────────────────────────────────────

  _emitFile(b, asset, fps) {
    b.open('file', { id: escapeAttr(asset.id) });
      b.leaf('name',     {}, escapeText(asset.name));
      b.leaf('pathurl',  {}, escapeText(
        asset.path.startsWith('file://') ? asset.path : `file://${asset.path}`,
      ));
      b.leaf('duration', {}, String(this._secToFrames(asset.duration, fps)));
      this._emitRate(b, asset.fps || fps);

      if (asset.hasVideo || asset.isImage) {
        b.open('media');
          b.open('video');
            b.open('samplecharacteristics');
              b.leaf('width',  {}, String(asset.width  || 1920));
              b.leaf('height', {}, String(asset.height || 1080));
              this._emitRate(b, asset.fps || fps);
            b.close();
          b.close(); // video
          if (asset.hasAudio) {
            b.open('audio');
              b.leaf('channelcount', {}, String(asset.audioChannels || 2));
              b.leaf('samplerate',   {}, String(asset.sampleRate    || 48000));
              b.leaf('depth',        {}, String(asset.bitDepth      || 16));
            b.close();
          }
        b.close(); // media
      } else if (asset.isAudio) {
        b.open('media');
          b.open('audio');
            b.leaf('channelcount', {}, String(asset.audioChannels || 2));
            b.leaf('samplerate',   {}, String(asset.sampleRate    || 48000));
            b.leaf('depth',        {}, String(asset.bitDepth      || 16));
          b.close();
        b.close(); // media
      }
    b.close(); // file
  }

  // ─── <clipitem> element ────────────────────────────────────────────────────────

  _emitClipItem(b, clip, asset, itr, editOrder, mediaType, emittedFiles) {
    const fps        = itr.fps;
    const startFrame = this._secToFrames(clip.timelineStart, fps);
    const endFrame   = this._secToFrames(clip.timelineEnd,   fps);
    const inFrame    = this._secToFrames(clip.sourceStart,   fps);
    const outFrame   = this._secToFrames(clip.sourceEnd,     fps);

    b.open('clipitem', { id: escapeAttr(`${clip.id}_${mediaType}`) });
      b.leaf('masterclipid', {}, escapeText(clip.id));
      b.leaf('name',    {}, escapeText(clip.name || (asset?.name ?? clip.id)));
      b.leaf('enabled', {}, 'TRUE');
      b.leaf('start',   {}, String(startFrame));
      b.leaf('end',     {}, String(endFrame));
      b.leaf('in',      {}, String(inFrame));
      b.leaf('out',     {}, String(outFrame));

      // File reference — emit full <file> on first use, id-only reference thereafter.
      if (asset) {
        if (emittedFiles.has(asset.uid)) {
          b.open('file', { id: escapeAttr(asset.id) }); b.close();
        } else {
          emittedFiles.set(asset.uid, asset.id);
          this._emitFile(b, asset, fps);
        }
      }

      this._emitRate(b, fps);

      if (mediaType === 'video') {
        b.leaf('sourcetrack', {}, 'video');
      } else {
        b.open('sourcetrack');
          b.leaf('mediatype',  {}, 'audio');
          b.leaf('trackindex', {}, '1');
        b.close();
      }

      // Gain / volume filter
      if (mediaType === 'audio' && clip.volume !== 1) {
        b.open('filter');
          b.open('effect');
            b.leaf('name',       {}, 'Gain');
            b.leaf('effectid',   {}, 'audiolevels');
            b.leaf('effecttype', {}, 'audiolevels');
            b.open('parameter');
              b.leaf('parameterid', {}, 'level');
              b.leaf('name',  {}, 'Level');
              b.leaf('value', {}, String(this._linearToDb(clip.volume)));
            b.close();
          b.close();
        b.close(); // filter
      }

      // Opacity filter
      if (mediaType === 'video' && clip.opacity !== 1) {
        this._emitOpacityFilter(b, clip.opacity);
      }

      // Speed / time remap filter
      if (clip.speed !== 1) {
        b.open('filter');
          b.open('effect');
            b.leaf('name',       {}, 'Time Remapping');
            b.leaf('effectid',   {}, 'timeremapping');
            b.leaf('effecttype', {}, 'motion');
            b.open('parameter');
              b.leaf('parameterid', {}, 'speed');
              b.leaf('name',  {}, 'Speed');
              b.leaf('value', {}, String(clip.speed * 100));
            b.close();
          b.close();
        b.close(); // filter
      }

      // User-defined effect filters
      for (const effect of (clip.effects ?? [])) {
        this._emitEffectFilter(b, effect);
      }

      // Transitions
      for (const trans of (clip.transitions ?? [])) {
        this._emitTransitionItem(b, trans, clip, itr);
      }

      // Motion (position / scale / rotation)
      if (this._hasTransform(clip)) {
        this._emitMotionFilter(b, clip, itr);
      }

      // Caption as generator item
      if (clip.isCaption && clip.captionData) {
        this._emitCaptionGeneratorItem(b, clip, itr);
      }

    b.close(); // clipitem
  }

  // ─── Opacity filter ───────────────────────────────────────────────────────────

  _emitOpacityFilter(b, opacity) {
    b.open('filter');
      b.open('effect');
        b.leaf('name',       {}, 'Opacity');
        b.leaf('effectid',   {}, 'opacity');
        b.leaf('effecttype', {}, 'motion');
        b.open('parameter');
          b.leaf('parameterid', {}, 'opacity');
          b.leaf('name',  {}, 'Opacity');
          b.leaf('value', {}, String(Math.round(opacity * 100)));
        b.close();
      b.close();
    b.close(); // filter
  }

  // ─── Motion filter ────────────────────────────────────────────────────────────

  _emitMotionFilter(b, clip, itr) {
    const cx       = Math.round(itr.width  / 2) + (clip.position?.x ?? 0);
    const cy       = Math.round(itr.height / 2) + (clip.position?.y ?? 0);
    const scaleVal = Math.round((clip.scale?.x ?? 1) * 100);
    const rotation = clip.rotation ?? 0;

    b.open('filter');
      b.open('effect');
        b.leaf('name',       {}, 'Basic Motion');
        b.leaf('effectid',   {}, 'motion');
        b.leaf('effecttype', {}, 'motion');
        b.open('parameter');
          b.leaf('parameterid', {}, 'center');
          b.leaf('name',  {}, 'Center');
          b.leaf('value', {}, `${cx} ${cy}`);
        b.close();
        b.open('parameter');
          b.leaf('parameterid', {}, 'scale');
          b.leaf('name',  {}, 'Scale');
          b.leaf('value', {}, String(scaleVal));
        b.close();
        b.open('parameter');
          b.leaf('parameterid', {}, 'rotation');
          b.leaf('name',  {}, 'Rotation');
          b.leaf('value', {}, String(rotation));
        b.close();
      b.close();
    b.close(); // filter
  }

  // ─── Generic effect filter ────────────────────────────────────────────────────

  _emitEffectFilter(b, effect) {
    const effectId    = effect.type || effect.videoForgeType || 'customEffect';
    const effectLabel = effect.type || effect.videoForgeType || 'Effect';

    b.open('filter');
      b.open('effect');
        b.leaf('name',       {}, escapeText(effectLabel));
        b.leaf('effectid',   {}, escapeText(effectId));
        b.leaf('effecttype', {}, 'video');
        b.leaf('mediatype',  {}, 'video');

        const params = effect.parameters instanceof Map
          ? effect.parameters
          : new Map(Object.entries(effect.parameters ?? {}));

        for (const [key, val] of params) {
          b.open('parameter');
            b.leaf('parameterid', {}, escapeText(String(key)));
            b.leaf('name',  {}, escapeText(String(key)));
            b.leaf('value', {}, escapeText(String(val)));
          b.close();
        }
      b.close();
    b.close(); // filter
  }

  // ─── Transition item ──────────────────────────────────────────────────────────

  _emitTransitionItem(b, trans, clip, itr) {
    const fps       = itr.fps;
    const durFrames = this._secToFrames(trans.duration, fps);
    const cutFrame  = this._secToFrames(clip.timelineEnd, fps);

    b.open('transitionitem');
      b.leaf('rate',      {}, String(fps));
      b.leaf('start',     {}, String(cutFrame - Math.floor(durFrames / 2)));
      b.leaf('end',       {}, String(cutFrame + Math.ceil(durFrames / 2)));
      b.leaf('alignment', {}, this._mapTransAlignment(trans.alignment));
      b.open('effect');
        b.leaf('name',       {}, escapeText(_transitionLabel(trans.type)));
        b.leaf('effectid',   {}, escapeText(_transitionEffectId(trans.type)));
        b.leaf('effecttype', {}, 'transition');
        b.leaf('mediatype',  {}, 'video');
      b.close();
    b.close(); // transitionitem
  }

  // ─── Caption / generator item ─────────────────────────────────────────────────

  _emitCaptionGeneratorItem(b, clip, itr) {
    const fps   = itr.fps;
    const title = clip.captionData.toPremiereTitle(clip.timelineStart, clip.timelineEnd);
    const start = this._secToFrames(clip.timelineStart, fps);
    const end   = this._secToFrames(clip.timelineEnd,   fps);
    const color = title.fontColor;

    b.open('generatoritem', { id: escapeAttr(`gen_${clip.id}`) });
      b.leaf('name',     {}, escapeText((title.text ?? '').slice(0, 50) || 'Title'));
      b.leaf('duration', {}, String(end - start));
      b.leaf('start',    {}, String(start));
      b.leaf('end',      {}, String(end));
      b.leaf('in',       {}, '0');
      b.leaf('out',      {}, String(end - start));
      this._emitRate(b, fps);
      b.open('effect');
        b.leaf('name',       {}, 'Text');
        b.leaf('effectid',   {}, 'Text');
        b.leaf('effecttype', {}, 'generator');
        b.leaf('mediatype',  {}, 'video');

        b.open('parameter');
          b.leaf('parameterid', {}, 'str');
          b.leaf('name',  {}, 'Text');
          b.leaf('value', {}, escapeText(title.text ?? ''));
        b.close();

        b.open('parameter');
          b.leaf('parameterid', {}, 'fontsize');
          b.leaf('name',  {}, 'Size');
          b.leaf('value', {}, String(title.fontSize || 72));
        b.close();

        b.open('parameter');
          b.leaf('parameterid', {}, 'fontstyle');
          b.leaf('name',  {}, 'Style');
          b.leaf('value', {}, title.bold ? 'Bold' : 'Plain');
        b.close();

        b.open('parameter');
          b.leaf('parameterid', {}, 'fontcolor');
          b.leaf('name',  {}, 'Color');
          b.open('value');
            b.leaf('alpha', {}, '255');
            b.leaf('red',   {}, String(Math.round(color.r * 255)));
            b.leaf('green', {}, String(Math.round(color.g * 255)));
            b.leaf('blue',  {}, String(Math.round(color.b * 255)));
          b.close();
        b.close();

        b.open('parameter');
          b.leaf('parameterid', {}, 'origin');
          b.leaf('name',  {}, 'Origin');
          b.leaf('value', {}, `${title.x} ${title.y}`);
        b.close();

      b.close(); // effect
    b.close(); // generatoritem
  }

  // ─── VideoForge namespace metadata ────────────────────────────────────────────

  _emitVfMetadata(b, itr) {
    b.comment('VideoForge Metadata — preserves unsupported features for round-trip fidelity');
    const payload = {
      version:    itr.metadata?.videoForge?.version ?? '1.0',
      projectId:  itr.projectId,
      name:       itr.name,
      fps:        itr.fps,
      width:      itr.width,
      height:     itr.height,
      sampleRate: itr.sampleRate,
      captionTracks: itr.getCaptionTracks().map((t) => ({
        id:    t.id,
        name:  t.name,
        clips: t.clips.map((c) => ({
          id:             c.id,
          timelineStart:  c.timelineStart,
          timelineEnd:    c.timelineEnd,
          captionPayload: c.captionData?.videoForgePayload ?? null,
        })),
      })),
    };

    b.open('vf:metadata', {
      [`xmlns:${this._nsMgr.vfPrefix}`]: escapeAttr(this._nsMgr.vfNamespace),
    });
      b.leaf('vf:payload', {}, escapeText(JSON.stringify(payload, null, 2)));
    b.close(); // vf:metadata
  }

  // ─── Rate helper ──────────────────────────────────────────────────────────────

  _emitRate(b, fps) {
    const { timebase, ntsc } = TimeCode.premiereRate(fps);
    b.open('rate');
      b.leaf('timebase', {}, String(timebase));
      b.leaf('ntsc',     {}, ntsc ? 'TRUE' : 'FALSE');
    b.close();
  }

  // ─── Numeric helpers ──────────────────────────────────────────────────────────

  _secToFrames(seconds, fps) {
    return Math.round((seconds ?? 0) * fps);
  }

  _totalFrames(itr) {
    return this._secToFrames(itr.duration || itr.computeDuration(), itr.fps);
  }

  _isNtsc(fps) {
    return TimeCode.premiereRate(fps).ntsc;
  }

  _linearToDb(linear) {
    if (!linear || linear <= 0) return 0;
    return Math.round(20 * Math.log10(linear) * 100) / 100;
  }

  _hasTransform(clip) {
    return (
      (clip.position?.x !== 0 || clip.position?.y !== 0) ||
      (clip.scale?.x    !== 1 || clip.scale?.y    !== 1) ||
      (clip.rotation ?? 0) !== 0
    );
  }

  _mapTransAlignment(alignment) {
    const map = {
      center:     'center',
      startBlack: 'start-black',
      endBlack:   'end-black',
    };
    return map[alignment] ?? 'center';
  }
}

// ─── Transition helpers ───────────────────────────────────────────────────────

function _transitionLabel(type) {
  const map = {
    crossDissolve: 'Cross Dissolve',
    dissolveIn:    'Fade In',
    dissolveOut:   'Fade Out',
    wipe:          'Wipe',
    push:          'Push',
    slide:         'Slide',
    zoom:          'Zoom',
    dipToBlack:    'Dip to Black',
    dipToWhite:    'Dip to White',
    dipToColor:    'Dip to Color',
  };
  return map[type] ?? 'Cross Dissolve';
}

function _transitionEffectId(type) {
  const map = {
    crossDissolve: 'Cross Dissolve',
    dissolveIn:    'Additive Dissolve',
    dissolveOut:   'Additive Dissolve',
    wipe:          'Wipe',
    push:          'Push',
    slide:         'Slide',
    zoom:          'Zoom',
    dipToBlack:    'Dip to Black',
    dipToWhite:    'Dip to White',
    dipToColor:    'Dip to Color',
  };
  return map[type] ?? 'Cross Dissolve';
}

export default PremiereXmlExporter;
