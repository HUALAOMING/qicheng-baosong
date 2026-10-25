import { uid } from './utils/helpers.js';
// 启程 · js/constants.js

const VERSION = '5.2.0';

const THEMES = {
  pudding : '布丁奶油', obsidian : '黑橙质感', blue : '墨蓝学院', jade : '深海翡翠', berry : '莓果银白'
};

const PALETTES = {
  pudding : ['#fff5d9', '#fffdf4', '#332b20', '#786b53', '#b7800f', '#e7d8ad'], obsidian : ['#101114', '#17191d', '#f7f3ed',
  '#b9b1a6', '#ff8d48', '#3f3936'], blue : ['#eaf0f7', '#ffffff', '#132c4b', '#61758c', '#2563bd', '#cfdbe9'], jade : ['#082f38',
  '#103f47', '#edfdf7', '#b0d5d0', '#74dbc0', '#2b6268'], berry : ['#f5eff4', '#fffafd', '#382339', '#796379', '#b13c70',
  '#e2cddd']
};

const AWARD_CATS = ['语言与表达', '学术与研究', '领导与实践', '艺术与体育', '综合荣誉'];

const EXP_CATS = ['社团活动', '社会实践', '高中干部经历', '志愿服务', '研究项目', '其他经历'];

const PRIORITIES = ['优先呈现', '补充呈现', '素材留存'];

const SCOPES = ['国家级及以上', '省级', '市级', '区级', '校级'];

const EXAM_TYPES = ['月考', '期中考试', '期末考试', '模拟考试', '保送班排位考', '语言能力考试', '其他考试'];

const PROFILE = [['name', '姓名'], ['birthday', '出生年月日'], ['school', '就读中学'], ['grade', '年级 / 毕业届别'], ['city', '所在城市'],
['schoolLanguage', '高中所学语种'], ['email', '电子邮箱'], ['phone', '联系电话'], ['targetSchool', '目标院校'], ['targetMajor', '语言 / 申请专业']];

const AWARD_FIELDS = [['title', '奖项 / 荣誉名称'], ['scope', '获奖级别'], ['level', '奖项等级与名次'], ['organizer', '主办 / 颁发单位'],
['date', '获奖时间'], ['location', '举办 / 颁发地点'], ['category', '荣誉类别'], ['note', '补充备注'], ['reflection', '获奖心得与成长']];

const EXP_FIELDS = [['title', '经历 / 项目名称'], ['category', '经历类别'], ['role', '担任角色'], ['date', '起止时间'], ['location',
'地点 / 组织'], ['action', '具体行动与成果'], ['reflection', '收获与思考'], ['note', '补充备注']];

const EXAM_FIELDS = [['title', '考试名称'], ['type', '考试类型'], ['date', '考试时间'], ['totalScore', '总分'], ['totalFullMark',
'总分满分'], ['rankScope', '排名范围'], ['rank', '总排名'], ['rankTotal', '参考人数'], ['note', '成绩备注']];

const BOOK_FIELDS = [['title', '书名 / 学习主题'], ['author', '作者 / 资料来源'], ['language', '阅读语言'], ['status', '阅读进度'], ['date',
'记录日期'], ['reflection', '阅读心得与学习记录']];

const EDU_FIELDS = [['school', '学校 / 培训机构'], ['start', '开始时间'], ['end', '结束时间'], ['location', '所在地点'], ['detail',
'学习内容 / 备注']];

const EDU_STAGES = ['小学', '初中', '高中', '培训经历'];

const blankEducation = (stage = '培训经历') => ( {
  id : uid (), stage, school : '', start : '', end : '', location : '', detail : ''
});

const LOGO = '<svg class="qicheng-logo31" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path class="logo-door31" d="M10 37V16a6 6 0 0 1 6-6h18v27" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path class="logo-route31" d="m15 33 8-8 6 3 8-12" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path class="logo-spark31" d="M31 16h6v6" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 37h10" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>';

const BULB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 18h6m-5 3h4m-6-8a6 6 0 1 1 8 0c-1.5 1-1.5 2.5-1.5 3h-5c0-.5 0-2-1.5-3Z"/><path d="M12 1v1M3 5l1 1m16-1-1 1"/></svg>';

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>';

const blankAward = () => ( {
  id : uid (), title : '', scope : '', level : '', organizer : '', date : '', location : '', category : AWARD_CATS [0],
  priority : PRIORITIES [0], note : '', reflection : '', photos : []
});

const blankExp = () => ( {
  id : uid (), title : '', category : EXP_CATS [0], priority : PRIORITIES [0], role : '', date : '', location : '',
  action : '', reflection : '', note : ''
});

const blankSubject = (name = '') => ( {
  id : uid (), name, score : '', fullMark : '', rank : ''
});

const blankExam = () => ( {
  id : uid (), title : '', type : EXAM_TYPES [0], date : '', totalScore : '', totalFullMark : '', rankScope : '年级',
  rank : '', rankTotal : '', note : '', subjects : ['语文', '数学', '外语'].map (blankSubject)
});

const blankBook = () => ( {
  id : uid (), title : '', author : '', language : '', status : '在读', date : '', reflection : ''
});

const MODULES = ['profile', 'education', 'statement', 'academics', 'exams', 'awards', 'experiences', 'practices',
'strengths', 'achievements', 'custom', 'learning'];

const MODULE_NAMES = {
  profile : ['基本信息', 'Basic information'], education : ['教育经历', 'Education'], statement : ['个人陈述', 'Personal statement'],
  academics : ['语言能力', 'Languages'], exams : ['考试成绩', 'Examination results'], awards : ['个人荣誉', 'Honors & awards'],
  experiences : ['个人经历', 'Experience'], practices : ['社会实践', 'Social practice'], achievements : ['个人成果', 'Personal projects & work'],
  strengths : ['特长与兴趣', 'Skills & interests'], custom : ['自定义内容', 'Additional content'], learning : ['个人学习经历', 'Learning record']
};

const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m10 2-.7 3-2 .9-2.8-.9-2 3.5 2.1 2.1v2.8L2.5 16l2 3.5 2.8-.9 2 .9.7 3h4l.7-3 2-.9 2.8.9 2-3.5-2.1-2.6v-2.3l2.1-2.1-2-3.5-2.8.9-2-.9L14 2Z"/><circle cx="12" cy="12" r="3"/></svg>';

const draftKeys = {
  awards : 'awardDraft', experiences : 'experienceDraft', exams : 'examDraft', books : 'bookDraft'
};

const blanks = {
  awards : blankAward, experiences : blankExp, exams : blankExam, books : blankBook
};

const NAV3 = [ {
  id : 'start', zh : '首页', en : 'Home', icon : 'home', standalone : true, items : [['home', '首页', 'Home']]
}, {
  id : 'learning-center', zh : '学习中心', en : 'Learning center', icon : 'bulb', items : [['quiz', '练习中心', 'Practice center'], ['reading', '阅读扩展', 'Reading'], ['reading-progress', '每日阅读进度', 'Reading progress'], ['calendar', '学习日历', 'Learning calendar'], ['self-introductions','自我介绍汇总','Self introductions']]
}, {
  id : 'entry', zh : '信息录入', en : 'Information', icon : 'edit', items : [['profile', '个人基本信息', 'Basic information'],
  ['education', '教育经历', 'Education'], ['statement', '个人陈述', 'Personal statement'], ['academics', '语言与考试成绩', 'Languages & exams'],
  ['awards', '荣誉录入', 'Honors & awards'], ['experiences', '个人经历录入', 'Experience'], ['practices', '社会实践录入', 'Social practice']]
}, {
  id : 'organize', zh : '材料组织整理', en : 'Organize', icon : 'layers', items : [['sort-awards', '荣誉整理', 'Organize awards'],
  ['sort-experiences', '经历整理', 'Organize experience'], ['sort-practices', '社会实践整理', 'Organize practice']]
}, {
  id : 'personal', zh : '个性化内容', en : 'Personal content', icon : 'spark', items : [['learning', '阅读与学习记录', 'Reading & learning'],
  ['achievements', '个人成果', 'Projects & work'], ['custom', '自定义图文', 'Custom content']]
}, {
  id : 'dashboard', zh : '数据看板', en : 'Dashboard', icon : 'chart', items : [['dashboard', '资料与成绩', 'Materials & results'], ['practice-dashboard', '练习数据', 'Practice data']]
}, {
  id : 'materials', zh : '资料中心', en : 'Materials', icon : 'folder', items : [['images', '图片管理', 'Images'], ['files',
  '文件管理', 'Files'], ['outputs', '导出内容管理', 'Exported documents']]
}, {
  id : 'export', zh : '导出成果', en : 'Create documents', icon : 'export', items : [['studio', '编排与导出', 'Compose & export'],
  ['archive', '个人资料打包', 'Download all materials']]
}, {
  id : 'info', zh : '信息栏', en : 'Universities', icon : 'globe', items : [['schools', '目标院校与地图', 'Universities & map'], ['exam-calendar', '考试信息', 'Examination calendar']]
}];

const ACHIEVEMENT_FIELDS = [['title', '成果名称'], ['category', '成果类型'], ['date', '完成 / 研究时间'], ['role', '个人角色'], ['method',
'过程与方法'], ['result', '成果与展示'], ['reflection', '收获与思考'], ['note', '补充备注']];

const ROUTE22 = ['profile', 'education', 'statement', 'academics', 'awards', 'sort-awards', 'experiences', 'sort-experiences',
'custom', 'studio'];

const UI_THEMES3 = [['pudding', '浅色', 'Light', '布丁奶油 / PUDDING'], ['obsidian', '深色', 'Dark', '黑橙质感 / OBSIDIAN'], ['blue',
'蓝图', 'Blueprint', '墨蓝学院 / BLUEPRINT']];

export { VERSION, THEMES, PALETTES, AWARD_CATS, EXP_CATS, PRIORITIES, SCOPES, EXAM_TYPES, PROFILE, AWARD_FIELDS, EXP_FIELDS, EXAM_FIELDS, BOOK_FIELDS, EDU_FIELDS, EDU_STAGES, blankEducation, LOGO, BULB, STAR, blankAward, blankExp, blankSubject, blankExam, blankBook, MODULES, MODULE_NAMES, GEAR, draftKeys, blanks, NAV3, ACHIEVEMENT_FIELDS, ROUTE22, UI_THEMES3 };
