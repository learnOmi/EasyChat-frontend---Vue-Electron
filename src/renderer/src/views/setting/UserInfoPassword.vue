<template>
  <div>
    <el-form ref="formDataRef" :model="formData" :rules="rules" label-width="80px" @submit.prevent>
      <el-form-item label="密码" prop="password">
        <el-input
          v-model.trim="formData.password"
          type="password"
          clearable
          placehoder="请输入新密码"
          show-password
        >
        </el-input>
      </el-form-item>
      <el-form-item label="确认密码" prop="rePassword">
        <el-input
          v-model.trim="formData.rePassword"
          type="password"
          clearable
          placehoder="请再次输入新密码"
          show-password
        >
        </el-input>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="saveUserInfo">修改密码</el-button>
        <el-button link @click="cancel">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const formData = ref({})
const formDataRef = ref()
// JavaScript 中 const 和 let 存在暂时性死区，不能在声明前使用,所以validator要定义在使用前
const validateRePass = (rule, value, callback) => {
  if (value !== formData.value.password) {
    callback(new Error(rule.message))
  } else {
    callback()
  }
}
const rules = {
  password: [
    { required: true, message: '请输入新密码' },
    { validator: proxy.Verify.password, message: '密码格式不正确' }
  ],
  rePassword: [
    { required: true, message: '请再次输入新密码' },
    { validator: validateRePass, message: '两次输入的密码不一致' }
  ]
}

const emit = defineEmits(['editBack'])
const saveUserInfo = () => {
  formDataRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }

    proxy.Confirm({
      message: '修改密码后需要重新登录，是否继续？',
      okfun: async () => {
        let params = {}
        Object.assign(params, formData.value)
        let result = await proxy.Request({
          url: proxy.Api.updatePassword,
          params
        })
        if (!result) {
          return
        }

        proxy.Message.success('修改密码成功，请重新登录', () => {
          window.electron.ipcRenderer.send('reLogin')
        })
        emit('editBack')
      }
    })
  })
}

const cancel = () => {
  emit('editBack')
}
</script>

<style lang="scss" scoped></style>
