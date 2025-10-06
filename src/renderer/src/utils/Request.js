/**
 * Axios 请求封装模块
 * 功能：
 * 1. 统一处理请求和响应拦截
 * 2. 自动管理加载状态
 * 3. 统一错误处理机制
 */

import axios from 'axios'
import Api from '../utils/Api'
import { ElLoading } from 'element-plus' // Element Plus 加载组件
import Message from '../utils/Message' // 统一消息提示

// 请求内容类型常量
const contentTypeForm = 'application/x-www-form-urlencoded;charset=UTF-8'
const contentTypeJson = 'application/json'
const responseTypeJson = 'json'

// 全局加载状态实例
let loading = null

/**
 * 创建 Axios 实例
 * 配置项：
 * - withCredentials: 允许跨域携带 cookie
 * - timeout: 请求超时时间(毫秒)
 * - baseURL: 根据环境变量动态设置 API 基础路径
 */
const instance = axios.create({
  withCredentials: true,
  timeout: 10000,
  baseURL: (import.meta.env.PROD ? Api.prodDomain : '') + '/api'
})

/**
 * 请求拦截器
 * 功能：
 * 1. 根据配置显示全局加载状态
 * 2. 统一处理请求配置
 */
instance.interceptors.request.use(
  (config) => {
    // 显示加载状态
    if (config.showLoading) {
      loading = ElLoading.service({
        lock: true, // 锁定屏幕
        text: '加载中...', // 加载提示文本
        background: 'rgba(0, 0, 0, 0.7)' // 背景遮罩
      })
    }
    return config
  },
  (error) => {
    // 请求发送失败处理
    if (error.config?.showLoading && loading) {
      loading.close() // 关闭加载状态
    }
    Message.error('请求发送失败') // 显示错误提示
    return Promise.reject(error) // 返回错误对象
  }
)

/**
 * 响应拦截器
 * 功能：
 * 1. 根据配置关闭加载状态
 * 2. 处理二进制响应数据
 * 3. 统一业务状态码处理
 * 4. 全局错误处理
 */
instance.interceptors.response.use(
  (response) => {
    // 解构响应配置
    const { showLoading, errorCallback, showError = true, responseType } = response.config

    // 关闭加载状态
    if (showLoading && loading) {
      loading.close()
    }

    const responseData = response.data

    // 处理二进制响应(如文件下载)
    if (responseType === 'arraybuffer' || responseType === 'blob') {
      return responseData
    }

    // 业务状态码处理
    if (responseData.code === 200) {
      return responseData // 成功响应
    } else if (responseData.code === 901) {
      // 登录超时处理
      setTimeout(() => {
        window.electron.ipcRenderer.send('reLogin') // 通知 Electron 重新登录
      }, 2000)
      return Promise.reject({ showError: true, msg: '登录超时' })
    } else {
      // 其他业务错误
      if (errorCallback) {
        errorCallback(responseData) // 执行自定义错误回调
      }
      return Promise.reject({
        showError: showError, // 是否显示错误提示
        msg: responseData.info // 错误信息
      })
    }
  },
  (error) => {
    // 网络错误处理
    if (error.config?.showLoading && loading) {
      loading.close()
    }
    return Promise.reject({
      showError: true, // 总是显示网络错误
      msg: '网络异常' // 统一错误提示
    })
  }
)

/**
 * 封装网络请求函数
 * @param {Object} config - 请求配置对象
 * @returns {Promise} 返回请求的Promise对象
 */
const request = (config) => {
  // 从配置中解构出常用参数，设置默认值
  const {
    url,
    params,
    dataType,
    showLoading = true,
    responseType = responseTypeJson,
    showError = true
  } = config
  // 初始化Content-Type为表单类型
  let contentType = contentTypeForm
  // 创建FormData对象用于处理请求参数
  let formData = new FormData()
  // 遍历参数对象，处理undefined值并添加到FormData中
  for (let key in params) {
    formData.append(key, params[key] == undefined ? '' : params[key])
  }
  // 如果指定数据类型为JSON，则修改Content-Type
  if (dataType != null && dataType == 'json') {
    contentType = contentTypeJson
  }
  // 从localStorage中获取token
  const token = localStorage.getItem('token')
  // 设置请求头
  let headers = {
    'Content-Type': contentType, // 指定请求的内容类型，如application/json
    token: token, // 用于身份验证的令牌
    'X-Requested-With': 'XMLHttpRequest' // 标识请求为AJAX请求，用于服务器端识别
  }
  // 发起POST请求
  return instance
    .post(url, formData, {
      headers: headers, // 请求头
      showLoading: showLoading, // 是否显示加载提示
      showError: showError, // 是否显示错误信息
      responseType: responseType, // 响应数据类型
      errorCallback: config.errorCallback // 错误回调函数
    })
    .catch((err) => {
      // 如果请求错误且配置显示错误，则提示错误信息
      if (err.showError) {
        Message.error(err.msg)
      }
      // 返回null表示请求失败
      return null
    })
}

export default request
