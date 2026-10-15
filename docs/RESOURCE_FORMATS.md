# 题库与每日一句资源格式

资源与个人资料、练习记录分开存放。应用启动只读取随应用打包的本地资源和已保存的资源，不访问更新清单。用户手动点击更新时才请求清单；导入本地 JSON 完全离线可用。

## 题库 JSON（schemaVersion 1）

```json
{
  "schemaVersion": 1,
  "bank": {
    "id": "my-english-practice",
    "name": "我的英语练习",
    "subject": "english",
    "section": "grammar",
    "version": "1.0.0"
  },
  "questions": []
}
```

`subject` 与 `section` 对应关系：

| subject | section |
| --- | --- |
| english | grammar、vocabulary |
| chinese | ancient-culture、chinese-usage |

题目必需字段为 `id`、`type`、`question`、`answer`、`explanation`。单选题的 `type` 为 `single-choice`，额外必需 `options`，格式为 `[{"id":"A","text":"选项内容"},{"id":"B","text":"选项内容"}]`；`answer` 为其中一个选项的 ID。判断题的 `type` 为 `true-false`，`answer` 必须为 JSON 布尔值 `true` 或 `false`，不设 `options`。

`explanation` 可以为空字符串。`bank.source`、题目 `source` 为可选的来源说明。题干、选项、解析先转义，仅保留原正式题库使用的无属性 <i>/<u> 强调标记；其他 HTML 不执行。每个题库最多 20000 题；单选题有 2–12 个选项；空题库表示栏目待补充，不能进入练习。

ID 长 1–120 字符，以英文字母或数字开头，其余可用英文字母、数字、点、下划线、连字符。一个题库内题目 ID 唯一；一题内选项 ID 唯一。`daily-quotes` 保留给句子。ID 是学习记录的关联依据，发布更新时不能把旧 ID 分配给另一道题。不得用删除后重新编号的方式更新题库。

版本遵循 SemVer，如 `1.0.0`、`1.10.0`、`2.0.0-rc.1`，按数字比较，支持预发布和构建标记。升级既有官方题库时不允许更换科目、章节或题库 ID。

## 每日一句 JSON

```json
{
  "schemaVersion": 1,
  "version": "1.0.0",
  "quotes": []
}
```

每条句子包含 `id`、`text`、`source`，如自行整理的句子及其准确出处。`text` 非空；`source` 可以为空字符串；ID 唯一。最多 20000 条。发布包允许空数组，不填充未经核实的句子。

## 手动更新清单

`data/resources/manifest.json` 格式为 `{ "schemaVersion": 1, "resources": [...] }`。每项字段：

| 字段 | 含义 |
| --- | --- |
| id | 题库的 `bank.id`；句子固定 `daily-quotes` |
| type | `quiz-bank` 或 `quotes` |
| version | 与下载 JSON 内版本完全一致 |
| url | 相对于清单 URL 的资源路径，或 HTTPS URL |
| sha256 | 实际 JSON 文件原始字节的 64 位十六进制 SHA-256 |

只能使用 HTTPS URL；本机同源 localhost、127.0.0.1、IPv6 回环测试可用 HTTP。拒绝凭证、片段和重定向。资源与清单请求均采用 `cache: "no-store"`；下载有 20 秒超时和 12 MB 大小上限。跨域服务器须允许 CORS。清单最多 100 项；不降级、不重复下载相同版本。

所有较新资源下载、哈希、JSON、版本和 ID 校验全部完成后，在一个 IndexedDB 事务中写入。任何失败都保留全部旧资源和原内存内容。更新不会清空个人记录。SHA-256 用于完整性检查，不构成发布者签名。

资源维护者应先更新 JSON 与版本，再按文件原始字节重新生成清单的 SHA-256，最后运行项目打包和校验。UTF-8 编码或换行改变也必须重新计算哈希。

## 存储、导入和备份

继续使用 `qicheng-v4`、版本 1、`records` object store。资源记录键为 `resource:official:{id}` 或 `resource:custom:{id}`；记录内容为规范 JSON 加 `origin` 字段。首次运行仅为缺失的官方记录读取应用内本地资源，并原子写入数据库。后续启动直接使用已安装版本；应用包带有较新种子也不会自动升级，升级必须手动检查更新。自定义句子优先显示，官方句子更新不覆盖自定义句子。

导入题库不能覆盖官方题库。相同自定义题库 ID 的文件会在校验成功后替换该题库，科目和章节必须保持不变；更新时保持题目 ID，已有错题和收藏继续通过稳定 ID 关联。导入句子替换当前自定义句子。导入与更新排队执行；只有数据库提交成功后才更新界面使用的内存，校验或写入失败时保留旧资源。

普通个人备份包含自定义资源，不包含官方资源。备份恢复应调用 `validateResourceRecords(records)` 检查自定义资源，再在恢复提交后 `reloadResources()`。便携副本可用 `validateResourceRecords(records, {allowOfficial:true})` 检查完整资源快照。恢复或清空前需等待 `waitForResourceWrites()`，并在操作期间禁用新的资源写操作。

单文件离线副本通过 `globalThis.QICHENG_RESOURCE_SEEDS = {banks:[...],quotes:{...}}` 提供内置资源，不执行网络请求；首次初始化后 `listQuizBanks()`、`getQuotesResource()`、`getResourceVersions()` 均同步读取内存。

`getResourceVersions()` 返回 `{banks:[{id,name,subject,section,version,origin,questionCount}],quotes:{id:"daily-quotes",version,origin,count}}`。`listQuizBanks()` 返回 `{schemaVersion,bank,questions,origin}` 数组；`getQuotesResource()` 返回 `{schemaVersion,version,quotes,origin}`。`updateResources()` 返回 `{updated:[资源ID],versions:版本信息}`。
