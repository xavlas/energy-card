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
