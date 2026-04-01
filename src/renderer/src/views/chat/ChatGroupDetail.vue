<template>
  <div class="group-panel">
    <el-drawer
      ref="drawerRef"
      v-model="showDrawer"
      modal-class="mask-style"
      :size="300"
      :close="closeDrawerHandler"
    >
      <div class="group-panel-body">
        <div class="member-list">
          <div v-for="item in memberList" :key="item.userId" class="member-item">
            <Avatar :user-id="item.userId" :width="30"></Avatar>
            <div class="nick-name" :title="item.contactName">{{ item.contactName }}</div>
            <div v-if="item.userId == groupInfo.groupOwnerId" class="owner-tag">群主</div>
          </div>
          <template v-if="userInfoStore.getUserInfo().userId == groupInfo.groupOwnerId">
            <div class="member-item" @click="addUser">
              <div class="iconfont icon-tianjia icon-op"></div>
              <div class="nick-name">添加成员</div>
            </div>
            <div class="member-item" @click="removeUser">
              <div class="iconfont icon-minimize icon-op"></div>
              <div class="nick-name">移除成员</div>
            </div>
          </template>
        </div>
        <div class="line"></div>
        <div class="part-content">
          <AvatarBase
            :user-id="groupInfo.groupId"
            :width="60"
            :border-radius="5"
            :show-detail="true"
          ></AvatarBase>
        </div>
        <div class="part-title">群号</div>
        <div class="part-content">{{ groupInfo.groupId }}</div>
        <div class="part-title">群名称</div>
        <div class="part-content">{{ groupInfo.groupName }}</div>
        <div class="part-title">群公告</div>
        <div class="part-content">{{ groupInfo.groupNotice || '-' }}</div>
        <div class="line"></div>
        <a
          v-if="userInfoStore.getUserInfo().userId == groupInfo.groupOwnerId"
          class="leave-btn"
          @click="dissolutionGroup"
          >解散群聊</a
        >
        <a v-else class="leave-btn" @click="leaveGroup">退出群聊</a>
      </div>
    </el-drawer>
    <UserSelect ref="userSelectRef" @callback="addOrRemoveUserCallback"></UserSelect>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import { useContactStateStore } from '@/stores/ContactStateStore'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import AvatarBase from '../../components/AvatarBase.vue'
import UserSelect from './UserSelect.vue'
const userInfoStore = useUserInfoStore()

const showDrawer = ref(false)
const groupInfo = ref({})
const memberList = ref([])
const drawerRef = ref(null)
const userSelectRef = ref(null)

const show = async (groupId) => {
  let result = await proxy.Request({
    url: proxy.Api.getGroupInfo4Chat,
    params: {
      groupId: groupId
    },
    showError: false,
    errorCallback: (res) => {
      proxy.Confirm({ message: res.info, showCancelButton: false })
    }
  })
  if (!result) {
    return
  }
  showDrawer.value = true
  memberList.value = result.data.userContactList
  groupInfo.value = result.data.groupInfo
}

const closeDrawerHandler = () => {
  if (userSelectRef.value) userSelectRef.value.close()
}

const addUser = async () => {
  let result = await proxy.Request({
    url: proxy.Api.loadContact,
    params: {
      contactType: 'USER'
    }
  })
  if (!result) {
    return
  }
  const contactIds = memberList.value.map((item) => item['userId'])
  let contactList = result.data
  contactList.forEach((item) => {
    if (contactIds.includes(item.contactId)) {
      Element.disabled = true
    }
  })
  userSelectRef.value.show({
    contactList,
    groupId: groupInfo.value.groupId,
    opType: 1
  })
}

const removeUser = async () => {
  let contactList = memberList.value.map((item) => item)
  contactList.forEach((item) => {
    item.contactId = item.userId
  })
  contactList.splice(0, 1)
  userSelectRef.value.show({ contactList, groupId: groupInfo.value.groupId, opType: 0 })
}

const addOrRemoveUserCallback = (data) => {
  show(data.groupId)
}

const emit = defineEmits(['delChatSessionCallback'])
const leaveGroup = async () => {
  proxy.Confirm({
    message: `确定要退出群聊【${groupInfo.value.groupName}】吗？`,
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.leaveGroup,
        params: {
          groupId: groupInfo.value.groupId
        }
      })
      if (!result) {
        return
      }
      emit('delChatSessionCallback', groupInfo.value.groupId)
      proxy.Message.success('退出成功')
      showDrawer.value = false
    }
  })
}

const dissolutionGroup = async () => {
  proxy.Confirm({
    message: `确定要解散群聊【${groupInfo.value.groupName}】吗？`,
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.dissolutionGroup,
        params: {
          groupId: groupInfo.value.groupId
        }
      })
      if (!result) {
        return
      }
      proxy.Message.success('解散成功')
      showDrawer.value = false
    }
  })
}

defineExpose({
  show
})
</script>

<style lang="scss" scoped>
.group-panel {
  color: #000000;
  :deep(.mask-style) {
    top: 1px;
    right: 1px;
    height: calc(100vh - 2px);
  }
  :deep(.el-drawer) {
    -webkit-app-region: no-drag;
  }
  :deep(.el-drawer__header) {
    margin-bottom: 10px;
  }
  :deep(.el-drawer__body) {
    padding: 10px;
  }
  .group-panel-body {
    .member-list {
      display: flex;
      flex-wrap: wrap;
      .member-item {
        width: 20%;
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 5px;
        padding: 5px;
        position: relative;
        .owner-tag {
          position: absolute;
          left: 0px;
          top: 0px;
          font-size: 12px;
          background: #07c160;
          color: #fff;
          border-radius: 3px;
        }
        .nick-name {
          margin-top: 3px;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
          text-align: center;
        }
        .icon-op {
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid #dbdbdb;
          color: #6e6e6e;
        }
      }
    }
    .line {
      margin-bottom: 10px;
      border-top: 1px solid #ddd;
      height: 1px;
    }
    .part-title {
      margin-top: 10px;
    }
    .part-content {
      color: #757575;
      margin-bottom: 10px;
    }
    .leave-btn {
      cursor: pointer;
      color: #f45454;
      text-decoration: none;
      text-align: center;
      display: block;
      margin-top: 10px;
    }
  }
}
</style>
