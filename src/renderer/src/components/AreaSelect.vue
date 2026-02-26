<template>
  <div>
    <el-cascader
      ref="areaSelectRef"
      v-model="modelValue.areaCode"
      :options="AreaData"
      clearable
      @change="change"
    ></el-cascader>
  </div>
</template>

<script setup>
import AreaData from './AreaData'
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue'])
const areaSelectRef = ref()
const change = (e) => {
  const areaData = {
    areaName: [],
    areaCode: []
  }
  const checkNodes = areaSelectRef.value.getCheckedNodes()[0]
  if (!checkNodes) {
    emit('update:modelValue', areaData)
    return
  }
  const pathValues = checkNodes.pathValues
  const pathLabels = checkNodes.pathLabels
  areaData.areaName = pathLabels
  areaData.areaCode = pathValues
  emit('update:modelValue', areaData)
}
</script>

<style lang="scss" scoped></style>
