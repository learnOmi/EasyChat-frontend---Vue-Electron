import WebSocket from 'ws'
import store from './store'
import {
  saveOrUpdateChatSessionBatch4Init,
  saveOrUpdate4Message,
  selectUserSessionByContactId
} from './db/ChatSessionUserModel'
import { saveMessageBatch, saveMessage, updateMessage } from './db/ChatMessageModel'
import { updateContactNoReadCount } from './db/UserSettingModel'
import { updateGroupName } from './db/ChatSessionUserModel'
const NODE_ENV = process.env.NODE_ENV

let ws = null
let maxReConnectTimes = null
let wsUrl = null
let sender = null
let needReconnect = null
let lockReconnect = false
let heartbeatTimer = null
let heartbeatTimeout = null

const resetHeartbeatTimeout = () => {
  if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
  heartbeatTimeout = setTimeout(() => {
    console.log('心跳超时，连接可能已断开')
    ws.terminate()
  }, 10000)
}

const clearAllTimers = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (heartbeatTimeout) {
    clearTimeout(heartbeatTimeout)
    heartbeatTimeout = null
  }
}

const initWs = (config, _sender) => {
  wsUrl = `${NODE_ENV !== 'development' ? store.getData('prodWsDomain') : store.getData('devWsDomain')}?token=${config.token}`
  sender = _sender
  needReconnect = true
  maxReConnectTimes = 5
  createWs()
}

const createWs = () => {
  if (wsUrl == null) {
    return
  }

  clearAllTimers() // ← 重连前先清旧定时器

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send('heart beat')
    maxReConnectTimes = 5
    lockReconnect = false

    heartbeatTimer = setInterval(() => {
      if (ws != null && ws.readyState === 1) {
        ws.send('heart beat')
        resetHeartbeatTimeout()
      }
    }, 5000)
  }

  ws.onmessage = async (e) => {
    console.log('收到服务器消息', e.data)
    resetHeartbeatTimeout() // ← 收到消息就重置超时

    const message = JSON.parse(e.data)
    const messageType = message.messageType
    const sessionInfo = {}
    let dbSessionInfo = {}
    const leaveGroupUserId = message.extendData

    switch (messageType) {
      // ws连接成功
      case 0:
        // 保存会话信息
        await saveOrUpdateChatSessionBatch4Init(message.extendData.chatSessionList)
        // 保存消息
        await saveMessageBatch(message.extendData.chatMessageList)
        // 更新联系人申请数
        await updateContactNoReadCount({
          userId: store.getUserId(),
          noReadCount: message.extendData.applyCount
        })
        sender.send('receiveMessage', { messageType: message.messageType })
        break

      // 好友申请
      case 4:
        await updateContactNoReadCount({
          userId: store.getUserId(),
          noReadCount: 1
        })
        sender.send('receiveMessage', { messageType: message.messageType })
        break

      case 1: // 添加好友成功
      case 2: // 聊天消息
      case 3: // 创建群成功
      case 5: // 媒体文件
      case 9: // 好友加入群组
      case 8: // 解散群聊
      case 11: //退出群聊
      case 12: //踢出群聊
        if (message.sendUserId == store.getUserId() && message.contactType == 1) {
          break
        }
        if (message.extendData && typeof message.extendData === 'object') {
          Object.assign(sessionInfo, message.extendData)
        } else {
          Object.assign(sessionInfo, message)
          if (message.contactType == 0 && message.messageType != 1) {
            sessionInfo.contactName = message.sendUserNickName
          }
          sessionInfo.lastReceiveTime = message.sendTime
        }
        if (messageType == 9 || messageType == 11 || messageType == 12) {
          sessionInfo.memberCount = message.memberCount
        }
        await saveOrUpdate4Message(store.getUserData('currentSessionId'), sessionInfo)
        await saveMessage(message)
        dbSessionInfo = await selectUserSessionByContactId(message.contactId)
        message.extendData = dbSessionInfo
        if (messageType == 11 && leaveGroupUserId == store.getUserId()) {
          break
        }
        sender.send('receiveMessage', message)
        break

      // 文件上传完成
      case 6:
        updateMessage({ status: message.status }, { messageId: message.messageId })
        sender.send('receiveMessage', message)
        break

      // 强制下线
      case 7:
        sender.send('receiveMessage', message)
        closeWs()
        break

      // 修改群昵称
      case 10:
        updateGroupName(message.contactId, message.extendData)
        sender.send('receiveMessage', message)
        break
    }
  }

  ws.onclose = () => {
    console.log('ws close')
    reconnet()
  }

  ws.onerror = (e) => {
    console.log('ws error')
    console.log(e)
    reconnet()
  }

  const reconnet = () => {
    if (!needReconnect) {
      return
    }
    if (ws != null) {
      ws.close()
    }
    if (lockReconnect) {
      return
    }
    lockReconnect = true
    if (maxReConnectTimes > 0) {
      maxReConnectTimes--
      setTimeout(() => {
        if (!needReconnect) return
        createWs()
      }, 5000)
    } else {
      console.log('连接超时')
    }
  }
}

const closeWs = () => {
  needReconnect = false
  clearAllTimers()
  ws.close()
}

export { initWs, closeWs }
