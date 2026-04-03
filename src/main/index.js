import { app, shell, BrowserWindow, Tray, Menu } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  onGetLocalStore,
  onLoginOrRegister,
  onLoginSuccess,
  onSetLocalStore,
  winTitleOp,
  onLoadSessionData,
  onDelChatSession,
  onTopChatSession,
  onLoadChatMessage,
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
} from './ipc'
import { saveWindow } from './windowProxy'

const login_width = 300
const login_height = 370
const register_height = 490

let contextMenu = [
  {
    label: '退出',
    click: () => {
      app.quit()
    }
  }
]

let mainWindow
let tray
function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: login_width,
    height: login_height,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    resizable: false,
    frame: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false
    }
  })

  saveWindow('main', mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  tray = new Tray(icon)
  const menu = Menu.buildFromTemplate(contextMenu)
  tray.setToolTip('EasyChat')
  tray.setContextMenu(menu)
  tray.on('click', () => {
    mainWindow.setSkipTaskbar(false)
    mainWindow.show()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 监听登陆或注册
  onLoginOrRegister((isLogin) => {
    mainWindow.setResizable(true)
    if (isLogin) {
      mainWindow.setSize(login_width, login_height)
    } else {
      mainWindow.setSize(login_width, register_height)
    }
    mainWindow.setResizable(false)
  })

  onLoginSuccess((config) => {
    mainWindow.setResizable(true)
    mainWindow.setSize(850, 800)
    mainWindow.center()
    mainWindow.setMaximizable(true)
    mainWindow.setMinimumSize(800, 600)

    if (config.admin) {
      contextMenu.unshift({
        label: '管理后台',
        click: function () {
          openAdminWindow({
            windowId: 'admin',
            title: '管理后台',
            path: '/admin',
            width: config.screenWidth * 0.8,
            height: config.screenHeight * 0.8,
            data: { token: config.token }
          })
        }
      })
    }
    contextMenu.unshift({
      label: '用户:' + config.nickName,
      click: () => {}
    })
    tray.setContextMenu(Menu.buildFromTemplate(contextMenu))
  })

  // 监听窗口标题操作
  winTitleOp((e, { action, data }) => {
    const webContents = e.sender
    const win = BrowserWindow.fromWebContents(webContents)
    switch (action) {
      case 'minimize':
        win.minimize()
        break
      case 'maximize':
        win.maximize()
        break
      case 'close':
        if (data.closeType === 0) {
          win.close()
        } else {
          win.setSkipTaskbar(true)
          win.hide()
        }
        break
      case 'unmaximize':
        win.unmaximize()
        break
      case 'setTop':
        win.setAlwaysOnTop(data.isTop)
        break
    }
  })

  createWindow()

  onSetLocalStore()
  onGetLocalStore()
  onLoadSessionData()
  onDelChatSession()
  onTopChatSession()
  onLoadChatMessage()
  onAddLocalMessage()
  onSetSessionSelected()
  onCreateCover()
  onOpenNewWindow()
  onSaveAs()
  onLoadContactApply()
  onUpdateContactNoReadCount()
  onReLogin(() => {
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(login_width, login_height)
    mainWindow.setSize(login_width, login_height)
    mainWindow.setResizable(false)
    mainWindow.center()
  })
  onOpenLocalFolder()
  onGetSysSetting()
  onChangeLocalFolder()
  onReloadChatSession()
  onOpenUrl()
  onDownloadUpdate()
  onLoadLocalUser()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
