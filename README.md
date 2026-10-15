# 启程 4.2.0

在已完成的 4.1.0 工程上增量升级，继续使用原生 HTML/CSS/JavaScript 和原有 IndexedDB。保留资料录入、资料中心、院校地图、成长看板、文档编排、主题与全部导出。运行时无需服务器端程序或构建依赖。

## 在线使用与安装

访问 https://hualaoming.github.io/qicheng-baosong/ 。在 Edge / Chrome 地址栏选择安装图标，或从浏览器菜单安装此应用。等待设置中显示“离线资源已就绪”，以后可以离线启动。

原版本用户继续使用相同地址。若设置中提示发现新版本，选择“保存并更新应用”；更新不会清除本机资料。不要更换浏览器配置文件或清除网站数据来更新。

## 本地运行

解压 ZIP，进入 `qicheng` 文件夹，运行：

```sh
node scripts/serve.mjs
```

打开 `http://127.0.0.1:4173/`。也可以运行 `python -m http.server 8000 --bind 127.0.0.1`，打开 `http://localhost:8000/`。

PWA 需要 HTTPS 或 localhost；双击 `index.html` 不能运行 PWA。设置显示“离线资源已就绪”后，可以断网启动，通过浏览器菜单安装。“保存与备份 → 保存本地文件”会生成可直接离线打开的可编辑 HTML。

## 功能

- 每次正常启动固定首页，右上角菜单保留全部原导航。首页直接读取原目标院校和梦想院校字段。
- 信息录入与学习拓展中心快捷入口、持久倒计时、手动滑动的三页近期信息、每日一句。
- 学习拓展中心提供答题与中华文化典籍入口。典籍包括《论语》《道德经》《管子》《庄子》；《管子》完整接入用户指定的百句必背文档，另三部显示待收录状态。
- 《管子》100 句、26 篇目提供原文/简释、搜索、篇目筛选、底本校勘说明、背诵建议和原 Markdown 下载，支持离线与完整 HTML 副本。
- 唯一答题引擎支持单选、判断、10/20 题、随机、错题与收藏复练。完成整组后点击“提交本组”才保存成绩、显示答案与解析；作答期间可以切换题目和修改答案。
- 正式英语 228 题：Grammar 118、Vocabulary 110。使用已审核的 Model Test 31–45 JSON，原 ID、题干、选项、答案和解析保持不变。
- 中文仅中国古代文化常识、汉语易错知识，初始均 0 题；每日一句为空，优雅显示未安装状态。
- 在原设置中集中外观、语言、Markdown 工具、题库资源管理、安装离线与原兼容数据工具。
- 菜单底部只有设置和保存与备份；备份页仅恢复备份、备份数据、保存本地文件。

## 数据与兼容

数据库 `qicheng-v4`、版本 1、`records` 存储区、原 `current` 工作台记录、数据格式版本 6 和备份格式版本 1 均未改变。没有重建数据库或强制迁移资料。

| 记录 | 内容 |
| --- | --- |
| `current` | 原录入、上传文件、草稿、主题、文档版本和导出历史 |
| `settings:countdown` | 目标名称、日期 |
| `quiz:record:{id}` | 已提交整组练习及当时题目快照 |
| `quiz:mark:{bankId}/{questionId}` | 稳定 ID 关联的错题与收藏 |
| `resource:official:{id}` | 官方题库、每日一句 |
| `resource:custom:{id}` | 用户导入的自定义资源 |

原资料仍按原机制约 500 ms 自动保存。答题选择只保存在当前练习内存中；收藏仅写对应标记；提交时一次事务写成绩与需要改变的错题。刷新会放弃未提交答案，不计成绩；已提交数据长期保存。

完整 JSON 备份覆盖全部用户资料、上传文件、设置、倒计时、答题记录、错题、收藏、自定义资源和其他用户记录；排除导航状态、官方资源与程序静态资源。恢复前校验并确认，原子替换用户数据，保留已安装官方资源；失败回滚。旧版 PWA 数据与备份继续可读。

可编辑 HTML 另行打包程序、全部资料及已安装资源，离线直接打开仍可编辑、答题。原资料 ZIP、PDF、DOCX、PPTX、PNG、展示 HTML、Markdown、打印及备份文本保留。

浏览器数据属于原访问地址。后续更新原站点应保留原地址和路径，便于读取同一份数据。

## 资源维护

题目来自 JSON，不写在组件中。格式、ID 和 manifest 规则见 `docs/RESOURCE_FORMATS.md`。

默认更新地址为应用同源的 `data/resources/manifest.json`。只有点击设置中的在线获取按钮才请求它。启动不查询资源更新或远程内容服务；首次只初始化缺失的随应用附带本地资源，后续读取已安装版本。程序 Service Worker 沿用原离线生命周期，显式内容更新绕过静态缓存。

更新先比较版本、下载并校验 SHA-256/JSON/ID/版本，全部成功后一次事务写入 IndexedDB；任何失败保留旧版。下载后完整离线使用。新增符合格式的英语/中文题库或每日一句，无需修改答题引擎或首页。

修改 JSON 并提升资源版本后运行：

```sh
node scripts/package.mjs
node scripts/check.mjs
node --experimental-vm-modules --test tests/*.test.mjs
```

打包生成资源 manifest 校验值、版本化 Service Worker 和可编辑离线模板。将工程根目录发布到现有 GitHub Pages 地址；保留 manifest 的应用标识、作用域及原 IndexedDB 名称。已安装应用可在设置中保存并更新，题库与每日一句由用户主动点击更新。

## 验证与源码

111 项自动化检查、25 项开发阶段真实 Edge 浏览器验收，以及 12 项发布后的线上 Edge 验收全部通过。完整结果见 `TEST_REPORT.md`、`docs/TEST_EVIDENCE.json`；交付摘要见 `docs/UPGRADE_REPORT.md`；基线和题库来源见 `docs/BASELINE_AUDIT.md`；上线记录与安装条件见 `docs/DEPLOYMENT_REPORT.md`。

4.2 主要新增 `js/modules/explore.js`、`data/classics.json`，接入原导航、首页和离线打包；4.1 已有 `js/resources.js`、`js/modules/home.js`、`js/modules/quiz.js`、`css/workflow.css`、`data/resources/`；主要修改 `js/app.js`、`js/events.js`、`js/backup.js`、`js/modules/settings.js`、`js/storage.js`、`js/utils/validation.js`、`scripts/package.mjs`。

运行时无需 Node 依赖或后端。逻辑测试使用 Node 原生工具；`tests/browser-upgrade.mjs` 使用已有 Playwright 和 Edge，路径可通过 `QICHENG_PLAYWRIGHT`、`QICHENG_BROWSER`、`QICHENG_BASE_URL` 指定。第三方声明仍见 `THIRD_PARTY.md`。

## 典籍内容维护

`data/classics.json` 将四部典籍的书目与 Markdown 内容集中保存，正文不写在页面组件里。《管子》保留原文档内容及来源 SHA-256；新增或更换资料后重新执行 `node scripts/package.mjs`，即可同时更新 PWA 离线缓存和完整 HTML 模板。典籍是应用内置内容，不重复进入用户 JSON 备份。版本 4.2 不增加用户字段或更改数据库结构。原 `quiz` 路由仍兼容，首页和主菜单改从学习拓展中心进入答题。
