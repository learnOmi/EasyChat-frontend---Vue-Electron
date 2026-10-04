import { app, shell, BrowserWindow, Tray, Menu, dialog } from 'electron'
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
import { init as initLocalDb } from './db/ADB'

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
app
  .whenReady()
  .then(async () => {
    // 本地数据库必须先初始化完成（建表 + 补列 + 列名映射），再创建窗口、注册 IPC。
    // 失败就直接退出，不让应用带着空的 globalColumnsMap 继续跑：
    // 那样所有写库操作都会报 "Cannot read properties of undefined"，
    // 把「建表失败」这个真正的原因埋在一堆看似无关的报错里。
    try {
      await initLocalDb()
    } catch (error) {
      console.error('本地数据库初始化失败，应用退出:', error)
      dialog.showErrorBox(
        '本地数据库初始化失败',
        `本地数据初始化失败，程序无法启动。\n\n${(error && error.message) || error}`
      )
      app.quit()
      return
    }

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
  .catch((error) => {
    // 启动流程中任何未捕获的异常都在这里收口，避免静默失败后应用带病运行
    console.error('主进程启动失败:', error)
    dialog.showErrorBox('启动失败', `程序启动失败。\n\n${(error && error.message) || error}`)
    app.quit()
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
