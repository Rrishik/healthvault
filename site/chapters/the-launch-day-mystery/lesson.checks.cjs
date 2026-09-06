const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const sandbox = vm.createContext({});
vm.runInContext(
  html.match(/<script id="lesson-core">([\s\S]*?)<\/script>/)[1],
  sandbox,
);
const lesson = sandbox.InferenceLesson;
const launch = { concurrent: 8, prompt: 8192, output: 2048, stage: 'budget' };

test('all inline scripts parse without external dependencies', () => {
  const scripts = [
    ...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),
  ];
  assert.equal(scripts.length, 3);
  for (const script of scripts)
    assert.doesNotThrow(() => new vm.Script(script[1]));
  assert.ok(!/<script[^>]+src=/i.test(html));
});
test('one replica shares weights while KV storage grows with concurrency', () => {
  const one = lesson.estimate({ ...launch, concurrent: 1 });
  const eight = lesson.estimate(launch);
  assert.equal(one.bytesPerToken, 131072);
  assert.equal(one.totalGiB, 17.25);
  assert.equal(eight.kvGiB, 10);
  assert.equal(eight.totalGiB - eight.kvGiB, 16);
  assert.equal(eight.fits, false);
});
test('prompt fit does not establish room for generation', () => {
  assert.equal(lesson.estimate({ ...launch, stage: 'prefill' }).totalGiB, 24);
  assert.equal(lesson.estimate(launch).totalGiB, 26);
  assert.equal(lesson.estimate(launch).capacity, 6);
});
test('six active sequences fit and seven exceed the illustrative budget', () => {
  assert.equal(lesson.estimate({ ...launch, concurrent: 6 }).totalGiB, 23.5);
  assert.equal(lesson.estimate({ ...launch, concurrent: 7 }).fits, false);
});
test('context and output allowances contribute to cache storage', () => {
  const shorter = lesson.estimate({ ...launch, prompt: 4096 });
  assert.equal(shorter.totalGiB, 22);
  assert.equal(shorter.capacity, 10);
  assert.equal(lesson.estimate({ ...launch, output: 0 }).totalGiB, 24);
});
test('trace processes prompt in prefill and previous output token in decode', () => {
  const first = lesson.trace(1, true);
  assert.equal(first.phase, 'Prefill');
  assert.equal(first.cachedTokens, 3);
  assert.equal(first.outputTokens, 1);
  const end = lesson.trace(3, true);
  assert.equal(end.cachedTokens, 5);
  assert.equal(end.outputTokens, 3);
  assert.equal(end.currentPositions, 1);
  assert.equal(end.processed, 5);
  assert.equal(lesson.trace(3, false).processed, 12);
  assert.equal(lesson.trace(3, false).cachedTokens, 0);
});
test('decisions preserve document requirements and avoid pretending latency was measured', () => {
  assert.equal(lesson.decision('queue').success, true);
  for (const id of ['shorten', 'all', 'nocache'])
    assert.equal(lesson.decision(id).success, false);
  assert.throws(() => lesson.decision('other'));
});
test('transfer requires capacity and a correct explanation, not the old answer', () => {
  assert.equal(lesson.assessTransfer(10, 'same').passed, true);
  assert.equal(lesson.assessTransfer(6, 'same').passed, false);
  assert.equal(lesson.assessTransfer(10, 'shrinks').passed, false);
  assert.equal(lesson.assessTransfer(11, 'same').passed, false);
});
test('invalid experiment inputs are rejected', () => {
  for (const concurrent of [0, -1, 1.5, NaN, 100])
    assert.throws(() => lesson.estimate({ ...launch, concurrent }));
  assert.throws(() => lesson.estimate({ ...launch, prompt: -2 }));
  assert.throws(() => lesson.estimate({ ...launch, stage: 'other' }));
  assert.throws(() => lesson.trace(4, true));
  assert.throws(() => lesson.assessTransfer(10, 'other'));
});
test('every chapter points to registered sources', () => {
  const ids = new Set(lesson.sources.map((source) => source.id));
  for (const chapter of lesson.chapters) {
    assert.ok(chapter.sourceIds.length);
    assert.ok(chapter.sourceIds.every((id) => ids.has(id)));
  }
});
test('all lab control combinations obey conservation and capacity bounds', () => {
  for (let concurrent = 1; concurrent <= 12; concurrent++) {
    for (let prompt = 1024; prompt <= 16384; prompt += 1024) {
      for (let output = 256; output <= 4096; output += 256) {
        for (const stage of ['prefill', 'budget']) {
          const result = lesson.estimate({ concurrent, prompt, output, stage });
          assert.equal(result.totalGiB + result.freeGiB, 24);
          assert.equal(result.kvGiB, result.perSequence * concurrent);
          assert.equal(result.fits, concurrent <= result.capacity);
          assert.ok(result.totalGiB >= 16);
          assert.equal(
            result.cachedTokens,
            prompt + (stage === 'budget' ? output : 0),
          );
        }
      }
    }
  }
});
