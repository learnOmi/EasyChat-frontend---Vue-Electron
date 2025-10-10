<template>
  <div class="win-op no-drag">
    <div
      v-if="showSetTop"
      :class="['iconfont', 'icon-top', isTop ? 'win-top' : '']"
      :title="isTop ? '取消置顶' : '置顶'"
      @click="setTop"
    ></div>
    <div v-if="showMin" class="iconfont icon-minimize" title="最小化" @click="minimize"></div>
    <div
      v-if="showMax"
      :class="['iconfont', isMax ? 'icon-max' : 'icon-maximize']"
      :title="isMax ? '还原' : '最大化'"
      @click="maximize"
    ></div>
    <div v-if="showClose" class="iconfont icon-close" title="关闭" @click="close"></div>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, onMounted } from 'vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  showSetTop: {
    type: Boolean,
    default: true
  },
  showMin: {
    type: Boolean,
    default: true
  },
  showMax: {
    type: Boolean,
    default: true
  },
  showClose: {
    type: Boolean,
    default: true
  },
  // 关闭类型 0:关闭, 1:隐藏
  closeType: {
    type: Number,
    default: 1
  }
})

const emit = defineEmits(['closeCallback'])

const isTop = ref(false)
const isMax = ref(false)

onMounted(() => {
  isMax.value = false
  isTop.value = false
})

const winOp = (action, data) => {
  window.electron.ipcRenderer.send('winTitleOp', { action, data })
}

const setTop = () => {
  isTop.value = !isTop.value
  winOp('setTop', { top: isTop.value })
}

const minimize = () => {
  winOp('minimize')
}

const maximize = () => {
  if (isMax.value) {
    winOp('unmaximize')
  } else {
    winOp('maximize')
  }
  isMax.value = !isMax.value
}

const close = () => {
  winOp('close', { closeType: props.closeType })
  emit('closeCallback')
}
</script>

<style lang="scss" scoped>
.win-op {
  top: 0px;
  right: 0px;
  position: absolute;
  z-index: 1;
  overflow: hidden;
  border-radius: 0px 3px 0px 0px;
  .iconfont {
    float: left;
    font-size: 12px;
    color: #101010;
    text-align: center;
    display: flex;
    justify-content: center;
    cursor: pointer;
    height: 25px;
    align-items: center;
    padding: 0px 10px;
    &:hover {
      background: #ddd;
    }
  }
  .icon-close {
    &:hover {
      background: #fb7373;
      color: #fff;
    }
  }
  .win-top {
    background: #ddd;
    color: #07c160;
  }
}
</style>
