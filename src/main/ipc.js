import { ipcMain } from 'electron'
import store from './store'
import { initWs } from './wsClient'
import { addUserSetting } from './db/UserSettingModel'
import { selectUserSessionList, delChatSession, topChatSession } from './db/ChatSessionUserModel'
import { selectMessageList } from './db/ChatMessageModel'

const onLoginOrRegister = (callback) => {
  // 监听登陆或注册
  ipcMain.on('loginOrRegister', (e, isLogin) => {
    callback(isLogin)
  })
}

const onLoginSuccess = (callback) => {
  ipcMain.on('openChat', (e, config) => {
    store.initUserId(config.userId)
    store.setUserData('token', config.token)
    addUserSetting(config.userId, config.email)
    callback(config)
    initWs(config, e.sender)
  })
}

const winTitleOp = (callback) => {
  ipcMain.on('winTitleOp', (e, data) => {
    callback(e, data)
  })
}

const onSetLocalStore = () => {
  ipcMain.on('setLocalStore', (e, { key, value }) => {
    store.setData(key, value)
  })
}

const onGetLocalStore = () => {
  ipcMain.on('getLocalStore', (e, key) => {
    e.sender.send('getLocalStoreCallback', store.getData(key))
  })
}

const onLoadSessionData = () => {
  ipcMain.on('loadSessionData', async (e) => {
    const dataList = await selectUserSessionList()
    e.sender.send('loadSessionDataCallback', dataList)
  })
}

const onDelChatSession = () => {
  ipcMain.on('delChatSession', (e, contactId) => {
    delChatSession(contactId)
  })
}

const onTopChatSession = () => {
  ipcMain.on('topChatSession', (e, { contactId, topType }) => {
    topChatSession(contactId, topType)
  })
}

const onLoadChatMessage = () => {
  ipcMain.on('loadChatMessage', async (e, data) => {
    const result = await selectMessageList(data)
    e.sender.send('loadChatMessageCallback', result)
  })
}

export {
  onLoginOrRegister,
  onLoginSuccess,
  winTitleOp,
  onGetLocalStore,
  onSetLocalStore,
  onLoadSessionData,
  onDelChatSession,
  onLoadChatMessage,
  onTopChatSession
}
