import { spawnSync } from "node:child_process";

const results = [];

function record(name, passed, details, required = false) {
  results.push({ name, passed, details, required });
}

function runCommand(command, args = []) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: false
  });

  return {
    available: !result.error && result.status === 0,
    output: `${result.stdout || ""}${result.stderr || ""}`.trim()
  };
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
record(
  "Node.js 22+",
  nodeMajor >= 22,
  `Detected ${process.version}`,
  true
);

const npm = runCommand("npm", ["--version"]);
record(
  "npm",
  npm.available,
  npm.available ? `Detected ${npm.output}` : "npm was not found.",
  true
);

if (process.platform === "darwin") {
  const xcodeSelect = runCommand("xcode-select", ["-p"]);
  record(
    "Xcode Command Line Tools",
    xcodeSelect.available,
    xcodeSelect.available
      ? xcodeSelect.output
      : "Run: xcode-select --install"
  );

  const xcode = runCommand("xcodebuild", ["-version"]);
  record(
    "Xcode 26+",
    xcode.available && /Xcode\s+(2[6-9]|[3-9]\d)/.test(xcode.output),
    xcode.available
      ? xcode.output.replace(/\n/g, " — ")
      : "Install Xcode from the Mac App Store."
  );
} else {
  record(
    "macOS for iOS builds",
    false,
    "iOS projects can only be compiled on macOS."
  );
}

const java = runCommand("java", ["-version"]);
record(
  "Java runtime",
  java.available,
  java.available
    ? java.output.split("\n")[0]
    : "Android Studio can install the required JDK."
);

const adb = runCommand("adb", ["version"]);
record(
  "Android SDK platform tools",
  adb.available,
  adb.available
    ? adb.output.split("\n")[0]
    : "Install Android Studio and Android SDK Platform Tools."
);

console.log("\nOperation Hunt mobile environment preflight\n");

results.forEach(result => {
  const status = result.passed ? "PASS" : result.required ? "FAIL" : "NOT READY";
  console.log(`${status.padEnd(9)} ${result.name}`);
  console.log(`          ${result.details}\n`);
});

const requiredFailures = results.filter(
  result => result.required && !result.passed
);

if (requiredFailures.length > 0) {
  console.error(
    "Preflight failed. Install the required Node/npm tools before continuing."
  );
  process.exitCode = 1;
} else {
  console.log(
    "Core JavaScript tooling is ready. Native rows marked NOT READY must be installed before that platform can be compiled."
  );
}
