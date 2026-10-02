import assert from 'node:assert/strict';
import { FlipperInput, PairedPaddleInput } from '../src/flipper-input.ts';

const input = new FlipperInput();
input.press('touch-left', 0, 100); input.press('touch-right', 1, 103);
assert.deepEqual(input.at(140), [true, true], 'two thumbs can hold both paddles beyond the minimum stroke');
input.release('touch-left');
assert.deepEqual(input.at(141), [false, true], 'release one paddle for aiming while the other stays held');
input.press('touch-left', 0, 145); input.release('touch-left');
assert.deepEqual(input.at(154), [true, true], 'a quick release-and-shoot retains the accepted ten-tick stroke');
assert.deepEqual(input.at(155), [false, true], 'the tap ends at the original tick boundary');
input.press('KeyL', 1, 155); input.release('touch-right');
assert.deepEqual(input.at(180), [false, true], 'lifting a thumb does not clear a simultaneous keyboard hold');
assert.equal(input.press('KeyL', 1, 180), false, 'repeat keydown does not retrigger the stroke');
input.release('KeyL'); assert.deepEqual(input.at(181), [false, false]);
input.press('touch-cancel', 0, 190); input.cancel('touch-cancel');
assert.deepEqual(input.at(191), [false, false], 'cancellation clears an unfinished touch stroke immediately');
input.press('touch-left', 0, 200); input.press('touch-left-second-finger', 0, 202); input.cancel('touch-left');
assert.deepEqual(input.at(240), [true, false], 'cancelling one finger preserves another finger on the same paddle');
input.clear(); assert.deepEqual(input.at(241), [false, false], 'pause/tab loss clears all fingers, keys and pending strokes');
input.release('unknown'); input.cancel('unknown'); assert.deepEqual(input.at(241), [false, false]);
input.press('touch-new-round', 1, 0); input.release('touch-new-round');
assert.deepEqual(input.at(9), [false, true], 'a fresh match accepts taps after the simulation tick resets');
assert.deepEqual(input.at(10), [false, false]);
const paired = new PairedPaddleInput();
let pairedChecks = 0;
function pairAt(tick: number, lower: boolean[], upper = lower, note = '') {
  assert.deepEqual(paired.at(tick), lower, `lower: ${note}`);
  assert.deepEqual(paired.upperAt(tick), upper, `upper: ${note}`); pairedChecks += 2;
}
paired.press('KeyA', 0, 0); pairAt(600, [true, false], undefined, 'left mapping operates only the left pair');
assert.equal(paired.press('KeyA', 0, 600), false, 'repeat does not add another stroke'); pairedChecks++;
paired.press('KeyL', 1, 601); pairAt(700, [true, true], undefined, 'both side keys can be held together');
paired.release('KeyA'); pairAt(701, [false, true], undefined, 'releasing the left pair preserves the right pair');
paired.press('pointer-right', 1, 702); paired.release('KeyL');
pairAt(800, [false, true], undefined, 'pointer hold survives keyboard release on the same side');
paired.release('pointer-right'); pairAt(801, [false, false], undefined, 'last source releases both paddles on its side');
paired.press('ShiftLeft', 0, 810); paired.press('ShiftRight', 1, 810);
pairAt(900, [true, true], undefined, 'custom Shift mappings operate both pairs');
paired.cancel('ShiftLeft'); pairAt(901, [false, true], undefined, 'cancelling one source affects only its side');
paired.clear(); pairAt(902, [false, false], undefined, 'pause or focus loss clears both pairs');
for (const side of [0, 1]) {
  const only = [side === 0, side === 1];
  paired.press('tap', side, 910); paired.release('tap');
  pairAt(919, only, only, 'quick tap preserves the lower and upper stroke');
  pairAt(920, [false, false], only, 'lower tap retains ten ticks while upper finishes its longer stroke');
  pairAt(921, [false, false], only);
  pairAt(922, [false, false], undefined, 'upper tap finishes at twelve ticks');
  paired.press('cancel', side, 930); paired.cancel('cancel');
  pairAt(931, [false, false], undefined, 'pointer cancellation also clears the unfinished upper stroke');
}
paired.press('touch-left', 0, 1000); paired.press('second-touch-left', 0, 1002); paired.cancel('touch-left');
pairAt(1100, [true, false], undefined, 'cancelling one finger preserves another on both same-side paddles');
paired.clear(); paired.press('rematch', 1, 0); paired.release('rematch');
pairAt(9, [false, true], undefined, 'fresh match accepts side taps after the simulation tick resets');
pairAt(12, [false, false]);
console.log(`${13 + pairedChecks} input checks passed: same-side pairs, remapping, independent holds, tap timing, mixed sources and cancellation.`);
