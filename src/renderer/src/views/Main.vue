<template>
  <div class="main">
    <div class="left-sider">
      <div>
        <Avatar
          :user-id="userInfoStore.getUserInfo().userId"
          :width="35"
          :show-detail="false"
        ></Avatar>
      </div>
      <div class="menu-list">
        <template v-for="item in menuList">
          <div
            v-if="item.position == 'top'"
            :key="item.name"
            :class="['tab-item iconfont', item.icon, item.path == currentMenu.path ? 'active' : '']"
            @click="changeMenu(item)"
          >
            <template v-if="item.name == 'chat' || item.name == 'contact'">
              <Badge :count="messageCount[item.countKey]" :top="3" :left="15" />
            </template>
          </div>
        </template>
      </div>
      <div class="menu-list menu-botttom">
        <template v-for="item in menuList">
          <div
            v-if="item.position == 'bottom'"
            :key="item.name"
            :class="['tab-item iconfont', item.icon, item.path == currentMenu.path ? 'active' : '']"
            @click="changeMenu(item)"
          ></div>
        </template>
      </div>
    </div>
    <div class="right-container">
      <router-view v-slot="{ Component }">
        <!-- keep alive 需配合组件名称使用 -->
        <keep-alive include="Chat">
          <component :is="Component" ref="componentRef" />
        </keep-alive>
      </router-view>
    </div>
  </div>
  <WinOp></WinOp>
  <Update></Update>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import WinOp from '../components/WinOp.vue'
const { proxy } = getCurrentInstance()
const router = useRouter()
const route = useRoute()
import { useMessageCountStore } from '@/stores/MessageCountStore'
const messageCountStore = useMessageCountStore()
const { messageCount } = storeToRefs(messageCountStore)
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { useGlobalInfoStore } from '@/stores/GlobalInfoStore'
import { useSysSettingStore } from '@/stores/SysSettingStore'
import Update from './Update.vue'
const userInfoStore = useUserInfoStore()
const globalInfoStore = useGlobalInfoStore()
const sysSettingStore = useSysSettingStore()

const menuList = ref([
  {
    name: 'chat',
    icon: 'icon-xiaoxi',
    countKey: 'chatCount',
    position: 'top',
    path: '/chat'
  },
  {
    name: 'contact',
    icon: 'icon-geren',
    countKey: 'contactApplyCount',
    position: 'top',
    path: '/contact'
  },
  {
    name: 'mysetting',
    icon: 'icon-a-s-tools',
    position: 'bottom',
    path: '/setting'
  }
])

const currentMenu = ref(menuList.value[0])
const changeMenu = (item) => {
  currentMenu.value = item
  router.push(item.path)
}

const getLoginInfo = async () => {
  let result = await proxy.Request({
    url: proxy.Api.getUserInfo
  })
  if (!result) return
  userInfoStore.setUserInfo(result.data)
  window.electron.ipcRenderer.send('getLocalStore', result.data.userId + 'localServerPort')
}

const getSysSetting = async () => {
  let result = await proxy.Request({
    url: proxy.Api.getSysSetting
  })
  if (!result) return
  sysSettingStore.setSetting(result.data)
}

const menuSelect = (path) => {
  currentMenu.value = menuList.value.find((item) => path.includes(item.path))
}

watch(
  () => route.path,
  (newVal, oldVal) => {
    if (newVal) {
      menuSelect(newVal)
    }
  },
  { immediate: true, deep: true }
)

onMounted(() => {
  getSysSetting()
  getLoginInfo()
  window.electron.ipcRenderer.on('getLocalStoreCallback', (event, serverPort) => {
    globalInfoStore.setInfo('localServerPort', serverPort)
  })
  window.electron.ipcRenderer.on('reLoginCallback', (e) => {
    router.push('/login')
  })
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('getLocalStoreCallback')
  window.electron.ipcRenderer.removeAllListeners('reLoginCallback')
})
</script>

<style lang="scss" scoped>
.main {
  background: #ddd;
  display: flex;
  border-radius: 0px 3px 3px 0px;
  overflow: hidden;
  .left-sider {
    width: 55px;
    background: #2e2e2e;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 35px;
    border: 1px solid #2e2e2e;
    border-right: none;
    padding-bottom: 10px;
    .menu-list {
      width: 100%;
      flex: 1;
      .tab-item {
        color: #d3d3d3;
        font-size: 20px;
        height: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-top: 10px;
        cursor: pointer;
        font-size: 22px;
        position: relative;
      }
      .active {
        color: #07c160;
      }
    }
    .menu-botttom {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
  }
  .right-container {
    flex: 1;
    overflow: hidden;
    border: 1px solid #ddd;
    border-left: none;
  }
}

.popover-user-panel {
  padding: 10px;
  .popover-user {
    display: flex;
    border-bottom: 1px solid #ddd;
    padding-bottom: 20px;
  }
  .send-message {
    margin-top: 10px;
    text-align: center;
    padding: 20px 0px 0px 0px;
  }
}
</style>
