'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/** 暴露给渲染进程的安全 API */
contextBridge.exposeInMainWorld('api', {
  addRecord: (rec) => ipcRenderer.invoke('records:add', rec),
  updateRecord: (id, rec) => ipcRenderer.invoke('records:update', id, rec),
  deleteRecord: (id) => ipcRenderer.invoke('records:delete', id),
  listRecords: (range) => ipcRenderer.invoke('records:list', range),
  queryRecords: (filters) => ipcRenderer.invoke('records:query', filters),
  listCategories: () => ipcRenderer.invoke('records:categories'),
  overview: (range, currency, rate) => ipcRenderer.invoke('records:overview', range, currency, rate),
  getReport: (period, anchor, currency, rate) =>
    ipcRenderer.invoke('report:get', { period, anchor, currency, rate }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  refreshRate: () => ipcRenderer.invoke('rate:refresh'),
  exportCsv: () => ipcRenderer.invoke('data:exportCsv'),
  backupDb: () => ipcRenderer.invoke('data:backupDb'),
});
