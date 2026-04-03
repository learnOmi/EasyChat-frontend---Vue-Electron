import { insertOrIgnore, queryAll, queryOne, run, update } from './ADB'
import store from '../store'
import { startLocalServer } from '../file'
const os = require('os')

const userDir = os.homedir()

const updateContactNoReadCount = async ({ userId, noReadCount }) => {
  let sql = null
  if (noReadCount === 0) {
    return
  }
  if (noReadCount) {
    sql = 'update user_setting set contact_no_read = contact_no_read + ? where user_id = ?'
  } else {
    noReadCount = 0
    sql = 'update user_setting set contact_no_read = ? where user_id = ?'
  }
  await run(sql, [noReadCount, userId])
}

const addUserSetting = async (userId, email) => {
  let sql = 'select max(server_port) server_port from user_setting'
  let { serverPort } = await queryOne(sql, [])
  if (!serverPort || typeof serverPort !== 'number') {
    serverPort = 10240
  } else {
    serverPort++
  }

  const sysSetting = {
    localFileFolder: userDir + '\\.easychat\\fileStorage\\'
  }

  let resultServerPort = null
  let localFileFolder = sysSetting.localFileFolder + userId
  sql = 'select * from user_setting where user_id = ?'
  const userInfo = await queryOne(sql, [userId])
  if (userInfo) {
    const updateData = { email, ...(!userInfo.serverPort && { serverPort }) }
    await update('user_setting', updateData, { userId: userId })
    resultServerPort = updateData.serverPort ? userInfo.serverPort : serverPort
    localFileFolder = JSON.parse(userInfo.sysSetting).localFileFolder + userId
  } else {
    await insertOrIgnore('user_setting', {
      userId: userId,
      email: email,
      sysSetting: JSON.stringify(sysSetting),
      contactNoRead: 0,
      serverPort: serverPort
    })
    resultServerPort = serverPort
  }
  // TODO 启动本地服务
  startLocalServer(resultServerPort)
  store.setUserData('localServerPort', resultServerPort)
  store.setUserData('localFileFolder', localFileFolder)
}

const selectSettingInfo = (userId) => {
  let sql = 'select * from user_setting where user_id = ?'
  return queryOne(sql, [userId])
}

const updateUserSetting = async (userId, updateData) => {
  await update('user_setting', { updateData }, { userId: userId })
}

const selectLocalUser = () => {
  let sql = 'select * from user_setting where email is not null'
  return queryAll(sql, [])
}

export {
  updateContactNoReadCount,
  addUserSetting,
  selectSettingInfo,
  updateUserSetting,
  selectLocalUser
}
