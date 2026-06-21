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
