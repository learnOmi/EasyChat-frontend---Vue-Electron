<template>
  <div class="avatar-upload">
    <div class="avatar-show">
      <template v-if="modelValue">
        <el-image v-if="preview" :src="localFile" fit="scale-down"></el-image>
        <ShowLocalImage
          v-else
          :file-id="props.modelValue"
          part-type="avatar"
          :width="40"
        ></ShowLocalImage>
      </template>
      <template v-else>
        <el-upload
          name="file"
          :show-file-list="false"
          accept=".png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.gif,.GIF,.bmp,.BMP"
          :multipe="false"
          :http-request="uploadImage"
        >
          <span class="iconfont icon-tianjia"></span>
        </el-upload>
      </template>
    </div>
    <div class="select-btn">
      <el-upload
        name="file"
        :show-file-list="false"
        accept=".png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.gif,.GIF,.bmp,.BMP"
        :multipe="false"
        :http-request="uploadImage"
      >
        <el-button type="primary" size="small">选择图片</el-button>
      </el-upload>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, computed, onUnmounted, onMounted } from 'vue'
import { getFileType, getFileTypeByName } from '@/utils/Constants'
const { proxy } = getCurrentInstance()

const props = defineProps({
  modelValue: {
    type: [String, Object],
    default: null
  }
})

const emit = defineEmits(['coverFile'])

const preview = computed(() => {
  return props.modelValue instanceof File
})

const localFile = ref(null)
const uploadImage = async (file) => {
  file = file.file
  const fileType = getFileTypeByName(file.name)
  // 使用 FileReader 读取文件内容
  const reader = new FileReader()
  reader.onload = async (e) => {
    const arrayBuffer = e.target.result
    window.electron.ipcRenderer.send('createCover', arrayBuffer)
  }
  reader.readAsArrayBuffer(file)
}

onMounted(() => {
  window.electron.ipcRenderer.on('createCoverCallback', (event, { avatarStream, coverStream }) => {
    const coverBlob = new Blob([coverStream], { type: 'image/png' })
    const coverFile = new File([coverBlob], 'thumbnail.jpg')
    let img = new FileReader()
    img.readAsDataURL(coverFile)
    img.onload = (e) => {
      localFile.value = e.target.result
    }
    const avatarBlob = new Blob([avatarStream], { type: 'image/png' })
    const avatarFile = new File([avatarBlob], 'thumbnail2.jpg')
    emit('coverFile', { avatarFile, coverFile })
  })
})

onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('createCoverCallback')
})
</script>

<style lang="scss" scoped>
.avatar-upload {
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: normal;
  .avatar-show {
    background: #ededed;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    .icon-add {
      font-size: 30px;
      color: #b9b9b9;
      width: 60px;
      height: 60px;
      text-align: center;
      line-height: 60px;
    }
    img {
      width: 100%;
      height: 100%;
    }
    .op {
      position: absolute;
      color: #0e8aef;
      top: 80px;
    }
  }
  .select-btn {
    vertical-align: bottom;
    margin-left: 5px;
  }
}
</style>
