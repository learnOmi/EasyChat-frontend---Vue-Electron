import { queryOne, update, insertOrIgnore, run, queryAll } from './ADB'
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

const selectUserSessionList = () => {
  let sql = 'select * from chat_session_user where user_id = ? and status = 1'
  return queryAll(sql, [store.getUserId()])
}

const delChatSession = (contactId) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    status: 0
  }
  return update('chat_session_user', sessionInfo, paramData)
}

const topChatSession = (contactId, topType) => {
  const paramData = {
    userId: store.getUserId(),
    contactId: contactId
  }
  const sessionInfo = {
    topType: topType
  }
  return update('chat_session_user', sessionInfo, paramData)
}

const updateSessionInfo4Message = async (
  currentSessionId,
  { sessionId, contactName, lastMessage, lastReceiveTime, contactId, memberCount }
) => {
  const params = [lastMessage, lastReceiveTime]
  let sql = 'update chat_session_user set last_message = ?, last_receive_time = ?, status = 1'
  if (contactName) {
    sql += ', contact_name = ?'
    params.push(contactName)
  }
  if (memberCount != null) {
    sql += ', member_count = ?'
    params.push(memberCount)
  }
  if (sessionId !== currentSessionId) {
    sql += ', no_read_count = no_read_count + 1'
  }
  sql += ' where contact_id = ? and user_id = ?'
  params.push(contactId)
  params.push(store.getUserId())
  return run(sql, params)
}

const readAll = (contactId) => {
  let sql = 'update chat_session_user set no_read_count = 0 where user_id = ? and contact_id = ?'
  return run(sql, [store.getUserId(), contactId])
}

const saveOrUpdate4Message = async (currentSessionId, sessionInfo) => {
  let sessionData = await selectUserSessionByContactId(sessionInfo.contactId)
  if (sessionData) {
    updateSessionInfo4Message(currentSessionId, sessionInfo)
  } else {
    sessionInfo.noReadCount = 1
    await addChatSession(sessionInfo)
  }
}

export {
  saveOrUpdateChatSessionBatch4Init,
  updateNoReadCount,
  selectUserSessionByContactId,
  selectUserSessionList,
  delChatSession,
  topChatSession,
  updateSessionInfo4Message,
  readAll,
  saveOrUpdate4Message
}
