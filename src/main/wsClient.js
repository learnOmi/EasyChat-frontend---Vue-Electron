import WebSocket from 'ws'
import store from './store'
import { saveOrUpdateChatSessionBatch4Init } from './db/ChatSessionUserModel'
import { saveMessageBatch } from './db/ChatMessageModel'
import { updateContactNoReadCount } from './db/UserSettingModel'
const NODE_ENV = process.env.NODE_ENV

let ws = null
let maxReConnectTimes = null
let wsUrl = null
let sender = null
let needReconnect = null
let lockReconnect = false

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

  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    ws.send('heart beat')
    maxReConnectTimes = 5
  }

  ws.onmessage = async (e) => {
    console.log('收到服务器消息', e.data)
    const message = JSON.parse(e.data)
    const messageType = message.messageType
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
        createWs()
        lockReconnect = false
      }, 5000)
    } else {
      console.log('连接超时')
    }
  }

  setInterval(() => {
    if (ws != null && ws.readyState === 1) {
      ws.send('heart beat')
    }
  }, 5000)
}

const closeWs = () => {
  needReconnect = false
  ws.close()
}

export { initWs, closeWs }
