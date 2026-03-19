import { run } from './ADB'
import store from '../store'

const updateContactNoReadCount = async ({ userId, noReadCount }) => {
  let sql = null
  if (noReadCount === 0) {
    return
  }
  if (noReadCount) {
    sql = 'update user_setting set contact_no_read = contact_no + ? where user_id = ?'
  } else {
    noReadCount = 0
    sql = 'update user_setting set contact_no_read = ? where user_id = ?'
  }
  await run(sql, [noReadCount, userId])
}

export { updateContactNoReadCount }
