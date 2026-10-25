import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './support.mjs';
await setup();
const {ctx}=await import('../js/state.js');
const {fresh}=await import('../js/model.js');
const data=await import('../js/data.js');
const {storage}=await import('../js/storage.js');
const home=await import('../js/modules/home.js');
await data.loadBuiltinData();
test('all saved destinations appear once, the featured university retains its name, abbreviation and seal',async()=>{
  ctx.state=fresh();const [a,b,c]=data.SCHOOL_DETAILS3;ctx.state.profile.targetSchool=a.name;ctx.state.dreamSchools=[a.name,b.name,c.name,b.name];
  await home.initializeHome({});await home.saveHomePreferences({featuredSchool:b.name});
  const html=home.homeDreamSchoolsMarkup52();
  assert.equal((html.match(/data-home-dream-school52=/g)||[]).length,3);
  assert.ok(html.includes('data-featured="'+b.name+'"'));
  assert.ok(html.includes(b.abbreviation));assert.ok(html.includes(b.logo));
  assert.match(html,/home-dream-main52/);assert.match(html,/home-dream-others52/);
  assert.equal((await storage.get('settings:home')).featuredSchool,b.name);
  ctx.state.dreamSchools=[a.name];assert.equal(home.homeFeaturedSchool().name,a.name);
});
test('arbitrary school names remain escaped, and an empty list keeps the normal invitation',async()=>{
  ctx.state=fresh();ctx.state.profile.targetSchool='<院校 & "目标">';ctx.state.dreamSchools=[];await home.initializeHome({});
  const html=home.homeDreamSchoolsMarkup52();assert.doesNotMatch(html,/<院校/);assert.match(html,/&lt;院校 &amp; &quot;目标&quot;&gt;/);
  ctx.state.profile.targetSchool='';assert.match(home.homeDreamSchoolsMarkup52(),/下一站，由你定义/);
});
test('weekly drag moves an item directly to its target while retaining all seven unique snapshots',()=>{
  const quotes=Array.from({length:7},(_,index)=>({selectionKey:'book:'+index,text:'句子'+index})),first=quotes[0];
  assert.equal(home.reorderWeeklyQuotes52(quotes,0,4),true);assert.equal(quotes[4],first);assert.equal(quotes[0].selectionKey,'book:1');
  assert.equal(home.reorderWeeklyQuotes52(quotes,4,0),true);assert.equal(quotes[0],first);assert.equal(new Set(quotes.map(quote=>quote.selectionKey)).size,7);
  const before=quotes.slice();for(const [from,to]of [[-1,2],[2,7],[2,2],[2.5,1],[0,Infinity]])assert.equal(home.reorderWeeklyQuotes52(quotes,from,to),false);
  assert.deepEqual(quotes,before);
});
