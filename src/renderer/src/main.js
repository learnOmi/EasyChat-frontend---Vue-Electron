import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import * as Pinia from 'pinia'
import 'element-plus/dist/index.css'
import '@/assets/cust-elementplus.scss'
import '@/assets/icon/iconfont.css'
import '@/assets/base.scss'
import router from '@/router'
import Utils from '@/utils/Utils.js'
import Verify from '@/utils/Verify.js'
import Request from '@/utils/Request.js'
import Message from '@/utils/Message.js'
import Api from '@/utils/Api.js'

/**
 * 创建Vue应用实例并进行全局配置
 * 使用ElementPlus UI组件库、路由插件，并挂载到DOM
 */
const app = createApp(App) // 创建Vue应用实例
app.use(ElementPlus).use(router).use(Pinia.createPinia())
app.config.globalProperties.Utils = Utils
app.config.globalProperties.Verify = Verify
app.config.globalProperties.Request = Request
app.config.globalProperties.Message = Message
app.config.globalProperties.Api = Api
app.mount('#app')
