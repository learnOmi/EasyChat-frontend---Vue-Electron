import { insertOrReplace, queryCount, queryAll } from './ADB'
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

const selectMessageList = async (query) => {
  const { sessionId, pageNo, maxMessageId } = query
  let sql = 'select count(1) from chat_message where session_id ? and user_id = ?'
  const totalCount = await queryCount(sql, [sessionId, store.getUserId()])
  const { pageTotal, offset, limit } = getPageOffset(pageNo, totalCount)

  const params = [sessionId, store.getUserId()]
  sql = 'select * from chat_message where session_id ? and user_id = ?'
  if (maxMessageId) {
    sql += ' and message_id <= ?'
    params.push(maxMessageId)
  }
  params.push(offset)
  params.push(limit)
  sql += ' order by message_id asc limit ?, ?'
  const dataList = await queryAll(sql, params)
  return { dataList, pageTotal, pageNo }
}

const getPageOffset = (pageNo, totalCount) => {
  const pageSize = 20
  const pageTotal =
    totalCount % pageSize == 0 ? totalCount / pageSize : Math.floor(totalCount / pageSize) + 1
  pageNo = pageNo <= 1 ? 1 : pageNo
  pageNo = pageNo >= pageTotal ? pageTotal : pageNo
  return {
    pageTotal,
    offset: (pageNo - 1) * pageSize,
    limit: pageSize
  }
}

export { saveMessageBatch, selectMessageList }
