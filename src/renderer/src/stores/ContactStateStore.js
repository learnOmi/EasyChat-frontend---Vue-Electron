import { defineStore } from 'pinia'

const useContactStateStore = defineStore('contactStateInfo', {
  state: () => {
    return {
      contactReload: null
    }
  },
  actions: {
    setContactReload(state) {
      this.contactReload = state
    }
  }
})

export { useContactStateStore }
