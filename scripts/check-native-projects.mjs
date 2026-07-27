import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const APP_ID = "com.cdunmore89.operationhunt";
const APP_NAME = "Operation Hunt";

const results = [];

async function read(relativePath) {
  return readFile(path.join(ROOT_DIR, relativePath), "utf8");
}

function record(name, passed, details = "") {
  results.push({ name, passed, details });
  const status = passed ? "PASS" : "FAIL";
  console.log(`${status.padEnd(6)} ${name}`);
  if (details) {
    console.log(`       ${details}`);
  }
}

function includes(name, content, expected) {
  record(
    name,
    content.includes(expected),
    content.includes(expected) ? expected : `Missing: ${expected}`
  );
}

async function fileExists(relativePath) {
  try {
    await access(path.join(ROOT_DIR, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log("\nOperation Hunt native project validation\n");

  const [
    packageJsonText,
    capacitorConfigText,
    androidBuild,
    androidVariables,
    androidManifest,
    androidStrings,
    androidMainActivity,
    androidUnitTest,
    androidInstrumentedTest,
    iosProject,
    iosInfo
  ] = await Promise.all([
    read("package.json"),
    read("capacitor.config.json"),
    read("android/app/build.gradle"),
    read("android/variables.gradle"),
    read("android/app/src/main/AndroidManifest.xml"),
    read("android/app/src/main/res/values/strings.xml"),
    read("android/app/src/main/java/com/cdunmore89/operationhunt/MainActivity.java"),
    read("android/app/src/test/java/com/cdunmore89/operationhunt/ExampleUnitTest.java"),
    read("android/app/src/androidTest/java/com/cdunmore89/operationhunt/ExampleInstrumentedTest.java"),
    read("ios/App/App.xcodeproj/project.pbxproj"),
    read("ios/App/App/Info.plist")
  ]);

  const packageJson = JSON.parse(packageJsonText);
  const capacitorConfig = JSON.parse(capacitorConfigText);

  record("Package version", packageJson.version === "1.0.0", packageJson.version);
  record("Capacitor app ID", capacitorConfig.appId === APP_ID, capacitorConfig.appId);
  record("Capacitor app name", capacitorConfig.appName === APP_NAME, capacitorConfig.appName);
  record("Capacitor web directory", capacitorConfig.webDir === "www", capacitorConfig.webDir);

  includes("Android namespace", androidBuild, `namespace = "${APP_ID}"`);
  includes("Android application ID", androidBuild, `applicationId "${APP_ID}"`);
  includes("Android version code", androidBuild, "versionCode 1");
  includes("Android version name", androidBuild, 'versionName "1.0"');
  includes("Android minimum SDK", androidVariables, "minSdkVersion = 24");
  includes("Android target SDK", androidVariables, "targetSdkVersion = 36");
  includes("Android backups disabled", androidManifest, 'android:allowBackup="false"');
  includes("Android cleartext disabled", androidManifest, 'android:usesCleartextTraffic="false"');
  includes("Android hardware acceleration", androidManifest, 'android:hardwareAccelerated="true"');
  includes("Android keyboard resize", androidManifest, 'android:windowSoftInputMode="adjustResize"');
  includes("Android display name", androidStrings, `<string name="app_name">${APP_NAME}</string>`);
  includes("Android activity package", androidMainActivity, `package ${APP_ID};`);
  includes("Android unit-test package", androidUnitTest, `package ${APP_ID};`);
  includes("Android instrumented-test package", androidInstrumentedTest, `package ${APP_ID};`);
  includes("Android instrumented app ID", androidInstrumentedTest, `"${APP_ID}"`);

  record(
    "Legacy Android unit-test namespace removed",
    !(await fileExists("android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java"))
  );
  record(
    "Legacy Android instrumented namespace removed",
    !(await fileExists("android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java"))
  );

  includes("iOS bundle ID", iosProject, `PRODUCT_BUNDLE_IDENTIFIER = ${APP_ID};`);
  includes("iOS marketing version", iosProject, "MARKETING_VERSION = 1.0;");
  includes("iOS build number", iosProject, "CURRENT_PROJECT_VERSION = 1;");
  includes("iOS deployment target", iosProject, "IPHONEOS_DEPLOYMENT_TARGET = 15.0;");
  includes("iOS phone and tablet support", iosProject, 'TARGETED_DEVICE_FAMILY = "1,2";');
  includes("iOS display name", iosInfo, `<string>${APP_NAME}</string>`);
  includes("iOS portrait support", iosInfo, "UIInterfaceOrientationPortrait");
  includes("iOS landscape-left support", iosInfo, "UIInterfaceOrientationLandscapeLeft");
  includes("iOS landscape-right support", iosInfo, "UIInterfaceOrientationLandscapeRight");

  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;

  console.log("\n----------------------------------------");
  console.log(
    failed === 0
      ? `PASS — ${passed}/${results.length} native checks passed.`
      : `FAIL — ${failed} of ${results.length} native checks failed.`
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch(error => {
  console.error(`Native validation failed: ${error.message}`);
  process.exitCode = 1;
});
