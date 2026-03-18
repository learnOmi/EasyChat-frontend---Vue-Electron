<template>
  <ContentPanel v-loading="copying" element-loading-text="正在复制文件，请稍后...">
    <el-form
      ref="formDataRef"
      label-position="top"
      :model="formData"
      :rules="rules"
      label-width="80px"
      @submit.prevent
    >
      <!--input输入-->
      <el-form-item label="文件管理" prop="" class="file-manage">
        <div class="file-input" :title="formData.sysSetting">{{ formData.sysSetting }}</div>
        <div class="tips">文件的默认保存位置</div>
      </el-form-item>
      <el-form-item label="" prop="">
        <el-button type="primary" @click="changeFolder">更改</el-button>
        <el-button type="primary" @click="openLocalFolder">打开文件夹</el-button>
      </el-form-item>
    </el-form>
  </ContentPanel>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const copying = ref(false)

const formData = ref({})
const formDataRef = ref()
const rules = {
  title: [{ required: true, message: '请输入内容' }]
}

// TODO 获取文件缓存路径

const changeFolder = () => {
  
}

const openLocalFolder = () => {
  
}
</script>

<style lang="scss" scoped>
.file-manage {
  :deep(.el-form-item__content) {
    display: block;
  }
  .file-input {
    background: #fff;
    padding: 0px 5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 16px;
  }
  .tips {
    color: #888888;
    font-size: 13px;
  }
}
</style>
