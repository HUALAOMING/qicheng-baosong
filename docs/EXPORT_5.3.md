# 5.3.0 排版与统一导出交付说明

## 完成内容

排版设计与统一导出使用当前所选简历版本的最终内容：包含版本独立正文、隐藏项、字段标题、局部样式、顺序、自定义模块和素材引用。编辑器的“立即导出”先进入统一导出中心，在核对版本、格式、文件名、检查结果和分页预览后生成文件。导出文件名只作用于此次文件，不改变简历版本名称。

保留 DOCX、PDF、PPTX、HTML、PNG、Markdown 六种既有格式。Markdown 同样使用最终版本解析结果，不再落回全局底稿。PPTX 保留“可编辑文字与图片”和“每页整体图片”两种既有输出选择。

## 文件与接口

| 文件 | 职责与接口 |
| --- | --- |
| `js/export53.js` | 延迟加载的排版和导出中心；`prepareExport53()`、`designPanel53(version)`、`bindDesign53({mutate,rerender,versionId})`、`exportCenterPage53()`、`bindExport53()`、`refreshDesignPreview53(id,target)` |
| `css/export53.css` | 排版控件、模板卡片、预览与导出中心的桌面和平板响应布局 |
| `js/modules/resume.js` | `configureResumeResolver53(fn)` 注册轻量版本解析器；`effectiveExportVersion53(version)` 计算有效外观；`exportRows({resolved})`、`textRows({resolved})` 生成最终导出语义行；`photoChoices53(resolved)` 统一照片选择；`preflightResolved53(resolved)` 复用原导出检查 |
| `js/modules/export.js` | `captureDocument53({versionId})` 捕获独立导出快照；`documentPlan(options)`、`wordBlob(options)` 接收 `{versionId}` 或 `{resolved}`；既有 `pdfBytes(plan)`、`pptBlob(plan)`、`exportHTML3(plan)`、`canvasPages(plan)` 复用同一固定版式；`markdownResolved53(context)`；`exportFile(type,{versionId,filename})` 统一生成、保存记录及下载 |
| `js/resume-model53.js` | 由简历模型模块提供 `resolveResume53(id)`；其模型与迁移见 `RESUME_MODEL_5.3.md` |

`bindDesign53` 优先接受编辑器提供的 `mutate`，因此设计修改沿用版本编辑撤销、重做和保存机制。没有建立第二套导出配置库、数据库或自动保存流程。

### 数据流与保存

1. 从稳定版本 ID 调用 `resolveResume53`，得到 `{workspace,version,modules}`。
2. `captureDocument53` 独立复制导出所需文本和素材元数据；异步读取原件仅填充该快照。
3. 根据快照生成语义行，再生成原生 DOCX 或固定分页计划。正文、照片说明、附件下载入口均遵守所选版本的隐藏状态。
4. 生成新文件前必须成功完成 `saveAllLocal()`；生成记录保存成功后才打开下载入口。保存失败会显示实际错误，不显示虚假的保存成功。

导出不在异步任务期间替换 `ctx.state`、活动版本或全局底稿；原件读取也不把 Base64 回填进共享素材对象。生成过程中用户切换版本，不应使正在生成的文件混入另一版本内容。

## 模板与原有配置

四个模板：`original` 原始版本、`classic` 经典简洁、`modern` 现代专业、`academic` 学术双栏。所有模板使用同一套版本正文和导出引擎，均可输出原生可编辑 DOCX。正文单栏/双栏、Word 字体、字号、行距、页边距和页码可调整。

模板外观保存在 `version.resume53.design.presets[template]`，继续保留旧版版本对象中的有效配置。原始版本按黑白、无装饰方式计算有效样式，隐藏配色、背景图、边框和密度入口；切回其他模板可继续使用此前保存的配色、背景和细节。原始版本不清空正文、独立覆盖或其他模板的保存值。

原有实用入口继续位于排版页面及“更多既有导出配置”：

- 纸色、章节颜色、分割线颜色、纸张背景图、页边装饰、章节线、内容密度。
- Word 是否含照片、黑白输出、照片位置、纸张方向、每行照片数。
- 个人照片显示、大小、正方形/圆形/证件照/自定义宽高比例。
- 导出标题语言、个人陈述语种、文档用途、PPT 可编辑/图片输出。
- 每张照片的版本独立展示选择；未关联条目的补充照片仍可进入照片附录。
- 各模块章节标题与条目标题字号、对齐、加粗、颜色，以及字段名称加粗。

背景图使用既有页面背景机制，保存在对应模板；上传前限制原文件大小，并压缩为合理的图片尺寸。照片展示选择仅修改当前版本，不删除资料原件。

## 封面、目录与分页

封面仅显示用户指定的独立标题，可选启用。目录有独立的章节选择，不因正文选择的每个字段自动生成字段目录；未选入目录的章节仍可正常保留在正文。

PDF、HTML、PNG、PPTX 的分页来自同一 `documentPlan`，目录页码包含封面和实际目录页数。双栏按左栏、右栏、下一页自然流动；显式模块分页会进入下一张物理页。对长文本检查了所有坐标为有限数，且文本位于打印区域内。

DOCX 使用原生分节和 `w:cols` 正文分栏，封面和目录保持单栏。正文为原生 `w:p` 段落与 `w:t` 文本，照片为独立 `w:drawing` 与 `word/media` 素材；无需把整页简历转为图片。选中的目录章节才应用一级标题，Word 目录字段设置为更新状态。页码采用 Word 当前页/总页数字段。

## 实际测试与证据

测试在本地工程实际运行，不使用伪造的性能或兼容性结论。

| 测试 | 结果 | 证据 |
| --- | --- | --- |
| 导出专项与旧版导出回归 | 14 通过，0 失败 | `tests/export53.test.mjs`、`tests/design52.test.mjs`、`tests/export50.test.mjs`；原始输出 `docs/EXPORT_53_UNIT_RAW.txt` |
| Windows 实际 Edge 浏览器 | 7 通过，0 失败；无 pageerror | `tests/export53-browser.mjs`；`docs/evidence53/export53/evidence.json` |
| 四模板纯文字 DOCX | 4 份生成并解包核查 | `docs/evidence53/export53/{original,classic,modern,academic}.docx` |
| 四模板含照片 DOCX | 4 份生成并解包核查 | 同目录 `*-with-photo.docx` |
| 全部六种输出路径 | 版本独立内容、封面、有限页坐标、实际 PDF/PPTX/HTML/Markdown/PNG 生成成功 | 浏览器证据第 6 项；同目录 `version.pdf`、`page-*.png` |
| 桌面/横向平板布局 | 桌面 1440×1000、模拟平板视口 1133×744；无文档横向溢出 | 同目录 `desktop-design.png`、`tablet-design.png` |
| 机器可读汇总 | 8 份 DOCX 的大小、SHA-256、原生段落、文本、图片、分栏、保护状态 | `docs/EXPORT_5.3_EVIDENCE.json` |

执行命令：

```text
node --experimental-vm-modules --test tests/export53.test.mjs tests/design52.test.mjs tests/export50.test.mjs
node tests/export53-browser.mjs
```

浏览器为本机安装的 Microsoft Edge 156.0.4314.50，以独立临时配置运行；浏览器用例仅访问本地静态服务器，阻止 Service Worker 干扰隔离测试。平板结果是浏览器视口模拟，不表示已在实体 iPad 上执行。

专项覆盖：版本正文与底稿隔离、显式空覆盖、四模板原生文本、选择性目录、双栏、长段落分页、原始模板非破坏外观、旧配置入口、背景图跨模板保留、独立照片展示、原生照片、文件名与版本名隔离、导出记录保存、语种选择保留新增字段，以及 HTML 不泄露已隐藏附件原件。

浏览器第一次加入照片用例后，名字因窄栏换行使 HTML 字面字符串断言失败。已改为解析导出 HTML 的实际文本节点并规范空白后校验；最终 7 项重新运行全部通过，没有为通过测试删除真实换行行为。

## 原生 DOCX 编辑性与兼容性边界

本次编辑性结论基于实际生成文件的 OOXML 结构检查：八份文件均包含独立版本正文，没有全局底稿串入；纯文字文件没有整页绘图，照片文件各有一张独立原生图片和正常正文段落；`word/settings.xml` 无 `documentProtection`，无 `altChunk` HTML 嵌入。学术双栏包含原生两栏设置。

本次没有在 Microsoft Word 或 LibreOffice 桌面中执行人工逐字编辑、打印预览和重新保存，因此不声称完成了这两类桌面软件的人工兼容性验收。交付后可用生成的八份样本继续做该验收。不同文字处理软件、字体安装状态、打印机驱动会改变自然分页；Word 目录页码需要软件完成分页并更新域。DOCX 自然分页与固定视觉 PDF 不保证逐像素一致。

PDF/HTML/PNG 使用内置字体的固定版式；Word 使用用户选择的字体名称，接收端缺少该字体时可能发生替换。若要保持最终投递的固定外观，可同时保留 PDF；DOCX 用于继续编辑。PPT 整页图片模式仅在用户明确选择时启用，不影响原生 DOCX。

这里只完成本地代码、测试与文档；未 push、发布 Release 或部署。
