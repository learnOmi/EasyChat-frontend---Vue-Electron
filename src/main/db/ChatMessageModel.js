import { insertOrReplace } from './ADB'
import store from '../store'
import { updateNoReadCount } from './ChatSessionUserModel'

const saveMessage = async (data) => {
  data.userId = store.getUserId()
  return insertOrReplace('chat_message', data)
}

const saveMessageBatch = async (messageList) => {
  const chatSessionCountMap = {}
  messageList.forEach((element) => {
    let contactId = element.contactType == 1 ? element.contactId : element.sendUserId
    let noReadCount = chatSessionCountMap[contactId]
    if (!noReadCount) {
      chatSessionCountMap[contactId] = 1
    } else {
      chatSessionCountMap[contactId] = noReadCount + 1
    }
  })

  // 更新未读消息数
  for (let item in chatSessionCountMap) {
    await updateNoReadCount({ contactId: item, noReadCount: chatSessionCountMap[item] })
  }

  // 批量插入
  for (let item of messageList) {
    await saveMessage(item)
  }
}

export { saveMessage, saveMessageBatch }
