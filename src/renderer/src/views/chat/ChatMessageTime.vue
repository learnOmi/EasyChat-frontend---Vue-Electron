<template>
  <div class="message-time">
    {{ props.Utils.formatDate(data.sendTime) }}
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from "vue"
const { proxy } = getCurrentInstance()

const props = defineProps({
  data: {
    type: Object,
    default: () => {}
  }
})
</script>

<style lang="scss" scoped>
.message-time {
  background: #dadada;
  display: inline-block;
  color: #fff;
  font-size: 12px;
  padding: 2px 5px;
  border-radius: 3px;
  margin: 10px 0px;
}
</style>
