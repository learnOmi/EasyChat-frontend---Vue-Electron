import { defineStore } from 'pinia'

const useUserInfoStore = defineStore('userInfo', {
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

export { useUserInfoStore }
