// Checks the size notation parser: node tools/test_sizes.mjs
import "../site/js/sizes.js";
import assert from "node:assert/strict";
const { parse, label, value } = globalThis.Sizes;
const cases = {
  "3x4 upvc": ["3/4in"], "UPVC 3/4": ["3/4in"], '3/4" elbow': ["3/4in"], "3*4": ["3/4in"],
  "11/2 pvc tee": ["1-1/2in"], "1 1/2 pvc": ["1-1/2in"], "21/2": ["2-1/2in"], "11/4''": ["1-1/4in"],
  "4x2 reducer": ["4in", "2in"], "3*2": ["3in", "2in"], "25mm": ["25mm"], "20 mm pipe": ["20mm"],
  "1.3mm wire": ["1.3mm"], '1.5" gi': ["1-1/2in"], '2" gi union': ["2in"], "ball valve": [],
  "10x4 sq mm cable": [], "2.5 sq mm wire": [],
};
for (const [q, want] of Object.entries(cases)) assert.deepEqual(parse(q).sizes, want, q);
assert.deepEqual(parse("3x4 upvc elbow").words, ["upvc", "elbow"]);
assert.deepEqual(parse("2.5 sq mm wire").words, ["wire", "2.5sqmm"]);
assert.equal(label("1-1/2in"), '1 1/2"');
assert.equal(label("25mm"), "25 mm");
assert.ok(value('3/4"') < value('1"') && value('1"') < value('1 1/2"') && value('4"') < value("15 mm"));
console.log(`sizes ok (${Object.keys(cases).length} cases)`);
