const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('publish only the chapter and explicit site assets, preserving the custom domain', async () => {
  const { buildSite } = await import('../scripts/build-site.mjs');
  const destination = await fs.mkdtemp(
    path.join(os.tmpdir(), 'under-the-model-'),
  );
  try {
    await fs.writeFile(
      path.join(destination, 'legacy-bundle.js'),
      'stale build',
    );
    await buildSite(destination);
    const entries = await fs.readdir(destination, {
      recursive: true,
      withFileTypes: true,
    });
    assert.equal(entries.filter((entry) => entry.isFile()).length, 9);
    assert.equal(
      await fs.readFile(path.join(destination, 'CNAME'), 'utf8'),
      'healthvault.online\n',
    );
    const home = await fs.readFile(
      path.join(destination, 'index.html'),
      'utf8',
    );
    assert.equal(
      home,
      await fs.readFile(
        path.join(destination, 'chapters/the-launch-day-mystery/index.html'),
        'utf8',
      ),
    );
    assert.equal(
      home,
      await fs.readFile(path.join(destination, '404.html'), 'utf8'),
    );
    assert.ok(home.includes('lesson-core'));
    assert.ok(
      home.includes(
        'https://healthvault.online/chapters/the-launch-day-mystery/',
      ),
    );
    assert.ok(!home.includes('/src/main.tsx'));
    assert.ok(!home.includes('manifest.webmanifest'));
    await assert.rejects(fs.access(path.join(destination, 'legacy-bundle.js')));
    await assert.rejects(fs.access(path.join(destination, 'src')));
  } finally {
    await fs.rm(destination, { recursive: true, force: true });
  }
});
