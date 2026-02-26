<template>
  <ContentPanel>
    <div v-if="showType == 0" class="show-info">
      <div class="user-info">
        <UserbaseInfo :user-info="userInfo"></UserbaseInfo>
        <div class="more-op">
          <el-dropdown placement="bottom-end" trigger="click">
            <span class="el-dropdown-link">
              <div class="iconfont icon-more"></div>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="changePart(1)">修改个人信息</el-dropdown-item>
                <el-dropdown-item @click="changePart(2)">修改密码</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <div class="part-item">
        <div class="part-title">朋友权限</div>
        <div class="part-content">
          {{ userInfo.joinType == 0 ? '直接加入' : '需要验证' }}
        </div>
      </div>
      <div class="part-item">
        <div class="part-title">个性签名</div>
        <div class="part-content">{{ userInfo.personalSignature }}</div>
      </div>
    </div>
    <div class="logout">
      <el-button @click="logout">退出登录</el-button>
    </div>
  </ContentPanel>
  <div v-if="showType == 1">
    <UserInfoEdit :data="userInfo" @edit-back="editBack"></UserInfoEdit>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const userInfo = ref({})

const getUserInfo = async () => {
  let result = await proxy.Request({
    url: proxy.Api.getUserInfo
  })
  if (!result) {
    return
  }
  userInfo.value = result.data
}
getUserInfo()

const showType = ref(0)
const changePart = (type) => {
  showType.value = type
}

const editBack = () => {
  showType.value = 0
  getUserInfo()
}

//TODO 退出登录
const logout = () => {}
</script>

<style lang="scss" scoped>
.show-info {
  .user-info {
    position: relative;
    .more-op {
      position: absolute;
      right: 0px;
      top: 20px;
      .icon-more {
        color: #9e9e9e;
        &:hover {
          background: #dddddd;
        }
      }
    }
  }
  .part-item {
    display: flex;
    border-bottom: 1px solid #eaeaea;
    padding: 20px 0px;
    .part-title {
      width: 60px;
      color: #9e9e9e;
    }
    .part-content {
      flex: 1;
      margin-left: 15px;
      color: #161616;
    }
  }
  .logout {
    margin-top: 20px;
    text-align: center;
  }
}
</style>
