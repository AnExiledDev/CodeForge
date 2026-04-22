# svelte-dnd-action — Reference

## Mental Model

`svelte-dnd-action` is an action-based drag-and-drop library. The `use:dndzone` action transforms any container element into a drag-and-drop zone. Items are plain arrays managed with `$state`; the library emits events when the user drags (consider) and drops (finalize), and the component reassigns its items array in response. There is no separate state store or provider — the action reads items from its options and communicates changes through DOM events.

> Official documentation and examples: <https://github.com/isaacHagworthy/svelte-dnd-action>

---

## Core API

### The dndzone Action

Apply `use:dndzone` to a container element. The action accepts an options object and emits two events:

```svelte
<script>
  import { dndzone } from 'svelte-dnd-action';

  let items = $state([
    { id: 1, name: 'Item A' },
    { id: 2, name: 'Item B' },
    { id: 3, name: 'Item C' }
  ]);

  function handleSort(e) {
    items = e.detail.items;
  }
</script>

<div
  use:dndzone={{ items }}
  onconsider={handleSort}
  onfinalize={handleSort}
>
  {#each items as item (item.id)}
    <div>{item.name}</div>
  {/each}
</div>
```

### Events

| Event | When | Purpose |
|-------|------|---------|
| `consider` | During drag (hover, reorder) | Preview the tentative new order; update items for visual feedback |
| `finalize` | On drop | Commit the final order; update items to persist the result |

Both events provide `e.detail.items` (the reordered array) and `e.detail.info` (metadata about the drag operation including `trigger` and `source`).

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `items` | array | required | The array of items. Each must have a unique `id` property |
| `type` | string | internal ID | Zone type identifier. Only zones with matching types accept drops |
| `flipDurationMs` | number | 0 | Animation duration in ms for reorder transitions. Set to ~200 for smooth animations |
| `dragDisabled` | boolean | false | Disable dragging from this zone |
| `morphDisabled` | boolean | false | Disable morph animation when items move between zones |
| `dropFromOthersDisabled` | boolean | false | Prevent items from being dropped into this zone from other zones |
| `dropTargetStyle` | object | `{outline: ...}` | CSS styles applied to the zone when a dragged item hovers over it |
| `dropTargetClasses` | array | `[]` | CSS classes applied to the zone during hover |
| `transformDraggedElement` | function | undefined | Callback to modify the dragged element's appearance |
| `autoAriaDisabled` | boolean | false | Disable automatic ARIA attribute management |
| `centreDraggedOnCursor` | boolean | false | Center the dragged element on the cursor |
| `zoneTabIndex` | number | 0 | Tab index for the zone container |
| `minItems` | number | undefined | Minimum items the zone must retain |
| `maxItems` | number | undefined | Maximum items the zone accepts |
| `itemsOrientation` | string | inferred | `"vertical"`, `"horizontal"`, or `"grid"`. Usually auto-detected |
| `multiDrag` | boolean | false | Enable selecting and dragging multiple items |

---

## Drag Handle Pattern

Use `dragHandleZone` and `dragHandle` when only a specific element within each item should initiate dragging:

```svelte
<script>
  import { dragHandleZone, dragHandle } from 'svelte-dnd-action';

  let items = $state([
    { id: 1, name: 'Task A' },
    { id: 2, name: 'Task B' }
  ]);

  function handleSort(e) {
    items = e.detail.items;
  }
</script>

<div
  use:dragHandleZone={{ items }}
  onconsider={handleSort}
  onfinalize={handleSort}
>
  {#each items as item (item.id)}
    <div>
      <span use:dragHandle aria-label="drag handle">☰</span>
      <span>{item.name}</span>
    </div>
  {/each}
</div>
```

`dragHandleZone` replaces `dndzone` on the container. `dragHandle` marks the grip element inside each item. All options and events remain the same.

---

## Svelte 5 Integration

### Event Syntax

Svelte 5 uses `onconsider` and `onfinalize` (no colon). The Svelte 4 syntax `on:consider` and `on:finalize` does not work in runes mode:

```svelte
<!-- Correct (Svelte 5) -->
<div use:dndzone={{ items }} onconsider={handleSort} onfinalize={handleSort}>

<!-- Wrong (Svelte 4 syntax) -->
<div use:dndzone={{ items }} on:consider={handleSort} on:finalize={handleSort}>
```

### State Management

Store items with `$state()` and reassign in event handlers. The library checks reference equality, so always reassign the entire array — never use `splice` or other in-place mutations in the handler:

```js
let items = $state([...]);

function handleSort(e) {
  items = e.detail.items;  // full reassignment
}
```

### Version Requirement

Version **0.9.59+** is required for `$state` compatibility. Earlier versions do not correctly detect Svelte 5's reactive proxies and may fail silently or throw during drag operations.

---

## Shadow Item Handling

During a drag operation, the library inserts a shadow placeholder item into the items array to represent the drop position. This shadow item is visible to `$derived` computations over the items array.

Filter shadow items when computing derived values to avoid counting or displaying the placeholder:

```js
import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';

let items = $state([...]);
let realCount = $derived(
  items.filter(i => !i[SHADOW_ITEM_MARKER_PROPERTY_NAME]).length
);
```

The shadow item carries the `SHADOW_ITEM_MARKER_PROPERTY_NAME` property set to `true`. The companion constant `SHADOW_PLACEHOLDER_ITEM_ID` holds the shadow's `id` value for identity-based filtering.

---

## Exported Constants

| Constant | Purpose |
|----------|---------|
| `TRIGGERS` | Enum of drag trigger types (e.g., `DRAG_STARTED`, `DROPPED_INTO_ZONE`) |
| `SOURCES` | Enum of event sources (e.g., `POINTER`, `KEYBOARD`) |
| `SHADOW_ITEM_MARKER_PROPERTY_NAME` | Property name on shadow placeholder items |
| `SHADOW_PLACEHOLDER_ITEM_ID` | The `id` value assigned to shadow items |

Access trigger and source info from `e.detail.info`:

```js
import { TRIGGERS, SOURCES } from 'svelte-dnd-action';

function handleFinalize(e) {
  if (e.detail.info.trigger === TRIGGERS.DROPPED_INTO_ZONE) {
    saveOrder(e.detail.items);
  }
}
```
