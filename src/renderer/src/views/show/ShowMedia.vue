<template>
  <div class="media-window">
    <div class="win-title drag"></div>
    <div class="media-op no-drag">
      <div
        :class="['iconfont icon-line_chevron_left', currentIndex == 0 ? 'not-allow' : '']"
        title="上一张"
        @dblclick.stop
        @click="next(-1)"
      ></div>
      <div
        :class="[
          'iconfont icon-line_chevron_right-copy',
          currentIndex >= allFileList.length - 1 ? 'not-allow' : ''
        ]"
        title="上一张"
        @dblclick.stop
        @click="next(1)"
      ></div>
      <template v-if="fileList[0].fileType == 0">
        <el-divider direction="vertical"></el-divider>
        <div
          class="iconfont icon-zoomin"
          title="放大"
          @click.stop="changeSize(0.1)"
          @dblclick.stop
        ></div>
        <div
          class="iconfont icon-zooout"
          title="缩小"
          @click.stop="changeSize(-0.1)"
          @dblclick.stop
        ></div>
        <div
          :class="['iconfont', isOne2One ? 'icon-projection' : 'icon-fullscreen-exit']"
          :title="isOne2One ? '图片适应窗口大小' : '图片原始大小'"
          @dblclick.stop
          @click="resize"
        ></div>
        <div class="iconfont icon-gengxin" title="旋转" @dblclick.stop @click="rotate"></div>
        <el-divider direction="vertical"></el-divider>
      </template>
      <div
        class="iconfont icon-icon-fenxiang"
        title="另存为..."
        @dblclick.stop
        @click="saveAs"
      ></div>
    </div>
    <div class="media-panel">
      <viewer
        v-if="fileList[0].fileType == 0 && fileList[0].status == 1"
        :options="options"
        :images="fileList"
        @inited="inited"
      >
        <img :src="fileList[0].url" />
      </viewer>
      <div
        v-show="fileList[0].fileType == 1 && fileList[0].status == 1"
        id="player"
        ref="player"
        style="width: 100%; height: 100%"
      ></div>
      <div v-if="fileList[0].fileType == 2" class="file-panel">
        <div class="file-item">文件名: {{ fileList[0].fileName }}</div>
        <div class="file-item">文件大小: {{ proxy.Utils.size2Str(fileList[0].fileSize) }}</div>
        <div class="file-item download">
          <el-button type="primary" @click="saveAs">下载文件</el-button>
        </div>
      </div>
      <div v-if="fileList[0].status != 1" class="loading">加载中...</div>
    </div>
    <WinOp @close-callback="closeWin"></WinOp>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, onMounted, onUnmounted } from 'vue'
import DPlayer from 'dplayer'
import 'viewerjs/dist/viewer.css'
import { component as Viewer } from 'v-viewer'
const { proxy } = getCurrentInstance()

const localServerPort = ref()
const isLoading = ref(false) // 新增：用于标记是否正在加载图片
const currentIndex = ref(0)
const allFileList = ref([])
const fileList = ref([{ fileType: 0, status: 0 }])

const options = ref({
  inline: true,
  toolbar: false,
  navbar: false,
  button: false,
  title: false,
  zoomRatio: 0.1,
  zoomOnWheel: false
})

const viewerMy = ref(null)
const inited = (e) => {
  viewerMy.value = e
}

const changeSize = (zoomRatio) => {
  if (!viewerMy.value) {
    return
  }
  viewerMy.value.zoom(zoomRatio, true)
}

const rotate = () => {
  viewerMy.value.rotate(90, true)
}

const isOne2One = ref(false)
const resize = () => {
  isOne2One.value = !isOne2One.value
  if (!isOne2One.value) {
    viewerMy.value.zoomTo(viewerMy.value.initialImageData.ratio, true)
  } else {
    viewerMy.value.zoomTo(1, true)
  }
}

const onWheel = (e) => {
  if (fileList.value[0].fileType !== 0) {
    return
  }
  if (e.deltaY < 0) {
    changeSize(0.1)
  } else {
    changeSize(-0.1)
  }
}

const getCurrentFile = () => {
  if (dPlayer.value) {
    dPlayer.value.pause()
  }

  const curFile = allFileList.value[currentIndex.value]
  const url = getUrl(curFile)

  // 更新当前文件信息，此时 status 可以先设为 0 (加载中)
  fileList.value.splice(0, 1, {
    url: url,
    fileType: curFile.fileType,
    status: 0, // 显式设置为加载中状态
    fileSize: curFile.fileSize,
    fileName: curFile.fileName
  })

  if (curFile.fileType == 1) {
    dPlayer.value.switchVideo({
      url: url
    })
    fileList.value[0].status = 1
    // 视频切换通常较快，可以直接释放锁，或者监听 canplay 事件
    isLoading.value = false
  } else {
    // 对于图片，我们需要等待图片真正加载完成
    // 创建一个 Image 对象来预加载
    const img = new Image()
    img.onload = () => {
      // 图片加载成功，更新状态为 1，并释放锁
      fileList.value[0].status = 1
      isLoading.value = false
    }
    img.onerror = () => {
      // 图片加载失败，也要释放锁，否则会卡死
      console.error('图片加载失败')
      isLoading.value = false
      // 可以在这里设置一个错误状态显示在界面上
    }
    img.src = url
  }
}

const getUrl = (file) => {
  return `http://127.0.0.1:${localServerPort.value}/file?fileId=${file.fileId}&partType=${file.partType}&fileType=${file.fileType}&forceGet=${file.forceGet}&${new Date().getTime()}`
}

const next = (index) => {
  // 如果正在加载中，直接返回，防止重复点击
  if (isLoading.value) {
    return
  }

  // 边界检查
  if (currentIndex.value + index < 0 || currentIndex.value + index >= allFileList.value.length) {
    return
  }

  // 开始加载：设置锁，更新索引
  isLoading.value = true
  currentIndex.value = currentIndex.value + index
  getCurrentFile()
}

const player = ref()
const dPlayer = ref()
const initPlayer = () => {
  dPlayer.value = new DPlayer({
    element: player.value,
    theme: '#b7daff',
    screenshot: true,
    video: {
      url: getUrl(fileList.value[0]) ? getUrl(fileList.value[0]) : ''
    }
  })
}

const saveAs = () => {
  const curFile = allFileList.value[currentIndex.value]
  window.electron.ipcRenderer.send('saveAs', {
    partType: curFile.partType,
    fileId: curFile.fileId
  })
}

onMounted(() => {
  initPlayer()
  window.addEventListener('wheel', onWheel)
  window.electron.ipcRenderer.on('pageInitData', (event, data) => {
    localServerPort.value = data.localServerPort
    allFileList.value = data.fileList
    let index
    if (data.currentFileId) {
      index = data.fileList.findIndex((item) => item.fileId == data.currentFileId)
      index = index >= 0 ? index : 0
    }
    currentIndex.value = index
    getCurrentFile()
  })
  window.electron.ipcRenderer.send('showMediaReady')
})

onUnmounted(() => {
  window.removeEventListener('wheel', onWheel)
  window.electron.ipcRenderer.removeAllListeners('pageInitData')
})

const closeWin = () => {
  dPlayer.value.pause()
}
</script>

<style lang="scss" scoped>
.media-window {
  padding: 0px;
  height: calc(100vh);
  border: 1px solid #ddd;
  background: #fff;
  position: relative;
  overflow: hidden;
  .win-title {
    height: 37px;
  }
  .media-op {
    position: absolute;
    left: 0px;
    top: 0px;
    height: 35px;
    line-height: 35px;
    display: flex;
    align-items: center;
    .iconfont {
      font-size: 18px;
      padding: 0px 10px;
      &:hover {
        background: #f3f3f3;
        cursor: pointer;
      }
    }
    .not-allow {
      cursor: not-allowed;
      color: #ddd;
      text-decoration: none;
      &:hover {
        color: #ddd;
        cursor: not-allowed;
        background: none;
      }
    }
  }
  .media-panel {
    height: calc(100vh - 37px);
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center; // 添加水平居中
    overflow: hidden;
    position: relative; // 确保定位上下文正确
    :deep(.viewer-backdrop) {
      background: #f5f5f5;
    }
    .file-panel {
      .file-item {
        margin-top: 5px;
      }
      .download {
        margin-top: 20px;
        text-align: center;
      }
    }
  }
}
</style>
