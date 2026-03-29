<template>
  <Layout>
    <template #left-content>
      <div class="drag-panel drag"></div>
      <div class="top-search">
        <el-input
          v-model="searchKey"
          placeholder="搜索联系人"
          size="small"
          clearable
          @keyup="handleSearch"
        >
          <template #suffix>
            <i class="iconfont icon-sousuo"></i>
          </template>
        </el-input>
      </div>
      <div class="chat-session-list">
        <template v-for="item in chatSessionList" :key="item.contactId">
          <ChatSession
            :data="item"
            :current-session="item.contactId == currentChatSession.contactId"
            @click="chatSessionClickHandler(item)"
            @contextmenu.stop="onContextmenu(item, $event)"
          ></ChatSession>
        </template>
      </div>
    </template>
    <template #right-content>
      <div v-if="Object.keys(currentChatSession).length > 0" class="title-panel drag">
        <div class="title">
          <span>{{ currentChatSession.contactName }}</span>
          <span v-if="currentChatSession.contactType == 1">
            ({{ currentChatSession.memberCount }})
          </span>
        </div>
      </div>
      <div
        v-if="currentChatSession.contactType == 1"
        class="iconfont icon-more no-drag"
        @click="showGroupDetail"
      ></div>
      <div v-show="Object.keys(currentChatSession).length > 0" class="chat-panel">
        <div id="message-panel" class="message-panel">
          <div
            v-for="data in messageList"
            :id="'message' + data.messageId"
            :key="data.messageId"
            class="message-item"
          >
            <template
              v-if="data.messageType == 1 || data.messageType == 2 || data.messageType == 5"
            >
              <ChatMessage :data="data" :current-chat-session="currentChatSession"></ChatMessage>
            </template>
          </div>
        </div>
        <MessageSend
          :current-chat-session="currentChatSession"
          @send-message4-local="sendMessage4LocalHandler"
        ></MessageSend>
      </div>
      <div v-show="Object.keys(currentChatSession).length == 0" class="chat-blank">
        <Blank></Blank>
      </div>
    </template>
  </Layout>
</template>

<script setup>
import Blank from '@/components/Blank.vue'
import ChatSession from './ChatSession.vue'
import MessageSend from './MessageSend.vue'
import ChatMessage from './ChatMessage.vue'
import { ref, reactive, getCurrentInstance, nextTick, onMounted, onUnmounted } from 'vue'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
const { proxy } = getCurrentInstance()

const searchKey = ref()
const search = () => {}
const chatSessionList = ref([])
const currentChatSession = ref({})
const messageList = ref([])
const messageCountInfo = {
  totalPage: 0,
  pageNo: 0,
  maxMessageId: null,
  noData: false
}

const onReceiveMessage = () => {
  window.electron.ipcRenderer.on('receiveMessage', (e, message) => {
    if (message.messageType == 6) {
      const localMessage = messageList.value.find((item) => item.messageId == message.messageId)
      if (localMessage != null) {
        localMessage.status = 1
      }
      return
    }

    let curSession = chatSessionList.value.find((item) => item.sessionId == message.sessionId)
    if (curSession == null) {
      chatSessionList.value.push(message.extendData)
    } else {
      Object.assign(curSession, message.extendData)
    }
    sortChatSessionList(chatSessionList.value)

    if (message.sessionId != currentChatSession.value.sessionId) {
      // TODO 会话需展示未读消息气泡
    } else {
      Object.assign(currentChatSession.value, message.extendData)
      messageList.value.push(message)
      gotoBottom()
    }
  })
}

const loadChatSession = () => {
  window.electron.ipcRenderer.send('loadSessionData')
}

const onLoadSessionData = () => {
  window.electron.ipcRenderer.on('loadSessionDataCallback', (e, dataList) => {
    sortChatSessionList(dataList)
    chatSessionList.value = dataList
  })
}

const onLoadChatMessage = () => {
  window.electron.ipcRenderer.on(
    'loadChatMessageCallback',
    (e, { dataList, pageTotal, pageNo }) => {
      if (pageNo == pageTotal) {
        messageCountInfo.noData = true
      }
      dataList.sort((a, b) => {
        return a.messageId - b.messageId
      })
      messageList.value = dataList.concat(messageList.value)
      messageCountInfo.pageNo = pageNo
      messageCountInfo.totalPage = pageTotal
      if (pageNo == 1) {
        messageCountInfo.maxMessageId =
          dataList.length > 0 ? dataList[dataList.length - 1].messageId : null
        gotoBottom()
      }
    }
  )
}

// 会话列表排序
const sortChatSessionList = (dataList) => {
  dataList.sort((a, b) => {
    const topTypeResult = b['topType'] - a['topType']
    if (topTypeResult != 0) {
      return topTypeResult
    }
    const timeResult = b['lastReceiveTime'] - a['lastReceiveTime']
    if (timeResult != 0) {
      return timeResult
    }
    return b['contactId'] - a['contactId']
  })
}

// 从会话列表删除
const delChatSessionList = (contactId) => {
  chatSessionList.value = chatSessionList.value.filter((item) => item.contactId != contactId)
}

// 右键
const onContextmenu = (data, e) => {
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: data.topType == 0 ? '置顶' : '取消置顶',
        onClick: () => {
          setTop(data)
        }
      },
      {
        label: '删除聊天',
        onClick: () => {
          proxy.Confirm({
            message: `确定删除与【${data.contactName}】聊天记录？`,
            okfun: () => {
              delChatSession(data.contactId)
            }
          })
        }
      }
    ]
  })
}

const setTop = (data) => {
  data.topType = data.topType == 0 ? 1 : 0
  sortChatSessionList(chatSessionList.value)
  window.ipcRenderer.send('topChatSession', { contactId: data.contactId, topType: data.topType })
}

const delChatSession = (contactId) => {
  delChatSessionList(contactId)
  currentChatSession.value = {}
  // TODO 设置选中的会话
  window.ipcRenderer.send('delChatSession', contactId)
}

// 点击打开会话
const chatSessionClickHandler = (item) => {
  currentChatSession.value = Object.assign({}, item)
  //TODO 清空未读消息记录数

  messageList.value = []
  messageCountInfo.pageNo = 0
  messageCountInfo.maxMessageId = null
  messageCountInfo.noData = false
  messageCountInfo.totalPage = 1

  loadChatMessage()
  // 设置选中session
  setSessionSelected({ contactId: item.contactId, sessionId: item.sessionId })
}

const loadChatMessage = () => {
  if (messageCountInfo.noData) {
    return
  }
  messageCountInfo.pageNo++
  window.electron.ipcRenderer.send('loadChatMessage', {
    sessionId: currentChatSession.value.sessionId,
    pageNo: messageCountInfo.pageNo,
    maxMessageId: messageCountInfo.maxMessageId
  })
}

const setSessionSelected = ({ contactId, sessionId }) => {
  window.electron.ipcRenderer.send('setSessionSelected', { contactId, sessionId })
}

const sendMessage4LocalHandler = (messageObj) => {
  messageList.value.push(messageObj)
  const chatSession = chatSessionList.value.find((item) => item.sessionId == messageObj.sessionId)
  if (chatSession) {
    chatSession.lastReceiveTime = messageObj.sendTime
    chatSession.lastMessage = messageObj.lastMessage
  }
  sortChatSessionList(chatSessionList.value)
  gotoBottom()
}

const onAddLocalMessage = (message) => {
  window.electron.ipcRenderer.on('addLocalCallback', (e, { messageId, status }) => {
    const findMessage = messageList.value.find((item) => item.messageId == messageId)
    if (findMessage != null) {
      findMessage.status = status
    }
  })
}

// 滚动到底部
const gotoBottom = () => {
  // 使用nextTick确保DOM更新后执行
  nextTick(() => {
    const items = document.querySelectorAll('.message-item')
    if (items.length > 0) {
      // 使用setTimeout确保浏览器已经渲染完成
      setTimeout(() => {
        items[items.length - 1].scrollIntoView()
      })
    }
  })
}

onMounted(() => {
  onReceiveMessage()
  onLoadSessionData()
  // 防止页面渲染先于initWs执行而导致onReceiveMessage没有监听到的异步问题
  loadChatSession()
  onLoadChatMessage()
  onAddLocalMessage()
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('receiveMessage')
  window.electron.ipcRenderer.removeAllListeners('loadSessionDataCallback')
  window.electron.ipcRenderer.removeAllListeners('loadChatMessageCallback')
  window.electron.ipcRenderer.removeAllListeners('addLocalCallback')
})
</script>

<style lang="scss" scoped>
.drag-panel {
  height: 25px;
  background: #f7f7f7;
}
.top-search {
  padding: 0px 10px 9px 10px;
  background: #f7f7f7;
  display: flex;
  align-items: center;
  .iconfont {
    font-size: 12px;
  }
}
.chat-session-list {
  height: calc(100vh - 62px);
  overflow: hidden;
  border-top: 1px solid #ddd;
  &:hover {
    overflow: auto;
  }
}
.search-list {
  height: calc(100vh - 62px);
  background: #f7f7f7;
  overflow: hidden;
  &:hover {
    overflow: auto;
  }
}
.title-panel {
  display: flex;
  align-items: center;
  .title {
    height: 60px;
    line-height: 60px;
    padding-left: 10px;
    font-size: 18px;
    color: #000000;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
.icon-more {
  position: absolute;
  z-index: 1;
  top: 30px;
  right: 3px;
  width: 20px;
  font-size: 20px;
  margin-right: 5px;
  cursor: pointer;
}
.chat-panel {
  border-top: 1px solid #ddd;
  background: #f5f5f5;
  .message-panel {
    padding: 10px 30px 0px 30px;
    height: calc(100vh - 200px - 62px);
    overflow-y: auto;
    .message-item {
      margin-bottom: 15px;
      text-align: center;
    }
  }
}
</style>
