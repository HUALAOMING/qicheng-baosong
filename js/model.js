import { AWARD_CATS, EDU_STAGES, EXP_CATS, MODULES, PROFILE, VERSION, blankAward, blankBook, blankEducation, blankExam, blankExp, draftKeys } from './constants.js';
import { clamp, clone, dataBytes, uid, validData3 } from './utils/helpers.js';
import { ctx } from './state.js';
// 启程 · js/model.js


function newVersion (name = '我的第一份简历') {
  return {
    id : uid (), name, purpose : 'resume', filename : name, target : '', order : [...MODULES], disabled : ['learning'],
    excluded : [], hiddenFields : [], includedFields : [], moduleStyles : {
    }, titles : {
    }, summaries : {
    }, breaks : [], palette : 'pudding', background : 'accent', margin : 18, fontSize : 11, lineHeight : 1.55, gap : 10,
    orientation : 'portrait', statementLang : 'both', exportLang : 'zh', photoMode : 'appendix', photosPerRow : 2, showAvatar : true,
    avatarSize : 30, avatarShape : 'square', avatarRatioW : 2, avatarRatioH : 3, boldLabels : true, showToc : false, wordImages : false,
    wordBW : false, pptMode : 'editable', showPageNumbers : true, pageDecoration : 'plain',
    paperColor : '#ffffff', lineColor : '#d6d6d6', titleColor : '#000000', paperImage : '', layoutPreset : 'standard'
  };
}

function currentVersion () {
  return ctx.state.versions.find (v => v.id === ctx.state.activeVersion) || ctx.state.versions [0];
}

function cleanCrop (c) {
  return {
    ratio : ['original', 'id', 'square', 'circle', 'custom'].includes (c?.ratio) ? c.ratio : 'original', x : clamp (c?.x,
    0, 100, 50), y : clamp (c?.y, 0, 100, 50), zoom : clamp (c?.zoom, 1, 3, 1), w : clamp (c?.w, 1, 20, 2), h : clamp (c?.h,
    1, 20, 3)
  }
}

function cleanModuleStyle (s) {
  return {
    titleSize : clamp (s?.titleSize, 10, 28, 14), titleAlign : s?.titleAlign === 'center' ? 'center' : 'left', titleBold : s?.titleBold !== false,
    subtitleSize : clamp (s?.subtitleSize, 9, 20, 12), subtitleAlign : s?.subtitleAlign === 'center' ? 'center' : 'left',
    subtitleBold : s?.subtitleBold !== false, labelBold : s?.labelBold !== false,
    titleColor : /^#[0-9a-f]{6}$/i.test(s?.titleColor) ? s.titleColor : ''
  }
}

function moduleStyle (key, v = currentVersion ()) {
  return {
    ...cleanModuleStyle ( {
      labelBold : v.boldLabels
    }), ...(v.moduleStyles?.[key] || {
    })
  }
}

function fieldVisible (key, defaultOn = true) {
  const v = currentVersion ();
  return defaultOn ? ! v.hiddenFields.includes (key) : v.includedFields.includes (key)
}

const records = kind => kind === 'books' ? ctx.state.learning.books : ctx.state [kind];

const cats = kind => [...new Set ([...(kind === 'awards' ? AWARD_CATS : EXP_CATS), ...ctx.state [kind].map (x => x.category).filter (Boolean)])];

function photoRefs3 (s = ctx.state) {
  return [s.avatar, ...(s.media || []), ...(s.awardDraft?.photos || []), ...(s.experienceDraft?.photos || []), ...(s.practiceDraft?.photos ||
  []), ...(s.achievementDraft?.photos || []), ...(s.bookDraft?.photos || []), ...['awards', 'experiences', 'practices',
  'achievements', 'customBlocks'].flatMap (k => (s [k] || []).flatMap (x => x.photos || [])), ...(s.learning?.books ||
  []).flatMap (x => x.photos || [])].filter (Boolean)
}

function normalizeAssets3 (s = ctx.state) {
  s.assets ||= [];
  for (const p of photoRefs3 (s)) {
    let a = s.assets.find (a => a.id === p.assetId) || s.assets.find (a => a.kind === 'image' && a.data === p.data);
    if (! a && validData3 (p.data)) {
      a = {
        id : uid (), name : p.name || 'Photo', mime : p.data.slice (5, p.data.indexOf (';')), kind : 'image', data : p.data,
        size : dataBytes (p.data).length, createdAt : new Date ().toISOString (), source : 'upload'
      };
      s.assets.push (a)
    }
    if (a) {
      p.assetId = a.id;
      p.data = a.data
    }
  }
}

function snapshot3 () {
  normalizeAssets3 ();
  const s = clone (ctx.state);
  for (const p of photoRefs3 (s)) if (p.assetId && s.assets.some (a => a.id === p.assetId)) delete p.data;
  return s
}

function synchronizeEditing () {
  for (const [kind, key] of Object.entries ( {
    ...draftKeys, practices : 'practiceDraft', achievements : 'achievementDraft'
  })) ctx.editing [kind] = records (kind).some (x => x.id === ctx.state [key].id) ? ctx.state [key].id : null;
}

function fresh () {
  const version = newVersion ();
  return {
    format : 'qicheng-resume', version : 6, appVersion : VERSION, theme : 'pudding', uiLang : 'zh', onboarded : false,
    route : 'home', section : 'resume', step : 0, orientation : 'portrait', sidebarHidden : true, menuOpen : ['start'],
    profile : Object.fromEntries (PROFILE.map (([key]) => [key, ''])), education : EDU_STAGES.slice (0, 3).map (blankEducation),
    statement : {
      zh : '', en : '', otherLanguage : '', other : '', strengths : '', hobbies : ''
    }, academics : {
      languageLearning : '', certificates : ''
    }, awards : [], experiences : [], practices : [], achievements : [], exams : [], learning : {
      readingNotes : '', plan : '', notes : '', books : []
    }, dreamSchools : [], awardDraft : blankAward (), experienceDraft : blankExp (), examDraft : blankExam (), bookDraft : blankBook (),
    practiceDraft : {
      ...blankExp (), category : '社会实践', photos : [], attachments : []
    }, achievementDraft : {
      id : uid (), title : '', category : '研究与实验', date : '', role : '', method : '', result : '', reflection : '', note : '',
      photos : [], attachments : []
    }, avatar : null, avatarCrop : {
      x : 50, y : 50, zoom : 1
    }, customBlocks : [], media : [], versions : [version], activeVersion : version.id, assets : [], exportHistory : [],
    introductions : [], introductionDraft : {id:'',title:'',language:'',minutes:'1',seconds:'0',note:'',body:''},
    chartExamIds : [], chartSelectionSet : false, chartMetric : 'totalScore', chartSubject : '', organizeModes : {
      awards : 'scope', experiences : 'custom', practices : 'custom'
    }, filePackageName : '我的个人资料', savedAt : null
  };
}
export { fresh, newVersion, currentVersion, cleanCrop, cleanModuleStyle, moduleStyle, fieldVisible, records, cats, photoRefs3, normalizeAssets3, snapshot3, synchronizeEditing };
