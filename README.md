# 启程 4.0.0-beta.1

基于上传的 `qicheng-v3.1-offline.html`。保留原有业务、配色、地图和全部导出，改为模块化原生 Web App、IndexedDB 自动保存与可安装 PWA。运行时不需要 Node、构建服务、账号或后端。

## 立即运行

1. 解压后进入 `qicheng` 目录。
2. 安装了 Python 3 的电脑，在该目录运行：

   ```sh
   python -m http.server 8000 --bind 127.0.0.1
   ```

3. 浏览器打开 `http://localhost:8000/index.html`。
4. 在设置中等待“离线资源已就绪”，然后点击“安装启程”。安装后可关闭窗口，再从应用图标打开。

不能通过双击 `index.html` 启用 PWA。iPhone/iPad 请访问部署后的 **HTTPS 静态地址**，在 Safari 点“分享 → 添加到主屏幕”。普通局域网 HTTP 地址不能启用 Service Worker；localhost 例外只适用于访问该地址的本机。部署时上传整个目录中的运行文件，保留相对路径；无需服务器端代码。本次交付是独立源码工程，未发布生产网址。

## 数据与备份

- 所有业务数据和设置统一保存在 IndexedDB 的 `records` 存储区；当前工作台为 `current` 记录。没有第二份 localStorage 数据副本。
- 停止输入约 500 ms 自动保存。离开前检查“已保存”；失败会显示提示，仍可尝试导出当前内存中的备份。
- 设置 → 数据与备份：**立即备份 / 从备份恢复 / 清除本地数据**。清除需要两次确认。
- JSON 包含个人信息、全部录入记录、编辑草稿、学习笔记、收藏、图片原文件、附件、文档版本、导出历史与设置；静态院校和地图等程序资源不另行打包。
- 恢复先校验并显示时间、版本、内容数量。确认后，单个数据库事务整体替换；写入失败会回滚。恢复期间暂停自动保存，保护当前未保存内容。
- JSON 是常规完整备份。原有个人资料 ZIP、备份文本和可继续编辑的独立 HTML 副本也保留。

`Qicheng_Backup_YYYY-MM-DD.json` 的外层格式：

```json
{
  "app": "Qicheng",
  "backupVersion": 1,
  "appVersion": "4.0.0-beta.1",
  "createdAt": "2026-10-12T13:00:00.000Z",
  "data": { "current": "完整工作台对象；此处仅示意" }
}
```

当前只有一个备份格式。旧版裸 JSON 不作为 PWA 备份恢复，未加入历史数据迁移。界面语言、文档语言与排版依旧分别设置。

## 源码位置

| 位置 | 负责内容 |
|---|---|
| `index.html` / `js/bootstrap.js` | 静态入口、初始化失败时的导出与清除入口 |
| `js/app.js` / `js/events.js` | 导航、工作台外壳和绑定协调；各模块拥有自己的操作绑定 |
| `js/storage.js` / `js/autosave.js` / `js/backup.js` | 数据库、自动保存、JSON 与独立 HTML 备份恢复 |
| `js/model.js` / `js/state.js` / `js/constants.js` | 数据默认值、当前内存状态和表单定义 |
| `js/modules/` | 资料录入、记录、整理、图片、资料中心、看板、简历、导出、Markdown、院校、地图、设置 |
| `js/utils/` | 通用小工具和备份字段校验 |
| `css/` | 通用控件、简历、布局、主题与 PWA 样式；保留原样式声明顺序 |
| `data/` / `assets/` | 内置资料、院校图片、字体、图标及原有导出库 |

## 维护与验证

维护工具只依赖 Node 内置模块，测试已在 Node 24 运行；无需 `npm install`。

```sh
npm run package   # 修改运行文件后刷新完整离线模板及 Service Worker 缓存版本
npm run check
npm test
```

发布更新前必须执行 `npm run package`，然后一起上传新的全部运行文件，包括 `service-worker.js`。新缓存准备完成后，设置会出现“保存并更新”；关闭所有旧窗口后再次启动也可启用新版本。新增 JS 模块时，打包脚本会检查其是否被纳入独立 HTML 副本。

完整审查见 [功能审查](docs/FEATURE_AUDIT.md)，验证范围和实机步骤见 [测试报告](TEST_REPORT.md)，变更见 [CHANGELOG](CHANGELOG.md)。

## 已知限制

真实浏览器、安装后的 PWA 和 iPhone/iPad 实机验收尚未完成；自动化测试使用 DOM、IndexedDB、Cache API 的测试替身，不能替代这些验收。浏览器清除网站数据、隐私模式和存储空间不足可能影响本机保存，请保留下载的 JSON。大量原图、附件及完整导出文档会增加内存和备份体积；初次离线缓存约 23.7 MB，其中包括为保留原功能而提供的完整 HTML 程序模板。外部招生网站与百科链接仍需要网络。同一地址的多个窗口同时编辑时，以最后成功保存的内容为准。
