<template>
  <ContentPanel>
    <el-form ref="formDataRef" label-width="80px" @submit.prevent>
      <el-form-item label="版本号">
        <div class="version-info">
          <div>EasyChat {{ config.version }}</div>
          <div>
            <el-button type="primary" @click="checkUpdate">检查更新</el-button>
          </div>
        </div>
      </el-form-item>
    </el-form>
  </ContentPanel>
</template>

<script setup>
import config from '../../../../../package.json'
import { ref, reactive, getCurrentInstance, nextTick } from "vue"
const { proxy } = getCurrentInstance()

// TODO 检测更新
const checkUpdate = () => {}
</script>

<style lang="scss" scoped>
</style>
