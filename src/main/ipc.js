import { BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import store from './store'
import { initWs, closeWs } from './wsClient'
import {
  addUserSetting,
  selectLocalUser,
  selectSettingInfo,
  updateContactNoReadCount
} from './db/UserSettingModel'
import {
  selectUserSessionList,
  delChatSession,
  topChatSession,
  updateSessionInfo4Message,
  readAll,
  updateStatus
} from './db/ChatSessionUserModel'
import { saveMessage, selectMessageList, updateMessage } from './db/ChatMessageModel'
import {
  createCover,
  saveFile2Local,
  saveAs,
  closeLocalServer,
  openLocalFolder,
  changeLocalFolder,
  downloadUpdate
} from './file'
import { getWindow, saveWindow, delWindow } from './windowProxy'
import icon from '../../resources/icon.png?asset'
const NODE_ENV = process.env.NODE_ENV

/**
 * 注册一个「异常安全」的 IPC 监听器。
 *
 * ipcMain.on 的回调没有调用方 await，只要监听器里出现未捕获异常（无论是同步 throw，
 * 还是 async 函数返回的 rejected Promise），就会变成 unhandled rejection：
 * Node 只打一行警告，渲染进程那边则永远等不到回调，表现为界面卡住。
 * 这里统一在边界收口——用 Promise.resolve().then() 把同步/异步两种失败收敛到同一个
 * catch，带上事件名打日志，避免异常逃逸成 unhandled rejection。
 *
 * @param {string} channel IPC 事件名
 * @param {(e: Electron.IpcMainEvent, ...args: any[]) => any} listener 业务监听器，可为 async
 */
const onSafe = (channel, listener) => {
  ipcMain.on(channel, (e, ...args) => {
    Promise.resolve()
      .then(() => listener(e, ...args))
      .catch((error) => {
        console.error(`处理 IPC 事件 ${channel} 失败:`, error)
      })
  })
}

const onLoginOrRegister = (callback) => {
  // 监听登陆或注册
  ipcMain.on('loginOrRegister', (e, isLogin) => {
    callback(isLogin)
  })
}

const onLoginSuccess = (callback) => {
  onSafe('openChat', async (e, config) => {
    store.initUserId(config.userId)
    store.setUserData('token', config.token)
    // 必须 await：写库失败在这里就暴露（由 onSafe 记录），否则会变成后台的 unhandled rejection，
    // 而且后续 initWs 会在「用户设置没写成功」的状态下继续跑。
    await addUserSetting(config.userId, config.email)
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
  onSafe('loadSessionData', async (e) => {
    const dataList = await selectUserSessionList()
    e.sender.send('loadSessionDataCallback', dataList)
  })
}

const onDelChatSession = () => {
  onSafe('delChatSession', async (e, contactId) => {
    await delChatSession(contactId)
  })
}

const onTopChatSession = () => {
  onSafe('topChatSession', async (e, { contactId, topType }) => {
    await topChatSession(contactId, topType)
  })
}

const onLoadChatMessage = () => {
  onSafe('loadChatMessage', async (e, data) => {
    const result = await selectMessageList(data)
    e.sender.send('loadChatMessageCallback', result)
  })
}

const onSetSessionSelected = () => {
  onSafe('setSessionSelected', async (e, { contactId, sessionId }) => {
    if (sessionId) {
      store.setUserData('currentSessionId', sessionId)
      await readAll(contactId)
    } else {
      store.deleteUserData('currentSessionId')
    }
  })
}

const onAddLocalMessage = () => {
  onSafe('addLocalMessage', async (e, data) => {
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
    updateSessionInfo4Message(store.getUserData('currentSessionId'), data)
    e.sender.send('addLocalCallback', { status: 1, messageId: data.messageId })
  })
}

const onCreateCover = () => {
  onSafe('createCover', async (e, fileBuffer) => {
    const stream = await createCover(fileBuffer)
    e.sender.send('createCoverCallback', stream)
  })
}

const onOpenNewWindow = () => {
  ipcMain.on('openNewWindow', (e, config) => {
    openMediaWindow(config)
    //e.sender.send('openNewWindowCallback', config)
  })
}

const openWindowDo = (windowId, title, path, width, height) => {
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

    newWindow.on('closed', () => {
      delWindow(windowId)
    })
  }
  return windowId
}

const openAdminWindow = ({ windowId, title, path, width, height, data }) => {
  const localServerPort = store.getUserData('localServerPort')
  data.localServerPort = localServerPort

  let newWindow = getWindow(windowId)
  if (newWindow) {
    newWindow.show()
    newWindow.setSkipTaskbar(true)
    newWindow.webContents.send('pageInitData', data)
  } else {
    newWindow = getWindow(openWindowDo(windowId, title, path, width, height))
    // 监听获取数据事件
    const readyHandler = () => {
      console.log('Received showAdminReady, sending pageInitData...')
      newWindow.webContents.send('pageInitData', data)
      // 发送完毕后，移除本次监听，避免多次触发
      ipcMain.removeListener('showAdminReady', readyHandler)
    }
    ipcMain.on('showAdminReady', readyHandler)

    newWindow.on('closed', () => {
      // 窗口关闭时，确保移除可能残留的监听器
      ipcMain.removeListener('showAdminReady', readyHandler)
    })
  }
}

const openMediaWindow = ({
  windowId,
  title = 'EasyChat',
  path,
  width = 800,
  height = 600,
  data
}) => {
  const localServerPort = store.getUserData('localServerPort')
  data.localServerPort = localServerPort

  let newWindow = getWindow(windowId)
  if (newWindow) {
    newWindow.show()
    newWindow.setSkipTaskbar(true)
    newWindow.webContents.send('pageInitData', data)
  } else {
    newWindow = getWindow(openWindowDo(windowId, title, path, width, height))
    // 监听获取数据事件
    const readyHandler = () => {
      console.log('Received showMediaReady, sending pageInitData...')
      newWindow.webContents.send('pageInitData', data)
      // 发送完毕后，移除本次监听，避免多次触发
      ipcMain.removeListener('showMediaReady', readyHandler)
    }
    ipcMain.on('showMediaReady', readyHandler)

    newWindow.on('closed', () => {
      // 窗口关闭时，确保移除可能残留的监听器
      ipcMain.removeListener('showMediaReady', readyHandler)
    })
  }
}

const onSaveAs = () => {
  onSafe('saveAs', async (e, data) => {
    await saveAs(data)
  })
}

const onLoadContactApply = () => {
  onSafe('loadContactApply', async (e) => {
    const userId = store.getUserId()
    let result = await selectSettingInfo(userId)
    let contactNoRead = 0
    if (result != null) {
      contactNoRead = result.contactNoRead
    }
    e.sender.send('loadContactApplyCallback', contactNoRead)
  })
}

const onUpdateContactNoReadCount = () => {
  onSafe('updateContactNoReadCount', async () => {
    await updateContactNoReadCount({ userId: store.getUserId() })
  })
}

const onReLogin = (callback) => {
  onSafe('reLogin', async (e) => {
    callback()
    e.sender.send('reLoginCallback')
    closeWs()
    closeLocalServer()
  })
}

const onOpenLocalFolder = () => {
  onSafe('openLocalFolder', async () => {
    await openLocalFolder()
  })
}

const onGetSysSetting = () => {
  onSafe('getSysSetting', async (e) => {
    let result = await selectSettingInfo(store.getUserId())
    e.sender.send('getSysSettingCallback', result.sysSetting)
  })
}

const onChangeLocalFolder = () => {
  onSafe('changeLocalFolder', async () => {
    await changeLocalFolder()
  })
}

const onReloadChatSession = () => {
  onSafe('reloadChatSession', async (e, { contactId }) => {
    await updateStatus(contactId)
    const chatSessionList = await selectUserSessionList()
    e.sender.send('reloadChatSessionCallback', { contactId, chatSessionList })
  })
}

const onOpenUrl = () => {
  ipcMain.on('openUrl', (e, { url }) => {
    shell.openExternal(url)
  })
}

const onDownloadUpdate = () => {
  onSafe('downloadUpdate', async (e, { id, fileName }) => {
    await downloadUpdate(id, fileName)
  })
}

const onLoadLocalUser = () => {
  onSafe('loadLocalUser', async (e) => {
    const localUser = await selectLocalUser()
    e.sender.send('loadLocalUserCallback', localUser)
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
  onSaveAs,
  onLoadContactApply,
  onUpdateContactNoReadCount,
  onReLogin,
  onOpenLocalFolder,
  onGetSysSetting,
  onChangeLocalFolder,
  onReloadChatSession,
  onOpenUrl,
  onDownloadUpdate,
  onLoadLocalUser,
  openAdminWindow
}
