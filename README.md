# Pixel Spell

A focused pixel art editor that runs entirely in the browser. Draw sprites, build layered artwork, and animate frame by frame with a clean, modern interface.

![Pixel Spell screenshot](docs/screenshot.jpg)

## Features

- **Drawing tools** — pencil, spray, eraser, line, curve, shape, paint bucket, gradient, and eyedropper, plus pan and pointer-focused zoom tools. The shape tool draws rectangles, ellipses, stars, or hearts, either as an outline or filled. The gradient tool fills a matching area with a linear or radial primary-to-secondary gradient, using optional Bayer 2×2, 4×4, or 8×8 dithering, fill tolerance, and contiguous-region matching. Zooming with the tool or the scroll wheel moves the view halfway from the current center toward the pointer. The curve tool starts with a dragged base line, then two clicks place its control points. The spray tool scatters random pixels inside a round area at an adjustable pixel rate.
- **Area effects** — the blur and jumble tools soften or scramble pixels inside a round area as you pass over them, with adjustable radius and power.
- **Selections** — magic wand (with optional diagonal connections), a shape marquee tool for rectangles, ellipses, stars, and hearts, freehand or polygonal lasso, and select-by-color. Drag inside a selection to move its pixels; hold `Shift` while making another selection to add it to the current one. Copy and paste selected pixels with `Ctrl+C` and `Ctrl+V` using an in-app clipboard. Pasted pixels stay floating so they can be dragged before being applied on deselect; moving or floating selections are previewed at 50% opacity. Transparent pixels are skipped so they never erase the destination. Edits are clipped to the selected area, and `Delete` clears the selected pixels. Deselect with the panel button, `Esc`, or by clicking the empty canvas stage with a selection tool.
- **Tool options** — brush sizes from 1–8 px, filled shapes, fill tolerance and contiguous fill, layer-aware color sampling, and selection options. The top bar's alpha-lock toggle prevents painting over fully transparent pixels.
- **Pixel perfect** — optional corner-pixel removal for smoother pencil, eraser, and curve strokes.
- **Mirroring** — X, Y, and two diagonal axis mirrors. X mirrors across the horizontal axis and Y across the vertical axis. Active axes are drawn as dashed blue lines across the whole canvas stage and can be dragged from anywhere on the stage; drag a line in half-pixel steps to move its mirror axis. Turning a mirror off resets its guide to the center. The toggles live in the top bar next to the theme switch.
- **Aseprite-style timeline** — layers are rows and frames are columns. Click any cel to select its layer and frame; sticky headers keep both axes visible while scrolling. Add, duplicate, reorder, rename, hide, lock, delete, and adjust layer opacity; add, duplicate, and delete frames; play the animation at 1–60 fps.
- **Resizable workspace** — drag the divider above the timeline, or focus it and use `↑` / `↓`, to resize the canvas/timeline split. The height is remembered between visits.
- **Color workflow** — separate primary (left mouse) and secondary (right mouse) colors with an always-visible saturation/brightness picker, hue and alpha sliders, and hex input. The color panel supports multiple palettes: the built-in 32-color palette is read-only, while custom palettes can be created, renamed, deleted, and hold up to 256 colors. The palette header's `+` and `−` buttons add the current color or remove the last color, and the palette button creates a new palette. Left-click a palette swatch to set the primary color; right-click to set the secondary. A swap button between the two swatches exchanges them. Custom palettes are persisted in `localStorage`.
- **History** — 80-step undo/redo stack per project, with keyboard shortcuts.
- **Export** — one dialog for image, sprite sheet, and GIF output. Export the current or chosen frame as PNG, WebP, or JPEG; build horizontal, vertical, or grid sprite sheets with configurable spacing; or render an animated GIF with adjustable frame rate, looping, and transparency. Every mode supports 1×–10× scaling and background choices, with live previews and size warnings.
- **Multiple projects** — open several projects in tabs above the canvas. New projects can be named and started with a transparent, white, or black background. Each tab keeps its own document, history, zoom, pan, rotation, and unsaved state. Closing a dirty project asks for confirmation; closing the last project starts a new untitled one.
- **File import** — use **File → Import…** or drag and drop a file anywhere to open the import dialog. Common images (PNG, JPEG, GIF, WebP, BMP, AVIF, ICO, SVG) can become new projects; images larger than 1024 × 1024 are cropped to the top-left corner. PNGs can also contribute a palette built from their unique colors, and JASC `.pal`, GIMP `.gpl`, and `.hex` palettes import directly. Palettes are capped at 256 colors and previewed before import.
- **Projects** — save and open portable `.pixelspell` files; opened files get their own tab.
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
        ├── import.ts           # Image/palette import parsing and analysis
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
- `frames[]` — animation frames
- `layers[]` — ordered bottom-to-top; each layer has visibility, opacity, lock state, and one `Uint32Array` cel per frame

Pixels are packed little-endian RGBA (`0xAABBGGRR`), which lets cels be written directly into `ImageData` for rendering and PNG export. Transparent pixels are `0`.

Project files use a compact binary container (`PXSP` version 2). Layer metadata is stored as UTF-8 JSON and each cel is stored as raw little-endian RGBA or run-length encoded data, whichever is smaller. Pixel art is usually dominated by flat color and transparency runs, so RLE keeps files small. Legacy version 1 JSON projects still open; saving upgrades them to the binary format.

Undo history stores one previous cel buffer for pixel edits and a full document snapshot only for structural edits (adding, deleting, or reordering layers and frames). The stack is capped at 80 entries and about 128 MB per project.

Each open project is a separate `PixelDoc` session with its own active layer/frame, zoom, pan, rotation, undo history, and dirty state. Tool, color, palette collection, theme, and timeline-height settings are shared across the workspace.

## Notes and limitations

- Open project tabs are kept in memory; reloading the page starts with a single new `Untitled` project.
- Each tab shows an unsaved dot when it has unsaved progress. Closing a dirty project asks for confirmation, and the close button is disabled for a single untouched project.
- **File → New project** and **File → Open project** create new tabs; **File → Save project** saves the active project.
- **File → Import…** opens a file picker, and dropping a file anywhere in the app opens the same import dialog. Images become unsaved project tabs; palettes are added to the workspace palette collection.
- **File → Export…** opens the export dialog for images, sprite sheets, and animated GIFs. Outputs are generated locally and downloaded by the browser.
- The timeline is an Aseprite-style grid: layer rows and frame columns, with sticky headers and cel thumbnails. Its height is remembered in `localStorage`.
- Custom color palettes and the active palette selection are saved in `localStorage`; the built-in palette is recreated on load and cannot be edited.
- Layer visibility and opacity are document-wide rather than per-frame.
- Brushes are square and pixel-aligned; there is no free-transform (scale/rotate) tool for selections yet.
- Projects are limited to 1024 layers and 1000 frames.
- The editor does not auto-save. Use **File → Save project** to keep your work.
- The default canvas is 32 × 32; new projects can be 1–1024 px in each dimension.
