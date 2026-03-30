<template>
  <ChatMessageTime :data="data"></ChatMessageTime>
  <div class="sys-message">{{ dataMessage.messageContent }}</div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, computed } from 'vue'
import ChatMessageTime from './ChatMessageTime.vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  data: {
    type: Object,
    default: () => {}
  }
})

const dataMessage = computed(() => {
  const data = { ...props.data }
  if (data.messageType == 1) {
    data.messageContent = '已经添加为好友，已下是打招呼消息'
  }
  return data
})
</script>

<style lang="scss" scoped>
.sys-message {
  text-align: center;
  font-size: 12px;
  color: #999999;
  margin-bottom: 20px;
}
</style>
