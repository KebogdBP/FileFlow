# FileFlow UI concept

A standalone, responsive workspace prototype for the FileFlow product. It combines the airy
camera-interface reference with Nova Glass, Mindora and restrained glassmorphism.

## Direction

- Nova Glass supplies the light technological canvas, prism highlights and cyan-blue depth.
- Mindora supplies the calm mint palette, friendly radii and wellness-like visual comfort.
- Minimal Glassmorphism supplies translucent surfaces and a paired light/dark theme.
- Simplicit supplies whitespace, thin icons and disciplined information density.
- Futuristic UI is used only for active gradients and subtle glow—not as constant visual noise.
- Muted green still identifies privacy/local processing; brighter blue is reserved for action.
- One dominant action per screen.
- Three clear zones: navigation, active files and contextual settings.
- Technical decisions are translated into outcomes: “Make it lighter” instead of codec-first UI.

## UX details

- File and URL input use the same workspace.
- Local processing status is visible before the user starts.
- Estimated size reduction sits next to quality controls.
- The settings card follows the active file instead of opening a separate wizard.
- Desktop, tablet and mobile layouts are included.
- Tabs, file selection, drag-and-drop, quality slider, mobile navigation and processing feedback
  are interactive.
- The moon button switches between the light Nova Glass and dark futuristic glass themes.

## Preview

Open `index.html` directly in a browser, or serve this directory with any static file server.

### Current main direction — Prism Liquid

`index.html` is now the primary FileFlow MVP concept. The previous light glass version is preserved
as `glass.html` and the dark Redsun direction as `redsun.html`.

The Prism Liquid direction includes:

- pastel light theme and a complete dark theme with a persistent device preference;
- English and Russian localization with instant switching and persistence;
- reference-based prismatic image buttons for video, audio, Telegram and mobile workflows;
- tactile liquid switches for theme, privacy, cloud and processing settings;
- file drag-and-drop, intent shortcuts, a before/after workspace and local processing feedback;
- responsive sidebar, mobile workspace and accessible keyboard focus states.

### Redsun direction

`redsun.html` is an alternative, separate direction inspired by the Redsun technology template:

- near-black editorial canvas with a restrained orange glow;
- oversized centered hero typography and announcement pill;
- thin dark panels, orbital product visual and compact uppercase labels;
- a complete FileFlow workspace embedded into the landing page;
- interactive file/URL source tabs, drag-and-drop, quality control and local-processing feedback;
- responsive navigation and mobile workspace layout.

This variant intentionally translates the reference rather than copying its SaaS copy or layout
verbatim. The privacy-first FileFlow workflow remains the product center.

## Suggested integration into the Next.js app

1. Keep the existing FileFlow design tokens and update the color, radius and shadow values from
   `styles.css`.
2. Split the prototype into `WorkspaceShell`, `WorkspaceSidebar`, `SourcePicker`, `FileQueue` and
   `OperationSettings` components.
3. Reuse the repository's current inspector, recommendation engine and local-processing state;
   only their presentation needs to change.
4. Preserve current accessible file input, progress announcements and reduced-motion behavior.
