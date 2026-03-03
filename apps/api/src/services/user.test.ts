import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStreakFromDates, getStartOfWeekMonday } from '../lib/time.js';

test('getStartOfWeekMonday uses Monday as week start', () => {
  const monday = new Date(2026, 2, 2, 15, 30, 0); // 2026-03-02
  const sunday = new Date(2026, 2, 8, 11, 0, 0); // 2026-03-08

  const mondayStart = getStartOfWeekMonday(monday);
  const sundayStart = getStartOfWeekMonday(sunday);

  assert.equal(mondayStart.getFullYear(), 2026);
  assert.equal(mondayStart.getMonth(), 2);
  assert.equal(mondayStart.getDate(), 2);
  assert.equal(mondayStart.getHours(), 0);

  assert.equal(sundayStart.getFullYear(), 2026);
  assert.equal(sundayStart.getMonth(), 2);
  assert.equal(sundayStart.getDate(), 2);
  assert.equal(sundayStart.getHours(), 0);
});

test('calculateStreakFromDates counts today-first streak', () => {
  const now = new Date(2026, 2, 10, 9, 0, 0); // Tue
  const dates = [
    new Date(2026, 2, 10, 8, 0, 0),
    new Date(2026, 2, 9, 20, 0, 0),
    new Date(2026, 2, 8, 7, 0, 0),
    new Date(2026, 2, 6, 12, 0, 0),
  ];

  const streak = calculateStreakFromDates(dates, now);
  assert.equal(streak, 3);
});

test('calculateStreakFromDates starts from yesterday if no photo today', () => {
  const now = new Date(2026, 2, 10, 9, 0, 0); // Tue
  const dates = [
    new Date(2026, 2, 9, 20, 0, 0),
    new Date(2026, 2, 8, 7, 0, 0),
    new Date(2026, 2, 5, 12, 0, 0),
  ];

  const streak = calculateStreakFromDates(dates, now);
  assert.equal(streak, 2);
});
