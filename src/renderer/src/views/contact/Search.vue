<template>
  <ContentPanel>
    <div class="search-form">
      <el-input
        v-model="contactId"
        placeholder="请输入用户Id或群组Id"
        clearable
        size="large"
        class="search-input"
        @keydown.enter="search"
      />
      <div class="search-button iconfont icon-sousuo" @click="search">搜索</div>
    </div>
    <div v-if="searchResult && Object.keys(searchResult).length > 0" class="search-result-panel">
      <div class="search-result">
        <span class="contact-type">{{ contactTypeName }}</span>
        <div>{{ searchResult.nickName }}</div>
      </div>
      <div v-if="searchResult.contactId != userInfoStore.getUserInfo().userId" class="op-btn">
        <el-button
          v-if="
            searchResult.status == null ||
            searchResult.status == 0 ||
            searchResult.status == 2 ||
            searchResult.status == 3 ||
            searchResult.status == 4
          "
          type="primary"
          @click="applyContact"
          >{{ searchResult.contactType == 'USER' ? '添加好友' : '申请入群' }}</el-button
        >
        <el-button v-if="searchResult.status == 1" type="primary" @click="sendMessage"
          >发送消息</el-button
        >
        <span v-if="searchResult.status == 5 || searchResult.status == 6">对方拉黑了你</span>
      </div>
    </div>
    <div v-if="!searchResult" class="no-data">暂无数据</div>
  </ContentPanel>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick, computed } from 'vue'
import { useUserInfoStore } from '@/stores/UserInfoStore'
const { proxy } = getCurrentInstance()
const userInfoStore = useUserInfoStore()

const contactTypeName = computed(() => {
  if (userInfoStore.getUserInfo().userId == searchResult.value.contactId) {
    return '自己'
  }
  if (searchResult.value.contactType == 'USER') {
    return '用户'
  }
  return '群组'
})

const contactId = ref('')
const searchResult = ref({})
const search = async () => {
  if (!contactId.value) {
    proxy.Message.warning('请输入用户Id或群组Id')
    return
  }

  let result = await proxy.Request({
    url: proxy.Api.search,
    params: {
      contactId: contactId.value
    }
  })

  if (!result) {
    return
  }

  searchResult.value = result.data
}
</script>

<style lang="scss" scoped>
.search-form {
  padding-top: 50px;
  display: flex;
  align-items: center;
  :deep(.el-input_wrapper) {
    border-radius: 4px 0px 0px 4px;
    border-right: none;
  }
  .search-button {
    background: #07c160;
    color: #fff;
    line-height: 40px;
    width: 80px;
    text-align: center;
    border-radius: 0px 5px 5px 0px;
    cursor: pointer;
    &:hover {
      background: #0dd36c;
    }
  }
}
.no-data {
  padding: 30px 0px;
}
.search-result-panel {
  .search-result {
    padding: 30px 20px 20px 20px;
    background: #fff;
    border-radius: 5px;
    margin-top: 10px;
    position: relative;
    .contact-type {
      position: absolute;
      left: 0px;
      top: 0px;
      background: #2cb6fe;
      padding: 2px 5px;
      color: #fff;
      border-radius: 5px 0px 0px 0px;
      font-size: 12px;
    }
  }
  .op-btn {
    border-radius: 5px;
    margin-top: 10px;
    padding: 10px;
    background: #fff;
    text-align: center;
  }
}
</style>
