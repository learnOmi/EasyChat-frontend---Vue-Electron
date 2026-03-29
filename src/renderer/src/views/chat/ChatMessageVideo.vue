<template>
  <div>
    <ShowLocalImage
      :file-id="data.messageId"
      part-type="chat"
      :file-type="data.fileType"
      :show-play="true"
    ></ShowLocalImage>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  data: {
    type: Object,
    default: () => {}
  }
})
</script>

<style lang="scss" scoped></style>
