<template>
  <div class="send-panel">
    <div class="toolbar">
      <el-popover
        trigger="click"
        placement="top"
        :teleported="false"
        :popper-style="{
          padding: '0px 10px 10px 10px',
          width: '490px'
        }"
        @show="openPopover"
        @hide="closePopover"
      >
        <template #default>
          <el-tabs v-model="activeEmoji" @click.stop>
            <el-tab-pane
              v-for="emoji in emojiList"
              :key="emoji.name"
              :label="emoji.name"
              :name="emoji.name"
            >
              <div class="emoji-list">
                <div
                  v-for="item in emoji.emojiList"
                  :key="item"
                  class="emoji-item"
                  @click="sendEmoji(item)"
                >
                  {{ item }}
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </template>
        <template #reference>
          <div class="iconfont icon-line_nianjin" @click="showEmojiPopoverHandler"></div>
        </template>
      </el-popover>
      <el-upload
        ref="uploadRef"
        name="file"
        :show-file-list="false"
        :multiple="true"
        :limit="fileLimit"
        :http-request="uploadFile"
        :on-exceed="uploadExceed"
      >
        <div class="iconfont icon-a-folder"></div>
      </el-upload>
    </div>
    <div class="input-area" @drop="dropHandler" @dragover="dragoverHandler">
      <el-input
        v-model="msgContent"
        type="textarea"
        :rows="5"
        resize="none"
        maxlength="500"
        show-word-limit
        spellcheck="false"
        input-style="background: #f5f5f5; border: none"
        @keydown.enter="sendMessage"
        @paste="pasteFile"
      ></el-input>
    </div>
    <div class="send-btn-panel">
      <el-popover
        :visible="showSendMsgPopover"
        :hide-after="1500"
        placement="top-end"
        :teleported="false"
        :popper-style="{
          padding: '5px',
          'min-with': '0px',
          width: '120px'
        }"
        @show="openPopover"
        @hide="closePopover"
      >
        <template #default>
          <span class="empty-msg">不能发送空消息</span>
        </template>
        <template #reference>
          <span class="send-btn" @click="sendMessage">发送(s)</span>
        </template>
      </el-popover>
    </div>
    <SearchAdd ref="searchAddRef" />
  </div>
</template>

<script setup>
import emojiList from '../../utils/Emoji'
import SearchAdd from '@/views/contact/SearchAdd.vue'
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { getFileType } from '@/utils/Constants'
const userInfoStore = useUserInfoStore()
const { proxy } = getCurrentInstance()

const props = defineProps({
  currentChatSession: {
    type: Object,
    default: () => {}
  }
})

const activeEmoji = ref('表情与情感')
const msgContent = ref('')
const showSendMsgPopover = ref(false)
const showEmojiPopover = ref(false)
const emit = defineEmits(['sendMessage4Local'])

const hidePopover = () => {
  showSendMsgPopover.value = false
  showEmojiPopover.value = false
}

const sendMessage = (e) => {
  if (e.shiftKey && e.keycode === 13) {
    return
  }
  e.preventDefault()

  const messageContent = msgContent.value ? msgContent.value.replace(/\s*$/, '') : ''
  if (messageContent == '') {
    showSendMsgPopover.value = true
    return
  }
  showSendMsgPopover.value = false
  sendMessageDo(
    {
      messageContent,
      messageType: 2
    },
    true
  )
}

const sendMessageDo = async (messageObj, cleanMsgContent) => {
  const { messageContent, messageType, localFilePath, fileSize, fileName, filePath, fileType } =
    messageObj
  //TODO 判断文件大小
  if (fileSize !== undefined && fileSize !== null && fileSize == 0) {
    proxy.Confirm({
      message: `${fileName}是一个空文件！`,
      showCancelBtn: false
    })
    return
  }
  messageObj.sessionId = props.currentChatSession.sessionId
  messageObj.sendUserId = userInfoStore.getUserInfo().userId

  let result = await proxy.Request({
    url: proxy.Api.sendMessage,
    showLoading: false,
    params: {
      contactId: props.currentChatSession.contactId,
      messageContent,
      messageType,
      fileSize,
      fileName,
      fileType
    },
    showError: false,
    errorCallback: (responseData) => {
      proxy.Confirm({
        message: responseData.message,
        okfun: () => {
          addContact(props.currentChatSession.contactId, responseData.code)
        },
        okText: '重新申请'
      })
    }
  })
  if (!result) {
    return
  }
  if (cleanMsgContent) {
    msgContent.value = ''
  }
  Object.assign(messageObj, result.data)
  emit('sendMessage4Local', messageObj)

  // 保存消息到本地
  window.electron.ipcRenderer.send('addLocalMessage', messageObj)
}

// 添加好友
const searchAddRef = ref()
const addContact = async (contactId, code) => {
  searchAddRef.value.show({
    contactId,
    contactType: code == 902 ? 'USER' : 'GROUP'
  })
}

const uploadRef = ref()
const uploadFile = (file) => {
  uploadFileDo(file.file)
  uploadRef.value.clearFiles()
}

const getFileTypeByName = (fileName) => {
  const fileExt = fileName.substring(fileName.lastIndexOf('.') + 1)
  return getFileType(fileExt)
}
const uploadFileDo = async (file) => {
  const fileType = getFileTypeByName(file.name)
  // 使用 FileReader 读取文件内容
  const reader = new FileReader()
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result

    sendMessageDo(
      {
        messageContent: `[${getFileType(fileType)}]`,
        messageType: 5,
        fileSize: file.size,
        fileName: file.name,
        fileType,
        buffer: arrayBuffer
      },
      false
    )
  }
  reader.readAsArrayBuffer(file)
}
</script>

<style lang="scss" scoped>
.emoji-list {
  .emoji-item {
    float: left;
    font-size: 23px;
    padding: 2px;
    text-align: center;
    border-radius: 3px;
    margin-left: 10px;
    margin-top: 5px;
    cursor: pointer;
    &:hover {
      background: #ddd;
    }
  }
}
.send-panel {
  height: 200px;
  border-top: 1px solid #ddd;
  .toolbar {
    height: 40px;
    display: flex;
    align-items: center;
    padding-left: 10px;
    .iconfont {
      color: #494949;
      font-size: 20px;
      margin-left: 10px;
      cursor: pointer;
    }
    :deep(.el-tabs_header) {
      margin-bottom: 0px;
    }
  }
  .input-area {
    padding: 0px 10px;
    outline: none;
    width: 100%;
    height: 115px;
    overflow: auto;
    word-wrap: break-word;
    word-break: break-all;

    :deep(.el-textarea__inner) {
      box-shadow: none;
    }
    :deep(.el-input__count) {
      background: none;
      right: 12px;
    }
  }
  .send-btn-panel {
    text-align: right;
    padding-top: 10px;
    margin-right: 22px;
    .send-btn {
      cursor: pointer;
      color: #07c160;
      background: #e9e9e9;
      border-radius: 5px;
      padding: 8px 25px;
      &:hover {
        background: #d2d2d2;
      }
    }
    .empty-msg {
      font-size: 13px;
    }
  }
}
</style>
