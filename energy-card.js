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
