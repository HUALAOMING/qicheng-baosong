# 启程 PWA 5.3.0 · 本地交付

> 2026-10-30：编辑与导出 UI 已重做，包含双列简历卡片、章节拖拽、字段卡片、保存指示灯与顶部展开搜索。详见 [界面修订与截图](docs/UI_5.3.md)。

从最新 `qicheng-5.2.1-optimized` 独立复制开发，保留原工程；未向 GitHub push、发布 Release 或部署 Pages。

本版增加独立多版本简历编辑、四套原生可编辑 Word 模板、统一导出中心、错题与收藏夹、个人笔记、题库管理、历史统计、全局搜索和按设备保存的完整/精简模式。继续使用原有 IndexedDB、增量保存、逐题接口、原件按需读取、完整备份与安全更新协议。

## 本地运行

需要 Node 20 或更新版本，无需安装依赖：

```sh
node scripts/serve.mjs
```

打开 `http://127.0.0.1:4177/`。如该端口已由旧工程使用，在 PowerShell 中设置 `$env:QICHENG_PORT=5273` 后运行，打开 `http://127.0.0.1:5273/`。

PWA 需 localhost 或 HTTPS；不要直接双击 index.html。`assets/editable-template.html` 是空白单文件版，可以双击使用。应用内导出“独立 HTML”可携带个人资料、题库和笔记，已验证断网文件模式下继续编辑、保存与搜索。

地址、端口和浏览器决定本地资料空间。换地址使用完整 JSON 转移资料；相同安装地址升级保留数据库。升级前保存一份外部完整备份。不要用 5.2.1 覆盖已在 5.3 编辑的数据库。

## 验证与说明

- [交付说明与数据流](docs/DELIVERY_5.3.md)
- [简历版本模型与接口](docs/RESUME_MODEL_5.3.md)
- [排版、导出与 Word 可编辑性](docs/EXPORT_5.3.md)
- [学习系统与题库接口复用](docs/LEARNING_5.3.md)
- [实测性能](docs/PERFORMANCE_5.3.md)
- [完整测试报告](TEST_REPORT.md)
- [新增与修改文件](docs/FILES_5.3.md)
- [维护约定](docs/MAINTENANCE_5.3.md)
- [更新日志](CHANGELOG.md)

运行时代码或样式变动后必须运行 `npm run package`，再运行 `npm run check` 和 `npm test`。浏览器测试路径列在测试报告中，脚本使用 Windows Edge 和本机 Playwright，不对外发送测试数据。`docs/` 中 5.2.1 及更早文件属于历史报告，当前交付结论以本版报告为准。
