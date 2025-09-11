#!/usr/bin/env node
// Ultra eXtreme Programming: tight feedback, fast checks.
// Android preflight for Expo/React Native builds.
import { exec as _exec } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(_exec);

const log = (label, msg) => {
  console.log(`${label}: ${msg}`);
};

const ok = (msg) => console.log(`✔ ${msg}`);
const warn = (msg) => console.warn(`! ${msg}`);
const fail = (msg) => console.error(`✖ ${msg}`);

async function exists(p) {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function which(cmd) {
  try {
    const { stdout } = await exec(
      process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`,
    );
    return stdout.trim();
  } catch {
    return '';
  }
}

async function checkJava() {
  // Prefer JAVA_HOME if present; otherwise use `java -version`.
  const javaHome = process.env.JAVA_HOME || '';
  if (javaHome) {
    ok(`JAVA_HOME set: ${javaHome}`);
  } else {
    warn('JAVA_HOME not set');
  }

  try {
    const { stderr, stdout } = await exec('java -version');
    const out = `${stderr}\n${stdout}`.trim();
    const m = out.match(/version\s+"(\d+)(?:\.|_)/);
    const major = m ? Number(m[1]) : NaN;
    if (major === 17) {
      ok(`Java version: ${out.split('\n')[0]}`);
      return true;
    } else {
      fail(`Java 17 required. Detected: ${out.split('\n')[0]}`);
      if (process.platform === 'darwin') {
        console.log(
          'Hint (macOS): export JAVA_HOME=$(/usr/libexec/java_home -v 17)',
        );
      }
      return false;
    }
  } catch (e) {
    fail('Java not found in PATH');
    return false;
  }
}

async function checkAndroidSdk() {
  const sdkRoot =
    process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME || '';
  if (!sdkRoot) {
    fail('ANDROID_SDK_ROOT/ANDROID_HOME not set');
    console.log(
      'Set ANDROID_SDK_ROOT to your SDK path (e.g., ~/Library/Android/sdk)',
    );
    return { ok: false, sdkRoot: '' };
  }
  const existsRoot = await exists(sdkRoot);
  if (!existsRoot) {
    fail(`SDK path does not exist: ${sdkRoot}`);
    return { ok: false, sdkRoot };
  }
  ok(`Android SDK: ${sdkRoot}`);

  const adbPath = join(
    sdkRoot,
    'platform-tools',
    process.platform === 'win32' ? 'adb.exe' : 'adb',
  );
  const emulatorPath = join(
    sdkRoot,
    'emulator',
    process.platform === 'win32' ? 'emulator.exe' : 'emulator',
  );
  const haveAdb = await exists(adbPath);
  const haveEmu = await exists(emulatorPath);
  if (!haveAdb)
    warn('platform-tools/adb not found; ensure Platform Tools are installed');
  if (!haveEmu)
    warn('emulator binary not found; ensure Android Emulator is installed');

  return { ok: true, sdkRoot, haveAdb, haveEmu };
}

async function checkAdb() {
  const adbBin = await which('adb');
  if (!adbBin) {
    fail('adb not found on PATH');
    console.log('Add <SDK>/platform-tools to PATH or start via Android Studio');
    return { ok: false, devices: [] };
  }
  ok(`adb: ${adbBin}`);

  try {
    await exec('adb start-server');
  } catch {}

  try {
    const { stdout } = await exec('adb devices');
    const lines = stdout.trim().split('\n').slice(1);
    const devices = lines
      .map((l) => l.trim().split(/\s+/))
      .filter((p) => p.length >= 2 && p[1] === 'device')
      .map((p) => p[0]);
    if (devices.length === 0) {
      warn('No devices/emulators attached');
      console.log(
        'Start an Android Emulator in Android Studio or plug in a device with USB debugging enabled.',
      );
    } else {
      ok(`Devices: ${devices.join(', ')}`);
    }
    return { ok: true, devices };
  } catch (e) {
    fail(`adb devices failed: ${e?.stderr || e?.message || e}`);
    return { ok: false, devices: [] };
  }
}

async function checkEmulators() {
  const emulatorBin = await which('emulator');
  if (!emulatorBin) {
    warn('emulator CLI not on PATH (optional)');
    return { ok: false, avds: [] };
  }
  try {
    const { stdout } = await exec('emulator -list-avds');
    const avds = stdout.trim().split('\n').filter(Boolean);
    if (avds.length === 0) {
      warn('No AVDs found. Create one in Android Studio > Device Manager.');
    } else {
      ok(`AVDs: ${avds.join(', ')}`);
    }
    return { ok: true, avds };
  } catch (e) {
    warn('Failed to list AVDs via emulator CLI (optional)');
    return { ok: false, avds: [] };
  }
}

async function checkPrefabArgfile() {
  // Verify the argfile workarounds are configured.
  const pkg = process.cwd() + '/package.json';
  try {
    const { stdout } = await exec(
      `node -p "require('./package.json').scripts['android'] || ''"`,
    );
    const script = stdout.trim();
    if (script.includes('PREFAB_NO_ARGFILE=1')) {
      ok('PREFAB_NO_ARGFILE=1 configured in npm script');
    } else {
      warn('PREFAB_NO_ARGFILE=1 not present; pnpm paths may break Prefab');
    }
  } catch {}

  // Read Gradle properties
  try {
    const { stdout } = await exec("sed -n '1,200p' android/gradle.properties");
    if (stdout.includes('android.prefab.noArgFile=true')) {
      ok('android.prefab.noArgFile=true set in gradle.properties');
    } else {
      warn('android.prefab.noArgFile=true not set in gradle.properties');
    }
  } catch {
    warn('Could not read android/gradle.properties');
  }
}

async function main() {
  console.log('Android Doctor — quick preflight\n');
  const results = {
    java: await checkJava(),
    sdk: await checkAndroidSdk(),
    adb: await checkAdb(),
    emu: await checkEmulators(),
  };
  await checkPrefabArgfile();

  console.log('\nSummary');
  console.log('-------');
  console.log(`Java: ${results.java ? 'OK' : 'NOT OK'}`);
  console.log(`SDK: ${results.sdk.ok ? 'OK' : 'NOT OK'}`);
  console.log(`ADB: ${results.adb.ok ? 'OK' : 'NOT OK'}`);
  console.log(
    `Device/Emulator: ${results.adb.devices.length > 0 ? 'FOUND' : 'MISSING'}`,
  );

  const actionable = [];
  if (!results.java) actionable.push('Ensure Java 17 and set JAVA_HOME');
  if (!results.sdk.ok) actionable.push('Set ANDROID_SDK_ROOT to your SDK path');
  if (results.sdk.ok && !results.sdk.haveAdb)
    actionable.push('Install Platform Tools (adb)');
  if (results.adb.ok && results.adb.devices.length === 0)
    actionable.push('Start an emulator or connect a device');

  if (actionable.length) {
    console.log('\nNext steps:');
    for (const step of actionable) console.log(`- ${step}`);
  } else {
    console.log('\nAll set. You can run: pnpm android');
  }
}

main().catch((e) => {
  fail(e?.message || String(e));
  process.exitCode = 1;
});
