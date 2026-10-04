import { insertOrReplace, queryCount, queryAll, update, queryOne, run } from './ADB'
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
  let sql = 'select count(1) from chat_message where session_id = ? and user_id = ?'
  const totalCount = await queryCount(sql, [sessionId, store.getUserId()])
  const { pageTotal, offset, limit } = getPageOffset(pageNo, totalCount)

  const params = [sessionId, store.getUserId()]
  sql = 'select * from chat_message where session_id = ? and user_id = ?'
  if (maxMessageId) {
    sql += ' and message_id <= ?'
    params.push(maxMessageId)
  }
  params.push(offset)
  params.push(limit)
  sql += ' order by message_id desc limit ?, ?'
  const dataList = await queryAll(sql, params)
  return { dataList, pageTotal, pageNo }
}

const selectByMessageId = async (messageId) => {
  const sql = 'select * from chat_message where message_id = ?'
  return await queryOne(sql, [messageId])
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

const updateMessage = (data, paramData) => {
  paramData.userId = store.getUserId()
  return update('chat_message', data, paramData)
}

/**
 * 只增不减地推进消息状态（幂等保护）
 * 仅当本地库中 status 小于目标状态时才更新，防止「文件上传完成」等延迟/重放帧
 * 把已送达(2)覆盖回已发送(1)。通用的 update 只能拼等值条件，写不出 status < ?，故走原生 SQL。
 * @param {number} messageId 消息ID
 * @param {number} status 目标状态
 * @returns {Promise<number>} 影响行数，0 表示状态未低于目标值、无需更新
 */
const updateStatusAsc = (messageId, status) => {
  const sql =
    'update chat_message set status = ? where message_id = ? and user_id = ? and status < ?'
  return run(sql, [status, messageId, store.getUserId(), status])
}

export {
  saveMessage,
  saveMessageBatch,
  selectMessageList,
  updateMessage,
  selectByMessageId,
  updateStatusAsc
}
