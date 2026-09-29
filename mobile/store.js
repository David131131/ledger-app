'use strict';

// Resolve writes only on transaction completion (a successful request alone is not durable).
const ledgerStore = (() => {
  const ready = new Promise((resolve, reject) => {
    const request = indexedDB.open('ledger-mobile-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('meta');
      request.result.createObjectStore('outbox', { keyPath: 'requestId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  async function op(store, mode, action) {
    const db = await ready;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('手机存储失败，请保留表单内容'));
    });
  }
  return {
    get: key => op('meta', 'readonly', s => s.get(key)),
    set: (key, value) => op('meta', 'readwrite', s => s.put(value, key)),
    pending: () => op('outbox', 'readonly', s => s.getAll()),
    add: row => op('outbox', 'readwrite', s => s.add(row)),
    remove: id => op('outbox', 'readwrite', s => s.delete(id)),
  };
})();
