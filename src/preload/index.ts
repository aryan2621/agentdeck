import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AgentDeckApi } from '../shared/ipc'

const call = (name: string) => (...args: unknown[]) => ipcRenderer.invoke(`api:${name}`, ...args)
const subscribe = <A extends unknown[]>(channel: string, cb: (...a: A) => void): (() => void) => {
  const h = (_: unknown, ...a: unknown[]): void => cb(...(a as A))
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.removeListener(channel, h)
}

const api: AgentDeckApi = {
  addProject: call('addProject'),
  pathForFile: (f) => webUtils.getPathForFile(f),
  listProjects: call('listProjects'),
  listSessions: call('listSessions'),
  listModels: call('listModels'),
  providerModes: call('providerModes'),
  createSession: call('createSession'),
  getEvents: call('getEvents'),
  sendMessage: call('sendMessage'),
  interrupt: call('interrupt'),
  respondToApproval: call('respondToApproval'),
  archiveSession: call('archiveSession'),
  renameSession: call('renameSession'),
  getLimits: call('getLimits'),
  sessionDiff: call('sessionDiff'),
  commitSession: call('commitSession'),
  searchSessions: call('searchSessions'),
  listHistory: call('listHistory'),
  importHistory: call('importHistory'),
  listMcp: call('listMcp'),
  listFiles: call('listFiles'),
  listCheckpoints: call('listCheckpoints'),
  rewindSession: call('rewindSession'),
  rewindPreview: call('rewindPreview'),
  checkTool: call('checkTool'),
  pushSession: call('pushSession'),
  createPr: call('createPr'),
  getSettings: call('getSettings'),
  setSettings: call('setSettings'),
  listAccounts: call('listAccounts'),
  addAccount: call('addAccount'),
  accountLogin: call('accountLogin'),
  moveSession: call('moveSession'),
  sessionUsage: call('sessionUsage'),
  usageSummary: call('usageSummary'),
  removeAccount: call('removeAccount'),
  configureSession: call('configureSession'),
  branchStatus: call('branchStatus'),
  openFile: call('openFile'),
  revertFile: call('revertFile'),
  revertHunk: call('revertHunk'),
  exportSession: call('exportSession'),
  termOpen: call('termOpen'),
  termWrite: call('termWrite'),
  termResize: call('termResize'),
  onTermData: (cb) => subscribe('evt:term', cb),
  onEvent: (cb) => subscribe('evt:event', cb),
  onSelectSession: (cb) => subscribe('evt:select', cb),
  onSessionUpdated: (cb) => subscribe('evt:session', cb),
} as AgentDeckApi

contextBridge.exposeInMainWorld('api', api)
