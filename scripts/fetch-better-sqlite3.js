'use strict';

/**
 * 为当前 Electron 版本安装 better-sqlite3 的官方预编译二进制。
 * 用法：npm run rebuild
 *
 * 说明：本项目路径含空格时，node-gyp 源码编译会失败；
 * 且直接下载 GitHub 发布包在部分网络下超时，因此这里：
 *   1. 读取本地 Electron 的 ABI 版本号（electron-vXXX）
 *   2. 依次尝试 ghfast.top 代理与 GitHub 直连下载对应预编译包
 *   3. 解压到 node_modules/better-sqlite3/build/Release/
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MODULE_DIR = path.join(ROOT, 'node_modules', 'better-sqlite3');

function electronBinPath() {
  if (process.platform === 'darwin') {
    return path.join(
      ROOT, 'node_modules', 'electron', 'dist',
      'Electron.app', 'Contents', 'MacOS', 'Electron'
    );
  }
  if (process.platform === 'win32') {
    return path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
  }
  return path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron');
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return r;
}

function getElectronAbi() {
  const r = run(electronBinPath(), ['-e', 'console.log(process.versions.modules)'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  if (r.status !== 0) {
    throw new Error('无法读取 Electron ABI：' + (r.stderr || r.error));
  }
  return r.stdout.trim();
}

function main() {
  const pkg = require(path.join(MODULE_DIR, 'package.json'));
  const abi = getElectronAbi();
  const platform = process.platform;
  const arch = os.arch();
  const asset = `better-sqlite3-v${pkg.version}-electron-v${abi}-${platform}-${arch}.tar.gz`;
  const urls = [
    `https://ghfast.top/https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${asset}`,
    `https://github.com/WiseLibs/better-sqlite3/releases/download/v${pkg.version}/${asset}`,
  ];
  console.log(`[setup-better-sqlite3] Electron ABI = electron-v${abi} (${platform}-${arch})`);
  console.log(`[setup-better-sqlite3] 目标预编译包: ${asset}`);

  const tmp = path.join(os.tmpdir(), `bs3-${process.pid}.tar.gz`);
  let ok = false;
  for (const url of urls) {
    console.log(`[setup-better-sqlite3] 尝试下载: ${url}`);
    const r = run('curl', ['-fL', '--max-time', '480', '-o', tmp, url], {
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    if (r.status === 0) { ok = true; break; }
    console.log(`[setup-better-sqlite3] 下载失败（exit ${r.status}），尝试下一个地址`);
  }
  if (!ok) {
    throw new Error('所有下载地址均失败');
  }

  const releaseDir = path.join(MODULE_DIR, 'build', 'Release');
  fs.rmSync(path.join(MODULE_DIR, 'build'), { recursive: true, force: true });
  fs.mkdirSync(releaseDir, { recursive: true });
  const r = run('tar', ['xzf', tmp, '-C', MODULE_DIR]);
  fs.rmSync(tmp, { force: true });
  if (r.status !== 0) throw new Error('解压失败：' + r.stderr);

  const binding = path.join(releaseDir, 'better_sqlite3.node');
  if (!fs.existsSync(binding)) throw new Error('解压后未找到 better_sqlite3.node');
  console.log(`[setup-better-sqlite3] 完成: ${binding}`);
}

main();
