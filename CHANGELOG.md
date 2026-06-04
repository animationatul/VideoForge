# Changelog

All notable changes to VideoForge are documented here.

---

## v0.9.0-alpha.1

### Added

- **MP4 Export V1** — FFmpeg-based render pipeline supporting VideoClip, AudioClip,
  trim, speed, reverse, fadeIn, fadeOut, volume, mute, and embedded audio
  auto-detected via ffprobe
- **Project Validation API** — `project.validate({ exporter? })` returns
  `{ valid, warnings, errors }` with checks for missing assets, invalid trim,
  and MP4-specific unsupported features
- **Integration tests** — Real FFmpeg integration test suite (auto-skipped when
  FFmpeg is absent), shared fixture generator in `tests/helpers/fixtures.js`
- **Examples** — `basic-edit.js`, `podcast-edit.js`, `premiere-export.js`,
  `fcpxml-export.js`, `caption-demo.js`

### Fixed

- **EDL export via `project.export()`** — `EXPORT_TYPES.EDL` was missing;
  `project.export({ type: 'edl', ... })` previously threw at runtime
- **Project.save() / Project.load() clip round-trip** — `Track.fromJSON()` was
  silently dropping all clips; all six clip types now deserialise correctly
- **onProgress callback value** — `Mp4Exporter` was passing a 0–1 fraction to
  `onProgress`; now correctly passes 0–100 percentage
- **Premiere XML audio** — Embedded audio from video clips correctly included
- **Premiere XML fade export** — Opacity keyframes generated for fadeIn/fadeOut
- **Caption animation export** — Caption keyframe and animation data preserved
  in Premiere XML via `vf:` namespace
- **TimeCode precision (29.97/59.94 fps)** — `fromFrames()` used exact rational
  division causing 0.1% drift; fixed to use integer nominal fps
- **FCPXML audio emission** — Audio clips extending past primary clip boundary
  were silently dropped; changed to "starts within" semantics

### Known Limitations

- Caption/text/shape rendering not supported in MP4 export (skipped with warning)
- Transitions not rendered in MP4 export (ignored with warning)
- Color correction, blur, and custom effects not rendered in MP4 export
- Gaps between clips are not padded in MP4 output (clips are back-to-back)
- `PreviewRenderer` and `PreviewPlayer` are interface skeletons — bring your own backend
- Effects (`FadeEffect`, `Transition`) are not rehydrated from JSON in `fromJSON()`
  round-trips (clip properties are preserved; only the effect chain is lost)
