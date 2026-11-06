import {uid} from './utils/helpers.js';

const DISPLAY_SCORE_FIELDS54=[['title','考试名称'],['item','展示项目'],['score','分数'],['fullMark','满分'],['classRank','班级排名'],['gradeRank','年级排名']];
function blankDisplayScore54(){return {id:'',...Object.fromEntries(DISPLAY_SCORE_FIELDS54.map(([key])=>[key,'']))};}
function prepareDisplayScore54(draft){
 const record={id:draft.id||uid(),...Object.fromEntries(DISPLAY_SCORE_FIELDS54.map(([key])=>[key,String(draft[key]??'').trim()]))};
 if(!record.title)throw Error('请填写考试名称。');
 if(!record.item)throw Error('请填写展示项目，例如总分、数学或外语。');
 if(![record.score,record.classRank,record.gradeRank].some(Boolean))throw Error('请至少填写分数或一项排名。');
 for(const key of ['score','fullMark'])if(record[key]&&Number.isFinite(Number(record[key]))&&Number(record[key])<0)throw Error('分数和满分不能为负数。');
 if(record.fullMark&&Number(record.fullMark)===0)throw Error('满分应大于零。');
 if(record.score&&record.fullMark&&Number.isFinite(Number(record.score))&&Number.isFinite(Number(record.fullMark))&&Number(record.score)>Number(record.fullMark))throw Error('分数不能高于满分。');
 return record;
}
// This projection belongs exclusively to resume content. The dashboard reads state.exams.
function displayScoreExam54(record){return {id:record.id,title:record.title,item:record.item,totalScore:record.score,totalFullMark:record.fullMark,classRank:record.classRank,gradeRank:record.gradeRank,type:'',date:'',rankScope:'',rank:'',rankTotal:'',note:'',subjects:[],displayOnly54:true};}
const DISPLAY_EXAM_FIELDS54=[['title','考试名称'],['item','展示项目'],['totalScore','分数'],['totalFullMark','满分'],['classRank','班级排名'],['gradeRank','年级排名']];
export {DISPLAY_SCORE_FIELDS54,DISPLAY_EXAM_FIELDS54,blankDisplayScore54,prepareDisplayScore54,displayScoreExam54};
