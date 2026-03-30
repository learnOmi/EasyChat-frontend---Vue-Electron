import { defineStore } from 'pinia'
export const useSysSettingStore = defineStore('sysSettingStore', {
  state: () => {
    return {
      sysSetting: {}
    }
  },
  actions: {
    setSetting(config) {
      this.sysSetting = config
    },
    getSetting() {
      return this.sysSetting
    }
  }
})
