import test from 'node:test';
import assert from 'node:assert/strict';
import { readHistory, saveScan, deleteScan, clearHistory } from './history.js';

function memoryStorage(initial = null) {
  const data = new Map(initial ? [['scamhunter.history.v1', initial]] : []);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

const scan = (id) => ({ id, text: 'hello', score: 0, signals: [], evidence: [], recommendations: [] });

test('history round-trip, individual delete, and clear work', () => {
  const storage = memoryStorage();
  assert.deepEqual(saveScan(scan('SH-1'), storage), [scan('SH-1')]);
  assert.deepEqual(saveScan(scan('SH-2'), storage), [scan('SH-2'), scan('SH-1')]);
  assert.deepEqual(deleteScan('SH-1', storage), [scan('SH-2')]);
  assert.deepEqual(readHistory(storage), [scan('SH-2')]);
  clearHistory(storage);
  assert.deepEqual(readHistory(storage), []);
});

test('corrupt, malformed history and storage errors do not break app', () => {
  assert.deepEqual(readHistory(memoryStorage('{bad json')), []);
  assert.deepEqual(readHistory(memoryStorage(JSON.stringify([{ id: 'x', text: 'bad', score: 100 }]))), []);
  const throwingStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.deepEqual(readHistory(throwingStorage), []);
  assert.deepEqual(saveScan(scan('SH-3'), throwingStorage), [scan('SH-3')]);
  assert.deepEqual(deleteScan('SH-3', throwingStorage), []);
  clearHistory(throwingStorage);
});
