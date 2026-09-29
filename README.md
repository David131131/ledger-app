# 做账 📒

本地记账桌面应用（Electron）。数据保存在本机 **SQLite** 数据库，支持记账、明细管理，以及**周报 / 月报 / 季报**：自动生成总结文案 + 折线图 + 饼图。

## 功能

- **记一笔**：金额、币种（¥/$）、日期、分类（餐饮/交通/购物/工资…可自定义）、收入/支出、消费路径、备注
- **明细**：关键词搜索 + 分类/类型/币种/日期区间筛选，可编辑、删除，自动统计支出/收入/结余/笔数（按显示币种折算）
- **周报 / 月报 / 季报 / 年报**
  - 总结文案，如：`本周总消费920元。主要消费来自购物，占54%。相比上周增加15%。`（年报为同比）
  - 折线图：周报为「本周 vs 上周」支出对比；月报为每日支出/收入趋势；季报为每周、年报为每月
  - 饼图：分类占比（支出 / 收入可切换）+ 消费排行 Top 8 条形图
  - 统计卡片：总支出、总收入、结余、主要消费分类、支出环比
- **预算管理**：每月总预算 + 分类预算；月报显示进度条，≥80% 变黄、超支变红并提示超额金额
- **暗色模式**：跟随系统深浅色自动切换（CSS 变量 + 图表主题联动）
- **双语界面**：中文 / English 一键切换（菜单、界面、报表、总结文案全部本地化）
- **多币种 + 统一折算**：每条记录可标 ¥ 或 $；报表统一折算到显示货币，
  混合币种时以 ≈ 标注近似值并附折算明细，如
  `本周总消费约 ¥1,339.00 …按当日汇率 1 USD ≈ 7.2000 CNY 折算（其中 $100.00 ≈ ¥720.00）`
- **当日汇率**：设置面板可联网刷新 USD/CNY 汇率（open.er-api.com 免费接口），
  失败自动回退缓存/默认值，也支持手动设置
- 完全离线可用（仅刷新汇率需要联网）
- **手机离线记账（v1.2）**：iPhone / Android 网页应用，可添加到主屏幕；手机先保存到 IndexedDB，电脑恢复连接后自动写入当前桌面应用的同一份 SQLite 账本，失败可重试且不会重复入账。

## iPhone 离线记账与电脑同步

手机端是独立的轻量网页，支持收入/支出、币种、日期、分类、路径、备注，显示待同步记录和电脑最近 1,000 笔账单的离线副本。完整报表、编辑、删除、预算和备份继续在桌面应用使用。

### 首次连接

1. 安装 v1.2 或更新版桌面应用并打开原来的账本。macOS 安装版沿用 `~/Library/Application Support/做账/ledger.db`；不要为了手机同步改用开发版新建一份账本。可先用设置中的「备份数据库」保存快照。
2. 在 Mac 和 iPhone 安装 [Tailscale](https://tailscale.com/download)，登录同一账号并连接。Mac 的安装/系统扩展授权、iPhone 的 VPN 授权与账号登录需要在各自设备上完成。参考 [macOS 安装说明](https://tailscale.com/docs/install/mac) 与 [iOS 安装说明](https://tailscale.com/docs/install/ios)。
3. 在电脑应用菜单 **做账 → 手机同步 / Mobile Sync…** 中开启服务，并复制连接密钥。对话框显示当前实际使用的数据库位置。启用后每次打开应用自动启动接收服务；可从同一菜单关闭或重置密钥。
4. 在 Mac 终端运行：

   ```bash
   tailscale serve --bg http://127.0.0.1:47831
   ```

   若 `tailscale` 命令不在 PATH 中，使用 Mac 应用内的 CLI：

   ```bash
   /Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg http://127.0.0.1:47831
   ```

   首次可能要求按命令给出的链接启用 HTTPS，完成后重新执行。使用 **Serve**（私有网络），不需要 Funnel 或路由器端口转发；不要覆盖自己已有的其他 Serve 服务配置。详见 [Tailscale Serve 官方说明](https://tailscale.com/docs/features/tailscale-serve)。
5. 用 iPhone Safari 打开命令返回的 `https://…ts.net` 地址，输入电脑连接密钥。等待「离线页面已就绪」后，点分享 → 添加到主屏幕。**从主屏幕再打开一次并确认已连接**（必要时重新输入密钥），然后就可以关掉电脑测试离线记账。
6. 电脑开机、Tailscale 在线且「做账」运行时，打开或切回手机网页，会自动同步；页面在前台时每 15 秒重试一次，也可点「立即同步」。电脑界面会自动刷新收到的记录。

电脑本地预览地址是 `http://127.0.0.1:47831`；手机必须用 HTTPS 安全地址，普通局域网 HTTP 地址不能提供所需的离线网页能力。首次加载必须在线，此后才可离线启动。

### 保存和同步的边界

- **自动登录（v1.2.1）**：首次连接后，密钥保存在当前设备的 IndexedDB，下次打开自动连接。已记住设备默认隐藏密钥输入框，只有主动「更换连接密钥」或电脑密钥失效时才显示。电脑离线不会清除登录状态。Safari 和主屏幕网页应用可能使用不同存储，建议固定从主屏幕打开；清除网站数据或换浏览器后需要重新连接。
- **手机页面升级**：保持电脑在线打开页面，让新版离线资源下载完成，再关闭此地址的所有网页/主屏幕应用窗口并重新打开。更新不会主动刷新正在填写的表单，也不会删除密钥和待同步账单。
- **电脑关机 / 休眠 / 应用退出**：账单只存于手机，明确显示「待同步」；电脑恢复连接后才能写入电脑磁盘。
- **iPhone 网页关闭 / 锁屏**：不承诺后台持续同步；回到网页时自动同步。这不是 iOS 原生后台服务。
- **离线数据**：保存在当前浏览器或主屏幕应用的 IndexedDB。未同步前不要清除网站数据、使用无痕浏览或删除应用。可在「连接电脑」中导出待同步 JSON 作应急备份（暂不提供 JSON 自动导入）。应用请求持久存储，但最终是否保留由系统决定，参考 [WebKit 存储策略](https://webkit.org/blog/14403/updates-to-storage-policy/)。
- **防重复**：账单与请求接收凭据在同一 SQLite 事务提交。网络超时、页面刷新、重复发送和服务重启后重试均复用相同请求编号。电脑删除已同步账单后，旧请求重试也不会把它重新创建。
- **防混账**：首次连接绑定账本 ID，账本变更时停止同步并保留队列；重置密钥后可重新连接同一账本。
- **连接安全**：服务仅监听 `127.0.0.1:47831`，所有账单 API 要求随机连接密钥，通过 Tailscale HTTPS 访问。密钥不放进 URL，静态页面不包含账本或密钥；账单不上传到额外的云数据库。
- **备份恢复**：数据库备份也包含同步凭据。恢复较旧的备份会恢复到当时的账本状态，不能把同步机制当作历史数据备份。

### 手机同步测试

```bash
npm run test:mobile
```

仅创建临时数据库和独立浏览器会话，不使用真实账本。覆盖鉴权、错误输入、账本 ID 不符、并发去重、删除后旧请求重试、关闭服务后离线启动和记账、刷新保留队列、重连写入相同数据库、服务重启重试、密钥撤销和重新连接，以及窄屏无横向溢出。自动测试使用 Electron 的 Chromium；真实 iPhone Safari、VPN 和主屏幕安装需要按上面步骤实机验证。

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面外壳
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — 同步 SQLite 驱动（主进程）
- [ECharts](https://echarts.apache.org/) — 图表
- 渲染层为原生 HTML/CSS/JS，通过 `preload.js`（contextBridge）安全调用主进程 API

## 运行

```bash
# 首次安装（国内网络建议设置镜像，避免 Electron 二进制下载超时）
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export electron_config_cache="$PWD/.electron-cache"   # 沙箱/权限受限时把下载缓存放到项目内
npm install

# npm 11+ 默认拦截安装脚本，需要批准这两个包的 install/postinstall 脚本：
npm approve-scripts electron better-sqlite3

# 安装 better-sqlite3 的 Electron 预编译二进制（见下）
npm run rebuild

# 启动应用
npm start

# 冒烟测试（验证数据库 + 报表逻辑 + 渲染层，不打开窗口）
npm run smoke
```

> 数据库文件位置（自动创建）：macOS 为 `~/Library/Application Support/zuozhang/ledger.db`

### 关于 better-sqlite3 原生模块

better-sqlite3 是原生模块，必须与 Electron 的 ABI 匹配。本项目路径含有空格时
node-gyp 源码编译会失败，因此 `npm run rebuild` 使用 `scripts/fetch-better-sqlite3.js`：

1. 读取本地 Electron 的模块 ABI（如 electron-v136）；
2. 从官方 GitHub Release（经 ghfast.top 代理，失败时回退直连）下载
   `better-sqlite3-v<版本>-electron-v<ABI>-<平台>-<架构>.tar.gz`；
3. 解压到 `node_modules/better-sqlite3/build/Release/`。

如果日后升级了 Electron 版本，重新执行 `npm run rebuild` 即可。
（路径不含空格的机器上也可以用 `npx electron-rebuild -f -w better-sqlite3` 从源码编译。）

## 目录结构

```
├── main.js          # Electron 主进程：窗口、菜单、IPC、冒烟测试
├── preload.js       # contextBridge 安全 API
├── db.js            # SQLite 建表与增删改查
├── stats.js         # 周/月/季度统计、总结文案、图表数据
├── mobile-server.js # 当前桌面数据库的手机接收服务（鉴权 / 去重事务）
├── mobile/          # 手机网页、IndexedDB 队列、Service Worker 离线页面
├── assets/
│   ├── icon.png     # 应用图标（1024，Dock 图标来源）
│   └── icon.icns    # macOS 图标集（启动器包 / Electron.app 使用）
├── scripts/
│   ├── fetch-better-sqlite3.js  # 下载 Electron 版预编译二进制
│   └── make-icon.py             # 重新生成图标（需 Pillow）
└── renderer/
    ├── index.html   # 界面结构
    ├── style.css    # 样式
    └── app.js       # 交互逻辑与 ECharts 渲染
```

## 数据库表结构（records）

| 字段 | 含义 |
| --- | --- |
| id | 编号（自增主键） |
| date | 日期（YYYY-MM-DD） |
| amount | 金额 |
| currency | 币种（CNY / USD） |
| category | 分类 |
| type | 收入/支出（income / expense） |
| path | 消费路径（可选） |
| note | 备注 |
| created_time | 创建时间 |

另有 `settings` 键值表：`lang`（zh/en）、`currency`（CNY/USD）、
`usd_cny_rate`、`rate_source`、`rate_updated_at`、`rate_manual`、
`budget_total`（每月总预算）、`budget_categories`（分类预算 JSON）。

## 应用图标

- `assets/icon.png` / `assets/icon.icns` 为程序化绘制的记账风格图标
  （靛蓝渐变圆角块 + 账本卡片 + ¥ 金币 + 收支箭头 + 趋势折线）
- 运行中的应用：`main.js` 里 `app.dock.setIcon()` 设置 Dock 图标；
  同时已把 `node_modules/electron/dist/Electron.app` 的
  `CFBundleName`/`CFBundleIconFile` 改为「做账」与自定义图标（重装依赖后会失效，
  Dock 图标由 `main.js` 兜底，但菜单栏名字会恢复成 Electron）
- 桌面快捷方式 `做账.app`：使用 `assets/icon.icns`
- 修改图标后重新生成：`PYTHONPATH=.icon-tools python3 scripts/make-icon.py`
  （首次需 `python3 -m pip install --target ./.icon-tools pillow`）

## 桌面快捷方式

桌面上的 `做账.app` 是启动器包（`dist/做账.app/` 为源副本），
内部是编译出的原生 Mach-O 启动器（`scripts/launcher.c`），
直接启动项目里的 Electron。

> 注意：新版 macOS 会拒绝 Finder 双击打开「纯 shell 脚本 + 无签名」的 .app，
> 因此启动器必须是原生二进制并对整个 bundle 做 ad-hoc 签名。
> 重新构建：`clang -O2 -o launcher scripts/launcher.c && codesign --force --deep -s - 做账.app`，
> 复制到桌面后执行 `lsregister -f ~/Desktop/做账.app` 并 `touch` 一下。

## Git 与 GitHub

- 仓库：<https://github.com/David131131/ledger-app>（v1.0.0 已发布 Release）
- 部分网络环境 git 传输到 github.com 会被干扰，拉取代码可用代理：
  ```bash
  git -c url."https://ghfast.top/https://github.com/".insteadOf="https://github.com/" fetch origin main
  ```

## 打包发布（electron-builder）

```bash
npm install
npm run rebuild      # 确保 better-sqlite3 是 Electron ABI 的预编译二进制
npm run dist         # macOS：release/做账-<版本>-arm64.dmg 与 .zip
npm run dist:win     # Windows：release/做账-<版本>-setup-x64.exe 与 -setup-arm64.exe
```

- 产物是**自包含应用**：不依赖源码目录与 node_modules；数据库位于
  `~/Library/Application Support/做账/ledger.db`（macOS）/ `%APPDATA%\做账`（Windows）
- 原生模块自动解包（app.asar.unpacked），ECharts 已内置（renderer/echarts.min.js）
- **Windows 打包必须用 `npm run dist:win`**：按 x64/arm64 分别下载对应 win32 预编译
  better-sqlite3 再打包（直接 `electron-builder --win` 会把 macOS 二进制打进去导致
  启动即崩溃），流水线结束自动恢复 darwin 版
- **Windows 安装器**：双语向导（English/中文，`multiLanguageInstaller`），
  默认安装到 `%LOCALAPPDATA%\Programs\zuozhang`（ASCII 路径，`scripts/installer.nsh`）
- **Windows SmartScreen**：无代码签名证书，首次运行会提示
  「Windows 已保护你的电脑」→ 点「更多信息」→「仍要运行」
- macOS 无 Apple 开发者证书时使用 **ad-hoc 签名**（`mac.identity: "-"`）：
  本机可直接双击运行；发给别人首次打开需右键 → 打开（未公证）
- 国内网络打包注意：
  ```bash
  export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
  export electron_config_cache="$PWD/.electron-cache"        # Electron 安装包缓存
  export ELECTRON_BUILDER_CACHE="$PWD/.electron-builder-cache"  # 打包工具缓存
  ```
  dmgbuild 工具包可从 ghfast 代理预置：
  `.electron-builder-cache/dmg-builder@1.2.5/dmgbuild-bundle-arm64-75c8a6c.tar.gz`

## 统计口径

- **周**：周一至周日（ISO 周），环比上周
- **月**：自然月，环比上月
- **季度**：自然季度（1-3 / 4-6 / 7-9 / 10-12 月），环比上季度
- **年**：自然年，同比去年
- “总消费”仅统计支出；环比按支出金额计算：`(本期 − 上期) / 上期 × 100%`
- 环比增减、分类占比均四舍五入为整数百分比；上期为 0 时不计算环比

## 预算口径

- 预算（总额与分类）按当前显示货币计价，仅月报展示进度
- 进度 = 本期支出（已折算）/ 预算：<80% 绿色，80%–100% 黄色，>100% 红色并标注超额金额

## 多币种与汇率

- 每条记录记录原始币种；报表/明细统一折算到「显示货币」
- 汇率语义：`rate = 1 USD 兑多少 CNY`，USD→CNY 乘、CNY→USD 除
- 混合币种时所有折算后的总额以 `≈`/“约”标注，总结文案附折算明细
- 有效汇率优先级：手动设置 > 联网缓存（含更新时间）> 默认 7.20
- 联网接口：`https://open.er-api.com/v6/latest/USD`（免费、无需 key，8 秒超时）
