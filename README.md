# 做账 📒

本地记账桌面应用（Electron）。数据保存在本机 **SQLite** 数据库，支持记账、明细管理，以及**周报 / 月报 / 季报**：自动生成总结文案 + 折线图 + 饼图。

## 功能

- **记一笔**：金额、币种（¥/$）、日期、分类（餐饮/交通/购物/工资…可自定义）、收入/支出、消费路径、备注
- **明细**：按月浏览全部账单，可编辑、删除，自动统计当月支出/收入/结余/笔数（按显示币种折算）
- **周报 / 月报 / 季报**
  - 总结文案，如：`本周总消费920元。主要消费来自购物，占54%。相比上周增加15%。`
  - 折线图：周报为「本周 vs 上周」支出对比；月报为每日支出/收入趋势；季报为每周支出/收入趋势
  - 饼图：分类占比（支出 / 收入可切换）
  - 统计卡片：总支出、总收入、结余、主要消费分类、支出环比
- **双语界面**：中文 / English 一键切换（菜单、界面、报表、总结文案全部本地化）
- **多币种 + 统一折算**：每条记录可标 ¥ 或 $；报表统一折算到显示货币，
  混合币种时以 ≈ 标注近似值并附折算明细，如
  `本周总消费约 ¥1,339.00 …按当日汇率 1 USD ≈ 7.2000 CNY 折算（其中 $100.00 ≈ ¥720.00）`
- **当日汇率**：设置面板可联网刷新 USD/CNY 汇率（open.er-api.com 免费接口），
  失败自动回退缓存/默认值，也支持手动设置
- 完全离线可用（仅刷新汇率需要联网）

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
`usd_cny_rate`、`rate_source`、`rate_updated_at`、`rate_manual`。

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

## 统计口径

- **周**：周一至周日（ISO 周），环比上周
- **月**：自然月，环比上月
- **季度**：自然季度（1-3 / 4-6 / 7-9 / 10-12 月），环比上季度
- “总消费”仅统计支出；环比按支出金额计算：`(本期 − 上期) / 上期 × 100%`
- 环比增减、分类占比均四舍五入为整数百分比；上期为 0 时不计算环比

## 多币种与汇率

- 每条记录记录原始币种；报表/明细统一折算到「显示货币」
- 汇率语义：`rate = 1 USD 兑多少 CNY`，USD→CNY 乘、CNY→USD 除
- 混合币种时所有折算后的总额以 `≈`/“约”标注，总结文案附折算明细
- 有效汇率优先级：手动设置 > 联网缓存（含更新时间）> 默认 7.20
- 联网接口：`https://open.er-api.com/v6/latest/USD`（免费、无需 key，8 秒超时）
