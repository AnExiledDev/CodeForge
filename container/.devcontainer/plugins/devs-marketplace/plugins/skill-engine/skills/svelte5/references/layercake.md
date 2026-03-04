# LayerCake — Reference

## Mental Model

LayerCake is a headless graphics framework, not a chart library. It provides a coordinate system — reactive scales that map data values to pixel positions — and layout containers for SVG, HTML, Canvas, and WebGL. The developer authors individual layer components (axes, lines, points, labels) that read scale functions from context. This separation means LayerCake handles the math while the developer controls every visual detail.

LayerCake does not ship pre-built chart types. Instead, it provides the plumbing: scale computation, responsive dimension tracking, data transformation helpers, and a layered rendering model that composites multiple technologies in a single chart area.

> Official guide, API reference, and component gallery: <https://layercake.graphics>

---

## Core API

### LayerCake Component

The `<LayerCake>` component is the root container. It computes scales from data and exposes them to all descendant layer components through Svelte context.

```svelte
<script>
  import { LayerCake, Svg } from 'layercake';
  import Line from './Line.svelte';

  let data = [
    { x: 0, y: 10 },
    { x: 1, y: 35 },
    { x: 2, y: 20 }
  ];
</script>

<div class="chart-container" style="width: 100%; height: 300px;">
  <LayerCake
    {data}
    x="x"
    y="y"
  >
    <Svg>
      <Line />
    </Svg>
  </LayerCake>
</div>
```

LayerCake requires a positioned container with explicit dimensions. The component measures this container and recomputes scales on resize.

### Key Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | array | The dataset. Each element is one data point |
| `x` | string / accessor | Key or function to extract the x value from each data point |
| `y` | string / accessor | Key or function to extract the y value |
| `z` | string / accessor | Optional third dimension (color, radius, category) |
| `r` | string / accessor | Optional radius/size dimension |
| `xScale` | d3 scale | Scale constructor for x axis (default: `scaleLinear`) |
| `yScale` | d3 scale | Scale constructor for y axis (default: `scaleLinear`) |
| `xDomain` | [min, max] | Override computed x domain |
| `yDomain` | [min, max] | Override computed y domain |
| `xRange` | [min, max] | Override x range (defaults to `[0, width]`) |
| `yRange` | [min, max] | Override y range (defaults to `[height, 0]` for SVG convention) |
| `padding` | object | `{ top, right, bottom, left }` in pixels |
| `xNice` | boolean | Round domain extents to nice values |
| `yNice` | boolean | Round domain extents to nice values |
| `flatData` | array | Pre-flattened data for domain calculation on nested/grouped datasets |

---

## Layout Components

Layout components create rendering contexts. Nest them inside `<LayerCake>` to composite multiple technologies:

| Component | Renders Into | Use Case |
|-----------|-------------|----------|
| `<Svg>` | `<svg>` element | Lines, areas, axes, annotations |
| `<Html>` | `<div>` overlay | Tooltips, labels, legends |
| `<Canvas>` | `<canvas>` element | Large point clouds, heatmaps, performance-critical rendering |
| `<WebGl>` | WebGL `<canvas>` | GPU-accelerated rendering for very large datasets |
| `<ScaledSvg>` | `<svg>` with viewBox | Resolution-independent SVG (PDF export, fixed coordinate space) |

Each layout component occupies the full chart area (respecting padding). Layers stack visually — SVG below, Canvas in the middle, HTML on top is a common arrangement.

---

## Context Values

Layer components (axes, lines, points) access chart context using `getContext('LayerCake')`. The context is a Svelte store containing:

### Dimensions
- `width`, `height` — inner dimensions (after padding)
- `containerWidth`, `containerHeight` — outer dimensions

### Scales
- `xScale`, `yScale`, `zScale`, `rScale` — configured d3 scale functions

### Accessors
- `x`, `y`, `z`, `r` — accessor functions that extract values from data points

### Convenience Getters
- `xGet(d)` — shorthand for `xScale(x(d))`, maps a data point to a pixel x position
- `yGet(d)` — shorthand for `yScale(y(d))`, maps to pixel y position
- `zGet(d)`, `rGet(d)` — same pattern for z and r dimensions

### Data
- `data` — the dataset passed to LayerCake
- `flatData` — flattened version for domain calculation

```svelte
<!-- Line.svelte (layer component) -->
<script>
  import { getContext } from 'svelte';

  const { data, xGet, yGet } = getContext('LayerCake');

  // Build an SVG path from the data
  $: path = 'M' + $data.map(d => `${$xGet(d)},${$yGet(d)}`).join('L');
</script>

<path d={path} fill="none" stroke="steelblue" stroke-width="2" />
```

> Context values are Svelte stores. Access them with `$` prefix in layer components: `$data`, `$xGet`, `$yGet`, `$width`, etc.

---

## Helper Functions

| Function | Purpose |
|----------|---------|
| `calcExtents(data, keys)` | Calculate min/max extents for specified dimensions |
| `stack(data, keys)` | D3-compatible stack layout for area/bar charts |
| `groupLonger(data, keys)` | Pivot wide data to long format for multi-series charts |
| `scaleCanvas(canvas, ctx)` | Apply device pixel ratio scaling to a canvas context |
| `bin(data, accessor, options)` | Create histogram bins from continuous data |

---

## Runes Incompatibility

**LayerCake uses `export let` and Svelte stores internally.** This makes the library incompatible with Svelte 5's global runes mode.

### The Problem

Enabling `runes: true` globally in `svelte.config.js` forces all components — including those inside `node_modules` — to use runes syntax. LayerCake's internal components use `export let` for props and `$:` reactive declarations, which are invalid in runes mode. The compiler will emit errors when processing LayerCake's source.

### Workarounds

**Option A (recommended):** Do not enable global runes mode. Svelte 5 components can use runes without any config flag — runes are auto-detected per file. Global `runes: true` is unnecessary for application code and breaks libraries that have not migrated.

**Option B:** If the project requires global runes mode for other reasons, mark individual LayerCake wrapper components with per-component legacy mode:

```svelte
<svelte:options runes={false} />
<!-- This component can use export let and $: safely -->
```

This workaround applies only to the wrapper component that imports LayerCake. Child layer components authored by the developer can still use runes for their own logic — they access context stores with the `$` prefix as shown above.

### Migration Status

LayerCake's runes migration is tracked in GitHub issue [#156](https://github.com/mhkeller/layercake/issues/156). Until the migration lands, treat LayerCake components as legacy-mode dependencies.

### Layer Components and Runes

User-authored layer components (the components nested inside `<Svg>`, `<Html>`, etc.) can use runes for their own local state and derived values. The constraint applies only to LayerCake's own components (`<LayerCake>`, `<Svg>`, `<Html>`, `<Canvas>`, etc.) which live in `node_modules`.

However, context values from LayerCake are Svelte stores, not rune-based signals. Layer components must use the `$` store subscription syntax (`$data`, `$xGet`) regardless of whether they use runes for other state.

---

## Multi-Layer Composition

A common pattern layers SVG (for axes and lines), Canvas (for dense point rendering), and HTML (for interactive tooltips):

```svelte
<script>
  import { LayerCake, Svg, Canvas, Html } from 'layercake';
  import AxisX from './AxisX.svelte';
  import AxisY from './AxisY.svelte';
  import Points from './Points.canvas.svelte';
  import Tooltip from './Tooltip.svelte';

  let data = [...];
</script>

<div class="chart-container" style="width: 100%; height: 400px;">
  <LayerCake {data} x="date" y="value">
    <Svg>
      <AxisX />
      <AxisY />
    </Svg>
    <Canvas>
      <Points />
    </Canvas>
    <Html>
      <Tooltip />
    </Html>
  </LayerCake>
</div>
```

Each layout component creates its own rendering surface at the same dimensions. Layer components render independently — the SVG axes do not interfere with the Canvas points, and the HTML tooltip floats above both.

Canvas layer components receive the canvas context through `getContext('canvas')` and render in the `onMount` or `$effect` lifecycle. Call `scaleCanvas` to handle high-DPI displays.
