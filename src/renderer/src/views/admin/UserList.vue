<template>
  <div class="top-panel">
    <el-card>
      <el-form :model="searchForm" label-width="70px" label-position="right">
        <el-row>
          <el-col :span="5">
            <el-form-item label="UID" label-width="40px">
              <el-input
                v-model="searchForm.userId"
                class="password-input"
                clearable
                @keyup.enter="loadDataList"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="5">
            <el-form-item label="昵称">
              <el-input
                v-model="searchForm.nickNameFuzzy"
                class="password-input"
                clearable
                placeholder="支持模糊查询"
                @keyup="loadDataList"
              ></el-input>
            </el-form-item>
          </el-col>
          <el-col :span="4" :style="{ paddingLeft: '10px' }">
            <el-button type="success" @click="loadDataList()">查询</el-button>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
  <el-card class="table-data-card">
    <MyTable
      :columns="colums"
      :fetch="loadDataList"
      :data-source="tableData"
      :options="tableOptions"
    >
      <template #slotAvatar="{ row }">
        <AvatarBase :width="50" :user-id="row.userId" part-type="avatar"></AvatarBase>
      </template>
      <template #slotNickName="{ row }">
        {{ row.nickName }}
        {{ row.userId }}
        <span v-if="row.sex == 0" class="iconfont icon-man"></span>
        <span v-else class="iconfont icon-woman"></span>
      </template>
      <template #slotStatus="{ row }">
        <span v-if="row.status == 0" style="color: red">禁用</span>
        <span v-else style="color: green">启用</span>
      </template>
      <template #slotOnline="{ row }">
        <span v-if="row.onlineType == 1" style="color: green">在线</span>
        <span v-else style="color: red">离线</span>
      </template>
      <template #slotOperation="{ row }">
        <el-dropdown v-if="userInfo.userId != row.userId" placement="bottom-end" trigger="click">
          <span class="iconfont icon-more"></span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="changeAccountStatus(row)">{{
                row.status == 0 ? '启用' : '禁用'
              }}</el-dropdown-item>
              <el-dropdown-item v-if="row.onlineType == 1" @click="forceOffLine(row)"
                >强制下线</el-dropdown-item
              >
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div v-else>管理员</div>
      </template>
    </MyTable>
  </el-card>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import AvatarBase from '@/components/AvatarBase.vue'

const tableData = ref({})
const tableOptions = {}
const colums = [
  {
    label: '头像',
    prop: 'userId',
    width: '70',
    scopedSlots: 'slotAvatar'
  },
  {
    label: '昵称',
    prop: 'nickName',
    scopedSlots: 'slotNickName'
  },
  {
    label: '邮箱',
    prop: 'email',
    width: 200
  },
  {
    label: '加入时间',
    prop: 'createTime',
    width: 200
  },
  {
    label: '地区',
    prop: 'areaName',
    width: 150
  },
  {
    label: '用户状态',
    prop: 'status',
    width: 100,
    scopedSlots: 'slotStatus'
  },
  {
    label: '在线状态',
    prop: 'onlineType',
    with: 100,
    scopedSlots: 'slotOnline'
  },
  {
    label: '操作',
    prop: 'operation',
    width: 100,
    scopedSlots: 'slotOperation'
  }
]

const searchForm = ref({})
const loadDataList = async () => {
  let params = {
    pageNo: tableData.value.pageNo,
    pageSize: tableData.value.pageSize
  }
  Object.assign(params, searchForm.value)
  let result = await proxy.Request({
    url: proxy.Api.loadAdminAccount,
    params: params
  })
  if (!result) {
    return
  }
  Object.assign(tableData.value, result.data)
}

const userInfo = ref({})
const getLoginInfo = async () => {
  let result = await proxy.Request({
    url: proxy.Api.getUserInfo
  })
  if (!result) {
    return
  }
  userInfo.value = result.data
}
getLoginInfo()

const changeAccountStatus = async (data) => {
  let status = data.status == 0 ? 1 : 0
  let info = status == 0 ? '禁用' : '启用'
  proxy.Confirm({
    message: `确定要${info}该账号吗？`,
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.updateUserStatus,
        params: {
          userId: data.userId,
          status: status
        }
      })
      if (!result) {
        return
      }
      proxy.Message.success(`${info}成功`)
      loadDataList()
    }
  })
}

const forceOffLine = async (data) => {
  proxy.Confirm({
    message: `确定要${data.nickName}该账号强制下线吗？`,
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.forceOffLine,
        params: {
          userId: data.userId,
          status: status
        }
      })
      if (!result) {
        return
      }
      proxy.Message.success(`强制下线成功`)
      loadDataList()
    }
  })
}
</script>

<style lang="scss" scoped>
.icon-man {
  color: #2cb6fe;
}
.icon-woman {
  color: #fb7373;
}
</style>
