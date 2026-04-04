<template>
  <div>
    <div class="top-panel">
      <el-card>
        <el-form :model="searchForm" label-width="80px" label-position="right">
          <el-row>
            <el-col :span="5">
              <el-form-item label="群组ID" label-width="55px">
                <el-input
                  v-model="searchForm.groupId"
                  class="password-input"
                  clearable
                  placeholder="支持模糊搜索"
                  @keyup.enter="loadDataList"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="群名称">
                <el-input
                  v-model="searchForm.groupNameFuzzy"
                  class="password-input"
                  clearable
                  placeholder="支持模糊搜索"
                  @keyup.enter="loadDataList"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="5">
              <el-form-item label="群主ID">
                <el-input
                  v-model="searchForm.groupOwnerId"
                  class="password-input"
                  clearable
                  @keyup.enter="loadDataList"
                ></el-input>
              </el-form-item>
            </el-col>
            <el-col :span="4" :style="{ paddingLeft: '10px' }">
              <el-button type="success" @click="loadDataList">查询</el-button>
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
        <template #slotGroupName="{ row }"> {{ row.groupName }}({{ row.groupId }}) </template>
        <template #slotGroupOwnerNickName="{ row }">
          {{ row.groupOwnerNickName }}({{ row.groupOwnerId }})
        </template>
        <template #slotJointType="{ row }">
          <div>{{ row.jointType == 0 ? '自由加入' : '需要验证' }}</div>
        </template>
        <template #slotStatus="{ row }">
          <div>
            <span v-if="row.status == 0" style="color: red">已解散</span>
            <span v-else style="color: green">正常</span>
          </div>
        </template>
        <template #slotOperation="{ row }">
          <div class="row-op-panel">
            <a v-if="row.status == 1" @click="dissolutionGroup">解散</a>
          </div>
        </template>
      </MyTable>
    </el-card>
  </div>
</template>

<script setup>
import AvatarBase from '@/components/AvatarBase.vue'
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()

const tableData = ref({})
const tableOptions = {}
const columns = [
  {
    label: '群头像',
    prop: 'groupId',
    scopedSlots: 'slotAvatar',
    width: 70
  },
  {
    label: '群名称',
    prop: 'groupName',
    scopedSlots: 'slotGroupName'
  },
  {
    label: '群主昵称',
    prop: 'groupOwnerNickName',
    scopedSlots: 'slotGroupOwnerNickName'
  },
  {
    label: '群员',
    prop: 'memberCount',
    width: 200
  },
  {
    label: '创建时间',
    prop: 'createTime',
    width: 200
  },
  {
    label: '加入方式',
    prop: 'joinType',
    width: 150,
    scopedSlots: 'slotJointType'
  },
  {
    label: '状态',
    prop: 'status',
    width: 150,
    scopedSlots: 'slotStatus'
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
    url: proxy.Api.loadGroup,
    params: params
  })
  if (!result) {
    return
  }
  Object.assign(tableData.value, result.data)
}

const dissolutionGroup = (data) => {
  proxy.Confirm({
    content: `确定解散该群【${data.groupName}】吗？`,
    okfun: async () => {
      let result = await proxy.Request({
        url: proxy.Api.adminDissolutionGroup,
        params: {
          userId: data.groupId
        }
      })
      if (!result) {
        return
      }
      proxy.Message.success('解散成功')
      loadDataList()
    }
  })
}
</script>

<style lang="scss" scoped></style>
