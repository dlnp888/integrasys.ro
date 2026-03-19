// screenshot.mjs — screenshot + comparare opțională cu o imagine de referință
//
// VARIANTA A — fără referință (doar screenshot):
//   node screenshot.mjs http://localhost:3000
//   node screenshot.mjs http://localhost:3000 hero
//   node screenshot.mjs http://localhost:3000 hero 1440
//
// VARIANTA B — cu referință (screenshot + comparare):
//   node screenshot.mjs http://localhost:3000 hero 1440 referinta.png
//
// Screenshots salvate în ./temporary screenshots/
// Comparații salvate în ./temporary screenshots/diff-N.png

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const url       = process.argv[2] || 'http://localhost:3000';
const label     = process.argv[3] || '';
const viewWidth = parseInt(process.argv[4]) || 1440;
const refPath   = process.argv[5] || null;

const SCREENSHOTS_DIR = path.join(process.cwd(), 'temporary screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  console.log(`✓ Creat folder: temporary screenshots/`);
}

function getNextFilename(prefix = 'screenshot') {
  const existing = fs.readdirSync(SCREENSHOTS_DIR)
    .filter(f => f.startsWith(prefix + '-') && f.endsWith('.png'))
    .map(f => {
      const match = f.match(new RegExp(`^${prefix}-(\\d+)`));
      return match ? parseInt(match[1]) : 0;
    });
  const max = existing.length > 0 ? Math.max(...existing) : 0;
  const n = String(max + 1).padStart(2, '0');
  return label
    ? `${prefix}-${n}-${label}.png`
    : `${prefix}-${n}.png`;
}

function loadPNG(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG())
      .on('parsed', function () { resolve(this); })
      .on('error', reject);
  });
}

function savePNG(png, filePath) {
  return new Promise((resolve, reject) => {
    const buf = PNG.sync.write(png);
    fs.writeFile(filePath, buf, err => err ? reject(err) : resolve());
  });
}

(async () => {
  console.log(`→ Screenshot: ${url}`);
  console.log(`  Viewport: ${viewWidth}px`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: viewWidth, height: 900, deviceScaleFactor: 2 });

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });
  } catch (e) {
    console.error(`✗ Nu am putut încărca: ${url}`);
    console.error(`  Asigură-te că serverul rulează: node serve.mjs`);
    await browser.close();
    process.exit(1);
  }

  await new Promise(r => setTimeout(r, 800));

  const filename = getNextFilename('screenshot');
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  await page.screenshot({ path: filepath, fullPage: true });
  await browser.close();

  console.log(`✓ Salvat: temporary screenshots/${filename}`);

  // ── VARIANTA B — comparare cu referință ──
  if (!refPath) {
    console.log(`  (Fără referință — doar screenshot)`);
    return;
  }

  if (!fs.existsSync(refPath)) {
    console.error(`✗ Referința nu există: ${refPath}`);
    return;
  }

  console.log(`\n→ Compar cu referința: ${refPath}`);

  let imgNew, imgRef;
  try {
    [imgNew, imgRef] = await Promise.all([loadPNG(filepath), loadPNG(refPath)]);
  } catch (e) {
    console.error(`✗ Eroare la citirea imaginilor: ${e.message}`);
    return;
  }

  // Redimensionează la dimensiunea minimă comună dacă diferă
  const width  = Math.min(imgNew.width,  imgRef.width);
  const height = Math.min(imgNew.height, imgRef.height);

  const diff = new PNG({ width, height });

  // Crop data to min dimensions (same width, slice rows for height)
  const croppedSize = width * height * 4;
  const dataNew = imgNew.width === width && imgNew.height === height
    ? imgNew.data
    : imgNew.data.slice(0, croppedSize);
  const dataRef = imgRef.width === width && imgRef.height === height
    ? imgRef.data
    : imgRef.data.slice(0, croppedSize);

  const mismatch = pixelmatch(
    dataNew, dataRef, diff.data,
    width, height,
    {
      threshold: 0.12,        // toleranță mică — sesizează diferențe reale
      includeAA: false,       // ignoră anti-aliasing (diferențe de rendering)
    }
  );

  const totalPixels   = width * height;
  const diffPercent   = ((mismatch / totalPixels) * 100).toFixed(2);
  const diffFilename  = getNextFilename('diff');
  const diffFilepath  = path.join(SCREENSHOTS_DIR, diffFilename);

  await savePNG(diff, diffFilepath);

  console.log(`\n── REZULTAT COMPARARE ──`);
  console.log(`  Pixeli diferiți: ${mismatch.toLocaleString()} din ${totalPixels.toLocaleString()}`);
  console.log(`  Diferență:       ${diffPercent}%`);
  console.log(`  Imagine diff:    temporary screenshots/${diffFilename}`);
  console.log(``);

  if (diffPercent < 1) {
    console.log(`  ✓ MATCH EXCELENT — diferență sub 1%, practic identic`);
  } else if (diffPercent < 5) {
    console.log(`  ~ APROAPE — diferențe mici, verifică imaginea diff`);
  } else if (diffPercent < 15) {
    console.log(`  ! DIFERENȚE MODERATE — zone clare de corectat`);
  } else {
    console.log(`  ✗ DIFERENȚE MAJORE — necesită revizuire semnificativă`);
  }

  console.log(`\n  Deschide temporary screenshots/${diffFilename} pentru a vedea exact unde diferă.`);
  console.log(`  Zonele roșii = diferențe. Zonele transparente = identice.`);
})();