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
  <Update ref="updateRef" :auto-update="false"></Update>
</template>

<script setup>
import Update from '../Update.vue'
import config from '../../../../../package.json'
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const updateRef = ref(null)
const checkUpdate = () => {
  updateRef.value.checkUpdate()
}
</script>

<style lang="scss" scoped></style>
