<template>
  <!-- 使用 el-config-provider 配置 Element Plus 的全局设置 -->
  <!-- locale: 设置语言为中文 -->
  <!-- message: 配置消息的最大显示数量 -->
  <el-config-provider :locale="locale" :message="config">
    <!-- 所有通过路由渲染的组件都能继承 Element Plus 的全局配置 -->
    <router-view />
  </el-config-provider>
</template>

<script setup>
// 导入 Vue 的相关功能
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
// 获取当前组件实例的代理对象
const { proxy } = getCurrentInstance()

// 导入 Element Plus 的配置提供者和中文语言包
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

// 设置语言为中文
const locale = zhCn

// 配置消息的最大显示数量为 1
const config = reactive({
  max: 1
})
</script>

<style lang="less">
</style>
