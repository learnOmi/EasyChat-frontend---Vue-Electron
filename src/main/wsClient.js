import WebSocket from 'ws'
import store from './store'
import {
  saveOrUpdateChatSessionBatch4Init,
  saveOrUpdate4Message,
  selectUserSessionByContactId
} from './db/ChatSessionUserModel'
import {
  saveMessageBatch,
  saveMessage,
  updateMessage,
  updateStatusAsc
} from './db/ChatMessageModel'
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

// 心跳间隔：与服务端 Constants.WS_HEART_BEAT_INTERVAL_SECONDS 保持一致（5 秒）
const HEARTBEAT_INTERVAL = 5000
// 心跳看门狗超时：取心跳间隔的 3 倍，可容忍连续 2 次下行应答丢失后才判定断链
const HEARTBEAT_TIMEOUT = HEARTBEAT_INTERVAL * 3

const resetHeartbeatTimeout = () => {
  if (heartbeatTimeout) clearTimeout(heartbeatTimeout)
  heartbeatTimeout = setTimeout(() => {
    console.log('心跳超时，连接可能已断开')
    ws.terminate()
  }, HEARTBEAT_TIMEOUT)
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
    // 立即启动看门狗：若只依赖下行帧来首次启动，链路上行通、下行不通（半开）时永远收不到帧、也就永远不触发超时
    resetHeartbeatTimeout()
    maxReConnectTimes = 5
    lockReconnect = false

    heartbeatTimer = setInterval(() => {
      if (ws != null && ws.readyState === 1) {
        ws.send('heart beat')
        // 这里绝不能调用 resetHeartbeatTimeout()：看门狗必须只由「收到下行帧」来重置。
        // 若在此处重置，等于自己给自己续命，无论对端是否存活都会每 5 秒重置一次，看门狗彻底失效（原实现的 bug）。
      }
    }, HEARTBEAT_INTERVAL)
  }

  // 下行消息处理逻辑抽成具名函数，注册时再由 onmessage 包一层异常收口（见下方）。
  const onMessage = async (e) => {
    // 任何下行帧（含服务端的心跳应答「heart」）都证明链路存活，重置看门狗
    resetHeartbeatTimeout()

    let message
    try {
      message = JSON.parse(e.data)
    } catch (err) {
      // 服务端心跳应答是纯文本「heart」，不是 JSON；其它非 JSON 脏数据同样在此丢弃。
      // 不能把解析异常抛出去，否则会中断 onmessage，连日志和后续处理都做不了（原实现会直接抛错）。
      return
    }
    console.log('收到服务器消息', e.data)
    const messageType = message.messageType
    const sessionInfo = {}
    let dbSessionInfo = {}
    const leaveGroupUserId = message.extendData
    const sentMessageStatusList = (message.extendData || {}).sentMessageStatusList || []
    const chatMessageList = message.extendData.chatMessageList || []

    switch (messageType) {
      // ws连接成功
      case 0:
        // 保存会话信息
        await saveOrUpdateChatSessionBatch4Init(message.extendData.chatSessionList)
        // 保存消息
        // 注意：下面不能直接写 `await saveMessageBatch(...)` 然后另起一行以 `(` 开头，
        // JS 的 ASI 不会在 `(` 前补分号，两行会被解析成 saveMessageBatch(x)(y)——即把返回值当函数再调一次。
        await saveMessageBatch(chatMessageList)
        chatMessageList.forEach(sendAck)
        // 回补「我发出的消息」的送达状态：离线期间被对方 ACK 的消息，服务端推送不到，重连时随 INIT 带回
        for (const item of sentMessageStatusList) {
          // 只增不减：仅在本地状态低于目标状态时推进，避免把已送达(2)覆盖回已发送(1)
          await updateStatusAsc(item.messageId, item.status)
          // 通知渲染进程就地更新内存里的消息状态（复用 messageType=15 的分支）
          sender.send('receiveMessage', {
            messageType: 15,
            messageId: item.messageId,
            status: item.status
          })
        }
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
        if (messageType == 2 || messageType == 5) {
          sendAck(message)
        }
        dbSessionInfo = await selectUserSessionByContactId(message.contactId)
        message.extendData = dbSessionInfo
        if (messageType == 11 && leaveGroupUserId == store.getUserId()) {
          break
        }
        sender.send('receiveMessage', message)
        break

      // 文件上传完成
      case 6:
        // 只增不减：仅在本地状态低于目标状态时推进，避免把已送达(2)覆盖回已发送(1)
        await updateStatusAsc(message.messageId, message.status)
        sender.send('receiveMessage', message)
        break

      // 强制下线
      case 7:
        sender.send('receiveMessage', message)
        closeWs()
        break

      // 修改群昵称
      case 10:
        await updateGroupName(message.contactId, message.extendData)
        sender.send('receiveMessage', message)
        break

      case 15:
        await updateMessage({ status: message.status }, { messageId: message.messageId })
        sender.send('receiveMessage', message)
        break
    }
  }

  // WebSocket 的事件回调没有调用方 await，async 函数体里抛出的异常会变成
  // unhandled rejection（Node 只打一行警告，且这条消息的后续逻辑被中断）。
  // 统一在边界收口：处理失败打日志，但不让异常逃逸，也不影响连接继续收发。
  ws.onmessage = (e) => {
    onMessage(e).catch((error) => {
      console.error(`处理下行消息失败: ${e.data}`, error)
    })
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

const sendAck = (message) => {
  if (!message || message.sendUserId === store.getUserId()) return
  if (message.messageType !== 2 && message.messageType !== 5) return
  if (ws == null || ws.readyState !== 1) return
  ws.send(
    JSON.stringify({
      messageType: 14,
      messageId: message.messageId
    })
  )
}

export { initWs, closeWs }
