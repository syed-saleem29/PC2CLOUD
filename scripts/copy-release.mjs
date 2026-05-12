import { readdirSync, copyFileSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { rcedit } = require("rcedit");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(root, "apps/desktop/dist");
const releasesDir = resolve(root, "releases");
const iconPath = resolve(root, "apps/desktop/resources/icon.ico");

mkdirSync(releasesDir, { recursive: true });

const exeFile = readdirSync(distDir).find((f) => f.endsWith(".exe") && f.includes("Setup"));
const ymlFile = "latest.yml";

if (!exeFile) {
  console.error("No Setup .exe found in apps/desktop/dist");
  process.exit(1);
}

const exePath = resolve(distDir, exeFile);

// 1. Stamp the correct icon onto the installer EXE
console.log(`Stamping icon on ${exeFile}...`);
await rcedit(exePath, { icon: iconPath });
console.log("Icon stamped.");

// 2. Recalculate SHA512 and size after stamping
const exeBuffer = readFileSync(exePath);
const sha512 = createHash("sha512").update(exeBuffer).digest("base64");
const size = statSync(exePath).size;
console.log(`Recalculated SHA512: ${sha512.slice(0, 20)}...`);

// 3. Update latest.yml with new hash and size
const ymlPath = resolve(distDir, ymlFile);
let yml = readFileSync(ymlPath, "utf8");
yml = yml.replace(/sha512: .+/g, `sha512: ${sha512}`);
yml = yml.replace(/size: \d+/g, `size: ${size}`);
writeFileSync(ymlPath, yml);
console.log("latest.yml updated with new hash.");

// 4. Copy both files to releases/
copyFileSync(exePath, resolve(releasesDir, exeFile));
console.log(`Copied → releases/${exeFile}`);
copyFileSync(ymlPath, resolve(releasesDir, ymlFile));
console.log(`Copied → releases/${ymlFile}`);

console.log("\nRelease ready. Download from /releases on your server.");
