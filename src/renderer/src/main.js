import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
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
import Layout from '@/components/Layout.vue'
import WinOp from '@/components/WinOp.vue'
import ContentPanel from '@/components/ContentPanel.vue'
import ShowLocalImage from '@/components/ShowLocalImage.vue'
import UserBaseInfo from '@/components/UserBaseInfo.vue'
import BaseDialog from '@/components/BaseDialog.vue'
import Avatar from '@/components/Avatar.vue'
import AvatarUpload from '@/components/AvatarUpload.vue'
import Confirm from './utils/Confirm'

/**
 * Vue应用初始化配置文件
 * 用于创建Vue应用实例并配置全局插件和属性
 */
const app = createApp(App) // 创建Vue应用实例
app.use(ElementPlus).use(router).use(createPinia())
app.component('Layout', Layout)
app.component('WinOp', WinOp)
app.component('ContentPanel', ContentPanel)
app.component('ShowLocalImage', ShowLocalImage)
app.component('UserBaseInfo', UserBaseInfo)
app.component('BaseDialog', BaseDialog)
app.component('Avatar', Avatar)
app.component('AvatarUpload', AvatarUpload)
app.config.globalProperties.Utils = Utils
app.config.globalProperties.Verify = Verify
app.config.globalProperties.Request = Request
app.config.globalProperties.Message = Message
app.config.globalProperties.Api = Api
app.config.globalProperties.Confirm = Confirm
app.mount('#app')
