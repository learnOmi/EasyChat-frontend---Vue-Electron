import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  mode: 'hash',
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: '默认路径',
      redirect: '/login'
    },
    {
      path: '/login',
      name: '登录',
      component: () => import('@/views/Login.vue')
    },
    {
      path: '/main',
      redirect: '/chat',
      name: '主界面',
      component: () => import('@/views/Main.vue'),
      children: [
        {
          path: '/chat',
          name: '聊天',
          component: () => import('@/views/chat/Chat.vue')
        },
        {
          path: '/contact',
          name: '联系人',
          redirect: '/contact/blank',
          component: () => import('@/views/contact/Contact.vue'),
          children: [
            {
              path: 'blank',
              name: '空白页',
              component: () => import('@/views/contact/BlankPage.vue')
            },
            {
              path: 'search',
              name: '搜索',
              component: () => import('@/views/contact/Search.vue')
            },
            {
              path: 'createGroup',
              name: '创建群聊',
              component: () => import('@/views/contact/GroupEdit.vue')
            },
            {
              path: 'userDetail',
              name: '用户详情',
              component: () => import('@/views/contact/UserDetail.vue')
            },
            {
              path: 'groupDetail',
              name: '群聊详情',
              component: () => import('@/views/contact/GroupDetail.vue')
            },
            {
              path: 'contactNotice',
              name: '新朋友',
              component: () => import('@/views/contact/ContactApply.vue')
            }
          ]
        },
        {
          path: '/setting',
          name: '设置',
          component: () => import('@/views/setting/Setting.vue')
        }
      ]
    }
  ]
})

export default router
