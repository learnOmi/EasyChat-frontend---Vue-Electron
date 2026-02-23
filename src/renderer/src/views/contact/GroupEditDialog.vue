<template>
  <Dialog
    :show="dialogConfig.show"
    :title="dialogConfig.title"
    :button="dialogConfig.button"
    width="400px"
    :show-cancel="false"
    @close="dialogConfig.show = false"
  >
    <GroupEditForm ref="groupEditRef" @eidt-back="eidtBack"></GroupEditForm>
  </Dialog>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const dialogConfig = ref({
  show: false,
  title: '修改群组',
  button: []
})

const groupEditRef = ref()
const show = (data) => {
  dialogConfig.value.show = true
  nextTick(() => {
    groupEditRef.value.show(data)
  })
}

const emit = defineEmits(['reloadGroupInfo'])
const eidtBack = () => {
  dialogConfig.value.show = false
  emit('reloadGroupInfo')
}

defineExpose({
  show
})
</script>

<style lang="scss" scoped></style>
