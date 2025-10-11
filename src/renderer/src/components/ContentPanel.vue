<template>
  <div class="content-panel" :style="{ 'boder-top': showTopBorder ? '1px solid #ddd' : 'none' }">
    <div class="content-inner">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  showTopBorder: {
    type: Boolean,
    default: false
  }
})
</script>

<style lang="scss" scoped>
.cotent-panel {
  overflow: auto;
  height: calc(100vh - 62px);
  .content-inner {
    margin: 0px auto;
    width: 400px;
  }
}
</style>
