import { defineStore } from 'pinia'

const useContactStateStore = defineStore('contactStateInfo', {
  state: () => {
    return {
      contactReload: null,
      delContactId: null
    }
  },
  actions: {
    setContactReload(state) {
      this.contactReload = state
    },
    delContactId(delContactId) {
      this.delContactId = delContactId
    }
  }
})

export { useContactStateStore }
