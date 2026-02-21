<template>
  <div class="user-panel">
    <AvatarBase
      :user-id="userInfo.userId || userInfo.contactId"
      :width="60"
      :border-radius="5"
      :show-detail="true"
    ></AvatarBase>
    <div class="user-info">
      <div class="nick-name">
        {{ userInfo.nickName }}
        <span v-if="userInfo.sex == 0" class="iconfont icon-woman"></span>
        <span v-if="userInfo.sex == 1" class="iconfont icon-man"></span>
      </div>
      <div class="info">ID: {{ userInfo.userId || userInfo.contactId }}</div>
      <div v-if="showArea" class="info">地区: {{ proxy.Utils.getAreaInfo(userInfo.areaNmae) }}</div>
    </div>
  </div>
</template>

<script setup>
import AvatarBase from './AvatarBase.vue'
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  userInfo: {
    type: Object,
    //使用函数形式 default: () => ({}) 可以确保每个组件实例都获得一个独立的新对象，否則，会导致所有组件实例共享同一个对象
    default: () => ({})
  },
  showArea: {
    type: Boolean,
    default: true
  }
})
</script>

<style lang="scss" scoped>
.user-panel {
  display: flex;
  padding-bottom: 20px;
  .user-info {
    flex: 1;
    margin-left: 10px;
    .nick-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #000000;
      font-size: 16px;
      .iconfont {
        font-size: 13px;
      }
      .icon-man {
        color: #2cb6fe;
      }
      .icon-woman {
        color: #fb7373;
      }
    }
    .info {
      font-size: 12px;
      color: #9e9e9e;
      margin-top: 3px;
    }
  }
}
</style>
