"""Assemble a local delivery from actual passing evidence. Never publishes."""
from pathlib import Path
from hashlib import sha256
import json, re, shutil, statistics, zipfile
from datetime import datetime, timezone

root = Path(__file__).resolve().parent.parent
baseline = root.parent / 'qicheng-5.2.1-optimized'
output = root.parent / 'deliverables-5.3.0'
output.mkdir(exist_ok=True)
cases = [
 ('ui53','evidence.json',24,'UI修订：PWA与单文件、拖拽、保存灯和内联搜索'),
 ('resume53','summary.json',10,'简历版本、触控、并发与底稿删除'),
 ('export53','evidence.json',7,'四套模板、原生图片和六种格式'),
 ('learning53','evidence.json',8,'题库、错题、笔记、备份救援'),
 ('global53','evidence.json',7,'首页、搜索、模式与设置'),
 ('runtime53','evidence.json',12,'旧功能与真实持久存储回归'),
 ('storage521','evidence.json',3,'Blob原件、无缩略图与增量写入'),
 ('pwa53','summary.json',6,'升级、断网、多窗口与失败资源保护'),
 ('offline53','evidence.json',4,'独立HTML、惰性文档库与离线编辑导出'),
]
rows=[]
for name,filename,count,label in cases:
 source=root/'tests/generated'/name
 evidence=json.loads((source/filename).read_text(encoding='utf-8'))
 assert len(evidence['checks'])==count,(name,'missing checks')
 assert all(c['status']=='PASS' for c in evidence['checks']),name
 assert not evidence.get('errors'),(name,evidence.get('errors'))
 assert not evidence.get('requests404') and not evidence.get('httpErrors'),name
 destination=root/'docs/evidence53'/name
 destination.mkdir(parents=True,exist_ok=True)
 shutil.copy2(source/filename,destination/filename)
 for pattern in ['manager.png','tablet-content.png','desktop-design.png','tablet-design.png','home-mobile.png','settings-desktop.png','review-desktop.png','mobile-notes.png','offline-home.png','desktop-storage.png','android-viewport-storage.png']:
  if (source/pattern).is_file():shutil.copy2(source/pattern,destination/pattern)
 if name=='ui53':
  for p in source.glob('*.png'):
   if 'failure' not in p.name:shutil.copy2(p,destination/p.name)
 if name=='export53':
  for p in list(source.glob('*.docx'))+[source/'version.pdf']+list(source.glob('page-*.png')):
   shutil.copy2(p,destination/p.name)
 rows.append(f'| {label} | {count}/{count} | `{name}/{filename}` |')

export_evidence_path=root/'docs/EXPORT_5.3_EVIDENCE.json'
if export_evidence_path.exists():
 import xml.etree.ElementTree as ET
 export_evidence=json.loads(export_evidence_path.read_text(encoding='utf-8'))
 export_evidence['browser']=json.loads((root/'tests/generated/export53/evidence.json').read_text(encoding='utf-8'))
 ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 for item in export_evidence.get('docx',[]):
  f=root/'tests/generated/export53'/Path(item['file']).name
  with zipfile.ZipFile(f) as doc:
   document=ET.fromstring(doc.read('word/document.xml'))
   all_text=''.join(document.itertext())
   settings=doc.read('word/settings.xml').decode('utf-8')
   item['columnCounts']=[column.get('{'+ns['w']+'}num') for column in document.findall('.//w:cols',ns) if column.get('{'+ns['w']+'}num')]
   item.update(bytes=f.stat().st_size,sha256=sha256(f.read_bytes()).hexdigest(),nativeParagraphs=len(document.findall('.//w:p',ns)),nativeTextRuns=len(document.findall('.//w:t',ns)),drawings=len(document.findall('.//w:drawing',ns)),mediaFiles=[n for n in doc.namelist() if n.startswith('word/media/') and not n.endswith('/')],hasIndependentName='Independent NAME' in all_text,hasIndependentStatement='Independent statement' in all_text,hasMasterText='Master original' in all_text,hasDocumentProtection='documentProtection' in settings,hasAltChunk=bool(document.findall('.//w:altChunk',ns)))
  assert item['hasIndependentName'] and item['hasIndependentStatement'] and not item['hasMasterText'] and not item['hasDocumentProtection'],item['file']
 export_evidence_path.write_text(json.dumps(export_evidence,ensure_ascii=False,indent=2),encoding='utf-8')

ui_evidence=json.loads((root/'tests/generated/ui53/evidence.json').read_text(encoding='utf-8'))
ui_rows=[]
for item in ui_evidence['checks']:
 if 'saving feedback holds' in item['name']:
  detail=item['detail']
  ui_rows.append('| '+item['flavor']+' | '+str(round(detail['savingVisibleMs'],1))+' ms | '+str(detail['noOpPuts'])+' |')
ui_doc=root/'docs/UI_5.3.md'
ui_text=ui_doc.read_text(encoding='utf-8')
ui_table='<!-- SAVE_FEEDBACK_TABLE -->\n| 环境 | 正在保存可见时间 | 无修改保存和视图切换写入次数 |\n| --- | ---: | ---: |\n'+'\n'.join(ui_rows)+'\n<!-- /SAVE_FEEDBACK_TABLE -->'
ui_doc.write_text(re.sub(r'(?s)<!-- SAVE_FEEDBACK_TABLE -->.*?<!-- /SAVE_FEEDBACK_TABLE -->',lambda _:ui_table,ui_text),encoding='utf-8')

raw=(root/'docs/ALL_53_FINAL.txt').read_text(encoding='utf-8-sig')
unit=int(re.search(r'ℹ pass (\d+)',raw).group(1))
assert re.search(r'ℹ fail 0\b',raw) and re.search(r'ℹ skipped 0\b',raw)
manifest=json.loads((root/'data/static-resources.json').read_text(encoding='utf-8'))
assert manifest['appVersion']=='5.3.0'
for name,digest in manifest['hashes'].items():assert sha256((root/name).read_bytes()).hexdigest()==digest,name
(root/'docs/BUILD_5.3.json').write_text(json.dumps({'appVersion':manifest['appVersion'],'revision':manifest['revision'],'verifiedAt':datetime.now(timezone.utc).isoformat(),'resources':len(manifest['assets']),'allResourceHashesVerified':True},indent=2),encoding='utf-8')
for filename in ['docs/RESUME_MODEL_5.3.md','docs/EXPORT_5.3.md','docs/LEARNING_5.3.md','docs/EXPORT_5.3_EVIDENCE.json']:
 p=root/filename
 text=p.read_text(encoding='utf-8')
 for name,_,_,_ in cases:text=text.replace('tests/generated/'+name,'docs/evidence53/'+name)
 p.write_text(text,encoding='utf-8')

performance=json.loads((root/'docs/PERFORMANCE_5.3_RAW.json').read_text(encoding='utf-8'))
assert not performance['errors'] and len(performance['reports'])==9
groups={mode:[r for r in performance['reports'] if r['mode']==mode] for mode in ['baseline','full','lite']}
assert all(len(rs)==3 for rs in groups.values())
def med(mode,key):
 vals=[r[key] for r in groups[mode] if r[key] is not None]
 return statistics.median(vals) if vals else None
def fmt(value):return '—' if value is None else f'{value:.2f}'
metrics=[('首页达到 ResumeStudio 就绪（ms）',lambda m:statistics.median([r['startup']['bootMs'] for r in groups[m]])),('首页资源正文（KiB）',lambda m:sum(r['bodyBytes'] for r in groups[m][0]['startup']['resources'])/1024),('首页 JS 堆近似值（MiB）',lambda m:statistics.median([r['startup']['heapBytes'] for r in groups[m]])/1048576)]
metrics += [(label,lambda m,key=key:med(m,key)) for label,key in [('导入5000题（ms）','import5000Ms'),('重复导入5000题（ms）','duplicateImportMs'),('完整题包读取（ms）','fullBankReadMs'),('全局搜索5000题中的唯一词（ms）','searchMs'),('首次打开编排/编辑器（ms）','editorFirstMs'),('一次简历保存（ms）','saveMs'),('20组/200题交答提交总耗时（ms）','twentyGroups200AnswersMs')]]
for label,key in [('单题读取（ms）','reads'),('单题更新（ms）','updates'),('50题分页（ms）','queries'),('切换两个版本（ms）','versionSwitchMs')]:
 def f(mode,key=key):
  v=[n for r in groups[mode] for n in r[key]]
  return statistics.median(v) if v else None
 metrics.append((label,f))
table='\n'.join('| '+label+' | '+' | '.join(fmt(fn(m)) for m in groups)+' |' for label,fn in metrics)
(root/'docs/PERFORMANCE_5.3.md').write_text('''# 5.3.0 同环境性能实测

原始证据：[PERFORMANCE_5.3_RAW.json](PERFORMANCE_5.3_RAW.json)。脚本：tests/performance53-browser.mjs。Windows Edge无头，本地服务器，1440×1000，关闭Service Worker，不限速、不降频。每轮交替运行最新5.2.1、5.3完整、5.3精简，各使用全新浏览器上下文，共9次；同一5000题夹具。正式测量期间没有并行的回归或浏览器测试任务。

下表为三轮中位数；单题/分页/切换合并各轮10次观测取中位数。首页资源正文为Performance API的encodedBodySize合计，包含CSS和模块等，不含HTML导航正文、HTTP头或后续PWA后台预缓存。首页就绪由performance.now到应用API可用测量，不等于用户感知交互全部完成。

| 项目 | 5.2.1基线 | 5.3完整 | 5.3精简 |
| --- | ---: | ---: | ---: |
'''+table+'''

两种5.3模式的首页同样延迟加载复杂功能，因此资源数接近或相同，这是共享按需机制的结果，不能据此宣称精简版将首页资源削减一半。三个模式的首页均没有请求新增编辑器/设计/学习工作区/搜索模块或assets/vendor库，脚本实际断言。完整版后续进入编辑器才初始化相应界面，精简版转为审阅。

5.3增加了公共版本模型、模式管理、样式和保存协调，因此首页资源较基线增加。启动时间差值包含本机调度、磁盘缓存、GC与浏览器预热，三次测量不足以证明算法级启动提升。题库底层仍复用5.2.1批量增量事务，不能将某次较快的导入归因为重新设计数据库。

5.2.1没有相应全局搜索；5.2.1旧编排与5.3完整编辑器的功能量不同，首次加载项仅供观察。精简模式没有执行复杂简历编辑器，表中空值表示未执行。单版本保存仍更新该版本记录；修改单题不会重写整包。

JS堆值来自Edge performance.memory，受GC和外部资源分配影响，不是进程RSS，也不包含全部Blob/图片/图形内存。原始数据保留操作后heapAfterBytes，场景不同不能当作严格峰值或泄漏证明。20组/200题为合成连续提交，不等同数小时真人答题。独立HTML体积、首次PWA预缓存、真实移动设备和桌面Word打开不在本表内；独立HTML另有按需执行及断网功能验收。

重现比较需保留同级qicheng-5.2.1-optimized目录；正常运行5.3不依赖它。测量不连接GitHub或任何线上服务。
''',encoding='utf-8')

total=sum(c[2] for c in cases)
(root/'TEST_REPORT.md').write_text(f'''# 启程5.3.0最终本地测试报告

Node全量回归 **{unit}/{unit}通过**，0失败、0跳过。实际Windows Edge浏览器 **{total}/{total}项通过**，各专项页面异常为0，数据集成及PWA无资源404。构建通过语法、模块路径、资源路径及全部SHA-256哈希验证。当前离线revision：`{manifest['revision']}`，{len(manifest['assets'])}个资源。

最新界面修订说明与截图见 [docs/UI_5.3.md](docs/UI_5.3.md)。

## 浏览器验收矩阵

所有原始证据随交付保存在docs/evidence53下。测试时使用tests/generated；该目录中的临时浏览器配置不进入交付包。

| 专项 | 结果 | 证据相对docs/evidence53 |
| --- | --- | --- |
'''+ '\n'.join(rows)+f'''

Node原始日志：[docs/ALL_53_FINAL.txt](docs/ALL_53_FINAL.txt)。导出机器证据：[docs/EXPORT_5.3_EVIDENCE.json](docs/EXPORT_5.3_EVIDENCE.json)。同环境5000题三轮性能：[docs/PERFORMANCE_5.3.md](docs/PERFORMANCE_5.3.md)。

## 主要证据与回归

- 简历：A/B/母版隔离、主动空值、真实修改时间、三级选择、结构化自定义字段、保存刷新、撤销重做、确认恢复、模板往返、封面目录、触控排序、双重删除确认、删除底稿保留最新文本和不同版本跨标签页旧写入拒绝。
- 导出：4模板×文字/照片共8份DOCX实际生成，原生文字、独立图片、无编辑保护、学术原生分栏；PDF/HTML/PNG/PPTX/Markdown使用独立版本内容，文件名不修改版本名；长段落边界、隐藏附件、旧高级配置回归。
- 学习：单题CRUD、分类标签、去重和增量、本地冲突选择与失败原子回滚、历史快照、错题去重/最近错误/掌握重开、收藏夹、共享笔记、配额失败救援、未交卷详情/历史/搜索保护与备份恢复。
- 原功能：1000题文件导入实际预检/确认、单题补丁、草稿续答、图像和二进制原文、持久配置重启、备份SHA防篡改、配额不足真实失败、清空恢复事务回滚、跨窗口收藏与工作区CAS；Node全量同时覆盖院校、阅读、考试、每日一句、资料和原导出。
- 离线：5.2.1→5.3数据库保留；子路径下断网重载及新功能按需路由；编辑窗口阻止更新；全部干净窗口共同保存重载；新资源中断/哈希不匹配保留旧缓存。独立HTML在file://完全断网下编辑、保存笔记、搜索并生成原生DOCX，文档库首页不执行。

## 可复现命令

```sh
npm run package
npm run check
npm test
npm run test:browser:5.3
node tests/performance53-browser.mjs
```

运行浏览器脚本需本机Edge和脚本中指定的Playwright路径；升级/性能比较还需要同级5.2.1基线目录。全部使用隔离的本机测试数据库和虚构数据，不写真实用户资料、不连接外部服务。

## 真实平台与限制

Windows Edge {performance.get('browserVersion','')}无头实际执行；桌面、窄窗口、1024×768触控、1133×744横向平板、412×915手机等为浏览器视口/触控模拟。没有实体iPad、Android、Mac或安装PWA外壳验收。

DOCX结构验证证明文本和图片为原生可编辑元素；未用Word/WPS/LibreOffice桌面实际逐字编辑和重存。PDF页面PNG和设计截图已检查，样本未见重叠/横溢出；不保证任意用户数据的所有排版。连续20组答题不是数小时真机稳定性测试。早期探索失败保留在历史文件，最终结论采用本报告列出的最终重跑证据。

未执行push、Release、Pages或任何线上部署。
''',encoding='utf-8')

def included(p):
 rel=p.relative_to(root)
 return p.is_file() and not any(x in rel.parts for x in ['.git','node_modules','__pycache__']) and not rel.parts[:2]==('tests','generated')
files=[p for p in root.rglob('*') if included(p)]
changes=[]
for p in files:
 rel=p.relative_to(root)
 if rel.as_posix()=='docs/FILES_5.3.md':continue
 other=baseline/rel
 if not other.is_file():status='新增'
 elif sha256(p.read_bytes()).digest()!=sha256(other.read_bytes()).digest():status='修改'
 else:continue
 changes.append((rel.as_posix(),status,p.stat().st_size))
(root/'docs/FILES_5.3.md').write_text('# 5.3.0新增和修改文件\n\n相对于同级最新qicheng-5.2.1-optimized逐文件比较；排除浏览器临时配置和tests/generated，包含经过筛选复制的交付证据。未删除基线文件。FILES_5.3.md为本清单自身，不参与比较。\n\n核心职责与接口见DELIVERY_5.3.md、RESUME_MODEL_5.3.md、EXPORT_5.3.md和LEARNING_5.3.md。\n\n| 文件 | 类型 | 字节 |\n| --- | --- | ---: |\n'+'\n'.join(f'| `{name}` | {status} | {size} |' for name,status,size in sorted(changes))+'\n',encoding='utf-8')

history=output/'before-ui'
history.mkdir(exist_ok=True)
for name in ['qicheng-5.3.0-source.zip','Qicheng-5.3.0-offline.html','DELIVERY_RECEIPT.json']:
 old=output/name
 if old.is_file() and not (history/name).exists():shutil.copy2(old,history/name)
archive=output/'qicheng-5.3.0-source.zip'
files=sorted(p for p in root.rglob('*') if included(p))
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in files:z.write(p,Path('qicheng-5.3')/p.relative_to(root))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert len(z.namelist())==len(files)
 for p in files:assert sha256(z.read((Path('qicheng-5.3')/p.relative_to(root)).as_posix())).digest()==sha256(p.read_bytes()).digest()
portable=output/'Qicheng-5.3.0-offline.html'
shutil.copy2(root/'assets/editable-template.html',portable)
receipt={'version':'5.3.0','revision':manifest['revision'],'unitPassed':unit,'browserPassed':total,'files':len(files),'artifacts':{p.name:{'bytes':p.stat().st_size,'sha256':sha256(p.read_bytes()).hexdigest()} for p in [archive,portable]},'published':False}
(output/'DELIVERY_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
