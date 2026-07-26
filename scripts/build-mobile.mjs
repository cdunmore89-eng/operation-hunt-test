import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "www");

const CERTIFIED_WEB_BASELINE =
  "c3d97026ae523f86496c5ee35d4946336e73dcae";

const productionFiles = [
  "css/styles.css",
  "css/demo.css",
  "css/operation-hunt-design-system.css",
  "css/operation-hunt-timer.css",
  "css/operation-hunt-feedback.css",
  "css/operation-hunt-board.css",
  "css/operation-hunt-scoreboard.css",
  "css/operation-hunt-shell.css",
  "css/operation-hunt-operations.css",
  "js/puzzle-engine.js",
  "js/arithmetic-engine.js",
  "js/arithmetic-multiplication.js",
  "js/arithmetic-division.js",
  "js/demo.js",
  "js/demo-addition-rules.js",
  "js/demo-operations.js",
  "js/demo-multiplication.js",
  "js/demo-division.js",
  "js/demo-timer-ui.js",
  "js/demo-feedback-ui.js",
  "js/demo-board-ui.js",
  "js/demo-scoreboard-ui.js",
  "js/demo-shell-ui.js",
  "mobile/mobile-native.css",
  "mobile/mobile-native.js"
];

const mobileOutputPaths = new Map([
  ["mobile/mobile-native.css", "css/mobile-native.css"],
  ["mobile/mobile-native.js", "js/mobile-native.js"]
]);

async function ensureFileExists(relativePath) {
  const sourcePath = path.join(ROOT_DIR, relativePath);

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Required production file is missing: ${relativePath}`);
  }
}

async function copyProductionFile(relativePath) {
  const sourcePath = path.join(ROOT_DIR, relativePath);
  const outputRelativePath =
    mobileOutputPaths.get(relativePath) || relativePath;
  const destinationPath = path.join(OUTPUT_DIR, outputRelativePath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

function createMobileIndex(sourceHtml) {
  const viewportSource =
    'content="width=device-width, initial-scale=1.0"';
  const viewportMobile =
    'content="width=device-width, initial-scale=1.0, viewport-fit=cover"';

  if (!sourceHtml.includes(viewportSource)) {
    throw new Error("The certified Demo viewport declaration was not found.");
  }

  if (!sourceHtml.includes("</head>") || !sourceHtml.includes("</body>")) {
    throw new Error("The certified Demo does not contain a complete HTML shell.");
  }

  let mobileHtml = sourceHtml.replace(viewportSource, viewportMobile);

  mobileHtml = mobileHtml.replace(
    "</head>",
    '  <link rel="stylesheet" href="css/mobile-native.css">\n</head>'
  );

  mobileHtml = mobileHtml.replace(
    '<body class="demo-page',
    '<body class="demo-page native-shell'
  );

  mobileHtml = mobileHtml.replace(
    "</body>",
    '  <script src="js/mobile-native.js"></script>\n</body>'
  );

  return mobileHtml;
}

async function validateLocalAssets(html) {
  const assetPattern = /(?:src|href)="([^"]+)"/g;
  const localAssets = [];
  let match;

  while ((match = assetPattern.exec(html)) !== null) {
    const asset = match[1];

    if (
      asset.startsWith("http://") ||
      asset.startsWith("https://") ||
      asset.startsWith("data:") ||
      asset.startsWith("#")
    ) {
      continue;
    }

    localAssets.push(asset.split("?")[0].split("#")[0]);
  }

  for (const asset of new Set(localAssets)) {
    try {
      await access(path.join(OUTPUT_DIR, asset));
    } catch {
      throw new Error(`Built index references a missing local asset: ${asset}`);
    }
  }
}

async function build() {
  console.log("Building Operation Hunt mobile web bundle…");

  await Promise.all([
    ensureFileExists("demo.html"),
    ...productionFiles.map(ensureFileExists)
  ]);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  await Promise.all(productionFiles.map(copyProductionFile));

  const certifiedDemo = await readFile(
    path.join(ROOT_DIR, "demo.html"),
    "utf8"
  );
  const mobileIndex = createMobileIndex(certifiedDemo);

  await writeFile(
    path.join(OUTPUT_DIR, "index.html"),
    mobileIndex,
    "utf8"
  );

  await writeFile(
    path.join(OUTPUT_DIR, "build-info.json"),
    `${JSON.stringify(
      {
        appName: "Operation Hunt",
        appVersion: "1.0.0",
        certifiedWebBaseline: CERTIFIED_WEB_BASELINE
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  await validateLocalAssets(mobileIndex);

  console.log("Mobile web bundle created successfully.");
  console.log(`Output: ${path.relative(ROOT_DIR, OUTPUT_DIR)}/`);
  console.log(`Certified baseline: ${CERTIFIED_WEB_BASELINE}`);
}

build().catch(error => {
  console.error(`Mobile build failed: ${error.message}`);
  process.exitCode = 1;
});
