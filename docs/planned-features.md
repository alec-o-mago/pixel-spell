# Planned features

This is a prioritized backlog for Pixel Spell. Ratings are deliberately simple:

- **Appeal (1–10)** — how much a typical pixel artist or game artist would want the feature. 10 means “I would switch editors for this”; 5 means “nice to have”; 1 means niche.
- **Difficulty (1–10)** — design + implementation + testing + file-format/performance risk. 1 is a small UI change; 10 is a multi-week architectural change.
- **Score = Appeal / Difficulty** — a rough cost-benefit ratio. Higher is better. Ties are ordered by appeal, then by how directly the feature strengthens the core editor.

“Strategic” marks features that could become unique selling points rather than catch-up features.

## Priority table

| # | Feature | Appeal | Difficulty | Score | Strategic | Why / implementation notes |
| ---: | --- | ---: | ---: | ---: | :---: | --- |
| 1 | Reference image / tracing layer ✓ | 9 | 2 | 4.50 | | Implemented as two complementary features: **Reference Layer** (timeline-integrated, per-frame cels, locked, non-exported, fitted to canvas) and **Reference Board** (project-level images independent of layers/frames, movable outside the canvas, non-exported). The import dialog also supports Layer and Frames destinations. |
| 2 | Radial / N-fold symmetry ✓ | 7 | 2 | 3.50 | | Implemented: rotational copies around a draggable center with a 2–16 symmetry count. Axis mirrors can be combined with radial symmetry; the red spoke guides and draggable center handle share the mirror overlay. Disabling radial symmetry resets its center. |
| 3 | Pixel-perfect line/shape/curve modes | 7 | 2 | 3.50 | | Reuse the existing pixel-perfect path filter for line, curve, and shape outlines. Add an option per tool. Removes the “stair-step plus corner” look without changing the data model. |
| 4 | Autosave and crash recovery | 9 | 3 | 3.00 | | Persist project snapshots to IndexedDB every N seconds/edits and offer recovery on load. Project tabs are currently in-memory; this closes the biggest data-loss gap. Add “restore autosave” and “discard” choices. |
| 5 | Onion skinning | 9 | 3 | 3.00 | | Draw previous/next frames at low alpha on the overlay canvas, with a configurable range and tint. No file-format change. Add per-frame visibility toggles and a quick `O` shortcut. One of the most requested animation features. |
| 6 | Project templates / presets | 6 | 2 | 3.00 | | Presets for canvas size, palette, background, starter layers, and grid. Store in `localStorage` and expose in New Project. Useful for game-jam and platform-specific workflows. |
| 7 | Command palette + shortcut editor | 6 | 2 | 3.00 | | Searchable action list (`Ctrl+K`), plus a keybinding editor with conflict detection and persistence. Low risk, improves discoverability and accessibility. |
| 8 | Palette tools: sort, dedupe, ramps, lock, cycling | 8 | 3 | 2.67 | | Sort by hue/lightness, remove duplicates, generate ramps between two colors, lock the active palette for indexed-style work, and preview color cycling. Builds on the existing palette collection. |
| 9 | Sprite sheet metadata export | 8 | 3 | 2.67 | | Export JSON alongside sheets in Aseprite, TexturePacker, and Godot formats. Include frame rects, trim, pivot, and tags. No model change; high value for game developers. |
| 10 | Dithering patterns and pattern brushes | 8 | 3 | 2.67 | | Add selectable dither masks (Bayer, checker, custom) to pencil/fill, and let a small pattern be stamped as a brush. Reuse the gradient Bayer code and selection masks. |
| 11 | Frame reordering drag-and-drop | 8 | 3 | 2.67 | | Drag frame headers to reorder; update every layer’s `cels` array in lockstep. The table already has stable frame ids. Add multi-frame selection in the same pass. |
| 12 | Color-blindness simulation and palette preview | 5 | 2 | 2.50 | | Preview deuteranopia/protanopia/tritanopia and grayscale in the canvas without changing pixels. Useful for accessibility checks and palette design. |
| 13 | ICO / favicon export | 5 | 2 | 2.50 | | Multi-size ICO encoder on top of the existing PNG export. Small, self-contained, and useful for web/game UI artists. |
| 14 | Frame tags, per-frame durations, loop range | 9 | 4 | 2.25 | | Extend `Frame` with duration and tag metadata, add tag ranges in the timeline, and honor them in GIF/APNG export and playback. Needed for non-uniform animation and game animation states. |
| 15 | Canvas resize, crop, and nearest-neighbor scale | 9 | 4 | 2.25 | | Resample every cel with nearest-neighbor, anchor the crop, and make it undoable. Add presets and “scale ×2/×3”. A basic editor capability that is currently missing. |
| 16 | Multi-frame selection, copy/paste, and duplicate | 8 | 4 | 2.00 | | Select a frame range, copy/paste cels across layers/frames, and duplicate with offsets. Pairs naturally with frame reordering and tags. |
| 17 | Outline, drop shadow, and color-replace filters | 8 | 4 | 2.00 | | Selection-aware filters that operate on the active cel or all visible layers. Add a preview and an undoable apply step. High value for quick sprite cleanup. |
| 18 | Rulers and draggable guides | 6 | 3 | 2.00 | | Horizontal/vertical guides with snapping, persisted per project. Reuse the mirror-guide overlay and pointer mapping. |
| 19 | Split view / second zoom window | 6 | 3 | 2.00 | | A second viewport showing the same document at another zoom, or a detached 1× preview. Reuse `drawScaled` and the preview component. |
| 20 | Custom grid offsets and isometric grid | 6 | 3 | 2.00 | | Offset the grid origin and add isometric/diagonal grid modes. Mostly rendering/UI work; useful for tiles and isometric art. |
| 21 | APNG and animated WebP export | 7 | 4 | 1.75 | | Add encoders/decoders alongside GIF. APNG can reuse PNG frames; animated WebP may need a small library or `ImageEncoder` support. Better quality and alpha than GIF. |
| 22 | Undo history panel | 7 | 4 | 1.75 | | Show named history entries, allow jumping to a point, and keep the cel-patch history compact. Requires history labels and a non-linear apply path. |
| 23 | Accessibility and localization pass | 5 | 3 | 1.67 | | Full keyboard navigation, screen-reader labels for canvas actions, reduced-motion support, and i18n extraction. Good for reach and polish. |
| 24 | Custom brushes (shapes, patterns, textured) | 8 | 5 | 1.60 | | A brush mask editor, saved brush library, and stamping pipeline. Build on `paintBrush` and `paintPixel`; add a brush preview and per-brush size/opacity. |
| 25 | Nine-slice / UI asset export | 6 | 4 | 1.50 | | Define nine-slice borders and export stretchable UI assets with metadata. Niche but valuable for game UI artists. |
| 26 | Recent files / project library | 6 | 4 | 1.50 | | A local project browser backed by IndexedDB/File System Access API, with thumbnails and recent projects. Complements autosave. |
| 27 | Isometric / seamless tiled drawing | 7 | 5 | 1.40 | | Wrap drawing across canvas edges and add an isometric tile mode. Requires careful coordinate wrapping in every drawing tool and preview. |
| 28 | Sprite atlas packing (MaxRects) | 7 | 5 | 1.40 | | Pack frames or tagged animations into an atlas with padding, trim, and rotation options. Build on the sprite-sheet geometry code. |
| 29 | Layer groups, blend modes, clipping masks | 8 | 6 | 1.33 | | Change the layer model to a tree, add blend modes (multiply, screen, overlay, etc.), and composite groups. High artist value but touches compositing, UI, undo, and file format. |
| 30 | Selection transform (scale/rotate/flip) | 8 | 6 | 1.33 | | Add transform handles to floating selections with nearest-neighbor scaling and 90° rotation. Reuse the floating-selection pipeline; add a transform matrix and commit path. |
| 31 | Version snapshots / named checkpoints | 6 | 5 | 1.20 | | Save named project snapshots locally with thumbnails and restore/diff. Complements undo and autosave without a backend. |
| 32 | Grayscale mode (1/2/4/8-bit, dithering) | 7 | 6 | 1.17 | | A document color mode with single-channel cels and a ramp palette, plus dithering and conversion to/from RGBA. Medium model change; valuable for Game Boy/1-bit and grayscale art. |
| 33 | Non-destructive adjustments (hue/sat/levels/curves) | 7 | 6 | 1.17 | | Per-layer adjustment stacks with live preview and export. Requires a layer-effect model and compositing changes; can be destructive first, then non-destructive. |
| 34 | Brush pressure / velocity and tablet support | 7 | 6 | 1.17 | | Pointer pressure API, pressure-to-size/opacity curves, and tablet-friendly UI. Requires a brush engine change and careful pixel snapping. |
| 35 | AI palette, cleanup, and generation assist | 8 | 7 | 1.14 | ★ | Optional, explicit AI actions: generate a palette from a prompt, clean up stray pixels, suggest outlines/shadows, or generate a base sprite. Needs a provider abstraction, privacy controls, and a review step. |
| 36 | Desktop app (Tauri/Electron) | 8 | 7 | 1.14 | ★ | Native menus, file-system access, auto-save, drag-and-drop, and offline project library. Reuses the Svelte UI; the main work is packaging, file APIs, and updates. |
| 37 | Indexed color mode | 9 | 8 | 1.13 | | Store palette indices instead of RGBA, enforce a document palette, support transparency index, palette swap, color cycling, and indexed PNG/GIF export. A major model/file-format change, but the classic pixel-art workflow and a strong differentiator. |
| 38 | Aseprite `.aseprite` import/export | 9 | 8 | 1.13 | | Parse/write the Aseprite binary format (layers, frames, tags, palettes, cels). High interoperability value; requires careful binary parsing and test fixtures. |
| 39 | MCP server | 8 | 8 | 1.00 | ★ | Expose Pixel Spell projects and operations to AI agents through MCP tools: inspect document/layers/frames/palette, draw/fill/select, add/remove frames and layers, export PNG/GIF/sheet, save project. A local Node bridge can talk to the browser app over WebSocket, or run the same TypeScript core headlessly. Security must be opt-in, localhost-only, and project-scoped. This is a genuinely uncommon selling point. |
| 40 | Tilemap / tileset mode | 9 | 9 | 1.00 | ★ | Tile size, tile palette document, tile layers storing indices, tile picker, auto-tiling rules, and tilemap JSON export. A large model change but extremely valuable for game artists and level design. |
| 41 | Mobile / touch UI and Apple Pencil | 7 | 7 | 1.00 | | Touch gestures, larger hit targets, pressure support, and a responsive layout. The canvas pointer pipeline is a good base; the UI needs a mobile pass. |
| 42 | Scripting / plugin API | 7 | 8 | 0.88 | | A safe JS plugin API for custom tools, filters, and exporters, with a sandbox and permission model. Powerful but risky; needs a stable API and documentation. |
| 43 | PSD import/export | 7 | 9 | 0.78 | | Read/write layered PSDs. High effort and large test surface; only worth it if the app targets artists who exchange files with Photoshop. |
| 44 | Cloud sync / project library | 6 | 9 | 0.67 | | Accounts, storage, conflict resolution, and sharing. Contradicts the current client-only architecture and adds operational cost. |
| 45 | Color management (ICC/sRGB/linear) | 4 | 6 | 0.67 | | Color-space-aware compositing and export. Most pixel artists work in sRGB, so this is mostly relevant for professional pipelines. |
| 46 | Audio / animation sync | 4 | 6 | 0.67 | | Attach audio tracks to animations and scrub/play in sync. Niche; useful for cutscenes and rhythm games. |
| 47 | Real-time collaboration | 5 | 10 | 0.50 | | Multiplayer editing, presence, conflict resolution, and permissions. Very high complexity and operational cost for a client-only editor. |

## Recommended roadmap

### Phase 1 — high-value quick wins (days to ~2 weeks)

1. Reference image / tracing layer — done (Reference Layer + Reference Board)
2. Onion skinning
3. Autosave and crash recovery
4. Frame tags, per-frame durations, and loop range
5. Canvas resize/crop/scale
6. Palette tools (sort, ramps, lock)
7. Sprite-sheet metadata export
8. Frame reordering and multi-frame selection

These add the most day-to-day value per unit of risk. Onion skinning and reference layers in particular are table stakes for animation and tracing workflows.

### Phase 2 — professional editing (1–2 months)

1. Layer groups, blend modes, and clipping masks
2. Selection transform (scale/rotate/flip)
3. Custom brushes and dithering patterns
4. Outline/shadow/color-replace filters
5. Grayscale mode
6. APNG/animated WebP export
7. Undo history panel

This phase closes the biggest gaps versus Aseprite and Photoshop-style workflows without changing the core document format too radically.

### Phase 3 — strategic differentiators (2–4 months)

1. Indexed color mode with palette swap/cycling
2. Tilemap/tileset mode
3. MCP server for AI-agent workflows
4. Aseprite `.aseprite` import/export
5. Desktop app (Tauri) with native file access and autosave

Indexed color and tilemaps deepen the pixel-art/game-art focus. The MCP server and desktop app make Pixel Spell useful in AI-assisted and offline workflows where most browser editors stop.

### Phase 4 — long bets

- Scripting/plugin API
- PSD import/export
- Cloud sync/project library
- Real-time collaboration
- Audio/animation sync

## Notes on the key requested and strategic features

### Indexed color mode

This is more than a palette UI: it changes the pixel representation and every tool that reads or writes pixels. A practical design:

- Add `doc.colorMode: "rgba" | "indexed"` and `doc.palette: string[]`.
- Store indexed cels as `Uint8Array` (or `Uint16Array` if more than 256 colors are allowed) and reserve index 0 or a configurable index for transparency.
- Make `compositeFrame` resolve indices through the document palette; make drawing tools write indices and compare indices for fill/selection.
- Add palette swap (replace palette entries without touching cels), color cycling (rotate a palette range over time), and indexed PNG/GIF export.
- Extend the project file format to version 3 with a color mode and palette table.
- Keep an “RGBA” escape hatch so users can convert a document without losing data.

Difficulty is high because undo, floating selections, copy/paste, import/export, and every tool need index-aware paths. The payoff is the classic pixel-art workflow and smaller cels.

### Grayscale mode

Grayscale is a smaller model change than indexed color but still needs its own pixel path:

- Add `doc.colorMode: "grayscale"` and a bit depth (1, 2, 4, or 8 bits per pixel).
- Store one value per pixel and resolve it through a grayscale ramp; support ordered/Bayer dithering when converting from RGBA.
- Make drawing tools compare and write values instead of packed RGBA; keep the same selection/floating-selection semantics.
- Convert to RGBA for PNG/WebP export and keep a dedicated grayscale export path for 1-bit/8-bit PNG.
- Add a document conversion command that maps the current RGBA image to the nearest ramp value with optional dithering.

This is a good fit for Game Boy, 1-bit, and monochrome art. It is less invasive than indexed color because there is no palette table, but it still touches tools, compositing, undo, and the file format.

### MCP server

A realistic architecture that preserves the client-only editor:

1. Add a local MCP server (stdio) that exposes tools such as `project.list`, `project.inspect`, `canvas.draw`, `canvas.fill`, `selection.set`, `frame.add`, `layer.add`, `export.png`, `export.gif`, and `project.save`.
2. Bridge the MCP server to the browser app over a localhost WebSocket, or run the same TypeScript core headlessly in Node with a canvas implementation.
3. Require an explicit “Enable MCP bridge” toggle, bind to `127.0.0.1`, and scope access to the open project. Do not expose arbitrary filesystem or network access.
4. Return structured JSON (dimensions, layers, frames, palette, changed pixel counts) so an agent can verify its work.
5. Add a read-only mode and an audit log of agent actions.

This is a strong differentiator because it lets an AI agent inspect and edit a real sprite project rather than generating a flat image. It is also a natural companion to AI palette/cleanup features.
