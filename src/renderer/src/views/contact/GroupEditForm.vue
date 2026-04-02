<template>
  <el-form ref="formDataRef" :model="formData" :rules="rules" label-width="80px" @submit.prevent>
    <el-form-item label="群聊名称" prop="groupName">
      <el-input
        v-model.trim="formData.groupName"
        maxlength="20"
        clearable
        placeholder="请输入群聊名称"
      ></el-input>
    </el-form-item>
    <el-form-item label="封面" prop="avatarFile">
      <AvatarUpload
        ref="avatarUploadRef"
        v-model="formData.avatarFile"
        @cover-file="saveCover"
      ></AvatarUpload>
    </el-form-item>
    <el-form-item label="加入权限" prop="joinType">
      <el-radio-group v-model="formData.joinType">
        <el-radio :label="1">管理员同意后加入</el-radio>
        <el-radio :label="0">直接加入</el-radio>
      </el-radio-group>
    </el-form-item>
    <el-form-item label="公告" prop="groupNotice">
      <el-input
        v-model.trim="formData.groupNotice"
        clearable
        placeholder="请输入群公告"
        type="textarea"
        :rows="5"
        maxlength="300"
        :show-word-limit="true"
        resize="none"
      ></el-input>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="submit">
        {{ formData.groupId ? '修改群组' : '创建群组' }}
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import { useContactStateStore } from '@/stores/ContactStateStore'
import { useAvatarUploadStore } from '@/stores/AvatarUploadStore'
const contactStateStore = useContactStateStore()
const avatarUploadStore = useAvatarUploadStore()

const formData = ref({})
const formDataRef = ref()
const rules = {
  groupName: [{ required: true, message: '请输入群聊名称' }],
  joinType: [{ required: true, message: '请选择加入权限' }],
  avatarFile: [{ required: true, message: '请上传群聊封面' }]
}

const emit = defineEmits(['editBack'])
const submit = async () => {
  formDataRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }
    let params = {}
    if (params.groupId) {
      avatarUploadStore.setForceReload(params.groupId, false)
    }
    Object.assign(params, formData.value)
    let result = await proxy.Request({
      url: proxy.Api.saveGroup,
      params
    })
    if (!result) {
      return
    }
    if (params.groupId){
      proxy.Message.success('修改群组成功')
      emit('editBack')
    } else {
      proxy.Message.success('创建群组成功')
    }
    formDataRef.value.resetFields()
    contactStateStore.setContactReload('MY')
    if (params.groupId) {
      avatarUploadStore.setForceReload(params.groupId, true)
    }
  })
}

const saveCover = ({ avatarFile, coverFile }) => {
  formData.value.avatarFile = avatarFile
  formData.value.avatarCover = coverFile
}

const show = (data) => {
  formDataRef.value.resetFields();
  formData.value = Object.assign({}, data)
  formData.value.avatarFile = data.groupId
}

defineExpose({
  show
})
</script>

<style lang="scss" scoped></style>
