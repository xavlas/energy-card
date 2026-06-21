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
