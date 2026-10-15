// One IndexedDB object store, no ORM and no historical data migrations.
const DATABASE_NAME = 'qicheng-v4' + (globalThis.QICHENG_EMBEDDED?.id ? '-copy-' + globalThis.QICHENG_EMBEDDED.id : '');
const STORE = 'records';
let connection = null;
let opening = null;

function storageOpen () {
  if (connection) return Promise.resolve (connection);
  if (opening) return opening;
  opening = new Promise ((resolve, reject) => {
    if (! globalThis.indexedDB) {
      reject (new Error ('此浏览器无法使用本地数据库，请使用系统浏览器。')); return;
    }
    let settled = false; const timeout = setTimeout (() => finish (new Error ('本地数据库无法打开。请关闭其他启程窗口后重新加载。')), 10000); function finish (error,
    db) {
      if (settled) {
        db?.close (); return;
      }
      settled = true; clearTimeout (timeout); if (error) reject (error); else resolve (db);
    }
    let request; try {
      request = indexedDB.open (DATABASE_NAME, 1);
    }
    catch (error) {
      finish (error); return;
    }
    request.onupgradeneeded = () => {
      if (! request.result.objectStoreNames.contains (STORE)) request.result.createObjectStore (STORE);
    }; request.onerror = () => finish (request.error || new Error ('无法打开本地数据库。')); request.onblocked = () => finish (new Error ('数据库被其他窗口占用，请关闭其他启程窗口后重试。')); request.onsuccess = () =>
    {
      const db = request.result; db.onversionchange = () => {
        db.close (); if (connection === db) connection = null;
      }; db.onclose = () => {
        if (connection === db) connection = null;
      }; finish (null, db);
    };
  }).then (db => {
    connection = db; return db;
  }).finally (() => {
    opening = null;
  });
  return opening;
}

async function storageTransaction (mode, operate) {
  const db = await storageOpen ();
  return new Promise ((resolve, reject) => {
    let tx; try {
      try {
        tx = db.transaction (STORE, mode, mode === 'readwrite' ? {
          durability : 'strict'
        } : undefined);
      }
      catch (e) {
        if (e.name !== 'TypeError') throw e; tx = db.transaction (STORE, mode);
      }
      let result; tx.oncomplete = () => resolve (result); tx.onabort = () => reject (tx.error || new Error ('本地数据操作未完成，原数据已保留。')); tx.onerror = () =>
      {
      }; operate (tx.objectStore (STORE), value => {
        result = value;
      }, tx);
    }
    catch (error) {
      try {
        tx?.abort ();
      }
      catch {
      }
      reject (error);
    }
  });
}

function storageGet (key) {
  return storageTransaction ('readonly', (store, done) => {
    const request = store.get (key); request.onsuccess = () => done (request.result);
  });
}
function storageSet (key, value) {
  return storageTransaction ('readwrite', store => {
    store.put (value, key);
  });
}
function storageRemove (key) {
  return storageTransaction ('readwrite', store => {
    store.delete (key);
  });
}
function storageClear () {
  return storageTransaction ('readwrite', store => {
    store.clear ();
  });
}
function storageGetAll () {
  return storageTransaction ('readonly', (store, done) => {
    const result = Object.create (null); const request = store.openCursor (); request.onsuccess = () => {
      const cursor = request.result; if (! cursor) {
        done (result); return;
      }
      result [cursor.key] = cursor.value; cursor.continue ();
    };
  });
}
function storageUpdate (key, updater) {
  return storageTransaction ('readwrite', (store, done, tx) => {
    const request = store.get (key); request.onsuccess = () => {
      try {
        const value = updater (request.result); if (value && typeof value.then === 'function') throw new TypeError ('update() 回调必须同步完成。'); store.put (value,
        key); done (value);
      }
      catch (error) {
        tx.abort ();
      }
    };
  });
}
function storageReplaceAll (records) {
  return storageTransaction ('readwrite', store => {
    store.clear (); for (const [key, value] of Object.entries (records)) store.put (value, key);
  });
}
// Merge related records in one transaction; failed writes leave every old value intact.
function storageSetMany (records) {
  return storageTransaction ('readwrite', store => {
    for (const [key, value] of Object.entries (records)) store.put (value, key);
  });
}
function storageClose () {
  connection?.close ();
  connection = null;
}
const storage = {
  open : storageOpen, close : storageClose, get : storageGet, set : storageSet, update : storageUpdate, remove : storageRemove,
  getAll : storageGetAll, clear : storageClear, replaceAll : storageReplaceAll, setMany : storageSetMany
};
export { storage, DATABASE_NAME };
