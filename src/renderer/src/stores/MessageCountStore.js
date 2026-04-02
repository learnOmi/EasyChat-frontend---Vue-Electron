import { defineStore } from 'pinia'
export const useMessageCountStore = defineStore('messageCountStore', {
  state: () => {
    return {
      messageCount: {
        chatCount: 0,
        contactApplyCount: 0
      }
    }
  },
  getters: {
    // 添加getter，确保响应式
    getCount: (state) => {
      return (key) => state.messageCount[key] || 0
    }
  },
  actions: {
    setCount(key, value, forceUpdate) {
      // 使用$patch确保响应式更新
      this.$patch((state) => {
        if (forceUpdate) {
          state.messageCount[key] = value
        } else {
          state.messageCount[key] += value
        }
      })
    }
  }
})
