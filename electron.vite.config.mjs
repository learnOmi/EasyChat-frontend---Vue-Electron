import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

/**
 * 配置文件，用于定义项目的构建和开发环境设置
 * @param {object} defineConfig - Vite 提供的配置函数
 * @returns {object} 返回配置对象
 */
export default defineConfig({
  /**
   * 主进程配置
   */
  main: {
    plugins: [externalizeDepsPlugin()] // 使用外部依赖插件，将依赖项外部化
  },
  /**
   * 预加载脚本配置
   */
  preload: {
    plugins: [externalizeDepsPlugin()] // 使用外部依赖插件，将依赖项外部化
  },
  /**
   * 渲染进程配置
   */
  renderer: {
    /**
     * 路径解析配置
     */
    resolve: {
      alias: {
        '@': resolve('src/renderer/src') // 设置 @ 别名指向 src/renderer/src 目录
      }
    },
    plugins: [vue()], // 使用 Vue 插件支持 Vue 开发
    /**
     * 开发服务器配置
     */
    server: {
      hmr: true, // 启用热模块替换
      port: 5000, // 设置开发服务器端口为 5000
      proxy: {
        // 配置代理，用于将 API 请求转发到后端服务
        '/api': {
          target: 'http://localhost:5050',
          changeOrigin: true,
          pathRewrite: {
            // 路径重写规则
            '^/api': '/api' // 将 /api 前缀保留
          }
        }
      }
    },
    build: {
      sourcemap: true // 生成源码映射文件
    }
  }
})
