<template>
  <div>
    <BaseDialog
      :show="dialogConfig.show"
      :title="dialogConfig.title"
      :buttons="dialogConfig.buttons"
      width="660px"
      @close="dialogConfig.show = false"
    >
      <template #default>
        <div class="dialog-content">
          <el-transfer
            v-model="formData.selectContacts"
            :titles="['全部', '已选']"
            :format="{
              noChecked: '${total}',
              hasChecked: '${checked}/${total}'
            }"
            :data="dataList"
            :props="{
              key: 'contactId',
              label: 'contactName'
            }"
            filterable
            :filter-method="search"
          >
            <template #default="{ option }">
              <div class="select-item">
                <div class="avatar">
                  <AvatarBase
                    :user-id="option.contactId"
                    :width="30"
                    :border-radius="5"
                    :show-detail="false"
                  ></AvatarBase>
                </div>
                <div class="nick-name">{{ option.contactName }}</div>
              </div>
            </template>
          </el-transfer>
        </div>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup>
import { ref, reactive, getCurrentInstance, nextTick } from 'vue'
const { proxy } = getCurrentInstance()
import AvatarBase from '../../components/AvatarBase.vue'

const dataList = ref([])
const formData = reactive({
  selectContacts: []
})

const dialogConfig = ref({
  show: false,
  title: '选择联系人',
  buttons: [
    {
      type: 'primary',
      text: '确定',
      click: (e) => {
        submitData()
      }
    }
  ]
})

const show = ({ contactList, groupId, opType }) => {
  dialogConfig.value.title = opType == 0 ? '移出群员' : '添加群员'
  dialogConfig.value.show = true
  dataList.value = contactList
  Object.assign(formData, {
    // 修改这里：reactive对象不需要.value
    selectContacts: [],
    groupId,
    opType
  })
}

const search = (query, item) => {
  return item.contactName.toLowerCase().includes(query.toLowerCase())
}

const emit = defineEmits(['callback'])
const submitData = async () => {
  if (formData.selectContacts.length == 0) {
    proxy.$message.warning('请选择联系人')
    return
  }
  let params = {}
  Object.assign(params, formData)
  params.selectContacts = params.selectContacts.join(',')
  let result = await proxy.Request({
    url: proxy.Api.addOrRemoveGroupUser,
    params
  })
  if (!result) {
    return
  }

  emit('callback', formData)
  dialogConfig.value.show = false
}

defineExpose({
  show
})
</script>

<style lang="scss" scoped>
.el-transfer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  :deep(.el-transfer-panel) {
    width: 280px;
    flex: none;
  }
  :deep(.el-transfer-panel__item) {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 10px;
    margin-top: 5px;
  }
  :deep(.el-transfer-panel__body) {
    height: 300px;
  }
}

:deep(.el-transfer__buttons) {
  width: 60px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0;
  margin: 0 15px;
  .el-transfer__button {
    display: block;
    margin: 5px 0;
    padding: 10px;
    height: 36px;
    border-radius: 50%;
  }
}

.select-item {
  display: flex;
  align-items: center;
  width: 100%;
  .avatar {
    width: 30px;
    height: 30px;
    flex: none;
  }
  .nick-name {
    flex: 1;
    margin-left: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
