<template>
  <BaseDialog
    :title="dialogConfig.title"
    :buttons="dialogConfig.buttons"
    :show="dialogConfig.show"
    :width="'400px'"
    @close="dialogConfig.show = false"
  >
    <el-form ref="formDataRef" :model="formData" :rules="rules" label-width="60px">
      <el-form-item label="邮箱" prop="email">
        <el-input
          v-model.trim="formData.email"
          :max-length="50"
          placeholder="请输入邮箱"
        ></el-input>
      </el-form-item>
      <el-form-item label="靓号" prop="userId">
        <el-input
          v-model.trim="formData.userId"
          :max-length="11"
          placeholder="请输入靓号"
        ></el-input>
      </el-form-item>
    </el-form>
  </BaseDialog>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const dialogConfig = ref({
  show: false,
  title: '修改靓号',
  buttons: [
    {
      type: 'primary',
      text: '确定',
      click: () => {
        submitForm()
      }
    }
  ]
})

const formData = ref({ updateDescList: [] })
const formDataRef = ref()
const rules = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { validator: proxy.Verify.email, message: '请输入正确的邮箱' }
  ],
  userId: [
    { required: true, message: '请输入靓号', trigger: 'blur' },
    { min: 11, max: 11, message: '靓号必须11位' },
    { validator: proxy.Verify.number, message: '请输入正确的靓号' }
  ]
}

const emit = defineEmits(['reload'])
const submitForm = () => {
  formDataRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }
    let params = {}
    Object.assign(params, formData.value)
    let result = await proxy.Request({
      url: proxy.Api.saveBeautyAccount,
      params
    })
    if (!result) {
      return
    }
    proxy.Message.success('操作成功')
    dialogConfig.value.show = false
    emit('reload')
  })
}

const showEdit = (data = {}) => {
  dialogConfig.value.show = true
  nextTick(() => {
    formDataRef.value.resetFields()
    formData.value = { ...data }
  })
}

defineExpose({
  showEdit
})
</script>

<style lang="scss" scoped></style>
