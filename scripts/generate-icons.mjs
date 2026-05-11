/**
 * Generates PNG and ICO icon files from the SVG source.
 * Run once: node scripts/generate-icons.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

const svgPath = resolve(root, "apps/desktop/resources/icon.svg");
const svg = readFileSync(svgPath);

async function generate() {
  // ── Desktop PNGs ──────────────────────────────────────────────────────────
  const desktopSizes = [16, 24, 32, 48, 64, 128, 256];
  const desktopPngs = {};

  for (const size of desktopSizes) {
    desktopPngs[size] = await sharp(svg).resize(size, size).png().toBuffer();
  }

  // Main 256×256 PNG used by electron-builder and the tray
  writeFileSync(resolve(root, "apps/desktop/resources/icon.png"), desktopPngs[256]);
  console.log("✓ apps/desktop/resources/icon.png");

  // 32×32 tray icon
  writeFileSync(resolve(root, "apps/desktop/resources/tray.png"), desktopPngs[32]);
  console.log("✓ apps/desktop/resources/tray.png");

  // ICO with multiple embedded sizes for Windows title bar / taskbar
  const icoBuffer = await pngToIco([
    desktopPngs[16],
    desktopPngs[32],
    desktopPngs[48],
    desktopPngs[256],
  ]);
  writeFileSync(resolve(root, "apps/desktop/resources/icon.ico"), icoBuffer);
  console.log("✓ apps/desktop/resources/icon.ico");

  // ── Web PNGs ──────────────────────────────────────────────────────────────
  const webSizes = [32, 180, 192, 512];
  for (const size of webSizes) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    writeFileSync(resolve(root, `apps/web/public/icon-${size}.png`), buf);
    console.log(`✓ apps/web/public/icon-${size}.png`);
  }

  // favicon.ico (16 + 32)
  const faviconIco = await pngToIco([
    await sharp(svg).resize(16, 16).png().toBuffer(),
    await sharp(svg).resize(32, 32).png().toBuffer(),
  ]);
  writeFileSync(resolve(root, "apps/web/public/favicon.ico"), faviconIco);
  console.log("✓ apps/web/public/favicon.ico");

  console.log("\nAll icons generated.");
}

generate().catch((err) => { console.error(err); process.exit(1); });
