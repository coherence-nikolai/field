# CLAUDE.md

This file describes the repository structure, conventions, and development guidelines for AI assistants working on this project.

## Project Overview

**field** is a minimal, single-page breathing/coherence practice application. It has no dependencies, no build step, no data collection, and no tracking. The entire app lives in a single self-contained HTML file.

The project philosophy, stated in the README:

> A quiet coherence practice. No data. No tracking. No optimisation.
> Open. Breathe. Close.
> Free. Forkable. No ownership.

It is released under CC0 1.0 (public domain). No attribution required, no permission needed.

## Repository Structure

```
field/
├── index.html   # The entire application (HTML + CSS + JavaScript)
├── README.md    # Bilingual project description (English / Spanish)
├── LICENSE      # CC0 1.0 Universal public domain dedication (bilingual)
└── CLAUDE.md    # This file
```

There is no `package.json`, no build system, no test runner, no linter, and no external dependencies of any kind.

## Architecture

The app is entirely self-contained in `index.html`. It is organized into three sections:

### CSS (`<style>` block, lines 7–226)

CSS custom properties (variables) are defined in `:root` for the color palette:

| Variable       | Usage                          |
|----------------|-------------------------------|
| `--bg1`        | Primary background dark teal  |
| `--bg2`        | Secondary background          |
| `--card1/2`    | Card gradient stops           |
| `--mint`       | Primary accent (mint green)   |
| `--mint2`      | Secondary accent              |
| `--header`     | Header and text color         |
| `--soft`       | Subdued text color            |
| `--circleText` | Text inside the circle        |
| `--shadow`     | Drop shadow color             |

Key CSS components:

- `.wrapper` — centers content, max-width 420px
- `.header` — the "field" wordmark, renders each letter as a separate `<span>`; switches to `.header--phrase` for multi-word Spanish
- `.card` — dark glass card container
- `.circleWrap` / `.circle` — the 210px breathing circle
- `.circle.breathing` — CSS keyframe animation (`breathe`, 11s ease-in-out infinite)
- `.circle.phase-in` / `.circle.phase-out` — glow shift to indicate inhale/exhale
- `.ripple` / `.ripple.go` — single-fire ripple animation on session start
- `.intent` / `.intent.pulse` — intention text with subtle glow pulse
- `.running .intent` / `.running .sub` — fades out text during active session
- `.lang-toggle` — absolute-positioned EN/ES switcher (top-right)
- `@media (max-width: 360px)` — small screen adjustments

### HTML (`<body>`, lines 228–253)

Minimal structure:

```html
.lang-toggle        — EN · ES switcher (top-right absolute)
#app .wrapper
  #header           — wordmark
  .card
    .circleWrap
      #ripple       — ripple overlay
      #circle       — breathing circle (interactive)
    #intent         — intention phrase (clickable, cycles)
    #sub            — subtitle ("the field is shared.")
    .controls
      #toggleBtn    — Start/Stop button
```

### JavaScript (`<script>`, lines 254–534)

All JS is wrapped in an IIFE (`(() => { 'use strict'; ... })()`).

**Data structures:**

- `TEXT` — bilingual string map with keys `en` and `es`; each contains: `header`, `inhale`, `exhale`, `start`, `stop`, `follow`, `sub`, and `intentions` (array of 9 phrases)

**Breath timing constants:**

- `IN_SEC = 5.5` — inhale duration in seconds
- `OUT_SEC = 5.5` — exhale duration in seconds (total cycle: 11s, matching the CSS `breathe` keyframe)

**State variables:**

| Variable             | Type    | Description                                     |
|----------------------|---------|-------------------------------------------------|
| `lang`               | string  | Current language (`'en'` or `'es'`)             |
| `running`            | boolean | Whether a session is active                     |
| `intentions`         | array   | Current-language intention phrases              |
| `intentIndex`        | number  | Index into `intentions` for cycling             |
| `firstCycleGuidance` | boolean | Whether to show INHALE/EXHALE on first cycle    |
| `phaseTimeoutA/B`    | timeout | Glow phase loop timers                          |
| `labelTimeoutA/B`    | timeout | First-cycle label timers                        |

**Key functions:**

| Function                    | Description                                                          |
|-----------------------------|----------------------------------------------------------------------|
| `renderHeaderWord(word)`    | Renders header as individual letter `<span>`s, or phrase mode       |
| `setLanguage(l)`            | Switches all UI text to `'en'` or `'es'`, resets intentions         |
| `clearTimers()`             | Clears all four timeout references                                   |
| `setGlowPhase(phase)`       | Toggles `.phase-in`/`.phase-out` on circle                          |
| `startGlowLoop()`           | Recursive timeout loop synchronized to breath timing                |
| `startFirstCycleLabels()`   | Shows INHALE/EXHALE text in circle for first breath cycle only      |
| `forceRestartAnimation(el)` | Forces CSS animation restart via `offsetWidth` reflow trick         |
| `startSession()`            | Activates session: adds `.running`, starts animations and timers    |
| `stopSession()`             | Deactivates session: clears timers, removes classes, resets UI      |
| `toggleSession()`           | Calls `startSession` or `stopSession` based on `running` state      |
| `fadeIntentTo(text)`        | Cross-fades intention text with opacity transition                  |
| `nextIntent()`              | Cycles to next intention phrase (only when not running)             |

**Event listeners:**

- `toggleBtn` click → `toggleSession`
- `circle` click → `startSession` (only when idle)
- `intentEl` click / Enter / Space → `nextIntent` (only when idle)
- `document` visibilitychange → pauses timers when tab hidden, resumes when visible
- `enBtn` / `esBtn` click → `setLanguage`

## Development Workflow

Since there are no build tools or dependencies, editing is direct:

1. Edit `index.html` in any text editor
2. Open `index.html` in a browser to test
3. No compilation, bundling, or installation required

### Testing

There is no automated test suite. Manual testing in-browser is the only testing method. When making changes, verify:

- The breathing animation starts and stops correctly
- INHALE/EXHALE labels appear only on the first cycle
- Switching language mid-session updates labels correctly
- Clicking the intention phrase cycles through all 9 phrases (idle only)
- The ripple animation fires once on session start
- Tab visibility change pauses/resumes timers without breaking state
- Layout is correct on narrow screens (≤360px)

## Key Conventions

- **No frameworks**: Keep the app as vanilla HTML/CSS/JS with zero dependencies.
- **No external resources**: No CDN links, no web fonts, no remote scripts or images.
- **No tracking**: No analytics, no cookies, no localStorage, no sessionStorage, no network requests of any kind.
- **Bilingual**: All user-facing strings must exist in both `TEXT.en` and `TEXT.es`.
- **Single file**: Keep everything in `index.html`. Do not split into separate CSS/JS files.
- **Silent after first cycle**: The circle shows INHALE/EXHALE only for the first breath cycle; subsequent cycles are silent.
- **Breath timing**: `IN_SEC` and `OUT_SEC` must match the CSS `breathe` keyframe duration (currently 11s total).
- **DOM safety**: All required DOM elements are validated at startup; if any are missing, the script exits gracefully with a console error.
- **IIFE pattern**: JavaScript is wrapped in an immediately-invoked function expression with `'use strict'`.
- **Animation restart trick**: `void el.offsetWidth` forces a reflow to restart CSS animations — do not remove this.

## License

CC0 1.0 Universal — public domain. No restrictions of any kind.
