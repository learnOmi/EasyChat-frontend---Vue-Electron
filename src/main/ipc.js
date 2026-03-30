import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import store from './store'
import { initWs } from './wsClient'
import { addUserSetting } from './db/UserSettingModel'
import {
  selectUserSessionList,
  delChatSession,
  topChatSession,
  updateSessionInfo4Message,
  readAll
} from './db/ChatSessionUserModel'
import { saveMessage, selectMessageList, updateMessage } from './db/ChatMessageModel'
import { createCover, saveFile2Local, saveAs } from './file'
import { getWindow, saveWindow, delWindow } from './windowProxy'
import icon from '../../resources/icon.png?asset'
const NODE_ENV = process.env.NODE_ENV

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

const onSetSessionSelected = () => {
  ipcMain.on('setSessionSelected', (e, { contactId, sessionId }) => {
    if (sessionId) {
      store.setUserData('currentSessionId', sessionId)
      readAll(contactId)
    } else {
      store.deleteUserData('currentSessionId')
    }
  })
}

const onAddLocalMessage = () => {
  ipcMain.on('addLocalMessage', async (e, data) => {
    await saveMessage(data)
    if (data.messageType === 5) {
      // 保存图片到本地；上传到服务器；生成缩略图
      await saveFile2Local(data.messageId, data.buffer, data.fileType)
      const updateInfo = {
        status: 1
      }
      await updateMessage(updateInfo, { messageId: data.messageId })
    }
    // 更新session
    data.lastReceiveTime = data.sendTime
    // TODO 更新会话
    updateSessionInfo4Message(store.getUserData('currentSessionId'), data)
    e.sender.send('addLocalCallback', { status: 1, messageId: data.messageId })
  })
}

const onCreateCover = () => {
  ipcMain.on('createCover', async (e, fileBuffer) => {
    const stream = await createCover(fileBuffer)
    e.sender.send('createCoverCallback', stream)
  })
}

const onOpenNewWindow = () => {
  ipcMain.on('openNewWindow', (e, config) => {
    openWindow(config)
    //e.sender.send('openNewWindowCallback', config)
  })
}

const openWindow = ({ windowId, title = 'EasyChat', path, width = 800, height = 600, data }) => {
  const localServerPort = store.getUserData('localServerPort')
  data.localServerPort = localServerPort

  let newWindow = getWindow(windowId)
  if (!newWindow) {
    newWindow = new BrowserWindow({
      width: width,
      height: height,
      fullscreen: false,
      fullscreenable: false,
      maximizable: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      resizable: false,
      frame: true,
      transparent: true,
      hasShadow: false,
      show: false,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: false
      }
    })

    saveWindow(windowId, newWindow)
    newWindow.setMinimumSize(600, 400)

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      newWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/index.html#${path}`)
    } else {
      newWindow.loadFile(join(__dirname, `../renderer/index.html`), { hash: path })
    }

    if (NODE_ENV === 'development') {
      newWindow.webContents.openDevTools()
    }
    newWindow.on('ready-to-show', () => {
      newWindow.show()
      newWindow.setTitle(title)
    })

    // 监听获取数据事件
    const readyHandler = () => {
      console.log('Received showMediaReady, sending pageInitData...')
      newWindow.webContents.send('pageInitData', data)
      // 发送完毕后，移除本次监听，避免多次触发
      ipcMain.removeListener('showMediaReady', readyHandler)
    }
    ipcMain.on('showMediaReady', readyHandler)

    newWindow.on('closed', () => {
      delWindow(windowId)
      // 窗口关闭时，确保移除可能残留的监听器
      ipcMain.removeListener('showMediaReady', readyHandler)
    })

    newWindow.on('closed', () => {
      delWindow(windowId)
    })
  } else {
    newWindow.show()
    newWindow.setSkipTaskbar(true)
    newWindow.webContents.send('pageInitData', data)
  }
}

const onSaveAs = () => {
  ipcMain.on('saveAs', (e, data) => {
    saveAs(data)
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
  onTopChatSession,
  onAddLocalMessage,
  onSetSessionSelected,
  onCreateCover,
  onOpenNewWindow,
  onSaveAs
}
