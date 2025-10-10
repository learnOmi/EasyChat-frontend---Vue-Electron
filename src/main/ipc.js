import { ipcMain } from 'electron'
import store from './store'
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

    callback(config)
  })
}

const winTitleOp = (callback) => {
  ipcMain.on('winTitleOp', (e, data) => {
    callback(e, data)
  })
}

export { onLoginOrRegister, onLoginSuccess, winTitleOp }
