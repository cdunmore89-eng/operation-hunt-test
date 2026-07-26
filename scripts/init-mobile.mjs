import { access } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

async function directoryExists(relativePath) {
  try {
    await access(path.join(ROOT_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

function runCap(args, label) {
  console.log(`\n${label}…`);

  const result = spawnSync(NPX, ["cap", ...args], {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: false
  });

  if (result.error || result.status !== 0) {
    throw new Error(`${label} failed.`);
  }
}

async function initialize() {
  const iosExists = await directoryExists("ios");
  const androidExists = await directoryExists("android");

  if (!iosExists) {
    runCap(["add", "ios"], "Creating iOS project");
  } else {
    console.log("iOS project already exists; skipping cap add ios.");
  }

  if (!androidExists) {
    runCap(["add", "android"], "Creating Android project");
  } else {
    console.log("Android project already exists; skipping cap add android.");
  }

  runCap(["sync"], "Synchronizing native projects");

  console.log("\nOperation Hunt native projects are initialized.");
}

initialize().catch(error => {
  console.error(`\nMobile initialization failed: ${error.message}`);
  process.exitCode = 1;
});
