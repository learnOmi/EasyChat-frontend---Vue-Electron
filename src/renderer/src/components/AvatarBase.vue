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
      :force-get="avatarUploadStore.getForceReload(userId)"
    ></ShowLocalImage>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
import { useAvatarUploadStore } from '@/stores/AvatarUploadStore'
const { proxy } = getCurrentInstance()
const avatarUploadStore = useAvatarUploadStore()

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
  window.electron.ipcRenderer.send('openNewWindow', {
    windowId: 'media',
    title: '图片查看',
    path: '/showMedia',
    data: {
      fileList: [
        {
          fileId: props.userId,
          fileType: 0,
          partType: 'avatar',
          status: 1,
          forceGet: true
        }
      ],
      currentFileId: props.userId
    }
  })
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
