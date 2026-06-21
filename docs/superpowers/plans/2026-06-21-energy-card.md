# Energy Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `energy-card`, a Home Assistant Lovelace custom card that visualizes an energy system as nodes (production/consumption/grid/storage) connected by animated lines to a central "house" circle, matching the provided mockup.

**Architecture:** Single no-build ES module (`energy-card.js`), following the exact pattern of the sibling repos `gauge` and `vumetre`: pure, exported helper functions (config validation, formatting, color lookup, path geometry, history parsing) are unit-tested with `node --test`; the `HTMLElement` subclass and all DOM/Canvas/SVG rendering live behind an `if (typeof window !== 'undefined' && window.customElements)` guard so the test file can be imported under plain Node. Layout uses CSS Grid (named areas) for the node cards and a single absolutely-positioned `<svg>` overlay for the connector curves and animated flow dots, recomputed via `ResizeObserver`. DOM/visual behavior (layout, animation, sparkline rendering) is verified manually through a browser test harness (`test/harness.html` + `test/serve.sh`), mirroring the convention already established in `gauge`/`vumetre` — those repos likewise only unit-test pure logic and verify canvas/DOM output by eye in a browser, since there's no DOM test runner in scope here.

**Tech Stack:** Vanilla JS (ES modules, Custom Elements, SVG, CSS Grid), Node's built-in `node:test` runner, HACS packaging (`hacs.json`).

---

## File Structure

- `energy-card.js` — the entire card: constants, pure exported helpers, guarded `EnergyCard` class, `customElements.define`.
- `test/config.test.mjs` — tests for `normalizeConfig`.
- `test/format.test.mjs` — tests for `formatPower` and `colorForType`.
- `test/geometry.test.mjs` — tests for `buildConnectorPath`.
- `test/history.test.mjs` — tests for `parseHistoryResponse` and `downsampleHistory`.
- `test/harness.html` + `test/serve.sh` — manual browser harness with mocked `hass` (including a mocked `callApi` for history).
- `hacs.json`, `package.json`, `LICENSE`, `.gitignore`, `README.md`, `examples/lovelace-examples.yaml` — packaging, copied/adapted from the `vumetre` repo.

---

### Task 1: Repo scaffolding

**Files:**
- Create: `package.json`
- Create: `hacs.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "energy-card",
  "version": "1.0.0",
  "description": "Animated energy system gauge card for Home Assistant",
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Create `hacs.json`**

```json
{
  "name": "Energy",
  "filename": "energy-card.js",
  "render_readme": true
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 4: Create `LICENSE`**

```
MIT License

Copyright (c) 2026 Xavier Lassus

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Commit**

```bash
cd ~/Documents/github/energy
git add package.json hacs.json .gitignore LICENSE
git commit -m "chore: scaffold energy-card package"
```

---

### Task 2: `normalizeConfig`

**Files:**
- Create: `energy-card.js`
- Test: `test/config.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `test/config.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../energy-card.js';

const baseNode = { side: 'top-left', type: 'production', entity: 'sensor.solar' };

test('throws when nodes is missing or empty', () => {
  assert.throws(() => normalizeConfig({ center: { entity: 'sensor.house' } }), /nœud/);
  assert.throws(() => normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [] }), /nœud/);
});

test('throws when center.entity is missing', () => {
  assert.throws(() => normalizeConfig({ nodes: [baseNode] }), /center\.entity/);
});

test('throws on invalid side', () => {
  assert.throws(
    () => normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [{ ...baseNode, side: 'top' }] }),
    /side invalide/
  );
});

test('throws on invalid type', () => {
  assert.throws(
    () => normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [{ ...baseNode, type: 'solar' }] }),
    /type invalide/
  );
});

test('throws when a non-grid node has no entity', () => {
  const node = { side: 'top-left', type: 'production' };
  assert.throws(
    () => normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [node] }),
    /entity est obligatoire/
  );
});

test('throws when a grid node is missing import_entity or export_entity', () => {
  const node = { side: 'left', type: 'grid', title: 'Réseau' };
  assert.throws(
    () => normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [node] }),
    /import_entity et export_entity/
  );
});

test('applies default title, icon and center icon', () => {
  const cfg = normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [baseNode] });
  assert.equal(cfg.title, 'Système énergétique');
  assert.equal(cfg.center.icon, 'mdi:home');
  assert.equal(cfg.nodes[0].title, 'Production');
  assert.equal(cfg.nodes[0].icon, 'mdi:white-balance-sunny');
});

test('keeps user-provided title and icon', () => {
  const node = { ...baseNode, title: 'Solaire', icon: 'mdi:solar-power' };
  const cfg = normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [node] });
  assert.equal(cfg.nodes[0].title, 'Solaire');
  assert.equal(cfg.nodes[0].icon, 'mdi:solar-power');
});

test('accepts a valid grid node', () => {
  const node = { side: 'left', type: 'grid', import_entity: 'sensor.imp', export_entity: 'sensor.exp' };
  const cfg = normalizeConfig({ center: { entity: 'sensor.house' }, nodes: [node] });
  assert.equal(cfg.nodes[0].title, 'Échange');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Documents/github/energy && node --test test/config.test.mjs`
Expected: FAIL — `energy-card.js` does not exist yet.

- [ ] **Step 3: Create `energy-card.js` with constants and `normalizeConfig`**

```javascript
const SIDES = ['top-left', 'top-right', 'left', 'right', 'bottom'];
const TYPES = ['production', 'consumption', 'grid', 'storage'];

export const TYPE_COLORS = {
  production: '#f5a623',
  consumption: '#2ecc71',
  grid: '#3498db',
  storage: '#9b59b6',
};

export const TYPE_LABELS = {
  production: 'Production',
  consumption: 'Consommation',
  grid: 'Échange',
  storage: 'Stockage',
};

const TYPE_DEFAULT_ICON = {
  production: 'mdi:white-balance-sunny',
  consumption: 'mdi:flash',
  grid: 'mdi:transmission-tower',
  storage: 'mdi:battery',
};

export function normalizeConfig(config) {
  if (!config.nodes || !Array.isArray(config.nodes) || config.nodes.length === 0) {
    throw new Error('Au moins un nœud est obligatoire');
  }
  if (!config.center || !config.center.entity) {
    throw new Error('center.entity est obligatoire');
  }

  const nodes = config.nodes.map((node, index) => {
    if (!SIDES.includes(node.side)) {
      throw new Error(`Nœud ${index}: side invalide (attendu: ${SIDES.join(', ')})`);
    }
    if (!TYPES.includes(node.type)) {
      throw new Error(`Nœud ${index}: type invalide (attendu: ${TYPES.join(', ')})`);
    }
    if (node.type === 'grid') {
      if (!node.import_entity || !node.export_entity) {
        throw new Error(
          `Nœud "${node.title || node.type}": import_entity et export_entity sont obligatoires pour un nœud grid`
        );
      }
    } else if (!node.entity) {
      throw new Error(`Nœud "${node.title || node.type}": entity est obligatoire`);
    }

    return {
      ...node,
      title: node.title || TYPE_LABELS[node.type],
      icon: node.icon || TYPE_DEFAULT_ICON[node.type],
    };
  });

  return {
    title: config.title || 'Système énergétique',
    center: {
      entity: config.center.entity,
      icon: (config.center && config.center.icon) || 'mdi:home',
    },
    nodes,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Documents/github/energy && node --test test/config.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add energy-card.js test/config.test.mjs
git commit -m "feat: add normalizeConfig with validation and defaults"
```

---

### Task 3: `formatPower` and `colorForType`

**Files:**
- Modify: `energy-card.js`
- Test: `test/format.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `test/format.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPower, colorForType, TYPE_COLORS } from '../energy-card.js';

test('formatPower returns watts below 1000', () => {
  assert.equal(formatPower(122), '122 W');
  assert.equal(formatPower(0), '0 W');
});

test('formatPower returns kW with a comma above 1000', () => {
  assert.equal(formatPower(22900), '22,9 kW');
  assert.equal(formatPower(1000), '1,0 kW');
});

test('formatPower returns a dash for null/NaN', () => {
  assert.equal(formatPower(null), '—');
  assert.equal(formatPower(undefined), '—');
  assert.equal(formatPower(NaN), '—');
});

test('colorForType returns the configured color per type', () => {
  assert.equal(colorForType('production'), TYPE_COLORS.production);
  assert.equal(colorForType('grid'), TYPE_COLORS.grid);
});

test('colorForType falls back to gray for an unknown type', () => {
  assert.equal(colorForType('unknown'), '#888888');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Documents/github/energy && node --test test/format.test.mjs`
Expected: FAIL — `formatPower`/`colorForType` not exported yet.

- [ ] **Step 3: Add `formatPower` and `colorForType` to `energy-card.js`**

Add below the `TYPE_DEFAULT_ICON` constant, before `normalizeConfig`:

```javascript
export function colorForType(type) {
  return TYPE_COLORS[type] || '#888888';
}

export function formatPower(watts) {
  if (watts === null || watts === undefined || Number.isNaN(watts)) return '—';
  if (Math.abs(watts) >= 1000) {
    return `${(watts / 1000).toFixed(1).replace('.', ',')} kW`;
  }
  return `${Math.round(watts)} W`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Documents/github/energy && node --test test/format.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add energy-card.js test/format.test.mjs
git commit -m "feat: add formatPower and colorForType helpers"
```

---

### Task 4: `buildConnectorPath`

**Files:**
- Modify: `energy-card.js`
- Test: `test/geometry.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `test/geometry.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConnectorPath } from '../energy-card.js';

test('builds a cubic bezier from one point to another', () => {
  const d = buildConnectorPath({ x: 0, y: 0 }, { x: 100, y: 50 });
  assert.equal(d, 'M 0 0 C 50 0, 50 50, 100 50');
});

test('handles points where from is to the right of to', () => {
  const d = buildConnectorPath({ x: 200, y: 10 }, { x: 50, y: 80 });
  assert.equal(d, 'M 200 10 C 125 10, 125 80, 50 80');
});

test('handles identical x (vertical connector)', () => {
  const d = buildConnectorPath({ x: 50, y: 0 }, { x: 50, y: 100 });
  assert.equal(d, 'M 50 0 C 50 0, 50 100, 50 100');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Documents/github/energy && node --test test/geometry.test.mjs`
Expected: FAIL — `buildConnectorPath` not exported yet.

- [ ] **Step 3: Add `buildConnectorPath` to `energy-card.js`**

Add after `normalizeConfig`:

```javascript
export function buildConnectorPath(from, to) {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Documents/github/energy && node --test test/geometry.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add energy-card.js test/geometry.test.mjs
git commit -m "feat: add buildConnectorPath for SVG connector curves"
```

---

### Task 5: `parseHistoryResponse` and `downsampleHistory`

**Files:**
- Modify: `energy-card.js`
- Test: `test/history.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `test/history.test.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHistoryResponse, downsampleHistory } from '../energy-card.js';

test('parseHistoryResponse converts HA history entries to {t, v} points', () => {
  const raw = [
    { state: '10.5', last_changed: '2026-06-21T10:00:00Z' },
    { state: '12', last_changed: '2026-06-21T10:05:00Z' },
  ];
  const points = parseHistoryResponse(raw);
  assert.equal(points.length, 2);
  assert.equal(points[0].v, 10.5);
  assert.equal(points[1].v, 12);
  assert.equal(points[0].t, new Date('2026-06-21T10:00:00Z').getTime());
});

test('parseHistoryResponse drops unavailable/unknown states', () => {
  const raw = [
    { state: 'unavailable', last_changed: '2026-06-21T10:00:00Z' },
    { state: '5', last_changed: '2026-06-21T10:05:00Z' },
  ];
  const points = parseHistoryResponse(raw);
  assert.equal(points.length, 1);
  assert.equal(points[0].v, 5);
});

test('parseHistoryResponse returns [] for non-array input', () => {
  assert.deepEqual(parseHistoryResponse(undefined), []);
});

test('downsampleHistory returns [] for empty input', () => {
  assert.deepEqual(downsampleHistory([], 5), []);
});

test('downsampleHistory returns the input unchanged when shorter than n', () => {
  const points = [{ t: 0, v: 1 }, { t: 1, v: 2 }];
  assert.deepEqual(downsampleHistory(points, 5), points);
});

test('downsampleHistory picks n evenly spaced points, keeping first and last', () => {
  const points = Array.from({ length: 100 }, (_, i) => ({ t: i, v: i }));
  const sampled = downsampleHistory(points, 5);
  assert.equal(sampled.length, 5);
  assert.equal(sampled[0].t, 0);
  assert.equal(sampled[4].t, 99);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Documents/github/energy && node --test test/history.test.mjs`
Expected: FAIL — neither function exported yet.

- [ ] **Step 3: Add `parseHistoryResponse` and `downsampleHistory` to `energy-card.js`**

Add after `buildConnectorPath`:

```javascript
export function parseHistoryResponse(rawEntityHistory) {
  if (!Array.isArray(rawEntityHistory)) return [];
  return rawEntityHistory
    .map((entry) => ({
      t: new Date(entry.last_changed).getTime(),
      v: parseFloat(entry.state),
    }))
    .filter((p) => !Number.isNaN(p.v) && !Number.isNaN(p.t));
}

export function downsampleHistory(points, n) {
  if (points.length === 0) return [];
  if (n <= 1) return [points[points.length - 1]];
  if (points.length <= n) return points.slice();

  const result = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round((i * (points.length - 1)) / (n - 1));
    result.push(points[idx]);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Documents/github/energy && node --test test/history.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Run the full suite and commit**

```bash
cd ~/Documents/github/energy && node --test
git add energy-card.js test/history.test.mjs
git commit -m "feat: add history parsing and downsampling helpers"
```

Expected: all 23 tests across the 4 test files pass.

---

### Task 6: Static DOM skeleton (grid layout, node cards, center card)

**Files:**
- Modify: `energy-card.js`

No automated test in this task — DOM rendering is verified visually in Task 11's browser harness. This task only adds code; verification happens once the harness exists.

- [ ] **Step 1: Add the guarded class with styles and static rendering**

Append to the end of `energy-card.js`:

```javascript
const STYLE = `
  ha-card.ec-card-root { background:#0b0d12; color:#e5e7eb; padding:16px; }
  .ec-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .ec-header .ec-title { font-size:20px; font-weight:600; }
  .ec-grid {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto auto auto;
    grid-template-areas:
      "top-left . top-right"
      "left center right"
      ". bottom .";
    gap: 24px;
    align-items: start;
  }
  .ec-lines { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
  .ec-cell { display:flex; flex-direction:column; gap:16px; z-index:1; }
  .ec-cell[data-side="top-left"] { grid-area: top-left; }
  .ec-cell[data-side="top-right"] { grid-area: top-right; }
  .ec-cell[data-side="left"] { grid-area: left; align-self:center; }
  .ec-cell[data-side="right"] { grid-area: right; align-self:center; }
  .ec-cell[data-side="bottom"] { grid-area: bottom; align-items:center; }
  .ec-center { grid-area: center; display:flex; justify-content:center; align-items:center; z-index:1; }

  .ec-node {
    border: 1px solid var(--ec-color);
    border-radius: 12px;
    padding: 16px;
    background: color-mix(in srgb, var(--ec-color) 8%, #0b0d12);
    box-shadow: 0 0 16px -4px var(--ec-color);
    min-width: 180px;
  }
  .ec-node-head { display:flex; align-items:center; gap:8px; color:#cbd5e1; margin-bottom:8px; }
  .ec-node-head ha-icon { color: var(--ec-color); }
  .ec-value { font-size:28px; font-weight:700; color:#fff; }
  .ec-grid-value { display:flex; align-items:center; gap:6px; font-size:20px; color: var(--ec-color); margin-bottom:4px; }
  .ec-badge {
    display:inline-block; margin-top:10px; padding:2px 10px; border-radius:999px;
    font-size:13px; color: var(--ec-color); background: color-mix(in srgb, var(--ec-color) 18%, transparent);
  }
  .ec-sparkline { display:block; width:100%; height:24px; margin-top:10px; }
  .ec-sparkline path { fill: color-mix(in srgb, var(--ec-color) 25%, transparent); stroke: var(--ec-color); stroke-width:1.5; }

  .ec-center-ring {
    width: 220px; height: 220px; border-radius: 50%;
    background: conic-gradient(#f5a623, #2ecc71, #3498db, #9b59b6, #f5a623);
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 0 30px -6px rgba(255,255,255,0.4);
  }
  .ec-center-inner {
    width: 192px; height: 192px; border-radius:50%; background:#0b0d12;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
  }
  .ec-center-inner ha-icon { --mdc-icon-size:32px; color:#fff; }

  .ec-flow-dot { fill: var(--ec-color); filter: drop-shadow(0 0 4px var(--ec-color)); }
  .ec-connector { fill:none; stroke: var(--ec-color); stroke-width:2; }

  .ec-legend { display:flex; gap:20px; justify-content:center; margin-top:24px; padding-top:16px; border-top:1px solid #1f2430; }
  .ec-legend-item { display:flex; align-items:center; gap:6px; font-size:14px; color:#cbd5e1; }
  .ec-legend-dot { width:10px; height:10px; border-radius:50%; background: var(--ec-color); }
`;

if (typeof window !== 'undefined' && window.customElements) {

class EnergyCard extends HTMLElement {
  setConfig(config) {
    this.config = normalizeConfig(config);
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    this.innerHTML = `
      <style>${STYLE}</style>
      <ha-card class="ec-card-root">
        <div class="ec-header">
          <div class="ec-title">${this.config.title}</div>
        </div>
        <div class="ec-grid">
          <svg class="ec-lines"></svg>
          <div class="ec-cell" data-side="top-left"></div>
          <div class="ec-cell" data-side="top-right"></div>
          <div class="ec-cell" data-side="left"></div>
          <div class="ec-cell" data-side="right"></div>
          <div class="ec-center"></div>
          <div class="ec-cell" data-side="bottom"></div>
        </div>
        <div class="ec-legend"></div>
      </ha-card>
    `;

    this._svg = this.querySelector('.ec-lines');
    this._gridEl = this.querySelector('.ec-grid');
    this._centerEl = this.querySelector('.ec-center');
    this._nodeEls = [];

    for (const node of this.config.nodes) {
      const cell = this.querySelector(`.ec-cell[data-side="${node.side}"]`);
      const el = this._renderNodeCard(node);
      cell.appendChild(el);
      this._nodeEls.push({ node, el });
    }

    this._centerEl.appendChild(this._renderCenterCard());
    this._renderLegend();
  }

  _renderNodeCard(node) {
    const el = document.createElement('div');
    el.className = 'ec-node';
    el.style.setProperty('--ec-color', colorForType(node.type));

    const valueMarkup = node.type === 'grid'
      ? `
        <div class="ec-grid-value" data-role="import"><ha-icon icon="mdi:arrow-left"></ha-icon><span>—</span></div>
        <div class="ec-grid-value" data-role="export"><ha-icon icon="mdi:arrow-right"></ha-icon><span>—</span></div>
      `
      : `<div class="ec-value" data-role="value">—</div>`;

    el.innerHTML = `
      <div class="ec-node-head">
        <ha-icon icon="${node.icon}"></ha-icon>
        <span>${node.title}</span>
      </div>
      ${valueMarkup}
      <div class="ec-badge">${TYPE_LABELS[node.type]}</div>
      <svg class="ec-sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
        <path data-role="sparkline" />
      </svg>
    `;
    return el;
  }

  _renderCenterCard() {
    const el = document.createElement('div');
    el.className = 'ec-center-ring';
    el.innerHTML = `
      <div class="ec-center-inner">
        <ha-icon icon="${this.config.center.icon}"></ha-icon>
        <div class="ec-value" data-role="center-value">—</div>
        <div class="ec-badge" style="--ec-color:#ffffff;">Consommation</div>
      </div>
    `;
    return el;
  }

  _renderLegend() {
    const usedTypes = [...new Set(this.config.nodes.map((n) => n.type))];
    const legend = this.querySelector('.ec-legend');
    legend.innerHTML = usedTypes
      .map(
        (type) => `
        <div class="ec-legend-item">
          <span class="ec-legend-dot" style="--ec-color:${colorForType(type)}"></span>
          <span>${TYPE_LABELS[type]}</span>
        </div>`
      )
      .join('');
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;

    for (const { node, el } of this._nodeEls) {
      if (node.type === 'grid') {
        const imp = hass.states[node.import_entity];
        const exp = hass.states[node.export_entity];
        el.querySelector('[data-role="import"] span').textContent = formatPower(imp ? parseFloat(imp.state) : null);
        el.querySelector('[data-role="export"] span').textContent = formatPower(exp ? parseFloat(exp.state) : null);
      } else {
        const state = hass.states[node.entity];
        el.querySelector('[data-role="value"]').textContent = formatPower(state ? parseFloat(state.state) : null);
      }
    }

    const centerState = hass.states[this.config.center.entity];
    this.querySelector('[data-role="center-value"]').textContent = formatPower(
      centerState ? parseFloat(centerState.state) : null
    );
  }

  getCardSize() {
    return 4;
  }
}

customElements.define('energy-card', EnergyCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'energy-card',
  name: 'Energy',
  description: "Visualisation animée d'un système énergétique pour Home Assistant.",
});
console.info(
  '%c ENERGY-CARD %c v1.0.0 ',
  'color:white;background:#3498db;font-weight:700',
  'color:#3498db;background:#222'
);

}
```

- [ ] **Step 2: Run the full unit test suite to confirm nothing broke**

Run: `cd ~/Documents/github/energy && node --test`
Expected: PASS (23 tests) — this task added no new unit tests, just confirms the pure-function tests still pass after the file grew.

- [ ] **Step 3: Commit**

```bash
git add energy-card.js
git commit -m "feat: add static DOM skeleton for EnergyCard (grid, node cards, center)"
```

---

### Task 7: Browser test harness

**Files:**
- Create: `test/harness.html`
- Create: `test/serve.sh`

- [ ] **Step 1: Create `test/harness.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { background:#111; margin:0; padding:20px; font-family:Arial; }
    .card { width:900px; max-width:100%; margin:0 0 30px; }
    h2 { color:#ccc; }
  </style>
</head>
<body>
  <h2>Configuration de la maquette</h2>
  <div class="card" id="a"></div>

  <script type="module">
    import '../energy-card.js';

    function makeHistory(base, count) {
      const now = Date.now();
      return Array.from({ length: count }, (_, i) => ({
        state: String(base + Math.sin(i / 2) * base * 0.2),
        last_changed: new Date(now - (count - i) * 5 * 60 * 1000).toISOString(),
      }));
    }

    const hass = {
      states: {
        'sensor.solar': { state: '22900' },
        'sensor.pool': { state: '0' },
        'sensor.grid_import': { state: '0' },
        'sensor.grid_export': { state: '122' },
        'sensor.water_heater': { state: '0' },
        'sensor.house': { state: '23000' },
      },
      callApi: async (method, path) => {
        const match = path.match(/filter_entity_id=([^&]+)/);
        const entityId = match ? match[1] : null;
        const base = parseFloat(hass.states[entityId]?.state || '0') || 1;
        return [makeHistory(base, 12)];
      },
    };

    const card = document.createElement('energy-card');
    card.setConfig({
      title: 'Système énergétique',
      center: { entity: 'sensor.house' },
      nodes: [
        { side: 'top-left', type: 'production', entity: 'sensor.solar', title: 'Solaire', icon: 'mdi:white-balance-sunny' },
        { side: 'top-right', type: 'consumption', entity: 'sensor.pool', title: 'Piscine', icon: 'mdi:pool' },
        { side: 'left', type: 'grid', title: 'Réseau', icon: 'mdi:transmission-tower', import_entity: 'sensor.grid_import', export_entity: 'sensor.grid_export' },
        { side: 'bottom', type: 'storage', entity: 'sensor.water_heater', title: 'Ballon', icon: 'mdi:battery' },
      ],
    });
    document.getElementById('a').appendChild(card);
    card.hass = hass;
  </script>
</body>
</html>
```

- [ ] **Step 2: Create `test/serve.sh`**

```bash
#!/usr/bin/env bash
# Lance un serveur HTTP local et ouvre le harnais de test dans le navigateur.
# Les modules ES (import/export) ne fonctionnent pas sous file://, d'où le serveur.
set -euo pipefail

PORT="${1:-8766}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT"
python3 -m http.server "$PORT" > /tmp/energy-card-serve.log 2>&1 &
SERVER_PID=$!

sleep 1
URL="http://localhost:${PORT}/test/harness.html"
echo "Harnais disponible sur ${URL} (Ctrl+C pour arrêter)"

if command -v open >/dev/null 2>&1; then
  open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"
fi

wait "$SERVER_PID"
```

- [ ] **Step 3: Make it executable and verify in browser**

Run: `chmod +x test/serve.sh && ./test/serve.sh`
Expected: browser opens showing the title, the 4 node cards in their correct grid positions (Solaire top-left, Piscine top-right, Réseau left, Ballon bottom), and the center ring — values filled in (not "—"), no console errors. The SVG connector lines and sparklines will still be empty at this point (added in later tasks) — that's expected.

- [ ] **Step 4: Commit**

```bash
git add test/harness.html test/serve.sh
git commit -m "test: add browser harness for manual verification"
```

---

### Task 8: SVG connector lines (static, no animation yet)

**Files:**
- Modify: `energy-card.js`

- [ ] **Step 1: Add `_layoutConnectors` and wire up `ResizeObserver`**

In `connectedCallback`, after `this._renderLegend();`, add:

```javascript
    this._resizeObserver = new ResizeObserver(() => this._layoutConnectors());
    this._resizeObserver.observe(this._gridEl);
```

And in `disconnectedCallback` (create this method right after `connectedCallback` if it doesn't exist yet):

```javascript
  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }
```

Add the `_layoutConnectors` method after `_renderLegend`:

```javascript
  _layoutConnectors() {
    const gridRect = this._gridEl.getBoundingClientRect();
    this._svg.setAttribute('viewBox', `0 0 ${gridRect.width} ${gridRect.height}`);
    this._svg.innerHTML = '';

    const centerRect = this._centerEl.getBoundingClientRect();
    const centerPoint = {
      x: centerRect.left + centerRect.width / 2 - gridRect.left,
      y: centerRect.top + centerRect.height / 2 - gridRect.top,
    };

    this._paths = [];

    for (const { node, el } of this._nodeEls) {
      const rect = el.getBoundingClientRect();
      const fromPoint = {
        x: rect.left + rect.width / 2 - gridRect.left,
        y: rect.top + rect.height / 2 - gridRect.top,
      };

      const d = buildConnectorPath(fromPoint, centerPoint);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'ec-connector');
      path.style.setProperty('--ec-color', colorForType(node.type));
      this._svg.appendChild(path);

      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('r', '5');
      dot.setAttribute('class', 'ec-flow-dot');
      dot.style.setProperty('--ec-color', colorForType(node.type));
      this._svg.appendChild(dot);

      const reverse = node.type === 'consumption' || node.type === 'storage';
      this._paths.push({ path, dot, length: path.getTotalLength(), reverse });
    }
  }
```

- [ ] **Step 2: Run unit tests to confirm nothing broke**

Run: `cd ~/Documents/github/energy && node --test`
Expected: PASS (23 tests)

- [ ] **Step 3: Verify in browser**

Run: `./test/serve.sh`
Expected: a colored curved line from each node card to the center circle, plus a static dot at each path's start point (it won't move until Task 9). Resizing the browser window should redraw the lines without them detaching from the cards.

- [ ] **Step 4: Commit**

```bash
git add energy-card.js
git commit -m "feat: draw SVG connector curves between nodes and center"
```

---

### Task 9: Animated flow dots

**Files:**
- Modify: `energy-card.js`

- [ ] **Step 1: Add the animation loop**

In `connectedCallback`, after the `ResizeObserver` setup added in Task 8, add:

```javascript
    this._rafId = requestAnimationFrame(() => this._tick());
```

In `disconnectedCallback`, add alongside the existing `_resizeObserver.disconnect()` call:

```javascript
    if (this._rafId) cancelAnimationFrame(this._rafId);
```

Add the `_tick` method after `_layoutConnectors`:

```javascript
  _tick() {
    const now = performance.now();
    const speed = 0.0002; // fraction du tracé parcourue par ms
    for (const p of this._paths || []) {
      let t = (now * speed) % 1;
      if (p.reverse) t = 1 - t;
      const point = p.path.getPointAtLength(t * p.length);
      p.dot.setAttribute('cx', point.x);
      p.dot.setAttribute('cy', point.y);
    }
    this._rafId = requestAnimationFrame(() => this._tick());
  }
```

- [ ] **Step 2: Run unit tests to confirm nothing broke**

Run: `cd ~/Documents/github/energy && node --test`
Expected: PASS (23 tests)

- [ ] **Step 3: Verify in browser**

Run: `./test/serve.sh`
Expected: the dot on the Solaire and Réseau lines travels from the card toward the center; the dot on the Piscine and Ballon lines travels from the center toward the card. Motion is smooth, no console errors, and stops cleanly with no leaked animation frame when the card is removed from the DOM (check via DevTools: navigate away from the page, no errors logged).

- [ ] **Step 4: Commit**

```bash
git add energy-card.js
git commit -m "feat: animate flow dots along connector paths"
```

---

### Task 10: Sparklines from real history

**Files:**
- Modify: `energy-card.js`

- [ ] **Step 1: Add history fetching and sparkline rendering**

Add these constants near the top of the guarded block (just before `class EnergyCard`):

```javascript
const SPARKLINE_POINTS = 12;
const HISTORY_REFRESH_MS = 5 * 60 * 1000;
const HISTORY_WINDOW_MS = 2 * 60 * 60 * 1000;
```

In `connectedCallback`, after the `requestAnimationFrame` call added in Task 9, add:

```javascript
    this._historyTimer = setInterval(() => this._refreshHistory(), HISTORY_REFRESH_MS);
    this._refreshHistory();
```

In `disconnectedCallback`, add alongside the existing cleanup:

```javascript
    if (this._historyTimer) clearInterval(this._historyTimer);
```

Add these two methods after `_tick`:

```javascript
  async _refreshHistory() {
    if (!this._hass) return;
    const start = new Date(Date.now() - HISTORY_WINDOW_MS).toISOString();

    for (const { node, el } of this._nodeEls) {
      const entityId = node.type === 'grid' ? node.import_entity : node.entity;
      const pathEl = el.querySelector('[data-role="sparkline"]');
      try {
        const response = await this._hass.callApi(
          'GET',
          `history/period/${start}?filter_entity_id=${entityId}&minimal_response`
        );
        const points = parseHistoryResponse(response[0] || []);
        const sampled = downsampleHistory(points, SPARKLINE_POINTS);
        this._renderSparkline(pathEl, sampled);
      } catch {
        this._renderSparkline(pathEl, []);
      }
    }
  }

  _renderSparkline(pathEl, points) {
    if (points.length < 2) {
      pathEl.setAttribute('d', 'M 0 15 L 100 15');
      return;
    }

    const values = points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 28 - ((p.v - min) / range) * 26;
      return `${x},${y}`;
    });

    pathEl.setAttribute('d', `M ${coords.join(' L ')} L 100 30 L 0 30 Z`);
  }
```

- [ ] **Step 2: Run unit tests to confirm nothing broke**

Run: `cd ~/Documents/github/energy && node --test`
Expected: PASS (23 tests)

- [ ] **Step 3: Verify in browser**

Run: `./test/serve.sh`
Expected: each of the 4 node cards shows a filled wavy sparkline at the bottom within a couple seconds of load (the harness's mocked `callApi` returns synthetic history immediately). The center circle has no sparkline (matches the mockup). No console errors.

- [ ] **Step 4: Commit**

```bash
git add energy-card.js
git commit -m "feat: render sparklines from real entity history"
```

---

### Task 11: README and examples

**Files:**
- Create: `README.md`
- Create: `examples/lovelace-examples.yaml`

- [ ] **Step 1: Create `examples/lovelace-examples.yaml`**

```yaml
# Config correspondant à la maquette
type: custom:energy-card
title: Système énergétique
center:
  entity: sensor.maison_puissance
nodes:
  - side: top-left
    type: production
    entity: sensor.solaire_puissance
    title: Solaire
    icon: mdi:white-balance-sunny
  - side: top-right
    type: consumption
    entity: sensor.piscine_puissance
    title: Piscine
    icon: mdi:pool
  - side: left
    type: grid
    title: Réseau
    icon: mdi:transmission-tower
    import_entity: sensor.reseau_import
    export_entity: sensor.reseau_export
  - side: bottom
    type: storage
    entity: sensor.ballon_puissance
    title: Ballon
    icon: mdi:battery
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Energy

Une carte Lovelace personnalisée pour Home Assistant qui visualise un système énergétique : des nœuds (production, consommation, échange réseau, stockage) reliés par des lignes animées à un cercle central représentant la maison. Un fichier JS unique, sans étape de build, entièrement configurable en YAML.

## Installation

### Via HACS

\`\`\`
1. HACS → menu (⋮) → Dépôts personnalisés (Custom repositories)
2. Ajouter l'URL du dépôt GitHub, catégorie "Lovelace"
3. Installer "Energy" ; la ressource est ajoutée automatiquement
\`\`\`

### Manuelle

\`\`\`
1. Copier energy-card.js dans /config/www/
2. Réglages → Tableaux de bord → Ressources → Ajouter
   URL: /local/energy-card.js   Type: Module JavaScript
3. Ajouter la carte: type: custom:energy-card
\`\`\`

## Configuration

| Clé | Type | Défaut | Rôle |
|-----|------|--------|------|
| `title` | string | `Système énergétique` | Titre de la carte |
| `center.entity` | string | — (requis) | Entité représentant la puissance de la maison |
| `center.icon` | string | `mdi:home` | Icône du cercle central |
| `nodes` | liste | — (requis, au moins 1) | Liste des nœuds (voir ci-dessous) |

### Nœud (`nodes[]`)

| Clé | Type | Défaut | Rôle |
|-----|------|--------|------|
| `side` | string | — (requis) | `top-left`, `top-right`, `left`, `right` ou `bottom` |
| `type` | string | — (requis) | `production`, `consumption`, `grid` ou `storage` — pilote la couleur et l'icône par défaut |
| `entity` | string | — (requis sauf `type: grid`) | Entité dont l'état est affiché |
| `import_entity` / `export_entity` | string | — (requis pour `type: grid`) | Entités d'import/export réseau |
| `title` | string | Libellé du type | Titre affiché sur la carte |
| `icon` | string | Icône par défaut du type | Icône mdi |

La légende en bas de carte est générée automatiquement à partir des types utilisés.

## Examples

Voir [`examples/lovelace-examples.yaml`](examples/lovelace-examples.yaml) pour une configuration complète correspondant à la maquette d'origine.

## Tests

\`\`\`
npm test
\`\`\`

Harnais de test visuel : `./test/serve.sh` (ouvre `test/harness.html` dans le navigateur avec des données simulées).

## License

MIT — see [LICENSE](LICENSE).
```

- [ ] **Step 3: Commit**

```bash
git add README.md examples/lovelace-examples.yaml
git commit -m "docs: add README and example Lovelace configuration"
```

---

### Task 12: Push to GitHub

**Files:** none (repo operations only)

- [ ] **Step 1: Run the full test suite one last time**

Run: `cd ~/Documents/github/energy && node --test`
Expected: PASS (23 tests)

- [ ] **Step 2: Create the GitHub repo and push**

```bash
cd ~/Documents/github/energy
gh repo create xavlas/energy --public --source=. --remote=origin --description "Animated energy system card for Home Assistant"
git branch -M main
git push -u origin main
```

Expected: repo created at `https://github.com/xavlas/energy`, `main` branch pushed with all prior commits.

---

## Self-Review Notes

- **Spec coverage:** config schema (Task 2), formatting (Task 3), connector geometry (Task 4), history parsing/downsampling (Task 5), layout/grid (Task 6), connectors (Task 8), animation direction rule (Task 9), sparklines + error fallback to flat line (Task 10), packaging (Tasks 1, 11, 12) — all spec sections are covered.
- **Correction vs. mockup:** the spec originally said the center card also gets a sparkline; the mockup doesn't show one there, so the spec was amended and Task 10 only renders sparklines for node cards.
- **Type consistency:** `formatPower`, `colorForType`, `normalizeConfig`, `buildConnectorPath`, `parseHistoryResponse`, `downsampleHistory` are the exact names used consistently from Task 2 onward; `TYPE_LABELS`/`TYPE_COLORS` are defined once in Task 2 and reused, never redefined.
