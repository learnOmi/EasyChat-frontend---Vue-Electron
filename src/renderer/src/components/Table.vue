<template>
  <div>
    <el-table
      ref="dataTable"
      :data="tableData.list"
      :height="tableHeight"
      :stripe="options.stripe"
      :border="options.border"
      header-row-class-name="table-header-row"
      highlight-current-row
      @row-click="handleRowClick"
      @selection-change="handleSelectionChange"
    >
      <!--selection选择框-->
      <el-table-column
        v-if="options.selectType && options.selectType == 'checkbox'"
        type="selection"
        :selectable="selectedHandler"
        width="50"
        align="center"
      ></el-table-column>
      <!--序号-->
      <el-table-column
        v-if="options.showIndex"
        label="序号"
        type="index"
        width="60"
        align="center"
      ></el-table-column>
      <!--数据列-->
      <template v-for="(column, index) in columns">
        <template v-if="column.scopedSlots">
          <el-table-column
            :key="index"
            :prop="column.prop"
            :label="column.label"
            :align="column.align || 'left'"
            :width="column.width"
          >
            <template #default="scope">
              <slot :name="column.scopedSlots" :index="scope.$index" :row="scope.row"> </slot>
            </template>
          </el-table-column>
        </template>
        <template v-else>
          <el-table-column
            :key="index"
            :prop="column.prop"
            :label="column.label"
            :align="column.align || 'left'"
            :width="column.width"
            :fixed="column.fixed"
          >
          </el-table-column>
        </template>
      </template>
    </el-table>
    <!-- 分页 -->
    <div v-if="showPagination" class="pagination">
      <el-pagination
        v-if="tableData.totalCount"
        v-model:current-page="tableData.pageNo"
        background
        :total="tableData.totalCount"
        :page-sizes="[15, 30, 50, 100]"
        :page-size="tableData.pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        style="text-align: right"
        @size-change="handlePageSizeChange"
        @current-change="handlePageNoChange"
      ></el-pagination>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, watch, computed, onMounted } from 'vue'

const emit = defineEmits(['rowSelected', 'rowClick', 'update:pageNo', 'update:pageSize'])
const props = defineProps({
  dataSource: {
    type: Object,
    default: () => ({})
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  options: {
    type: Object,
    default: () => ({})
  },
  extHeight: {
    type: Number,
    default: 70
  },
  columns: Array,
  fetch: Function,
  initFetch: {
    type: Boolean,
    default: true
  },
  selected: Function
})

// 创建响应式数据，避免直接修改props
const tableData = reactive({
  list: [],
  pageNo: 1,
  pageSize: 15,
  totalCount: 0
})

// 初始化tableData
const initTableData = () => {
  tableData.list = props.dataSource.list || []
  tableData.pageNo = props.dataSource.pageNo || 1
  tableData.pageSize = props.dataSource.pageSize || 15
  tableData.totalCount = props.dataSource.totalCount || 0
}

// 监听props.dataSource的变化
watch(
  () => props.dataSource,
  (newVal) => {
    initTableData()
  },
  { deep: true, immediate: true }
)

// 计算表格高度
const tableHeight = computed(() => {
  return props.options.tableHeight
    ? props.options.tableHeight
    : window.innerHeight - (40 + 20 + 10 + 42 + 20 + 2) - props.extHeight
})

// 初始化
const init = () => {
  if (props.initFetch && props.fetch) {
    props.fetch()
  }
}

onMounted(() => {
  init()
})

const dataTable = ref()

// 清除选中
const clearSelection = () => {
  dataTable.value?.clearSelection()
}

// 设置行选中
const setCurrentRow = (rowKey, rowValue) => {
  const row = tableData.list.find((item) => item[rowKey] === rowValue)
  dataTable.value?.setCurrentRow(row)
}

// 行点击
const handleRowClick = (row) => {
  emit('rowClick', row)
}

// 多选
const handleSelectionChange = (row) => {
  emit('rowSelected', row)
}

// 切换每页大小
const handlePageSizeChange = (size) => {
  tableData.pageSize = size
  tableData.pageNo = 1
  // 通知父组件更新
  emit('update:pageSize', size)
  emit('update:pageNo', 1)
  props.fetch()
}

// 切换页码
const handlePageNoChange = (pageNo) => {
  tableData.pageNo = pageNo
  // 通知父组件更新
  emit('update:pageNo', pageNo)
  props.fetch()
}

// 复选事件
const selectedHandler = (row, index) => {
  return props.selected ? props.selected(row, index) : true
}

// 暴露方法给父组件
defineExpose({ setCurrentRow, clearSelection })
</script>
<style lang="scss">
.pagination {
  padding-top: 10px;
}
.el-pagination {
  justify-content: right;
}

.el-table__body tr.current-row > td.el-table__cell {
  background-color: #e6f0f9;
}

.el-table__body tr:hover > td.el-table__cell {
  background-color: #e6f0f9 !important;
}
</style>
