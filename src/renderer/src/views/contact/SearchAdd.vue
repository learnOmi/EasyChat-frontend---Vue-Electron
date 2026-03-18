<template>
  <div>
    <BaseDialog
      :show="dialogConfig.show"
      :title="dialogConfig.title"
      :buttons="dialogConfig.buttons"
      width="400px"
      :show-cancel="false"
      @close="dialogConfig.show = false"
    >
      <el-form ref="formDataRef" :model="formData" :rules="rules" @submit.prevent>
        <!--input输入-->
        <el-form-item label="" prop="">
          <el-input
            v-model.trim="formData.applyInfo"
            type="textarea"
            :rows="5"
            clearable
            placehodler="输入申请信息，更容易被通过哦"
            resize="none"
            show-word-limit
            maxlength="100"
          ></el-input>
        </el-form-item>
      </el-form>
    </BaseDialog>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import { useUserInfoStore } from '@/stores/UserInfoStore'
const userInfoStore = useUserInfoStore()
import { useContactStateStore } from '@/stores/ContactStateStore'
const contactStateStore = useContactStateStore()

const formData = ref({})
const formDataRef = ref()
const rules = {
  title: [{ required: true, message: '请输入内容' }]
}

const dialogConfig = ref({
  show: false,
  title: '提交申请',
  buttons: [
    {
      type: 'primary',
      text: '确定',
      click: (e) => {
        submitApply()
      }
    }
  ]
})

const emit = defineEmits(['reload'])
const submitApply = async () => {
  const { contactId, contactType, applyInfo } = formData.value
  let result = await proxy.Request({
    url: proxy.Api.applyAdd,
    params: {
      contactId,
      applyInfo,
      contactType
    }
  })
  if (!result) {
    return
  }
  if (result.data == 0) {
    contactStateStore.setContactReload(contactType)
    proxy.Message.success('加入成功')
  } else {
    proxy.Message.success('申请已发送')
  }
  dialogConfig.value.show = false
  emit('reload')
}

const show = (data) => {
  dialogConfig.value.show = true
  nextTick(() => {
    formDataRef.value.resetFields()
    formData.value = Object.assign({}, data)
    formData.value.applyInfo = '我是' + userInfoStore.getInfo().nickName
  })
}

defineExpose({
  show
})
</script>

<style lang="scss" scoped></style>
