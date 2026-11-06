// File metadata operations never read or copy attachment bytes.
function fileCollection54(asset, kind) {
  return kind === 'resume' ? asset.collection === 'resume' : asset.kind === kind;
}
function folderName54(state, id) {
  return (state.assetFolders || []).find(folder => folder.id === id)?.name || '未分类';
}
function cleanFileName54(value, previous = '') {
  let name = String(value || '').trim();
  if (!name || name.length > 240 || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /^\.+$/.test(name)) throw new Error('请输入 1–240 字的名称，不能包含路径或特殊符号。');
  const extension = /\.[^.]+$/.exec(previous)?.[0];
  if (extension && !/\.[^.]+$/.test(name)) name += extension;
  if (name.length > 240) throw new Error('文件名过长，请缩短后重试。');
  return name;
}
function createFolder54(state, name, id, createdAt = new Date().toISOString()) {
  name = String(name || '').trim();
  if (!name || name.length > 100 || /[\\/:*?"<>|\x00-\x1f]/.test(name) || /^\.+$/.test(name)) throw new Error('请输入 1–100 字的文件夹名称，不能包含路径或特殊符号。');
  const folders = state.assetFolders ||= [];
  if (folders.length >= 200) throw new Error('最多创建 200 个文件夹。');
  if (folders.some(folder => folder.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error('已有同名文件夹，请使用其他名称。');
  if (!id || folders.some(folder => folder.id === id)) throw new Error('文件夹编号重复，请重试。');
  const folder = {id, name, createdAt};
  folders.push(folder);
  return folder;
}
function renameFolder54(state, id, name) {
  const folder = (state.assetFolders || []).find(folder => folder.id === id);
  if (!folder) throw new Error('文件夹不存在。');
  const temporary = {assetFolders: state.assetFolders.filter(folder => folder.id !== id)};
  folder.name = createFolder54(temporary, name, id).name;
  return folder;
}
function moveFiles54(state, ids, folderId) {
  if (folderId && !(state.assetFolders || []).some(folder => folder.id === folderId)) throw new Error('目标文件夹不存在。');
  const wanted = new Set(ids);
  for (const asset of state.assets || []) if (wanted.has(asset.id)) asset.folderId = folderId || '';
}
function removeFolder54(state, id) {
  moveFiles54(state, (state.assets || []).filter(asset => asset.folderId === id).map(asset => asset.id), '');
  state.assetFolders = (state.assetFolders || []).filter(folder => folder.id !== id);
}
function renameFile54(state, id, name) {
  const asset = (state.assets || []).find(asset => asset.id === id);
  if (!asset) throw new Error('文件不存在。');
  asset.name = cleanFileName54(name, asset.name);
  // Photo references (including version-local references) display the same filename.
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.assetId === id && Object.hasOwn(value, 'name')) value.name = asset.name;
    for (const [key, child] of Object.entries(value)) if (key !== 'assets' && key !== 'data' && child && typeof child === 'object') visit(child);
  };
  visit(state);
  return asset;
}
function filterFiles54(state, {kind, folder = '*', search = ''} = {}) {
  const query = search.toLocaleLowerCase().trim();
  return (state.assets || []).filter(asset => (!kind || fileCollection54(asset, kind)) && (folder === '*' || (asset.folderId || '') === folder) && (!query || asset.name.toLocaleLowerCase().includes(query)));
}
export {fileCollection54, folderName54, cleanFileName54, createFolder54, renameFolder54, moveFiles54, removeFolder54, renameFile54, filterFiles54};
