/**
 * Regenerates icon.ico, tray.png, and all web icons from the current icon.png.
 * Use this instead of generate-icons.mjs when icon.png is the source of truth.
 *   node scripts/regen-icons-from-png.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dir = dirname(fileURLToPath(import.meta.url));
const root  = resolve(__dir, "..");
const src   = readFileSync(resolve(root, "apps/desktop/resources/icon.png"));

async function px(size) {
  return sharp(src).resize(size, size, { fit: "fill" }).png().toBuffer();
}

async function run() {
  // ── Desktop icons ────────────────────────────────────────────────────────
  const [p16, p32, p48, p256] = await Promise.all([px(16), px(32), px(48), px(256)]);

  const ico = await pngToIco([p16, p32, p48, p256]);
  writeFileSync(resolve(root, "apps/desktop/resources/icon.ico"), ico);
  console.log("✓ apps/desktop/resources/icon.ico");

  writeFileSync(resolve(root, "apps/desktop/resources/tray.png"), p32);
  console.log("✓ apps/desktop/resources/tray.png");

  // ── Web icons ────────────────────────────────────────────────────────────
  for (const size of [32, 180, 192, 512]) {
    writeFileSync(resolve(root, `apps/web/public/icon-${size}.png`), await px(size));
    console.log(`✓ apps/web/public/icon-${size}.png`);
  }

  const favicon = await pngToIco([await px(16), await px(32)]);
  writeFileSync(resolve(root, "apps/web/public/favicon.ico"), favicon);
  console.log("✓ apps/web/public/favicon.ico");

  console.log("\nAll icons regenerated from icon.png ✓");
}

run().catch(err => { console.error(err); process.exit(1); });
