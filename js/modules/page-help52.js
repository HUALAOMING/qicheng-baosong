import { ctx } from '../state.js';
import { esc, tr } from '../utils/helpers.js';

// Help belongs to the visible page, including the selected composer tab.
// Keep this data independent of app.js so help can refresh without rebuilding the shell.
const pageHelpContent52 = {
  home: {
    title: ['首页', 'Home'],
    sections: [
      ['梦想院校', 'Dream universities', '先在“目标院校与地图”收藏学校，再选择首页主要展示院校。点击右侧的小院校卡片，即可把它切换到主位置；原来的主院校会回到侧边。', 'Favorite universities in Universities & map, then choose your featured university. Click a smaller university card to bring it to the main position; the previous one moves to the side.'],
      ['每天的起点', 'Your daily starting point', '点击每日一句可阅读原文并安排本周七句。倒计时日期可以在学习日历中设置；有未完成练习时，可以从首页继续答题。', 'Open the daily quote to read its source or arrange seven quotes for this week. Set your countdown date in the Learning calendar. Unfinished practice can be resumed from Home.'],
      ['保存记录', 'Keep your records', '内容修改后会自动保存在当前浏览器中。菜单底部的“手动保存”会另存完整 JSON 文件，包含资料与学习记录；请保留该文件以便恢复或换设备。', 'Edits save automatically in this browser. Save file at the bottom of the menu creates a complete JSON file containing your materials and study records. Keep it for restoration or another device.']
    ]
  },
  quiz: {
    title: ['练习中心', 'Practice center'],
    sections: [
      ['开始一组练习', 'Start a practice group', '选择题库、练习方式与题数，按需开启倒计时。错题和收藏模式只从对应题目中抽取；自定义题库可在设置中导入。', 'Choose a bank, mode and question count, with an optional countdown. Mistakes and favorites modes draw from those marked questions. Import custom banks in Settings.'],
      ['暂存与提交', 'Drafts and submission', '答题过程会暂存到本机，可以稍后继续。整组提交后才生成正式成绩并计入练习数据看板；查看解析后可以收藏题目，便于复练。', 'Answers are saved locally so you can continue later. Only submitting a whole group creates a result in Practice data. Mark questions as favorites while reviewing explanations to revisit them later.']
    ]
  },
  explore: {
    title: ['学习中心', 'Learning center'],
    sections: [
      ['选择学习方式', 'Choose an activity', '进入练习中心进行答题训练，或打开典籍阅读原文与简释。每日阅读进度用于记录章节，学习日历用于回顾每天的状态。', 'Open Practice center for quizzes or a classic for its text and explanations. Reading progress records your chapters, and Learning calendar keeps daily reflections.'],
      ['补充学习资料', 'Add learning material', '更多题库与典籍可在设置中导入本地 JSON。已安装的学习资源可以离线使用。', 'Import additional banks and classics as local JSON files in Settings. Installed study resources remain available offline.']
    ]
  },
  reading: {
    title: ['阅读扩展', 'Reading'],
    sections: [
      ['打开典籍', 'Open a classic', '选择书目进入阅读页，可按篇目筛选或搜索原文与简释。显示“学习资料待收录”的入口需要先安装相应内容。', 'Choose a book to read, then filter by chapter or search its text and explanations. An entry marked as awaiting material needs its resource installed first.'],
      ['记下阅读进度', 'Record your reading', '典籍阅读页用于查阅资料；想记录自己读到哪一章，请进入“每日阅读进度”。新典籍可在设置中导入。', 'The reader displays source material. Use Reading progress to record the chapters you have read. Import new classics in Settings.']
    ]
  },
  classic: {
    title: ['典籍阅读', 'Classic reader'],
    sections: [
      ['查找与阅读', 'Find and read', '在搜索框输入原文、简释或篇目关键词，也可通过“选择篇目”缩小范围。清空搜索并选择全部篇目，即可恢复整本内容。', 'Search for words in the text, explanations or chapter names, or choose a chapter to narrow the list. Clear the search and select all chapters to restore the full book.'],
      ['底本与进度', 'Source and progress', '“底本说明与校勘重点”中可查看来源说明并下载原资料。阅读内容可离线使用；自己的章节进度和阅读小记请在“每日阅读进度”保存。', 'Source and editorial notes explain the edition and offer the original material for download. Reading works offline. Save your own chapter progress and notes in Reading progress.']
    ]
  },
  'reading-progress': {
    title: ['每日阅读进度', 'Reading progress'],
    sections: [
      ['按章节记录', 'Record chapters', '阅读日期、书名、作者、阅读语言与阅读章节必填。章节由你自由输入，版本、页码范围和阅读小记均选填。保存后记录会进入下方阅读足迹。', 'Date, book title, author, reading language and chapters are required. Enter chapters in your own format; edition, page range and notes are optional. Saved entries appear in your reading log below.'],
      ['查看阅读足迹', 'Browse your reading log', '同名书目的记录会自动汇成纵向阅读轴。“按时间排序”优先显示最近录入的书目；选择“按书筛选”后，再选择具体书目查看它的记录。保持同一本书的书名写法一致。', 'Entries with the same book title share a vertical timeline. By time shows books with the latest entries first. Choose Filter by book, then a title to see that book’s records. Use a consistent title for the same book.'],
      ['整合阅读心得', 'Combine reflections', '阅读小记可以在“阅读与学习记录”中按书一键合并，整理后仍可自由修改。这里修改或删除记录会改变之后可整合的内容。', 'In Reading & learning, combine a book’s notes into an editable reflection. Editing or deleting an entry here changes what can be included in a later combination.']
    ]
  },
  calendar: {
    title: ['学习日历', 'Learning calendar'],
    sections: [
      ['记录一天', 'Reflect on a day', '切换周视图或月视图，点击日期填写当天状态与简单回顾。“今天”可回到当前日期，左右箭头用于切换日期范围。', 'Switch between week and month views, then choose a date to record your daily state and reflection. Today returns to the current date; arrows move to the previous or next period.'],
      ['倒计时与鼓励', 'Countdown and encouragement', '日期菜单中可以把某一天设为首页倒计时目标日。日历上方的“自定义鼓励”可以修改自己的日历标语。考试安排请在信息栏的“考试信息”管理。', 'The date menu can set your Home countdown target. Customize your calendar message above the grid. Manage examination arrangements in Examination calendar under Universities.']
    ]
  },
  'self-introductions': {
    title: ['自我介绍汇总', 'Self introductions'],
    sections: [
      ['保存多个版本', 'Keep multiple versions', '新增版本时填写语言、时长和正文，版本名称与备注选填。时长可填分钟和秒，点击“换算分秒”可将 90 秒换算为 1 分 30 秒。正文旁显示中文字数或英文词数，不含标点。', 'Enter language, duration and script for each version; its name and notes are optional. Enter minutes and seconds, then normalize, for example, 90 seconds to 1 minute 30 seconds. The script shows Chinese character or English word counts, excluding punctuation.'],
      ['朗读复习与计时', 'Rehearse with a timer', '点击版本卡片查看大字号正文，使用开始、暂停与重置控制计时。倒计时到零后会继续记录超时秒数；切换页面后仍会计时，刷新页面会重置。', 'Open a version card for its large script and timer. Start, pause or reset the timer. After zero it counts overtime in seconds. Timing continues across pages and resets when the app is reloaded.'],
      ['用于个人陈述', 'Use it in a personal statement', '在“个人陈述”点击“从自我介绍导入”，可从全部版本中手动选择并复制正文。复制后两处内容可分别修改。', 'Use Import from introduction in Personal statement to select any version and copy its script. The copied text and original can then be edited independently.']
    ]
  },
  profile: {
    title: ['个人基本信息', 'Basic information'],
    sections: [
      ['建立个人档案', 'Build your profile', '填写姓名、学校、联系方式与目标专业等信息，并按需上传个人照片。照片保留原图，可调整裁剪位置以适应导出。', 'Enter your name, school, contact details and target major, and optionally add a portrait. The source image is retained, with crop positioning available for exports.'],
      ['控制导出字段', 'Choose exported fields', '这里的资料由各份文档共用。需要隐藏某些联系方式或字段时，到“编排与导出”的内容选择中调整对应文档版本。', 'Your documents share this profile. To hide contact details or other fields, adjust the relevant version in Compose & export → Content.']
    ]
  },
  education: {
    title: ['教育经历', 'Education'],
    sections: [
      ['按阶段录入', 'Record each stage', '为学校或培训经历填写起止时间、地点及学习内容。可以继续添加教育记录，尽量统一日期写法，方便阅读。', 'Record each school or training experience with its dates, location and study details. Add further entries as needed and use consistent date formatting.'],
      ['整理呈现', 'Prepare for documents', '原始教育经历保存在这里，是否呈现及导出时的模块顺序可在“编排与导出”中按文档版本调整。', 'Your education entries stay here. Choose whether to include them and set their module order for each version in Compose & export.']
    ]
  },
  statement: {
    title: ['个人陈述', 'Personal statement'],
    sections: [
      ['按语种撰写', 'Write in each language', '分别填写中文、英文个人陈述。小语种陈述为选填，先填写语种名称，再输入正文；个人特长与兴趣也可在这里补充。', 'Write Chinese and English statements in their respective fields. The additional-language statement is optional: enter its language and script. You can also record skills and interests here.'],
      ['从自我介绍导入', 'Import an introduction', '在对应区域点击“从自我介绍导入”，手动选择任意已保存的版本，系统会复制相同正文。不会根据语言名称自动筛选；填入后可继续修改。', 'Use Import from introduction in the relevant section and choose any saved version to copy its script. Versions are not filtered by language names. You can edit the copied text afterward.']
    ]
  },
  academics: {
    title: ['语言与考试成绩', 'Languages & exams'],
    sections: [
      ['收录考试', 'Save an exam', '填写考试名称、日期和排名范围，录入总分、总分满分及各科成绩；可增加或移除科目。完成后点击收录，再在已收录列表编辑或移除。', 'Enter an exam’s name, date and ranking group, then its total score, full mark and subjects. Add or remove subjects as needed. Save the exam before editing or removing it from the saved list.'],
      ['让比较有依据', 'Make comparisons meaningful', '不同考试满分可能不同，建议同时填写对应满分，成绩看板才能比较得分率。单科排名与总排名分开填写；缺失数据会在看板中显示为空，不按零分处理。', 'Record full marks as well as scores so the dashboard can compare score rates across exams. Keep subject ranks separate from overall rank. Missing values appear as missing rather than zero.']
    ]
  },
  awards: {
    title: ['荣誉录入', 'Honors & awards'],
    sections: [
      ['收录一项荣誉', 'Save an award', '填写名称、获奖级别、时间与颁发单位，并补充自己的收获。可上传照片与附件，完成后点击收录；右侧列表可以编辑已有记录。', 'Enter the title, level, date and awarding body, plus your reflections. Add photos or attachments, then save the entry. Edit saved entries from the list.'],
      ['从素材到成稿', 'Prepare your materials', '优先级和类别帮助后续筛选。到“荣誉整理”调整呈现顺序，再在编排与导出中选择需要展示的荣誉。', 'Priority and category help with selection. Use Organize awards to arrange the entries, then choose which to include in Compose & export.']
    ]
  },
  experiences: {
    title: ['个人经历录入', 'Experience'],
    sections: [
      ['记下行动与成果', 'Record actions and outcomes', '为每段经历填写名称、角色、时间与具体行动，补充成果和收获。照片与附件可一并收录；保存后从列表继续编辑。', 'For each experience, record its title, your role, dates, actions, outcomes and reflections. Include photos or attachments and edit saved entries from the list.'],
      ['整理经历', 'Arrange experiences', '类别和优先级用于归纳素材。需要调整经历顺序时，到“经历整理”；导出是否包含某条经历由各文档版本分别设置。', 'Use category and priority to organize material. Change its order in Organize experience. Each document version independently chooses which entries to include.']
    ]
  },
  practices: {
    title: ['社会实践录入', 'Social practice'],
    sections: [
      ['记录实践过程', 'Describe your practice', '填写实践名称、组织、时间、承担角色和具体成果，再补充自己的思考。保存后可继续编辑，并上传活动照片或证明附件。', 'Record the activity, organization, dates, your role and concrete outcomes, followed by reflections. Saved entries can be edited and illustrated with photos or supporting files.'],
      ['安排呈现顺序', 'Set the presentation order', '进入“社会实践整理”按需要排序；到编排与导出选择要呈现的实践记录和字段。', 'Arrange entries in Organize practice, then choose the records and fields to include in Compose & export.']
    ]
  },
  'sort-awards': {
    title: ['荣誉整理', 'Organize awards'],
    sections: [
      ['选择整理方式', 'Choose an organization mode', '按级别或自定义方式查看荣誉，拖动记录调整可用的顺序与分组。需要修改荣誉内容时，回到“荣誉录入”。', 'View awards by level or custom order, then drag records to adjust the available order and groups. Edit their content in Honors & awards.'],
      ['用于导出', 'Use the organized entries', '整理帮助建立清晰的素材顺序。具体文档中的模块顺序和内容勾选仍可在“编排与导出”中单独调整。', 'Organization gives your source material a clear order. Each document can still have its own module order and content selection in Compose & export.']
    ]
  },
  'sort-experiences': {
    title: ['经历整理', 'Organize experience'],
    sections: [
      ['整理已有经历', 'Arrange saved experiences', '选择类别或自定义排序方式，拖动记录调整经历顺序或分组。记录正文在“个人经历录入”中修改。', 'Choose category or custom ordering, then drag records to adjust their order or grouping. Edit the text in Experience.'],
      ['检查重点', 'Review your emphasis', '把最能体现能力的经历放在前面，再到编排与导出为不同申请准备各自的内容版本。', 'Bring the most relevant experiences forward, then prepare separate content selections for different applications in Compose & export.']
    ]
  },
  'sort-practices': {
    title: ['社会实践整理', 'Organize practice'],
    sections: [
      ['安排实践记录', 'Arrange practice entries', '选择当前需要的整理方式，拖动已有实践调整顺序与分组。这里使用已收录记录，新增或修改正文请到“社会实践录入”。', 'Choose an organization mode and drag saved practice entries to adjust their order and groups. Add entries or edit their text in Social practice.'],
      ['选入文档', 'Include entries in a document', '整理完成后，在“编排与导出”中勾选需要呈现的实践及其字段，并检查最终预览。', 'Select the practice entries and fields you need in Compose & export, then inspect the final preview.']
    ]
  },
  learning: {
    title: ['阅读与学习记录', 'Reading & learning'],
    sections: [
      ['两种录入方式', 'Two ways to create an entry', '选择“自己撰写”从头记录阅读经历，或选择“从每日进度整合”并选书。填入书目信息会带入书名、作者和语言，阅读日期默认今天且可更改。', 'Write from scratch or choose Combine daily progress and select a book. Fill book details copies its title, author and language. The reading date defaults to today and remains editable.'],
      ['合并阅读小记', 'Combine reading notes', '“一键合并全部小记”会把该书全部已保存的小记整理进阅读心得。请先确认是否保留当前手写内容；填入后可以继续增删、修改，最后收录这段阅读经历。', 'Combine all reading notes gathers the selected book’s saved notes into its reflection. Check any existing handwritten text before replacing it. Edit the combined reflection and save the reading experience.'],
      ['其他学习内容', 'Other study records', '下方可单独保存书单、学习计划与其他学习记录。需要记录每天读到的章节，使用“每日阅读进度”。', 'Keep book lists, study plans and other notes in the separate fields below. Use Reading progress to track the chapters read each day.']
    ]
  },
  achievements: {
    title: ['个人成果', 'Projects & work'],
    sections: [
      ['说明一项成果', 'Describe your work', '录入作品或研究名称、时间、个人角色、过程方法与实际成果。补充图片、附件和反思，让成果有可查阅的依据。', 'Record the title, date, your role, methods and outcomes of a project or work. Add images, files and reflections to support it.'],
      ['整理到文档', 'Include your work in documents', '保存后可在列表编辑，导出时到“编排与导出”选择所需成果，并按目标调整字段与呈现顺序。', 'Edit saved entries from the list. In Compose & export, select the relevant work and adjust fields and order for the intended document.']
    ]
  },
  custom: {
    title: ['自定义图文', 'Custom content'],
    sections: [
      ['增加自定义模块', 'Add a custom block', '为系统预设模块之外的内容添加标题、正文与图片，并选择适合的图文布局。每个模块都可独立编辑。', 'Add titles, text and images for content beyond the preset modules, then choose a suitable layout. Each block can be edited independently.'],
      ['安排导出位置', 'Place it in your document', '自定义模块保存后，到“编排与导出”选择是否呈现，并在模块顺序中调整位置。建议预览检查长正文与图片的分页。', 'Choose whether to include custom blocks in Compose & export, then set their positions in Order. Check the preview for page breaks around long text and images.']
    ]
  },
  dashboard: {
    title: ['资料与成绩看板', 'Materials & results'],
    sections: [
      ['比较成绩曲线', 'Compare examination results', '第一个菜单选择总分或具体科目，第二个菜单选择实际得分、得分率或排名。勾选要比较的考试；满分不同时优先看得分率，排名越小代表名次越靠前。', 'Choose total score or a subject in the first menu, then actual score, score rate or rank in the second. Select the exams to compare. Use score rate when full marks differ; a smaller rank means a higher position.'],
      ['为什么权重不用合计 100？', 'Why do weights not have to total 100?', '权重表示相对占比，系统会除以权重合计后再计算，不会把“分数 × 权重”直接相加。因此 20:30:50、2:3:5 与 0.2:0.3:0.5 完全等价，合计不必为 100。', 'Weights express relative proportions. The calculation divides by their sum rather than simply adding score × weight. Therefore 20:30:50, 2:3:5 and 0.2:0.3:0.5 are equivalent, and the sum need not be 100.'],
      ['计算公式与例子', 'Formula and example', '加权总分 = Σ（每次总分 × 对应权重）÷ Σ（权重）。例如三次成绩为 80、90、100，权重为 2、3、5，结果为（80×2 + 90×3 + 100×5）÷10 = 93。权重不得为负且合计必须大于 0；权重为 0 的考试不参与计算。', 'Weighted total = Σ(score × weight) ÷ Σ(weight). For scores 80, 90 and 100 with weights 2, 3 and 5: (80×2 + 90×3 + 100×5) ÷ 10 = 93. Weights must be nonnegative and their sum must be positive. Exams with zero weight are excluded.'],
      ['名次的参考范围', 'Interpreting weighted rank', '个人加权平均名次用相同公式，将分数替换为名次。它不是重新计算的真实年级排名，仅供参考，可能存在较大误差，因为参考人数、排名范围与考试难度可能不同。加权总分直接使用录入分数，满分不同请结合得分率判断；缺少有效分数或名次时，对应结果暂不计算。', 'Personal weighted average rank uses the same formula with ranks in place of scores. It is not a recalculated cohort ranking and is for reference only, with potentially substantial error from differing cohort sizes, ranking groups and exam difficulty. Weighted scores use recorded scores directly; consider score rates when full marks differ. A result is unavailable if its required scores or ranks are missing.']
    ]
  },
  'practice-dashboard': {
    title: ['练习数据', 'Practice data'],
    sections: [
      ['统计范围与时间', 'Scope and time range', '练习数据已整合学习统计。选择最近7天、最近30天或全部时间，只统计已交卷记录，未提交草稿不计入。待复习与收藏反映当前状态，不随时间范围改变。', 'Practice data includes learning statistics. Choose the last 7 days, last 30 days or all time. Only submitted groups count; drafts are excluded. Review and favorites show their current state regardless of the date range.'],
      ['题次与不同题目', 'Attempts and distinct questions', '作答题次累计每一次练习，重复作答也计入；不同题目按题包与永久题目ID去重。同一道题练习三次计3题次、1道不同题目。总体正确率按正确题次除以作答题次计算，历史成绩保留当时的评分依据。', 'Attempts count each answer, including repeats. Distinct questions are deduplicated by pack and permanent question ID: practicing one question three times gives three attempts and one distinct question. Accuracy is correct attempts divided by all attempts; historical scores keep their original grading basis.'],
      ['安排复练', 'Plan a review', '查看题库、题包与分类表现、当前待复习及收藏数量，回到练习中心选择错题或收藏模式巩固薄弱部分。', 'Review performance by bank, pack and category, plus current review and favorite counts. Return to Practice center to revise mistakes or favorites.']
    ]
  },

  images: {
    title: ['图片管理', 'Images'],
    sections: [
      ['集中查找图片', 'Find your images', '各处上传的图片会集中收在这里，可搜索、查看使用位置并管理素材。记录里的图片可以关联到同一份素材。', 'Images uploaded throughout the app are collected here. Search them, inspect their usage and manage the materials. Multiple records can link to one image.'],
      ['区分解除关联与删除', 'Unlinking and deletion', '在记录中移除图片只解除该处关联。在图片管理中删除会要求确认，并解除全部使用位置；重要原图请随完整备份或个人资料包留存。', 'Removing an image from a record only unlinks it there. Deleting it in Images asks for confirmation and removes all links. Keep important originals in a complete backup or personal archive.']
    ]
  },
  files: {
    title: ['文件管理', 'Files'],
    sections: [
      ['管理附件', 'Manage attachments', '上传的证明、文档等附件集中保存在文件管理，可搜索并查看它们关联的记录。需要使用时可从资料中选择附件。', 'Supporting documents and other uploaded files are collected here. Search them and inspect their linked records. Choose existing materials when attaching a file.'],
      ['删除前确认用途', 'Check usage before deleting', '从一条记录移除附件只解除关联；在文件管理中删除会同时解除全部关联。完整 JSON 备份与个人资料包都可保留附件。', 'Removing an attachment from one record only unlinks it. Deleting it in Files removes all its links. Complete JSON backups and personal archives can preserve attachments.']
    ]
  },
  outputs: {
    title: ['导出内容管理', 'Exported documents'],
    sections: [
      ['查找已导出成果', 'Find previous exports', '这里保存已生成的文档，可再次下载或删除。需要修改正文与版式时，回到资料录入或“编排与导出”，再生成一份新文件。', 'Find generated documents here and download or delete them. To change content or layout, edit the source records or Compose & export settings, then generate a new file.'],
      ['保留可恢复资料', 'Keep editable records', '导出的 PDF、图片等用于阅读与提交；想继续编辑完整工作进度，请另存完整 JSON 备份。', 'Exported PDFs and images are for reading and submission. Save a complete JSON backup to retain the editable workspace.']
    ]
  },
  archive: {
    title: ['个人资料打包', 'Download all materials'],
    sections: [
      ['完整带走素材', 'Take your materials with you', '按需要选择图片、附件、已导出文档及完整进度备份，打包下载为 ZIP。原图按原比例保留。', 'Choose images, attachments, exported documents and the complete progress backup to download in a ZIP. Original images retain their aspect ratios.'],
      ['恢复工作进度', 'Restore your workspace', 'ZIP 便于整理和留档；恢复完整工作进度时，使用包内的完整 JSON 备份，并通过启动页或设置载入。', 'The ZIP is useful for organization and archiving. To restore the editable workspace, load its complete JSON backup from the startup screen or Settings.']
    ]
  },
  schools: {
    title: ['目标院校与地图', 'Universities & map'],
    sections: [
      ['查找与收藏院校', 'Find and favorite universities', '通过地图、地区筛选或搜索查找学校，点击院校查看详情。将感兴趣的院校设为梦想院校，可集中筛选和在首页展示。', 'Use the map, region filter or search to find a university, then open its details. Favorite dream universities to filter them together and display them on Home.'],
      ['选择首页主院校', 'Choose your featured university', '首页保留一个主要展示院校，其他梦想院校以侧边小卡片展示。点击小卡片即可切换主要展示学校。招生与考试信息请以院校正式通知为准。', 'Home highlights one featured university and shows other dream universities as smaller cards. Click a smaller card to feature it. Follow official university notices for admissions and exam information.']
    ]
  },
  school: {
    title: ['院校详情', 'University details'],
    sections: [
      ['查看院校资料', 'Read university information', '查看校名、地区、简介与招生链接，可将学校加入或移出梦想院校。加入后可在首页作为主要或侧边院校展示。', 'Review the university’s name, region, introduction and admissions links, and add or remove it from your dream universities. Favorites can be displayed as the featured or side universities on Home.'],
      ['核对考试安排', 'Verify examinations', '本页的考核资料用于准备时参考，请核对院校官网最新通知。自己的考试时间和地点可以在“考试信息”的日历中手动添加。', 'Assessment information here is a preparation reference. Check the latest official university notices. Add your own exam dates and locations in Examination calendar.']
    ]
  },
  'exam-calendar': {
    title: ['考试信息', 'Examination calendar'],
    sections: [
      ['在日期上添加考试', 'Add an exam on a date', '点击任意一天，即使当天没有安排也可以选择“添加考试”。在弹窗中选择院校、考试类型与日期，地点选填；保存后可再编辑或删除。', 'Choose any date, including a day with no events, then Add exam. Select the university, exam type and date in the dialog; the location is optional. Saved arrangements can be edited or deleted.'],
      ['查看与留存安排', 'Review and keep arrangements', '同日同校的不同考试安排会归在一起。手动安排随本地记录与完整备份保存，也可以在设置中导入考试日程；最终以院校正式通知为准。', 'Different events for the same university on one day are grouped together. Manual arrangements are saved in your local records and complete backups. Import schedules in Settings and follow official university notices.']
    ]
  },
  'daily-quote': {
    title: ['每日一句', 'Daily quote'],
    sections: [
      ['安排本周七句', 'Arrange seven quotes', '点击“自定义每日一句”，选择书目或句库，搜索并勾选恰好七句，再拖动右侧句子调整周一至周日的顺序。保存后按当天星期显示。', 'Choose Customize this week’s quotes, select a book or library, then search and select exactly seven quotes. Drag the selected quotes to arrange Monday through Sunday. Save to show the quote for each weekday.'],
      ['默认滚动与原文', 'Rotation and source text', '本周安排只在当前自然周生效，下周恢复默认顺序；也可以手动恢复默认滚动。带原文关联的句子可以打开对应典籍段落。', 'A custom plan applies only to the current calendar week; default rotation resumes next week. You can also restore default rotation manually. Linked quotes can open their original classic passage.']
    ]
  },
  settings: {
    title: ['设置', 'Settings'],
    sections: [
      ['外观与资源', 'Appearance and resources', '选择浅色、深色或蓝图主题及界面语言。导入题包时，先下载AI指令md文档，附给AI并补充出题需求；可复制AI说明提供简短背景。核对生成的JSON后选择目标题库，导入题目会归入该题库。新建题库需选择科目。', 'Choose Light, Dark or Blueprint and the interface language. For question packs, download the Markdown instructions and attach them with your requirements. Copy AI brief supplies short context. Verify generated JSON and choose a destination bank; imported questions belong to that bank. New banks require a subject.'],
      ['保存与恢复', 'Save and restore', '自动保存写入当前浏览器的本地数据库。“手动保存”或完整 JSON 备份会生成可另存的本地文件，启动时可选择继续当前进度或载入该文件。建议定期保留完整文件。', 'Autosave writes to this browser’s local database. Save file or complete JSON backup creates a file you can keep separately. At startup, continue the current progress or load that file. Keep complete files regularly.'],
      ['缓存与本地数据', 'Cache and local records', '“清除程序缓存”清理离线程序资源，与“清除本地数据”分开；清除前请先手动保存。清除本地数据会移除个人资料和学习记录，操作前请核对提示。', 'Clear application cache removes offline program resources and is separate from Clear local data. Save a file before clearing. Clearing local data removes personal and study records; read the confirmation first.'],
      ['获取更新', 'Get updates', '点击“检查应用新版本”，发现更新后使用“保存并更新应用”。已安装的题库资源可单独通过“在线获取最新版资源”更新。', 'Choose Check for app updates, then Save & update app when an update is available. Installed bank resources can be updated separately with Get latest resources online.']
    ]
  }
};

const studioHelpContent52 = {
  content: {
    title: ['编排与导出 · 内容选择', 'Compose & export · Content'],
    sections: [
      ['选择当前版本内容', 'Select content for this version', '先选择文档版本与成果类型，再勾选要呈现的模块、记录和字段。每份文档版本独立保存自己的内容选择，源资料仍可供其他版本使用。', 'Choose a document version and purpose, then select its modules, records and fields. Each version keeps its own selection, while source records remain available to other versions.'],
      ['逐步完成成稿', 'Build your document', '按排版、照片、模块顺序与导出前检查逐步调整，随时打开当前预览。需要不同申请版本时，可复制当前版本后继续修改。', 'Continue through Layout, Photos, Order and Check, opening the preview as needed. Duplicate a version to prepare a different application.']
    ]
  },
  style: {
    title: ['编排与导出 · 排版', 'Compose & export · Layout'],
    sections: [
      ['调整纸张与文字', 'Set the page and text', '设置纸张、页边距、字体与字号。紧凑、标准、舒展三个档位可以拖动切换，再按需要微调现有的自定义设置。', 'Set paper, margins, font and text size. Drag between Compact, Standard and Spacious, then refine the available custom settings.'],
      ['设置文档配色', 'Set document colors', '分割线、纸张背景、标题文字颜色可以分别调整，也可上传背景图片；标题颜色独立于正文，默认均为黑色。打开当前预览检查对比度和分页效果。', 'Set divider, paper background and heading colors separately, or upload a background image. Headings have an independent color; both headings and body text default to black. Check contrast and page breaks in the preview.']
    ]
  },
  media: {
    title: ['编排与导出 · 照片', 'Compose & export · Photos'],
    sections: [
      ['挑选文档照片', 'Choose document photos', '按当前文档需要选择个人照片和记录配图，并调整照片样式与可用的裁剪设置。上传素材仍集中保存在图片管理。', 'Select the portrait and record images needed for this document, with the available photo styles and crop controls. Uploaded images remain in Images.'],
      ['检查图片呈现', 'Inspect image placement', '图片选择按文档版本保存。打开预览检查裁剪、尺寸与分页，原始图片不会因版式调整而被裁掉。', 'Photo choices belong to the document version. Inspect crops, sizes and page breaks in the preview. Layout adjustments retain the original image.']
    ]
  },
  order: {
    title: ['编排与导出 · 模块顺序', 'Compose & export · Order'],
    sections: [
      ['调整阅读顺序', 'Set the reading order', '拖动模块改变当前文档的先后顺序，把最重要的信息放在前面。可用按钮或键盘操作完成同样的调整。', 'Drag modules into the desired order for this document, putting the most relevant information first. Available buttons or keyboard controls provide the same adjustments.'],
      ['预览整体结构', 'Review the structure', '顺序修改独立保存在当前文档版本中。调整后查看预览，确认标题、内容衔接和分页是否合适。', 'The order is saved separately for the current version. Check the preview for heading flow, transitions between content and page breaks.']
    ]
  },
  check: {
    title: ['编排与导出 · 导出前检查', 'Compose & export · Check'],
    sections: [
      ['核对导出内容', 'Review before export', '查看缺项、重复记录与其他检查提示。需要补充内容时回到对应录入页，调整后再预览。', 'Review missing fields, repeated records and other checks. Return to the relevant entry page to complete information, then preview again.'],
      ['人工检查', 'Inspect the document', '自动检查帮助定位常见问题，仍需核对姓名、日期、成绩、目标院校和实际分页。确认内容与当前申请要求相符后再导出。', 'Checks identify common issues; also inspect names, dates, scores, target university and pagination. Confirm the document matches the application requirements before exporting.']
    ]
  },
  files: {
    title: ['编排与导出 · 导出文件', 'Compose & export · Export'],
    sections: [
      ['预览与下载', 'Preview and download', '检查分页预览与导出文件名，再选择所需文件格式。较大的图片或长文档生成时可能需要稍等；完成后按提示保存文件。', 'Inspect the page preview and export filename, then choose the required format. Large images or long documents may take a moment to generate. Save the file when prompted.'],
      ['保留可编辑版本', 'Keep an editable version', '已生成文件可到“导出内容管理”再次下载。想恢复全部可编辑资料，请使用手动保存的完整 JSON 文件；导出成稿不会替代完整进度备份。', 'Generated files can be downloaded again in Exported documents. Use a complete JSON file from Save file to restore all editable records. Exported documents do not replace a workspace backup.']
    ]
  }
};

Object.assign(pageHelpContent52,{
 resumes:{title:['简历管理中心','Resume manager'],sections:[['版本隔离','Independent versions','最近修改区域是已有简历的快捷入口。新建、复制、重命名或设置院校；每份简历的内容与设计互不影响，删除需要两次确认。','Manage independent resume versions, targets and copies. Deletion requires two confirmations.']]},
 'export-center':{title:['统一导出中心','Export center'],sections:[['先核对再导出','Review before exporting','选择当前版本和文件格式，检查内容及分页后确认导出。文件名不修改版本名称；保存失败会停止导出。所有Word模板保持原生可编辑。','Select a version, filename and format, inspect preflight and preview, then export. All Word templates remain editable.']]},
 'learning-review':{title:['错题与收藏','Review and collections'],sections:[['待复习与已掌握','Review and mastery','错题按永久题目身份保留一条记录。收藏夹由你手动整理；掌握状态与收藏相互独立。筛选后可组卷，整组提交后再查看答案及笔记。','Mistakes are deduplicated by identity. Folders and mastery are independent. Submit a complete group before viewing answers and notes.']]},
 'question-bank':{title:['题库管理','Question bank management'],sections:[['逐题维护','Edit individual questions','浏览、搜索和分页读取题目，可直接新增或修改题目。旧JSON不会静默覆盖本地修改；导入冲突须明确选择，学习历史与个人笔记保留。','Browse, search and edit individual questions. Imports detect conflicts with local edits and preserve learning history.']]},
 'quiz-history':{title:['答题历史','Practice history'],sections:[['当时的评分依据','Historical grading','历史保留交卷时的题目、答案和分数快照。之后更改题库标准答案不会重算过去的成绩；正在作答的同题不显示旧解析或笔记。','Results retain question and grading snapshots from submission. Later bank changes do not recalculate scores.']]},
 'learning-stats':{title:['学习统计','Learning statistics'],sections:[['统计口径','Counting rules','可查看最近7天、30天及全部记录。作答题次与不同题目数分开计算，未提交练习不计入正式统计。','Choose seven days, thirty days or all time. Attempts and unique questions are counted separately; drafts are excluded.']]},
 'resume-editor':{title:['简历编辑工作区','Resume editor'],sections:[['继承、独立、隐藏','Inheritance, overrides and visibility','字段可继承底稿、使用当前版本独立内容，或单独隐藏。主动清空也是独立修改；同步底稿需要确认。撤销和重做在保存后仍可使用。','Inherit master values, override independently, or hide fields. Empty overrides are preserved and restores require confirmation.']]},
 'resume-review':{title:['简历只读审阅','Read-only resume review'],sections:[['安全审阅','Safe reading','精简版和空间不足时使用只读审阅。可以查看当前版本与进入导出；内容编辑和排版请在宽屏完整版进行。','Read and export the selected version. Use full mode in a wider viewport to edit its content and design.']]},
 question:{title:['题目与个人笔记','Question and notes'],sections:[['同一份笔记','Shared personal notes','个人笔记独立保存并在各学习页面共享。题目处于未交卷练习中时，旧笔记和标准解析暂不显示，提交后恢复。','Personal notes are shared across learning views and stay separate from standard explanations. They are hidden while the question is in an unfinished group.']]}
});

function getPageHelp52(route = ctx.state?.route || 'home', studioTab = ctx.studioTab || 'content') {
  const currentRoute = String(route || 'home');
  const pageKey = currentRoute.startsWith('resume-editor:')?'resume-editor':currentRoute.startsWith('resume-review:')?'resume-review':currentRoute.startsWith('question:')?'question':currentRoute.startsWith('classic:') ? 'classic' : currentRoute.startsWith('school:') ? 'school' : currentRoute === 'backup' ? 'settings' : currentRoute;
  const entry = pageKey === 'studio' ? studioHelpContent52[studioTab] || studioHelpContent52.content : pageHelpContent52[pageKey];
  const content = entry || {
    title: ['当前页面', 'Current page'],
    sections: [['使用当前页面', 'Using this page', '通过左侧菜单选择需要的工具。修改资料后会自动保存，也可用菜单底部的“手动保存”留存完整本地文件。', 'Choose a tool from the menu. Edits save automatically; Save file at the bottom of the menu creates a complete local file.']]
  };
  return {
    key: currentRoute + (pageKey === 'studio' ? ':' + studioTab : '') + ':' + (ctx.state?.uiLang || 'zh'),
    title: tr(...content.title) + tr(' · 使用提示', ' · Help'),
    html: content.sections.map(([zhTitle,enTitle,zhText,enText]) => '<section><h3>' + esc(tr(zhTitle,enTitle)) + '</h3><p>' + esc(tr(zhText,enText)) + '</p></section>').join('')
  };
}

export { getPageHelp52 };
