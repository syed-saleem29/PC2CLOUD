import { execSync } from "child_process";
import { readdirSync, copyFileSync, mkdirSync, statSync, rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = resolve(root, "apps/desktop");
const distDir = resolve(desktopDir, "dist");
const releasesDir = resolve(root, "releases");

// Remove stale build artifacts that get accidentally packaged into the ASAR
const staleArtifacts = [
  resolve(desktopDir, "out", "_asar_staging"),
  resolve(desktopDir, "out", "app.asar"),
  resolve(desktopDir, "out", "app.asar.unpacked"),
];
for (const p of staleArtifacts) {
  if (existsSync(p)) {
    console.log(`Removing stale artifact: ${p}`);
    rmSync(p, { recursive: true, force: true });
  }
}

// Build from inside apps/desktop — disable code signing (no cert available)
console.log("Building...");
const buildEnv = { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" };
// Unset any cert env vars so electron-builder skips code signing entirely
delete buildEnv.WIN_CSC_LINK;
delete buildEnv.CSC_LINK;
delete buildEnv.WIN_CSC_KEY_PASSWORD;
delete buildEnv.CSC_KEY_PASSWORD;

execSync("npm run dist", {
  cwd: desktopDir,
  stdio: "inherit",
  env: buildEnv,
});

const exeFile = readdirSync(distDir).find((f) => f.endsWith(".exe") && f.includes("Setup"));
if (!exeFile) { console.error("No Setup .exe found in dist/"); process.exit(1); }

const exePath = resolve(distDir, exeFile);
const sizeMB = (statSync(exePath).size / 1024 / 1024).toFixed(1);
console.log(`\nSetup size: ${sizeMB} MB`);

if (parseFloat(sizeMB) < 10) {
  console.error("ERROR: Installer is too small — build failed. Do not copy.");
  process.exit(1);
}

mkdirSync(releasesDir, { recursive: true });
copyFileSync(exePath, resolve(releasesDir, exeFile));
copyFileSync(resolve(distDir, "latest.yml"), resolve(releasesDir, "latest.yml"));

console.log("Copied to releases/");
console.log("Done. Download from /releases on your server.");
