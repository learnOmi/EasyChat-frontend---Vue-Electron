import { defineStore } from 'pinia'
export const useAvatarUploadStore = defineStore('avatarUpload', {
  state: () => {
    return {
      avatarMap: {}
    }
  },
  actions: {
    setForceReload(uid, forceReload) {
      this.avatarMap[uid] = forceReload
    },
    getForceReload(uid) {
      return this.avatarMap[uid] || false
    }
  }
})
