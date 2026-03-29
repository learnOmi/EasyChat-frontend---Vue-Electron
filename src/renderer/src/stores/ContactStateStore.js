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
    setDelContactId(id) {
      this.delContactId = id
    }
  }
})

export { useContactStateStore }
