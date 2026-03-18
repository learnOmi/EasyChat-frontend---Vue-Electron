<template>
  <div
    class="user-avatar"
    :style="{ width: `${width}px`, height: `${width}px`, borderRadius: `${borderRadius}px` }"
    @click="showDetailHandler"
  >
    <ShowLocalImage
      :width="width"
      :file-id="userId"
      part-type="avatar"
      :force-get="false"
    ></ShowLocalImage>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  userId: {
    type: String
  },
  width: {
    type: Number,
    default: 40
  },
  borderRadius: {
    type: Number,
    default: 0
  },
  showDetail: {
    type: Boolean,
    default: false
  }
})

const showDetailHandler = () => {
  if (!props.showDetail) return
  //TODO 查看图片详情
}
</script>

<style lang="scss" scoped>
.user-avatar {
  background: #d3d3d3;
  display: flex;
  overflow: hidden;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}
</style>
