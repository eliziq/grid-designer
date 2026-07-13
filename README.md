# Grid Designer (Vanilla JS Starter)

Simple vanilla JavaScript grid designer for quickly prototyping CSS grid layouts.

## Quick start

1. Open `index.html` in your browser.
2. Set banner id and banner dimentions and click `Build Grid`.
3. REsize and move cells
4. Click `Export CSS` to download a CSS file.

## Project files

- `index.html` – UI skeleton
- `style.css` / `main.css` – Styles
- `script.js` – Dynamic script loader (dev entry point)
- `use-script.js` – Demo initialisation

### core/
- `core/class.js` – GridDesigner class definition, constructor, DOM cache, static helpers
- `core/state.js` – State persistence and editor data exports
- `core/tag-sync.js` – Tag-state synchronisation and area-pruning logic
- `core/resolutions.js` – Resolution lifecycle, import hydration, and tab UI

### components/
- `components/confirm-dialog.js` – Reusable confirm dialog component
- `components/resolution-option-component.js` – Resolution tab option template
- `components/tag-component.js` – Element list tag template
- `components/area-controls-component.js` – Per-area layout controls template

### export/
- `export/css-generator.js` – CSS output generation for finished resolution states

### layout/
- `layout/layout.js` – Grid geometry, area placement, conflict detection, pointer math

### render/
- `render/render.js` – Grid, area block, and element list rendering
- `render/tag-panel.js` – Tag selection panel rendering
- `render/tag-layout-controls.js` – Per-area alignment controls behaviour

### interactions/
- `interactions/interactions.js` – Editor event handlers (build, clear, import, export, tags)
- `interactions/pointer.js` – Pointer move/resize/drop handlers for area blocks

### api/
- `api/api.js` – Public `window.GridDesigner` API surface
