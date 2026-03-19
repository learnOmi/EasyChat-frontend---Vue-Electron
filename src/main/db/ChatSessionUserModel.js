import { queryOne, update, insertOrIgnore, run } from './ADB'
import store from '../store'

const saveOrUpdateChatSessionBatch4Init = async (chatSessionList) => {
  try {
    for (let i = 0; i < chatSessionList.length; i++) {
      const sessionInfo = chatSessionList[i]
      sessionInfo.status = 1
      let sessionData = await selectUserSessionByContactId(sessionInfo.contact_id)
      if (sessionData) {
        await updateChatSession(sessionInfo)
      } else {
        await addChatSession(sessionInfo)
      }
    }
  } catch (e) {
    console.error(e)
    throw e
  }
}

const selectUserSessionByContactId = (contactId) => {
  let sql = 'select * from chat_session_user where contact_id = ? and user_id = ?'
  return queryOne(sql, [contactId, store.getUserId()])
}

const addChatSession = (sessionInfo) => {
  sessionInfo.userId = store.getUserId()
  insertOrIgnore('chat_session_user', sessionInfo)
}

const updateChatSession = (sessionInfo) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: sessionInfo.contact_id
  }
  const updateInfo = Object.assign({}, sessionInfo)
  updateInfo.userId = null
  updateInfo.contactId = null
  return update('chat_session_user', updateInfo, paramData)
}

const updateNoReadCount = ({ contactId, noReadCount }) => {
  let sql =
    'update chat_session_user set no_read_count = no_read_count + ? where contact_id = ? and user_id = ?'
  return run(sql, [noReadCount, contactId, store.getUserId()])
}

export { saveOrUpdateChatSessionBatch4Init, updateNoReadCount }
