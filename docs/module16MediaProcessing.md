# M16 — Media Processing

M16 registers the first production cloud operations on the resource-bounded M14 worker.

## Delivered

- MOV/video to broadly compatible H.264/AAC MP4;
- video compression with fast, medium and slow server presets;
- 1080p, 720p and 480p resize ceilings without upscaling;
- video audio-track extraction to MP3;
- WAV or other supported audio to MP3;
- MP3/audio optimization at 128, 192 or 256 kbps;
- audio to PCM WAV;
- bounded audio trimming;
- metadata removal, `yuv420p`, fast-start MP4 and optional-audio handling;
- output magic-byte verification before object storage persistence;
- shared operation identifiers with the product recommendation registry.

Every FFmpeg invocation uses a server-built argv, an absolute executable path, no shell and no stdin. Client parameters are reduced to closed numeric ranges or enumerated presets before argv construction.

The development host used for this module does not provide FFmpeg, so command and artifact contracts are tested with a recording runner. Deployment images must run the same tests plus fixed-fixture encode and benchmark gates with the exact FFmpeg build they ship.
