import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const chapterPath = 'chapters/the-launch-day-mystery/index.html';

export async function buildSite(destination = path.join(root, 'dist')) {
  const chapter = await readFile(path.join(root, 'site', chapterPath), 'utf8');
  const domain = (
    await readFile(path.join(root, 'public/CNAME'), 'utf8')
  ).trim();
  if (domain !== 'healthvault.online')
    throw new Error('Review the publication URLs before changing the domain.');

  await rm(destination, { recursive: true, force: true });
  await mkdir(path.join(destination, path.dirname(chapterPath)), {
    recursive: true,
  });
  await Promise.all([
    writeFile(path.join(destination, 'index.html'), chapter),
    writeFile(path.join(destination, chapterPath), chapter),
    writeFile(path.join(destination, '404.html'), chapter),
    copyFile(path.join(root, 'site/sw.js'), path.join(destination, 'sw.js')),
    copyFile(
      path.join(root, 'site/favicon.svg'),
      path.join(destination, 'favicon.svg'),
    ),
    writeFile(path.join(destination, 'CNAME'), `${domain}\n`),
    writeFile(path.join(destination, '.nojekyll'), ''),
    writeFile(
      path.join(destination, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: https://${domain}/sitemap.xml\n`,
    ),
    writeFile(
      path.join(destination, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${domain}/chapters/the-launch-day-mystery/</loc></url></urlset>\n`,
    ),
  ]);
  return destination;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(`Published site built at ${await buildSite()}`);
}
