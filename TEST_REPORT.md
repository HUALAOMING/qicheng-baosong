# 启程 5.4.0 验证报告

验证日期：2026-11-07。基线：已发布的 5.3.2，提交 18ab923490107e3fb88428ddc73afc1cd236fc2e。所有浏览器资料均在独立测试配置中创建，不访问用户现有浏览器数据。

## 结果

- `npm run package`、`npm run check` 通过：独立离线文件、静态资源版本清单和 Service Worker 同步，源码语法和缓存路径校验成功。
- `npm test`：343 项通过，0 失败。覆盖旧数据/备份兼容、原子事务回滚、导入校验、跨窗口冲突、文件操作、题库合并、仅展示成绩及简历克隆。
- `tests/migration54-browser.mjs`：旧版真实运行并保存后切换至新版，同地址保留个人资料、成绩、简历、关联图片、自建典籍、独立学习记录及约 1.3 MB 附件；原件逐字节一致。旧完整 JSON 在新版恢复成功。输入、焦点变化、内部导航零工作区写入；手动保存不生成文件，刷新保留修改。
- `tests/files54-browser.mjs`：最终简历上传、文件夹创建与重命名、文件重命名及关联、批量移动、ZIP 默认无选择、文件夹选择后排除单文件；在新浏览器中导入选择性 ZIP，原件字节一致。删除文件夹保留文件，重载保留结果，桌面/平板/手机视口无横向溢出。
- `tests/resume-scores54-browser.mjs`：5 项流程通过。两个录入页面、两种成绩、看板隔离、现有版本克隆及独立编辑、样式/自定义模块保留、选择框文字可见和保存重载。
- `tests/modular54-browser.mjs`：4 组流程通过。导出默认无选择；512 KB 随机二进制附件与背景图片分离，资料 JSON 10,875 B、学习 JSON 220,972 B、附件 ZIP 526,300 B。批量恢复原件 SHA-256 相同；保留自我介绍、学习笔记、收藏及接收端原有题库。附件缺失在确认前拒绝；模拟本机保存配额失败后，仍能导出内存中的修改作救援备份。
- `tests/pwa54-browser.mjs`：6 项实际 Service Worker 生命周期检查通过。5.3.2 → 5.4.0、GitHub Pages 子路径离线重启、编辑中的其他窗口阻止更新、多窗口确认后共同更新、资源损坏拒绝安装且旧版仍可离线使用。
- `tests/storage521-browser.mjs`：3 项通过。4 MB 原件完整；单字段保存只修改资料记录，实测约 1.6 ms（单次观察，非性能保证）；过期窗口写入被拒绝，刷新后文件完整。
- `tests/export53-browser.mjs`：7 项导出回归通过，包含四套可编辑 DOCX、PDF/PPTX/HTML/Markdown/PNG、照片分离、分页与平板布局。
- `tests/offline53-browser.mjs`：4 项通过。生成携带资料的独立 HTML 后，断网以 file:// 打开、编辑保存、题目笔记/搜索及原生 DOCX 生成，无 HTTP 请求。

## 复现和证据

运行 `npm run test:5.4` 和 `npm run test:browser:5.4`；附加回归脚本如上。浏览器脚本依赖本机 Edge/Playwright，迁移脚本使用固定旧版提交；需要该 Git 提交可访问。结构化结果汇总见 [validation-5.4.json](docs/validation-5.4.json)。原始日志与截图位于未跟踪的 `tests/generated/`。

## 边界

平板和手机为 Chromium 视口/触控模拟，尚未实体 iPad/Safari 验证。Word/PPTX 检查原生文件结构和浏览器生成，未在 Microsoft Office/WPS 实际打开。附件 ZIP 单批上限 512 MB；每批可包含资料 JSON、学习 JSON和一份附件 ZIP，其他附件包可继续分次导入。旧完整 JSON 单独恢复并明确提示完整替换。部署状态以发布记录为准。
