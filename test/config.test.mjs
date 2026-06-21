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
