# Pixel Spell

A focused pixel art editor that runs entirely in the browser. Draw sprites, build layered artwork, and animate frame by frame with a clean, modern interface.

![Pixel Spell screenshot](docs/screenshot.jpg)

## Features

- **Drawing tools** — pencil, spray, eraser, line, curve, shape, paint bucket, gradient, and eyedropper, plus pan and pointer-focused zoom tools. The shape tool draws rectangles, ellipses, stars, or hearts, either as an outline or filled. The gradient tool fills a matching area with a linear or radial primary-to-secondary gradient, using optional Bayer 2×2, 4×4, or 8×8 dithering, fill tolerance, and contiguous-region matching. Zooming with the tool or the scroll wheel moves the view halfway from the current center toward the pointer. The curve tool starts with a dragged base line, then two clicks place its control points. The spray tool scatters random pixels inside a round area at an adjustable pixel rate.
- **Area effects** — the blur and jumble tools soften or scramble pixels inside a round area as you pass over them, with adjustable radius and power.
- **Selections** — magic wand (with optional diagonal connections), a shape marquee tool for rectangles, ellipses, stars, and hearts, freehand or polygonal lasso, and select-by-color. Drag inside a selection to move its pixels; hold `Shift` while making another selection to add it to the current one. Copy and paste selected pixels with `Ctrl+C` and `Ctrl+V` using an in-app clipboard. Pasted pixels stay floating so they can be dragged before being applied on deselect; moving or floating selections are previewed at 50% opacity. Transparent pixels are skipped so they never erase the destination. Edits are clipped to the selected area, and `Delete` clears the selected pixels. Deselect with the panel button, `Esc`, or by clicking the empty canvas stage with a selection tool.
- **Tool options** — brush sizes from 1–8 px, filled shapes, fill tolerance and contiguous fill, layer-aware color sampling, and selection options. The top bar's alpha-lock toggle prevents painting over fully transparent pixels.
- **Pixel perfect** — optional per-tool corner-pixel removal for pencil, eraser, curve, and shape-outline strokes. The switch lives in the tool options panel and only appears for tools that support it. The line tool does not expose it because Bresenham lines already avoid redundant corner pixels.
- **Mirroring** — X, Y, and two diagonal axis mirrors. X mirrors across the horizontal axis and Y across the vertical axis. Active axes are drawn as dashed blue lines across the whole canvas stage and can be dragged from anywhere on the stage; drag a line in half-pixel steps to move its mirror axis. Turning a mirror off resets its guide to the center. The toggles live in the top bar next to the theme switch.
- **Radial symmetry** — an asterisk button duplicates every stroke around a center point for mandalas, wheels, and ornaments. Choose 2–16 rotational copies from the adjacent chevron menu, and drag the center handle on the canvas to move the rotation origin. Radial symmetry can be combined with the axis mirrors; mirror axes stay blue while radial spokes and the center handle are red. Turning radial symmetry off resets its center to the canvas center.
- **Aseprite-style timeline** — layers are rows and frames are columns. Click any cel to select its layer and frame; sticky headers keep both axes visible while scrolling. Add, duplicate, reorder (drag frame headers), rename, hide, lock, delete, and adjust layer opacity; add, duplicate, and delete frames; play the animation at 1–60 fps. Shift-click frames or cels to select a range, Ctrl/Cmd-click to toggle individual frames, and drag a selected frame header to move the whole range.
- **Onion skinning** — show previous and/or next frames at low opacity behind the active frame. Choose a 1–3 frame range, 15/30/50% opacity, and a previous/next tint preset. Toggle it with `O`, the ghost button, or its settings menu.
- **Multi-frame editing** — copy, paste, and duplicate selected frame ranges. Duplicate can shift every cel by X/Y offsets. Right-click a frame header or cel for the same actions plus move left/right, frame duration and tag settings, loop range controls, and delete.
- **Frame tags, durations, and loop range** — give frames a tag and a custom duration. Contiguous frames with the same tag appear as tag ranges above the timeline; click a range to select it. Set a loop range for playback and GIF export. Per-frame durations override the project FPS, and GIF export can honor the loop range.
- **Canvas size tools** — the Project menu scales, resizes, and crops the canvas. **Scale Canvas** resamples with nearest-neighbor and offers a live preview, aspect lock, and ½×/1×/2×/3× presets. **Resize Canvas** crops or extends around a 3×3 anchor with a live preview. **Crop to Content** trims transparent borders across every layer and frame, and **Crop to Selection** crops to the selection rectangle. All four are undoable.
- **Reference layers** — add a locked, non-exported reference layer to the timeline from an image. Reference layers are fitted to the canvas, can be shown or hidden, have their own opacity, and keep a cel per frame for animation-focused reference work. Use the timeline's reference-eye button for a quick import, or choose **Reference Layer** in the import dialog to apply to one frame or all frames. With a reference layer selected, the same timeline button replaces the current frame's reference cel, making it easy to build a per-frame reference sequence.
- **Reference board** — a project-level mood board for images that should not live in the layer stack. Board references are independent of frames and layers, can be moved outside the canvas, support visibility, lock, opacity, zoom, and rotation controls, and are never exported. Toggle it from **View → Show reference board** or the top-left canvas button.
- **Resizable workspace** — drag the divider above the timeline, or focus it and use `↑` / `↓`, to resize the canvas/timeline split. The height is remembered between visits.
- **Color workflow** — separate primary (left mouse) and secondary (right mouse) colors with an always-visible saturation/brightness picker, hue and alpha sliders, and hex input. The color panel supports multiple palettes: the built-in 32-color palette is read-only, while custom palettes can be created, renamed, deleted, and hold up to 256 colors. The palette header's `+` and `−` buttons add the current color or remove the last color, and the palette button creates a new palette. Left-click a palette swatch to set the primary color; right-click to set the secondary. A swap button between the two swatches exchanges them. Custom palettes are persisted in `localStorage`.
- **History** — 80-step undo/redo stack per project, with keyboard shortcuts.
- **Export** — one dialog for image, sprite sheet, and GIF output. Export the current or chosen frame as PNG, WebP, or JPEG; build horizontal, vertical, or grid sprite sheets with configurable spacing; or render an animated GIF with adjustable frame rate, looping, and transparency. Every mode supports 1×–10× scaling and background choices, with live previews and size warnings.
- **Multiple projects** — open several projects in tabs above the canvas. New projects can be named and started with a transparent, white, or black background. Double-click a tab name to rename it. Each tab keeps its own document, history, zoom, pan, rotation, and unsaved state. Closing a dirty project asks for confirmation; closing the last project starts a new untitled one.
- **Autosave and crash recovery** — unsaved projects are snapshotted to IndexedDB shortly after you pause drawing, and every few seconds during longer sessions. If the app is reloaded or crashes, the next launch offers the autosaved tabs with a live preview and **Restore** or **Discard** choices. Autosaves are recovery copies; saved `.pixelspell` files remain the source of truth.
- **File import** — use **File → Import…** or drag and drop a file anywhere to open the import dialog. Common images (PNG, JPEG, GIF, WebP, BMP, AVIF, ICO, SVG) can become a new project, a normal layer, a new frame, a timeline reference layer, or a reference-board image. Project imports larger than 1024 × 1024 are cropped to the top-left corner; reference layers use the complete image fitted to the canvas, and board references retain their original full-resolution bytes. PNGs can also contribute a palette built from their unique colors, and JASC `.pal`, GIMP `.gpl`, and `.hex` palettes import directly. Palettes are capped at 256 colors and previewed before import.
- **Projects** — save and open portable `.pixelspell` files; opened files get their own tab. Reference layers and board images are stored inside the project file, so references travel with the artwork.
- **Canvas controls** — fit-to-window or manual zoom, scroll-wheel zoom, middle-mouse panning that always keeps part of the sprite on stage, canvas rotation from −180° to +180° in 15° steps, preset grid sizes from 1×1 to 64×64, and a live cursor preview. The grid control sits at the bottom left of the canvas, while rotation and zoom controls sit at the bottom right. A compact menu-bar readout shows the canvas size, last cursor coordinate, current frame, and active layer.
- **Preview window** — a 1× copy of the active frame floats in the upper-right of the canvas stage. Close it to leave a circular scan-eye button; toggle it from **View → Show preview**. The preview updates while the animation plays.
- **Light and dark themes** with a sky-blue accent, persisted in `localStorage`.

## Tech stack

- [Svelte 5](https://svelte.dev/) with runes
- [Vite](https://vite.dev/) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/)
- [shadcn-svelte](https://shadcn-svelte.com/) (Nova preset) and [bits-ui](https://bits-ui.com/)
- [Lucide](https://lucide.dev/) icons

## Getting started

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

### Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                    |
| `npm run build`   | Build for production                          |
| `npm run preview` | Preview the production build locally         |
| `npm run check`   | Run `svelte-check` and TypeScript validation |
| `npm run bench`   | Run the deterministic core performance benchmarks |

## Keyboard shortcuts

| Action              | Shortcut                 |
| ------------------- | ------------------------ |
| Pan                 | `H`                      |
| Zoom                | `Z`                      |
| Magic wand          | `W`                      |
| Shape select        | `M`                      |
| Lasso               | `Q`                      |
| Select by color     | `C`                      |
| Pencil              | `B`                      |
| Spray               | `S`                      |
| Eraser              | `E`                      |
| Line                | `L`                      |
| Curve               | `U`                      |
| Shape               | `R`                      |
| Fill                | `G`                      |
| Gradient            | `D`                      |
| Eyedropper          | `I`                      |
| Blur                | `K`                      |
| Jumble              | `J`                      |
| Undo / redo         | `Ctrl+Z` / `Ctrl+Shift+Z` |
| New project         | `Ctrl+N`                 |
| Save project        | `Ctrl+S`                 |
| Play / pause        | `Space`                  |
| Previous / next frame | `[` / `]` or `,` / `.`  |
| Toggle onion skin   | `O`                      |
| Move selected frames | `Alt+←` / `Alt+→`       |
| Toggle grid         | `Shift+G`                |
| Select all          | `Ctrl+A`                 |
| Copy selection      | `Ctrl+C`                 |
| Paste selection     | `Ctrl+V`                 |
| Delete selection    | `Delete`                 |
| Deselect            | `Esc`                    |
| Resize timeline     | Drag divider, or `↑` / `↓` |

Shortcuts are ignored while typing in an input. The Help menu also lists them.

## Project structure

```
src/
├── App.svelte                  # App shell, layout, global shortcuts
├── app.css                     # Tailwind, shadcn theme, editor surface styles
└── lib/
    ├── components/
    │   ├── editor/             # Menu bar, tool strip, tool/color panels, canvas, timeline, dialogs
    │   └── ui/                 # shadcn-svelte components
    └── editor/
        ├── editor.svelte.ts    # Reactive editor state (Svelte 5 runes)
        ├── types.ts            # Document, layer, frame, and tool types
        ├── doc.ts              # Document creation, cloning, compositing
        ├── draw.ts             # Brush, line, shape, and fill algorithms
        ├── render.ts           # Canvas and thumbnail rendering helpers
        ├── color.ts            # Packed RGBA and hex color utilities
        ├── file.ts             # Project serialization and save helpers
        ├── autosave.ts         # IndexedDB crash-recovery snapshots
        ├── canvas.ts           # Nearest-neighbor scale, resize, and crop helpers
        ├── import.ts           # Image/palette import parsing and analysis
        ├── reference.ts        # Reference-layer fitting and board placement helpers
        ├── export.ts           # Image, sprite sheet, and GIF export encoding
        ├── palette.ts          # Default palette and palette persistence
        └── tools.ts            # Tool metadata and shortcuts
bench/                          # Deterministic core benchmarks (npm run bench)
docs/                           # Screenshot, performance notes, planned features
```

The project tab strip lives in `components/editor/ProjectTabs.svelte`; the editor core keeps one session per project in `editor.svelte.ts`.

## Data model

A document is a `PixelDoc`:

- `width`, `height`, `fps`
- `frames[]` — animation frames, each with an optional custom duration (milliseconds) and tag
- `layers[]` — ordered bottom-to-top; each layer has visibility, opacity, lock state, an optional `role: "reference"`, and one `Uint32Array` cel per frame
- `references[]` — project-level reference-board images with their source bytes, natural dimensions, display bounds, opacity, visibility, and lock state
- `loopStart`, `loopEnd` — optional inclusive playback/export range

Pixels are packed little-endian RGBA (`0xAABBGGRR`), which lets cels be written directly into `ImageData` for rendering and PNG export. Transparent pixels are `0`.

Reference layers participate in the viewport composite but are excluded from export, preview, and thumbnails by default. Reference-board images are rendered separately on the canvas stage and never enter the cel compositor. The eyedropper can sample visible reference layers when layer-aware sampling is enabled.

Project files use the current `PXSP` container format (version 2). Layer and frame metadata is stored in a UTF-8 metadata block and each cel is stored as raw little-endian RGBA or run-length encoded data, whichever is smaller. Reference-board images are appended as their original compressed source bytes after the cels, which keeps photos and other high-resolution references efficient. Projects from earlier unreleased format versions are intentionally not supported.

Undo history stores one previous cel buffer for pixel edits and a full document snapshot only for structural edits (adding, deleting, or reordering layers and frames). The stack is capped at 80 entries and about 128 MB per project.

Each open project is a separate `PixelDoc` session with its own active layer/frame, zoom, pan, rotation, undo history, and dirty state. Tool, color, palette collection, theme, and timeline-height settings are shared across the workspace.

## Notes and limitations

- Open project tabs are kept in memory; reloading the page offers to recover any tabs that had unsaved changes from IndexedDB.
- Each tab shows an unsaved dot when it has unsaved progress. Double-click a tab name to rename it inline; Enter or clicking away commits, Escape cancels, and renaming marks the project dirty. Closing a dirty project asks for confirmation, and the close button is disabled for a single untouched project. Closing a dirty project without saving also deletes its recovery snapshot.
- **File → New project** and **File → Open project** create new tabs; **File → Save project** saves the active project. The **Project** menu contains canvas scaling, resizing, and cropping.
- Canvas transforms apply to every layer and frame. Reference layers are resampled or cropped with the artwork; reference-board images keep their absolute position and size. Crop to Content ignores reference layers and board images, so tracing aids do not prevent a tight crop.
- Canvas transforms clear the current pixel selection and are undoable. Scale uses nearest-neighbor sampling, not bilinear smoothing.
- **File → Import…** opens a file picker, and dropping a file anywhere in the app opens the same import dialog. Images can become project tabs, layers, frames, timeline reference layers, or reference-board images; palettes are added to the workspace palette collection.
- **File → Export…** opens the export dialog for images, sprite sheets, and animated GIFs. Outputs are generated locally and downloaded by the browser.
- Reference layers are locked and never exported. They are fitted to the canvas and store one cel per frame, so each frame can carry its own reference. Applying a large reference to many frames increases project file size because each reference cel is saved like a normal cel.
- Reference-board images are stored inside the project file. A large mood board therefore makes the `.pixelspell` file larger. Board image movement, opacity, zoom, and rotation changes are not part of the undo history; adding and removing a board image is.
- Reference-board images are draggable only while selected in the board panel and unlocked. Lock them when you want to keep drawing over them without moving them.
- The timeline is an Aseprite-style grid: layer rows and frame columns, with sticky headers and cel thumbnails. Its height is remembered in `localStorage`. Frame tags appear as ranges above the frame numbers, and the active loop range is underlined in amber.
- Onion skins are a viewport aid only; they are never included in thumbnails, previews, or exports. They are hidden during playback.
- Per-frame durations, tag ranges, and the loop range are stored in `.pixelspell` files. Frames without a custom duration follow the project FPS.
- GIF export uses custom frame durations and can optionally export only the loop range. The fallback frame rate applies to frames without a custom duration.
- Custom color palettes and the active palette selection are saved in `localStorage`; the built-in palette is recreated on load and cannot be edited.
- Layer visibility and opacity are document-wide rather than per-frame.
- Brushes are square and pixel-aligned; there is no free-transform (scale/rotate) tool for selections yet.
- Projects are limited to 1024 layers and 1000 frames.
- The editor autosaves dirty tabs to IndexedDB for crash recovery. Autosaves are offered on the next launch and do not replace **File → Save project**, which is still required to keep a `.pixelspell` file. Saving or discarding a dirty project clears its recovery snapshot.
- The default canvas is 32 × 32; new projects can be 1–1024 px in each dimension.
