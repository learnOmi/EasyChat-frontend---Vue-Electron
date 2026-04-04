<template>
  <div>
    <div class="top-panel">
      <el-card>
        <el-form :model="searchForm" label-width="70px" label-position="right">
          <el-row>
            <el-col :span="5">
              <el-form-item label="账号" label-width="40px">
                <el-input
                  v-model="searchForm.userIdFuzzy"
                  class="password-input"
                  clearable
                  placeholder="支持模糊搜索"
                  @keyup.enter="loadDataList"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="邮箱">
                <el-input
                  v-model="searchForm.emailFuzzy"
                  class="password-input"
                  clearable
                  placeholder="支持模糊搜索"
                  @keyup.enter="loadDataList"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="4" :style="{ paddingLeft: '10px' }">
              <el-button type="success" @click="loadDataList">查询</el-button>
              <el-button type="primary" @click="editAccount">新增</el-button>
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
          <span v-if="row.sex == 0" class="iconfont icon-man"></span>
          <span v-else class="iconfont icon-woman"></span>
        </template>
        <template #slotStatus="{ row }">
          <span v-if="!row.status || row.status == 0" style="color: red">未使用</span>
          <span v-else style="color: green">已使用</span>
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
                <el-dropdown-item v-if="row.status == 0" @click="editAccount(row)"
                  >修改</el-dropdown-item
                >
                <el-dropdown-item @click="delAccount(row)">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </MyTable>
    </el-card>
  </div>
  <BeautyAccountEdit ref="beautyAccountEditRef" @reload="loadDataList"></BeautyAccountEdit>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import BeautyAccountEdit from './BeautyAccountEdit.vue'

const tableData = ref({})
const tableOptions = {}
const columns = [
  {
    label: '邮箱',
    prop: 'email'
  },
  {
    label: '靓号',
    prop: 'userId'
  },
  {
    label: '状态',
    prop: 'status',
    scopedSlots: 'slotStatus'
  },
  {
    label: '操作',
    prop: 'operation',
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
    url: proxy.Api.loadBeautyAccount,
    params: params
  })
  if (!result) {
    return
  }
  Object.assign(tableData.value, result.data)
}

const beautyAccountEditRef = ref(null)
const editAccount = (row) => {
  beautyAccountEditRef.value.show(row)
}

const delAccount = async (row) => {
  proxy.Confirm({
    content: '确定删除该账号吗？',
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.delBeautyAccount,
        params: {
          userId: row.userId
        }
      })
      if (!result) {
        return
      }
      proxy.Message.success('删除成功')
      loadDataList()
    }
  })
}
</script>

<style lang="scss" scoped></style>
