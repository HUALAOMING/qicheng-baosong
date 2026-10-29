// Kept independent of the application imports so missing/broken modules cannot produce a blank screen.
(async () => {
  function showFailure(error) {
    const root = document.getElementById('app');
    root.innerHTML = '<main class="startup-error"><h1>启程无法正常加载。</h1><p id="startupErrorDetail"></p><p>本机数据不会自动删除。请先尝试导出，再重新加载。</p><div class="actions"><button id="retryStartup">重新加载</button><button id="exportEmergency">尝试导出本地数据</button><button class="danger-button" id="clearEmergency">清除本地数据</button></div><p id="emergencyStatus" role="status"></p></main>';
    document.getElementById('startupErrorDetail').textContent = error?.message || String(error);
    document.getElementById('retryStartup').onclick = () => location.reload();
    document.getElementById('exportEmergency').onclick = async () => {
      const status = document.getElementById('emergencyStatus');
      try {
        const {storage} = await import('./storage.js');
        const data = await storage.getAll();
        if (!Object.keys(data).length && globalThis.QICHENG_EMBEDDED?.draft) data.current = globalThis.QICHENG_EMBEDDED.draft;
        if (!Object.keys(data).length) throw new Error('没有可导出的本地数据。');
        for (const key of Object.keys(data)) if (key.startsWith('resource:official:') || key === '__seedCleared') delete data[key];
        if (data.current) for (const key of ['route','section','step','sidebarHidden','menuOpen']) delete data.current[key];
        const content = {app:'Qicheng',backupVersion:1,appVersion:'5.3.0',createdAt:new Date().toISOString(),data};
        const blob = new Blob([JSON.stringify(content,null,2)],{type:'application/json'});
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = 'Qicheng_Emergency_Backup.json'; a.textContent = '保存紧急备份';
        status.textContent = '已生成本地数据备份。点击保存；文件仍需通过常规恢复校验。'; status.append(a);
        a.click(); setTimeout(() => URL.revokeObjectURL(url),60000);
      } catch (e) { status.textContent = '无法导出：' + e.message; }
    };
    document.getElementById('clearEmergency').onclick = async () => {
      const message = '这将删除此地址的全部个人信息、学习记录、图片、附件、设置、收藏、草稿、简历版本和导出历史。请先备份。';
      if (!confirm(message + '\n继续？')) return;
      if (!confirm('最后确认：删除全部本机数据？\n' + message)) return;
      try { const {storage} = await import('./storage.js'); await storage.replaceAll({__seedCleared:true}); location.reload(); }
      catch (e) { document.getElementById('emergencyStatus').textContent = '无法清除：' + e.message; }
    };
  }
  try { const {boot} = await import('./app.js'); await boot(); }
  catch (error) { showFailure(error); }
})();
