# 5.0 本地整合验收（2026-10-23）

已按用户确认整合，停留在本地，未推送 GitHub、未部署 Pages、未创建 Release。应用版本号仍为 5.0.0，本地缓存修订为 `d8a4be878fed`；线上 5.0 与本地修订应按此区分。

## 已完成

- 沿用上一轮四个默认题库、自建题库、题目包归属及删除功能。
- 设置中只保留一组“立即保存到本机 / 导出完整 JSON / 导入完整 JSON”。备份与设备接力复用原 backupVersion 1，不再有两个导出、接收区域。
- “立即保存”和原顶部“保存进度”共用完整保存屏障：提交当前资料与答题草稿，等待已接受的首页、资源、阅读/日历写入。任一失败不提示全部成功；无内容变化时不写 current。原 500ms 内容保存防抖、导航不保存规则保持。
- 完整 JSON 继续覆盖全部个人资料、文件、用户设置、阅读/日历、答题草稿及成绩、错题收藏、自建题库及自定义资源。接收前校验并确认，失败事务保留旧资料；导入是整份替换，不合并两端编辑。
- 保留本机最后保存、最近导入和来源文件时间。设备接力说明折叠收纳。备份失败时仍能尝试导出当前可读取的内存资料和答案草稿，提示用户妥善保存文件。
- HTML 改名为“导出可编辑 HTML 副本”，移入高级工具；说明独立空间、不会与原 PWA 持续同步，也不作为可安装 PWA 更新。
- 三个配色均有选中题库的勾选标记。黑橙主题额外使用暖橙边框、侧边线和暖色底，修复玻璃通用样式覆盖选中态的问题。
- 修复灯泡：44px 按钮与 24px SVG 居中，清除通用 `button svg` 的右边距及原按钮内边距造成的偏移。
- 设置、备份和每日一句页不再回退为“信息栏”分组，进入设置不会将该菜单自行展开。
- 数据看板拆为“资料与成绩”及“练习数据”。保留原资料分类、考试成绩与排名图；练习页面保留整组成绩、加权正确率、错题收藏、用时、分板块过滤和最近练习。临时过滤与菜单展开不保存。
- 信息栏新增“考试信息”：周一到周日的月历、月份跳转、上一月/下一月/今天、选定日期详情。同校同日多个阶段算一所院校，笔试/面试分别展示，可带时间、地点和备注。
- 考试日程资源为空，不引入旧静态说明中的日期或未经核实日程。已预留完整 JSON 导入、校验、离线保存、用户备份及主动在线更新；设置提供空 JSON 样例与 AI 格式说明。

## 存储与兼容

继续使用 `qicheng-v4` / IndexedDB version 1 / records，不改数据库结构。自动保存的 current 指纹及导航排除规则未修改。

考试日程使用 `resource:official:schedule:exam-schedule` 和 `resource:custom:schedule:exam-schedule`。使用类型前缀，避免与旧用户可能已经建立的 `exam-schedule` 题目包 ID 冲突。用户导入日程优先于官方日程，并进入完整备份；官方日程不进入日常 JSON。旧版 Backup / Transfer 文件继续可导入。

首次缺少官方日程记录时，从随程序打包的空 JSON 初始化，不自动获取远程 manifest。预缓存共 118 项，包含新增模块与空资源。Service Worker 的小批下载、失败保留旧版及用户主动应用更新流程继续有效。

## 验证结果

- 186 项自动化检查通过：包含旧资料与导出功能回归、题库管理、统一保存及失败重试、资源事务失败保护、日程格式与阶段校验、去重计数、备份恢复及旧题库 ID 兼容。
- 12 项实际浏览器验收通过：设置菜单、手动保存与无重复写入、三主题选中态/图标对齐、两个看板、空月历、日程 JSON 导入/拒绝、完整 JSON 导出、另一移动端环境离线恢复、非法备份保护、HTML 独立离线编辑、390px 三主题布局、冷启动及安装资格。
- 从已发布 5.0 快照在同地址真实更新到本地修订，原资料、旧导入题目、错题和收藏保留；更新后断网重开可用（2 项通过）。
- 控制台无未捕获运行异常；语法、模块、资源路径及 118 项缓存检查通过。
- 未在安卓/iOS 真机运行。安卓“未知错误”的上一轮可靠性改进仍需用户设备复测，不能仅凭桌面移动端视口模拟断言已根治。

实际日程数据仍为 0 项。虚拟院校与日期只在隔离测试环境中用于验证，没有写入应用资源 JSON。

证据：`docs/LOCAL_INTEGRATION_BROWSER_EVIDENCE.json`、`docs/LOCAL_INTEGRATION_UNIT_EVIDENCE.txt`、`docs/LOCAL_INTEGRATION_UPGRADE_EVIDENCE.json`。

## 主要文件

- js/transfer.js、js/backup.js、js/modules/settings.js：统一入口、保存屏障及引导。
- js/app.js、js/constants.js、js/modules/dashboard.js：菜单与路由、两个数据看板。
- js/modules/quiz.js、css/workflow.css：选中提示、灯泡和响应式日历。
- js/modules/exam-calendar.js、js/resources.js、data/resources/exam-schedule.json：考试日历、资源格式及持久化。
- js/events.js、scripts/package.mjs、scripts/prepare-resources.mjs、data/resource-examples.json：绑定、打包、在线清单与样例。
- assets/editable-template.html、service-worker.js、data/static-resources.json：重新生成的离线资源。
