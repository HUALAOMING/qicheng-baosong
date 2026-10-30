import {$,toast,download} from './utils/helpers.js';
function quizAIInstructions52(){
  return `请根据我随后给出的主题、资料、题量和难度，为“启程系统”制作可直接导入的题库文件。你负责生成题目 JSON，不是介绍如何制作软件。若我的需求缺少主题、数量或来源，请先向我确认；不要擅自补全来源中的事实。优先忠于我提供的教材、原文或练习题。你可以在推理中完成核对，但最终答复只能包含一个完整、严格有效的 JSON 对象，第一字符为 {，最后字符为 }，不要 Markdown 代码围栏、注释、解释、下载链接、前言、尾注、省略号或 JSON 以外的内容。我会把你的输出保存为 UTF-8 编码的 .json 文件，在启程“设置 → 题库与资源 → 导入本地 JSON”导入。

一、顶层结构必须且只能采用以下题包结构，不要生成启程个人资料备份，不要混入 book、quotes 或 examSchedule：
{
  "schemaVersion": 1,
  "bank": {
    "id": "my-topic-pack-001",
    "name": "根据主题命名的题目包",
    "subject": "custom",
    "section": "custom",
    "version": "1.0.0",
    "source": "资料来源；没有可靠来源时说明是自编练习"
  },
  "questions": [
    {
      "id": "Q0001",
      "type": "single-choice",
      "question": "一个清楚且只有一个最佳答案的题干",
      "options": [
        {"id": "A", "text": "选项内容一"},
        {"id": "B", "text": "选项内容二"},
        {"id": "C", "text": "选项内容三"},
        {"id": "D", "text": "选项内容四"}
      ],
      "answer": "A",
      "explanation": "解释正确答案的依据，并尽量说明干扰项为什么不正确。",
      "source": "可核实的具体出处；选填"
    },
    {
      "id": "Q0002",
      "type": "true-false",
      "question": "一个表述明确且可判断真假的命题。",
      "answer": true,
      "explanation": "判断依据；错误命题应附正确说法。"
    }
  ]
}

二、精确的兼容规则（逐条遵守）：
1. schemaVersion 是数字 1，不能是字符串。bank.version 是语义化版本字符串，例如 "1.0.0"。ID 必须以英文字母或数字开头，仅使用英文字母、数字、点、下划线或短横线，最长120字符；bank.id 不得为保留值 daily-quotes。给同一主题题包后续修订时保持 bank.id 和已有题目 id 稳定，不同题包用不同 bank.id。
2. questions 必须是数组，最多20000题，单文件不超过12 MB；题目 id 在本文件内唯一，例如 Q0001、Q0002。题量过大时先告知我需要分包，按我的确认逐包输出，每包都是完整JSON，不能静默截断或用省略号代替题目。
3. 只支持 single-choice（单选）和 true-false（判断），不支持多选、填空、简答题。除非我另有要求，只使用单选。不要为包含多个正确答案的题目强行标注单选。
4. 单选 options 是包含2至12项的对象数组，不能写成 {"A":"..."} 形式的对象。各项都有唯一 id 与非空 text。answer 是唯一正确选项的 id 字符串，必须精确匹配本题 options 中一个 id，不得写选项全文、字母数组或“答案：A”。
5. 判断题 answer 必须是 JSON 布尔值 true 或 false，不能写成 "true"、"正确"、1 或0。判断题不要出现 options 字段。
6. 每题 question 为非空字符串，最长20000字符；每个选项的 text 为非空字符串，最长20000字符。explanation 必须提供字符串，最长40000字符，认真解释而非重复答案（若资料实在无法支持，应标注不确定并移除该题后补足题量）。选填 source 为字符串，最长2000字符；bank.name最长200字符。
7. 一般主题（数学、时政、面试常识、自定义学科等）使用 subject:"custom"、section:"custom"。英语语法可用 subject:"english"、section:"grammar"；英语词汇可用 english/vocabulary；中文古代文化可用 chinese/ancient-culture；中文语言运用可用 chinese/chinese-usage。不要为了导入而把其他科目假装归入英语或中文。
8. name、question、text、explanation、source 可含中文或任何语种。正文按普通字符串写，换行用 \\n，双引号用 \\"，反斜线用 \\\\ 转义。数学LaTeX中的反斜线也要按JSON规范转义。不要输出真实换行破坏字符串，不要单引号、尾随逗号、NaN、undefined。
9. 本例只是结构范例，正式输出必须替换所有示例文本，并生成我所需的完整真实题目。选项顺序合理分布，答案与解析逐题对应，不能只生成题目大纲。避免重复题、含糊题和未经核实的引用。
10. 启程中的“题库”是用户选择科目后创建的容器，四个默认题库和自建题库同级；“题包”是一次导入的一组题目，bank.id 表示题包身份。导入时由用户选择目标题库，题包中的全部题目随即归入该题库，可统一搜索、编辑、管理和练习，也可在题库内进一步选择题包。相同题包ID再次导入会更新该包；不同题包可以合并到同一题库。题库的科目用于筛选，题包元数据不改变目标题库的科目。无需把多包嵌套在一个JSON，也无需增加目标题库字段。

三、发送前自查：严格JSON可解析；顶层字段齐全；bank元数据合法；题量准确；所有题目和选项ID唯一；单选答案在选项中；判断答案为布尔值且无options；答案与解析一致；没有重复题、占位文本或额外说明。若你不能保证题目依据或完整格式，请先提出具体问题，不要输出不完整的题库。

下面是我希望制作的题库需求（我将在此补充主题、题量、难度、资料和题型）：`;
}
function quizAIBrief531(){
  return '我在使用“启程”学习系统，想把我提供的教材、原文或资料制作成可导入的题目 JSON，用于练习、错题复习和题库管理。请先阅读我附上的《启程-AI出题完整指令.md》，严格按其中的结构、题型和校验规则生成完整题包。题包导入时由我选择题库，科目随题库，无需生成个人资料备份。\n我的出题需求：主题【填写】；题量【填写】；难度【填写】；题型【单选/判断】；资料或来源【随后提供】。如信息不足，请先向我确认；有充分资料后只输出严格有效的 JSON。';
}
function quizAIInstructionMarkdown531(){
  return '# 启程 · AI 出题完整指令\n\n将本文件和你的资料、出题需求一起交给 AI（如千问、DeepSeek、GLM 或其他支持附件的 AI）。可同时使用启程中的“复制AI说明”提供简短背景。完整格式与约束以本文为准。\n\n## 给 AI 的完整要求\n\n'+quizAIInstructions52()+'\n';
}
function downloadQuizInstructions531(){
  download(quizAIInstructionMarkdown531(),'text/markdown;charset=utf-8','启程-AI出题完整指令.md');
}
async function copyQuizBrief531(){
  const text=quizAIBrief531();
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(text);toast('AI说明已复制，请补充需求，并附上下载的完整指令md文档。');}
  catch{
    let dialog=$('#copyAI52');if(!dialog){dialog=document.createElement('dialog');dialog.id='copyAI52';dialog.className='startup-choices52 copy-ai52';document.body.append(dialog);}
    dialog.innerHTML='<h2>复制AI说明</h2><p>浏览器未开放自动复制，请复制下方简短背景，补充需求，并附上下载的完整指令md文档。</p><textarea readonly aria-label="给AI的简短说明"></textarea><button type="button">关闭</button>';
    dialog.querySelector('textarea').value=text;dialog.querySelector('button').onclick=()=>dialog.close();dialog.showModal();dialog.querySelector('textarea').select();
  }
}
// Retain the old entry point for callers while keeping clipboard content short.
async function copyQuizInstructions52(){return copyQuizBrief531();}
export {quizAIInstructions52,quizAIBrief531,quizAIInstructionMarkdown531,downloadQuizInstructions531,copyQuizBrief531,copyQuizInstructions52};
