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

export function buildConnectorPath(from, to) {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

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

    this._resizeObserver = new ResizeObserver(() => this._layoutConnectors());
    this._resizeObserver.observe(this._gridEl);
  }

  disconnectedCallback() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
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
