<template>
  <div class="search-item">
    <Avatar :user-id="data.contactId" :show-detail="false"></Avatar>
    <div class="contact-info">
      <div class="contact-name" v-html="safeLastMessage.searchContactName"></div>
      <div class="last-message" v-html="safeLastMessage.searchLastMessage"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, computed } from 'vue'
const { proxy } = getCurrentInstance()
import DOMPurify from 'dompurify'

const props = defineProps({
  data: {
    type: Object,
    default: () => {}
  }
})

const safeLastMessage = computed(() => {
  const data = {
    searchContactName: '',
    searchLastMessage: ''
  }

  if (props.data.searchContactName) {
    data.searchContactName = DOMPurify.sanitize(props.data.searchContactName)
  }

  if (props.data.searchLastMessage) {
    data.searchLastMessage = DOMPurify.sanitize(props.data.searchLastMessage)
  }
  return data
})
</script>

<style lang="scss" scoped>
.search-item {
  padding: 10px;
  display: flex;
  align-items: center;
  .contact-info {
    margin-left: 10px;
    :deep(.highlight) {
      color: #ff0000;
    }
    .last-message {
      color: #999999;
    }
  }
  &:hover {
    background: #ededed;
  }
}
</style>
