# 原有资源

本工程继续使用上传 3.1 版内嵌的 docx、pdf-lib、JSZip、fontkit、PptxGenJS 及中文/拉丁字体。导出库仅按文件拆出，保留原分发文件及其许可说明；本次没有添加或下载新的运行时依赖。

49 张院校图片与来源字段保留在 `data/universities.json`，图片二进制拆至 `assets/images/`。省级边界来源仍保留在 `data/china-map.json`：

https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json

所有静态内容离线保存。来源、百科、官方招生等外部链接由用户主动打开。

开发依据：

- https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction
- https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
