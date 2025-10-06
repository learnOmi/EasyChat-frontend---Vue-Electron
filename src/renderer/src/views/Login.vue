<template>
  <div class="login-panel">
    <div class="title drag">{{ isLogin ? '登录' : '注册' }}</div>
    <div v-if="showLoading" class="loading-panel">
      <img src="../assets/loading.gif" alt="loading" />
    </div>
    <div v-else class="login-form">
      <div class="error-ms">{{ errorMS }}</div>
      <el-form ref="formDataRef" :model="formData" label-width="0px" @submit.prevent>
        <!--input输入-->
        <el-form-item prop="email">
          <el-input
            v-model.trim="formData.email"
            size="large"
            clearable
            placeholder="请输入邮箱"
            max-length="30"
            @focus="clearVerify"
          >
            <template #prefix><icon class="iconfont icon-youxiang" /></template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="!isLogin" prop="nickName">
          <el-input
            v-model.trim="formData.nickName"
            size="large"
            clearable
            placeholder="请输入昵称"
            max-length="15"
            @focus="clearVerify"
          >
            <template #prefix><icon class="iconfont icon-geren" /></template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model.trim="formData.password"
            size="large"
            clearable
            show-password
            placeholder="请输入密码"
            @focus="clearVerify"
          >
            <template #prefix><icon class="iconfont icon-quanxian" /></template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="!isLogin" prop="repassword">
          <el-input
            v-model.trim="formData.repassword"
            size="large"
            clearable
            show-password
            placeholder="请再次输入密码"
            @focus="clearVerify"
          >
            <template #prefix><icon class="iconfont icon-quanxian" /></template>
          </el-input>
        </el-form-item>
        <el-form-item prop="checkcode">
          <div class="check-code-panel">
            <el-input
              v-model.trim="formData.checkCode"
              size="large"
              clearable
              show-password
              placeholder="请输入验证码"
              @focus="clearVerify"
            >
              <template #prefix><icon class="iconfont icon-anquan" /></template>
            </el-input>
            <img :src="checkCodeUrl" class="check-code" @click="changeCheckCode" />
          </div>
        </el-form-item>
        <el-form-item prop="">
          <el-button type="primary" class="login-btn" @click="submit">{{
            isLogin ? '登录' : '注册'
          }}</el-button>
        </el-form-item>
        <div class="bottom-link">
          <span class="a-link" href="javascript:void(0)" @click="changeOpType">{{
            isLogin ? '没有账号?' : '已有账号'
          }}</span>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
import md5 from 'js-md5'
import { useUserInfoStore } from '@/stores/UserInfoStore'
import { useRouter } from 'vue-router'

const { proxy } = getCurrentInstance()
const userInfoStore = useUserInfoStore()
const router = useRouter()

// 表单数据
const formData = ref({})
// 表单引用
const formDataRef = ref()
// 错误信息
const errorMS = ref('')
// 是否为登录状态
const isLogin = ref(true)
// 验证码图片URL
const checkCodeUrl = ref(null)
// 是否显示加载中
const showLoading = ref(false)

/**
 * 切换登录/注册类型
 */
const changeOpType = () => {
  // 向主进程发送登录/注册切换事件
  window.electron.ipcRenderer.send('loginOrRegister', !isLogin.value)
  // 切换登录状态
  isLogin.value = !isLogin.value
  // 在下一次DOM更新后执行
  nextTick(() => {
    // 重置表单字段
    formDataRef.value.resetFields()
    // 清除验证码
    clearVerify()
  })
}

/**
 * 切换验证码
 */
const changeCheckCode = async () => {
  // 请求验证码
  let result = await proxy.Request({
    url: proxy.Api.checkCode
  })
  // 如果请求失败，直接返回
  if (!result) {
    return
  }
  // 更新验证码URL
  checkCodeUrl.value = result.data.checkCode
  // 存储验证码key到localStorage
  localStorage.setItem('checkCodeKey', result.data.checkCodeKey)
}
changeCheckCode()

const checkValue = (type, value, msg) => {
  // 判空
  if (proxy.Utils.isEmpty(value)) {
    errorMS.value = msg
    return false
  }

  // 类型校验；type 和 Verify 中的函数对应使用
  if (type && !proxy.Verify[type](value)) {
    errorMS.value = msg
    return false
  }

  return true
}

const clearVerify = () => {
  errorMS.value = ''
}

/**
 * 提交表单
 */
const submit = async () => {
  // formDataRef.value.validate(async (valid) => {
  //   if (valid) {
  //     window.electron.ipcRenderer.send('loginOrRegister', formData.value);
  //   } else {
  //     return ;
  //   }
  // });
  clearVerify()
  if (!checkValue('checkEmail', formData.value.email, '请输入正确的邮箱')) {
    return
  }

  if (!isLogin.value && !checkValue('', formData.value.nickName, '请输入昵称')) {
    return
  }

  if (
    !checkValue('checkPassword', formData.value.password, '密码只能是数字、字母、特殊字符8-16位')
  ) {
    return
  }

  if (!isLogin.value && formData.value.password !== formData.value.repassword) {
    errorMS.value = '两次密码输入不一致'
    return
  }

  if (!checkValue('', formData.value.checkCode, '请输入正确的验证码')) {
    return
  }

  if (isLogin.value) {
    showLoading.value = true
  }

  // 登录或注册请求处理
  let result = await proxy.Request({
    url: isLogin.value ? proxy.Api.login : proxy.Api.register, // 根据登录状态选择请求的URL
    showError: false, // 不显示错误提示
    showLoading: isLogin.value ? false : true, // 登录时不显示加载提示，注册时显示
    params: {
      email: formData.value.email, // 邮箱参数
      password: isLogin.value ? md5(formData.value.password) : formData.value.password, // 登录时使用MD5加密密码，注册时不加密
      checkCode: formData.value.checkCode, // 验证码
      nickName: formData.value.nickName, // 昵称
      checkCodeKey: localStorage.getItem('checkCodeKey') // 验证码密钥，从localStorage获取
    },
    errorCallback: (response) => {
      // 请求错误回调函数
      showLoading.value = false // 隐藏加载提示
      changeCheckCode() // 更换验证码
      errorMS.value = response.info // 设置错误信息
    }
  })
  // 如果请求没有返回结果，则直接返回
  if (!result) {
    return
  }

  // 如果是登录操作
  if (isLogin.value) {
    // 设置用户信息
    userInfoStore.setUserInfo(result.data)
    // 保存token到localStorage
    localStorage.setItem('token', result.data.token)
    // 跳转到主页面
    router.push('/main')

    // 获取屏幕宽高
    const screenWidth = window.screen.width
    const screenHeight = window.screen.height
    // 发送IPC消息，打开聊天窗口
    window.electron.ipcRenderer.send('openChat', {
      email: formData.value.email, // 用户邮箱
      token: result.data.token, // 用户token
      userId: result.data.userId, // 用户ID
      nickName: result.data.nickName, // 用户昵称
      admin: result.data.admin, // 用户是否为管理员
      screenHeight, // 屏幕高度
      screenWidth // 屏幕宽度
    })
  } else {
    // 注册成功提示
    proxy.Message.success('注册成功，请登录')
    // 切换操作类型（切换到登录）
    changeOpType()
  }
}
</script>

<style lang="scss" scoped>
.email-select {
  width: 250px;
}
.loading-panel {
  height: calc(100vh - 32px);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  img {
    width: 300px;
  }
}
.login-panel {
  background: #fff;
  border-radius: 3px;
  border: 1px solid #ddd;
  .title {
    height: 30px;
    padding: 5px 0px 0px 10px;
  }

  .login-form {
    padding: 0px 15px 29px 15px;
    :deep(.el-input__wrapper) {
      box-shadow: none;
      border-radius: none;
    }
    .el-form-item {
      border-bottom: 1px solid #ddd;
    }

    .email-panel {
      align-items: center;
      width: 100%;
      display: flex;
      .input {
        flex: 1;
      }
      .icon-dom {
        margin-left: 3px;
        width: 16px;
        cursor: pointer;
        border: none;
      }
    }
    .error-ms {
      line-height: 30px;
      height: 30px;
      font-size: 14px;
      color: #f56c6c;
    }
    .check-code-panel {
      display: flex;
      .check-code {
        cursor: pointer;
        width: 120px;
        margin-left: 5px;
      }
    }

    .login-btn {
      margin-top: 20px;
      width: 100%;
      background: #07c160;
      height: 36px;
      font-size: 16px;
    }
    .bottom-link {
      text-align: right;
    }
  }
}
</style>
