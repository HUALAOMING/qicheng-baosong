# 启程5.2.1题库架构专项交付

本轮直接在最新 qicheng-5.2.1-optimized 工程完善底层，保留既有文件中心按需打开、导入加速等成果。修改前快照为相邻 qicheng-5.2.1-bank-baseline，未覆盖其他版本、未修改 sources/，未上传GitHub、发布Release或部署。没有开发5.3.0任何新页面、编辑表单、批注UI或统计UI。

## 一、代码核查结论

5.2.0 的 resource:* 单条信封含完整 questions 数组。最新5.2.1实际已经拆为 `@521:bank:meta:<origin>:<packId>` 和 `@521:bank:q:<origin>:<packId>/<qid>`。bank-store521.js 的 bankDelta521 按ID计算变化；storage.js 的 bankDelta 严格事务只提交变化行。quiz.js 的 loadPracticeSample 按ID读取所需题目；首页只加载概要。并非仍在数据库里整包存储。

但此前存在实际缺口：JSON补丁为验证一题仍克隆、校验、比较整库；没有公开的逐题CRUD与分页查询接口；无手动来源标记及独立批注协议。完整再导入按传入全集计算删除，可能删除手动新增题、覆盖本地解析；在线资源更新同样缺少本地修改保护。此次针对这些缺口补齐，复用原校验、永久ID、题库修订号、任务系统、增量提交与备份协议。

## 二、模型对比与选择

| 数据 | 修改前 | 修改后 |
| --- | --- | --- |
| 题库/单题 | 独立元数据和单题行 | 保留，不新增数据库或ORM |
| 题目所属 | 源包ID、展示题库目录与assignments | 保留；接口用源包ID定位，不用展示名称 |
| 单题操作 | 通用底层get和完整JSON补丁 | 公开逐题CRUD；只验证一题并写该题、头部修订与来源记录 |
| 本地改动 | 无 | question:edit:<origin>:<packId>/<qid>：schemaVersion1、kind、base、baseVersion、updatedAt |
| 个人批注 | 无稳定协议 | question:note:<packId>/<qid>：独立文本与修订，不占用标准解析 |
| 历史/错题/收藏/草稿 | quiz:* 独立，已交卷题目有快照 | 不改模型与ID，继续保留 |

继续使用同一个 records 对象仓库。字符串主键是有序索引；按前缀查找和精确键读取足够支撑当前规模。数据库结构仍为2，公开题库JSON仍为schemaVersion1、备份仍为2；新用户记录schemaVersion为1。没有破坏式迁移：旧库没有本地修改标记时沿用现有内容，无法追溯推断以前哪些解析曾经被手动修改。

## 三、身份、归属和学习数据

永久身份为源题包ID+题目ID；修改题干、解析、答案不会改变ID。不同包相同qid可独立定位。新题默认 crypto.randomUUID()，拒绝覆盖已存在或被保留的ID。手动题包按展示题库ID生成确定性的SHA-256派生包ID，并进入已有assignments；不会把题目直接写进没有来源包的展示分类。

自定义练习会把可显示题ID包装为JSON数组字符串，同时携带 learningBankId、learningQuestionId。未来编辑、批注和错题调用必须使用这两个源身份；官方题直接用源包ID和题ID。可用 listPracticeBankSummaries().sourceBankIds 枚举展示题库来源，再逐包分页。

历史快照与作答结果不回算；答案修改只影响后续练习。删除单题移除活动题行和头部ID，保留deleted来源记录、历史、错题、收藏与批注。readQuestion返回question:null和local信息；getQuestionLearning在题目/题包移除后仍可读取用户记录，不必依赖活动题存在。

## 四、更新与冲突

- 手动新增与appendQuestions追加的新题标为created，普通完整JSON缺少这些题也保留。
- 修改与本地JSON补丁记录原始base快照。旧JSON内容等于base时保留本地修改；内容与当前有效题相同则正常通过。上游与本地分别发生变化、或上游删除本地修改题时，抛出 QuestionUpdateConflict。
- error.code=QUESTION_UPDATE_CONFLICT，error.conflicts包含bankId、questionId、kind、base、local、incoming；此时预检未落盘，在线多资源更新也整批拒绝，不部分覆盖。
- 删除标记阻止旧JSON复活同一道题；上游已改动被删题时交给冲突处理。
- resetQuestionLocalChange 是明确的放弃本地修改接口，恢复base或移除本地新题，再移除来源标记；保留批注与历史。5.3.0应先展示冲突并备份，由用户决定调用；本轮不提供自动冲突解决UI。
- 每个预检绑定读取内容时的题库修订。逐题修改/删除必须传expectedRevision，事务内CAS；快速提交旧版本会被拒绝。批注同样必须带读取时的noteRevision。线上更新使用内容快照绑定的修订，额外读取不能推进旧计划的基准。

## 五、5.3.0可直接调用的接口

从 js/resources.js 导入下列接口；它们是业务数据接口，不要求window调试API。

| 接口 | 参数/结果要点 |
| --- | --- |
| readQuestion(packId,qid) | 返回question、local、origin、revision、deleted；不加载整库题干 |
| createQuestion(packId,question,{expectedRevision?}) | ID可省略；返回生成的questionId和新revision |
| updateQuestion(packId,qid,fields,{expectedRevision}) | 仅允许题干/type/options/answer/explanation/source；不变更ID |
| deleteQuestion(packId,qid,{expectedRevision}) | 原子删除活动行、保留删除标记 |
| queryQuestions(packId,{offset,limit,keyword,type,expectedRevision}) | 默认50，最多200；items、nextOffset、revision、total；total为活动题总数而非筛选命中数 |
| appendQuestions(packId,questions) | 原子追加/增量合并；新题标记本地新增，未指定题不删除 |
| prepareResourceImport / applyPreparedResourceImport | 完整JSON、append模式、已有批量字段补丁；预检后提交 |
| exportQuestionBank(packId) | 返回当前有效题目的标准完整JSON对象；需要文本时JSON.stringify |
| getQuestionLearning(packId,qid) | 返回mark、note及noteRevision，适用于删除后记录 |
| saveQuestionNote(packId,qid,text,{expectedRevision}) | 最多64000字符，独立保存，返回note和revision |
| ensureManualQuestionPack(practiceBankId) | 为展示题库建立/复用手动来源包，返回packId |
| resetQuestionLocalChange(packId,qid,{expectedRevision}) | 显式恢复基线/放弃本地新题，不删除用户批注 |

示例：

```js
const row = await readQuestion(packId, questionId);
await updateQuestion(packId, questionId,
  { explanation: '新的解析' }, { expectedRevision: row.revision });
const learning = await getQuestionLearning(packId, questionId);
await saveQuestionNote(packId, questionId, '我的思路',
  { expectedRevision: learning.noteRevision });
```

分页下一页必须沿用上页revision作为expectedRevision，题库变化时重新从头查询。关键词查询分批扫描题干、解析、来源、选项；不预先加载整库，也不建立未经证明有收益的全文索引。批量字段变更继续用原有JSON patch协议，一次事务提交。

## 六、性能实测

Windows实际Edge，无头、本地HTTP；修改前快照与本轮各3个独立上下文，每轮5000道判断题。单题读写每轮各10次；表为中位数，单位ms。新readQuestion还读取来源状态并校验一致性，旧读取只是底层单行get；加载比较也明确是不同工作量，不将它当作相同操作倍数。

| 操作 | 修改前 | 本轮 |
| --- | ---: | ---: |
| 5000题完整导入 | 236.30 | 210.60 |
| 同会话重复导入 | 48.40 | 45.40 |
| JSON单题补丁（整库预检） | 58.60 | 75.20 |
| 单题读取（新接口额外返回本地状态和修订） | 1.90 | 2.70 |
| 单题修改：旧JSON补丁 / 新逐题接口 | 51.85 | 4.15 |
| 旧整库缓存加载 / 新读取50题（不同工作量） | 19.40 | 4.40 |
| 从数据库完整读取5000题（相同路径） | 91.80 | 98.70 |

单题新接口不克隆/校验整库正文；仍需读取和写入题库头部的ID列表，成本随ID数量增长。JSON补丁为了完整预检仍校验合并后的整库，不能宣称这条兼容路径已变成常数时间。完整读取复用同一实现，计时波动不等于读取路径被重构；首次导入仍保留上轮批量写入路径，单轮波动不做普遍性能承诺；本轮重点是逐题操作和本地数据保护。原始数据 QUESTION_PERFORMANCE_RAW.json，复跑 `node tests/question-performance-browser.mjs`，需要相邻基线目录及本机Edge/Playwright路径。此脚本每轮还实际切断网络、修改并读回原题。

## 七、测试与交付文件

专项 question-architecture.test.mjs 覆盖5000题导入、逐题新增修改、只写指定题、追加与重复去重、旧JSON保护、本地/上游冲突、答案改变、删除后批注/历史/收藏、失败回滚、快速过期提交、完整备份清空恢复、元数据校验、跨包同qid、手动包归属、官方在线冲突、显式重置。最终完整回归271/271通过（无跳过），日志BANK_ARCHITECTURE_FINAL_TESTS.txt；实际Windows Edge运行时12/12、PWA升级离线6/6通过，页面异常与404为0。新增专项9/9通过；性能浏览器脚本还在3轮中分别验证真实断网逐题修改。

主要修改：js/resources.js（公开业务接口、来源校验、导入/在线保护），js/storage.js（批量只读readMany、扩展原题库原子提交以包含来源记录）。bank-store521.js与quiz.js经核查无需重构；永久ID映射、学习快照、原有迁移及懒加载保留。tests/banks521.test.mjs只增加补丁来源记录的精确写入断言，新增专项与性能脚本。没有新增依赖、对象仓库或新功能UI。

新增question:*记录以公开用户键进入现有完整备份，恢复前由统一资源校验入口检查结构。删除题的来源/批注允许没有活动题，避免恢复时误删历史关联。旧备份无这些记录时正常恢复；旧整包题库仍由原有可回滚事务迁移为逐题行。

## 八、限制与后续建议

1. 题库元数据仍保存全量ID列表，单题修改会重写这份轻量列表/元数据，尚非完全O(1)。若规模扩到十万级，应以实测决定拆分ID页，不提前引入高风险结构。
2. 搜索为有界批次的线性扫描；冷题库全量关键词搜索仍O(N)。当前没有复杂排名、分词或全文索引，未来搜索UI需按需取消与节流。
3. 对旧数据无法推断既往手动修改；本轮部署后的CRUD、追加与JSON补丁才有来源保护。上轮导出已被覆盖的内容不能凭空恢复。
4. 冲突按整题保守检测，并非逐字段三方自动合并；一个冲突拒绝整个资源提交，错误中提供必要内容供未来UI判断。
5. 一般完整JSON仍为源包快照，会删除未受本地保护的缺失源题；追加请使用append模式。批注无UI、全局搜索无UI、统计无新UI，符合本轮范围。
6. Android Edge真机未验证；桌面Edge断网与PWA回归不能替代系统安装外壳或真实浏览器驱逐测试。
