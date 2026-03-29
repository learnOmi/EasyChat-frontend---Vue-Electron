import { add_tables, alter_tables, add_index } from './Tables'

const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()
const os = require('os')
const NODE_ENV = process.env.NODE_ENV

const userDir = os.homedir()
const dbFolder = userDir + (NODE_ENV == 'development' ? '/.easychattest/' : '/.easychat/')
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder)
}

const db = new sqlite3.Database(dbFolder + 'local.db')
const globalColumnsMap = {}

const createTable = async () => {
  try {
    // 并行执行所有创建表操作
    const tablePromises = add_tables.map(
      (sql) =>
        new Promise((resolve, reject) => {
          db.run(sql, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
    )
    await Promise.all(tablePromises)

    // 顺序执行修改表操作（因为需要先查询再修改）
    for (const item of alter_tables) {
      try {
        const filedList = await queryAll(`PRAGMA table_info(${item.tableName})`, [])
        const field = filedList.some((row) => row.name === item.field)
        if (!field) {
          await new Promise((resolve, reject) => {
            db.run(item.alter_sql, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        }
      } catch (error) {
        console.error(`修改表 ${item.tableName} 失败:`, error)
        throw error
      }
    }

    // 并行执行所有添加索引操作
    const indexPromises = add_index.map(
      (sql) =>
        new Promise((resolve, reject) => {
          const filedList = db.run(sql, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
    )
    await Promise.all(indexPromises)

    console.log('数据库表结构初始化完成')
  } catch (error) {
    console.error('数据库初始化失败:', error)
    throw error // 重新抛出错误，让调用者处理
  }
}

/**
 * 初始化表格列名映射关系
 * 将数据库中的表名和列名转换为小驼峰命名并建立映射关系
 * @returns {Promise<void>} 无返回值的异步函数
 */
const initTableColumnsMap = async () => {
  // 查询所有用户表（排除sqlite_sequence系统表）
  let sql = `select name from sqlite_master where type='table' and name != 'sqlite_sequence'`
  let tables = await queryAll(sql, [])
  // 遍历每个表
  for (let i = 0; i < tables.length; i++) {
    let table = tables[i].name
    // 获取当前表的所有列信息
    sql = `pragma table_info(${table})`
    let columns = await queryAll(sql, [])
    // 创建当前表的列名映射对象
    const columsMapItem = {}
    // 遍历当前表的所有列
    for (let j = 0; j < columns.length; j++) {
      let column = columns[j]
      // 将列名转换为小驼峰命名作为键，原始列名作为值
      columsMapItem[toLowerCamelCase(column.name)] = column.name
    }
    // 将当前表的列名映射关系保存到全局映射对象中
    globalColumnsMap[table] = columsMapItem
  }
}

/**
 * 执行 SQL 查询并返回所有结果
 * @param {string} sql - 要执行的 SQL 查询语句
 * @param {Array} params - SQL 查询参数数组
 * @returns {Promise<Array>} 返回包含查询结果的 Promise，结果已转换为驼峰命名格式
 */
const queryAll = (sql, params) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql)
    stmt.all(params, function (err, row) {
      if (err) resolve([])
      row.forEach((item, index) => {
        row[index] = convertDbObj2BizObj(item)
      })
      resolve(row)
    })
    stmt.finalize()
  })
}

/**
 * 执行 SQL 查询并返回计数结果
 * @param {string} sql - 要执行的 SQL 查询语句
 * @param {Array} params - SQL 查询参数数组
 * @returns {Promise<number>} 返回包含计数结果的 Promise
 */
const queryCount = (sql, params) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql)
    stmt.get(params, function (err, row) {
      if (err) {
        resolve(0)
        return
      }
      resolve(Array.from(Object.values(row))[0])
    })
    stmt.finalize()
  })
}

/**
 * 执行 SQL 查询并返回单条结果
 * @param {string} sql - 要执行的 SQL 查询语句
 * @param {Array} params - SQL 查询参数数组
 * @returns {Promise<Object>} 返回包含查询结果的 Promise，结果已转换为驼峰命名格式
 */
const queryOne = (sql, params) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql)
    stmt.get(params, function (err, row) {
      if (err) resolve({})
      resolve(convertDbObj2BizObj(row))
      console.log(`执行的sql:${sql}, params:${params}, row:${JSON.stringify(row)}`)
    })
    stmt.finalize()
  })
}

/**
 * 向指定表中插入数据
 * @param {string} sqlPrefix - SQL 语句前缀（如 'INSERT INTO '）
 * @param {string} tableName - 要插入数据的表名
 * @param {Object} data - 要插入的数据对象，键为驼峰命名的字段名
 * @returns {Promise<number>} 返回 Promise，解析为影响的行数
 */
const insert = (sqlPrefix, tableName, data) => {
  const columsMap = globalColumnsMap[tableName]
  const dbColumns = []
  const params = []
  for (let item in data) {
    if (data[item] != undefined && columsMap[item] != undefined) {
      dbColumns.push(columsMap[item])
      params.push(data[item])
    }
  }
  const prep = '?'.repeat(dbColumns.length).split('').join(',')
  const sql = sqlPrefix + tableName + '(' + dbColumns.join(',') + ') values(' + prep + ')'
  return run(sql, params)
}

const insertOrReplace = (tableName, data) => {
  return insert('INSERT OR REPLACE INTO ', tableName, data)
}

const insertOrIgnore = (tableName, data) => {
  return insert('INSERT OR IGNORE INTO ', tableName, data)
}

/**
 * 更新指定表中的数据
 * @param {string} tableName - 要更新的表名
 * @param {Object} data - 要更新的数据对象，键为驼峰命名的字段名
 * @param {Object} paramData - 更新条件对象，键为驼峰命名的字段名
 * @returns {Promise<number>} 返回 Promise，解析为影响的行数
 */
const update = (tableName, data, paramData) => {
  // 获取当前表的列名映射关系
  const columsMap = globalColumnsMap[tableName]
  const dbColumns = []
  const params = []
  const whereColumns = []
  // 遍历要更新的数据，构建SET子句和参数数组
  for (let item in data) {
    if (data[item] != undefined && columsMap[item] != undefined) {
      dbColumns.push(`${columsMap[item]}=?`)
      params.push(data[item])
    }
  }
  // 遍历条件数据，构建WHERE子句和参数数组
  for (let item in paramData) {
    if (paramData[item] != undefined && columsMap[item] != undefined) {
      whereColumns.push(`${columsMap[item]}=?`)
      params.push(paramData[item])
    }
  }
  // 构建完整的UPDATE SQL语句
  const sql = `update ${tableName} set ${dbColumns.join(',')} ${whereColumns.length > 0 ? 'where ' + whereColumns.join(' and ') : ''}`
  return run(sql, params)
}

/**
 * 执行 SQL 语句并返回影响的行数
 * @param {string} sql - 要执行的 SQL 语句
 * @param {Array} params - SQL 语句参数数组
 * @returns {Promise<number>} 返回 Promise，解析为影响的行数
 */
const run = (sql, params) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(sql)
    stmt.run(params, function (err) {
      if (err) resolve('操作数据库失败！')
      console.log(`执行的sql:${sql}, params:${params}, 执行记录数:${this.changes}`)
      resolve(this.changes)
    })
    stmt.finalize
  })
}

const convertDbObj2BizObj = (data) => {
  if (!data) return null
  const bizData = {}
  for (let item in data) {
    bizData[toLowerCamelCase(item)] = data[item]
  }
  return bizData
}

const toLowerCamelCase = (str) => {
  return str.replace(/_([a-z])/g, function (match, p1) {
    return String.fromCharCode(p1.charCodeAt(0) - 32)
  })
}

const init = () => {
  // 确保传入其中的回调函数里的数据库操作按照顺序串行执行。
  // 即使回调内部包含异步操作，serialize 也会保证前一个语句执行完毕后再执行下一个，
  // 防止并发写入导致的数据竞争或锁死问题。
  db.serialize(async () => {
    await createTable()
    await initTableColumnsMap()
  })
}

init()

export { run, queryAll, queryCount, queryOne, insert, insertOrReplace, insertOrIgnore, update }
