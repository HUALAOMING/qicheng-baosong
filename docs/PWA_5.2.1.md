# 5.2.1 程序缓存与更新约定

本工程仅作本地交付。没有上传 GitHub、创建 Release 或部署 Pages。

## 实际审查与改动

5.2.0 已有按安装路径隔离的静态缓存、四个一组下载、等待用户保存再更新、安卓 UnknownError 重试以及显式资源更新绕过缓存；这些合理部分保留。审查发现：安装未校验资源内容一致性；激活时直接删除旧缓存并 claim 所有窗口；等待 worker 收到单条消息即可 skipWaiting，其他编辑窗口没有确认；已缓存版本缺少模块时会直接取可能属于新版本的网络代码；下载中没有真实资源计数。

5.2.1 将 worker 源模板放入 `scripts/service-worker-template.mjs`，由 `npm run package` 生成 `service-worker.js`。静态资源清单包含全部程序模块、按需加载的导出库、字体、地图、JSON worker 以及独立 HTML 模板。个人记录从未写入 Cache Storage。

## 三种版本彼此独立

- 应用版本读取 `package.json`，当前为 5.2.1。
- 资源修订号由所有静态资源路径、SHA-256、worker 模板及 package.json 共同计算；不同程序内容或 worker 生命周期逻辑得到不同缓存名，防止安装失败误删活动版本缓存。
- 数据库结构和备份协议由数据层分别管理，worker 不读取或升级 IndexedDB。

`data/static-resources.json` 记录资源清单与逐文件校验和。任一程序文件修改后必须重新运行 `npm run package`。`npm run check` 会识别未重新打包的文件，防止交付陈旧的资源哈希。文档和测试修改不改变程序缓存。

## 下载和失败处理

安装每次并行下载最多四个资源，每个失败资源重试一次；每个响应必须 HTTP 成功并通过 SHA-256 后才写入新缓存。网络中断、404、空间不足、文件内容与版本清单不符均导致安装失败，删除未完成的新缓存，保留当前完整版本。全部必要资源完成后写入就绪标记，等待用户决定应用。

worker 通过 `UPDATE_CACHE_PROGRESS` 发送已实际完成校验和缓存的资源数量，不估算下载字节数，不用定时器虚构百分比。失败发出 `UPDATE_CACHE_FAILED`。全资源准备完成发出 `UPDATE_CACHE_READY`，它只代表资源准备阶段完成；程序版本切换是独立任务。

## 编辑保护与多窗口协调

5.2.1 更新按钮先等待本窗口所有数据提交，再要求等待 worker 发起协议 2：

1. worker 枚举当前安装 scope 的全部窗口，并要求每个窗口确认。
2. 正在编辑输入框、存在未提交内容、保存失败或正在执行任务的其他窗口拒绝更新。没有响应的旧窗口在 15 秒后超时，继续使用当前版本。
3. 可更新窗口临时锁定交互，等待自己所有保存链完成后确认；保存期间发生新的编辑则拒绝。
4. 全窗口确认后再次检查窗口列表，若新增或关闭窗口，取消并解除锁定；完整资源就绪标记存在后才 skipWaiting。
5. 只有已参与并确认本次切换的窗口会在 controllerchange 后刷新。未确认窗口不强制刷新。
6. 用 sessionStorage 保存待验证的资源修订号。新程序启动完成、本机数据库已读入、控制器回复的修订号和应用版本一致后，显示切换完成。

协调或切换超时会显示失败并恢复交互，不长期停留在虚假完成状态。

5.2.0 不支持新协调协议。兼容其原有保存按钮时，仅当该安装路径只有一个窗口才允许切换；请先关闭其他 5.2.0 启程窗口，再在保留窗口保存并更新。对旧程序尚未具备的进度界面不能追溯添加。

## 缓存读取与路径

所有 URL 相对 `self.registration.scope`，可在 `/qicheng-baosong/` 等 GitHub Pages 项目路径运行。导航和静态模块始终从当前 worker 对应的完整缓存读取。已知版本资源缺失时返回明确 503，而不混入另一个网络版本的 JS/CSS。

激活不调用 clients.claim，以免抢占尚未受控制、已经加载其他版本资源的页面。新安装页面下一次打开或导航后受到控制；完成预缓存后可正常离线重开。保留紧邻的一个完整旧缓存用于中断恢复，更老的本应用缓存才清理；不修改其他应用缓存或任何用户数据库。显式的题库资源更新使用 no-store，仍从网络获取并交由题库数据层校验。

独立 HTML 副本依旧不注册 worker；程序、依赖、静态数据和资源被嵌入一个文件。JSON worker 在 file 协议下使用主线程回退。

## 验证

- `node --experimental-vm-modules --test tests/pwa-update.test.mjs tests/service-worker.test.mjs`：17 项检查覆盖安卓注册重试、离线检查、等待提交、实际计数、下载并发、完整性校验、失败保留旧版、缓存缺失、防止编辑窗口被更新、窗口变化竞态。
- `node tests/pwa521-browser.mjs`：本地 Edge 实际安装、5.2.0 升级、离线重开、子路径、编辑窗口拒绝、干净窗口协同刷新、损坏版本安装失败；结果见 `tests/generated/pwa521/summary.json`。本次 Windows Edge 156.0.4314.42 的六项实际生命周期检查均通过，无页面错误或 HTTP 404。运行结果以实际生成报告为准。
- Android Edge 真机、系统安装 PWA 外壳和设备卸载行为未在本次桌面自动化中验证。

## 查阅的官方资料

[Chrome 的 Service Worker 生命周期说明](https://developer.chrome.com/docs/workbox/service-worker-lifecycle)、[skipWaiting 行为](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting)、[controllerchange 事件](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controllerchange_event)。多窗口保存协议是本工程根据这些生命周期行为实施的保护设计。
