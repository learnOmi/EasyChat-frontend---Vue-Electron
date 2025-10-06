import { defineStore } from 'pinia'

export const useUserInfoStore = defineStore('userInfo', {
  state: () => {
    return {
      userInfo: {}
    }
  },
  actions: {
    setUserInfo(userInfo) {
      this.userInfo = userInfo
      localStorage.setItem('userInfo', JSON.stringify(userInfo))
    },
    getUserInfo() {
      return this.userInfo
    }
  }
})
