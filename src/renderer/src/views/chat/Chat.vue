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
          <ChatSession :data="item" @contextmenu.stop="onContextmenu(item, $event)"></ChatSession>
        </template>
      </div>
    </template>
  </Layout>
</template>

<script setup>
import ChatSession from './ChatSession.vue'
import { ref, reactive, getCurrentInstance, nextTick, onMounted, onUnmounted } from 'vue'
import ContextMenu from '@imengyu/vue3-context-menu'
import '@imengyu/vue3-context-menu/lib/vue3-context-menu.css'
const { proxy } = getCurrentInstance()

const searchKey = ref()
const search = () => {}
const chatSessionList = ref([])
const currentChatSession = ref({})

const onReceiveMessage = () => {
  window.electron.ipcRenderer.on('receiveMessage', (e, message) => {})
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

onMounted(() => {
  onReceiveMessage()
  onLoadSessionData()
  // 防止页面渲染先于initWs执行而导致onReceiveMessage没有监听到的异步问题
  loadChatSession()
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('receiveMessage')
  window.electron.ipcRenderer.removeAllListeners('loadSessionDataCallback')
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
