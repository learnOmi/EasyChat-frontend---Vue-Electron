const Store = require('electron-store').default
const store = new Store()

let userId = null
const initUserId = (id) => {
  userId = id
}

const getUserId = () => {
  return userId
}

const setData = (key, value) => {
  store.set(key, value)
}

const getData = (key) => {
  return store.get(key)
}

const setUserData = (key, value) => {
  return setData(userId + key, value)
}

const getUserData = (key, value) => {
  return getData(userId + key)
}

const deleteUserData = (key) => {
  return store.delete(userId + key)
}

export default {
  initUserId,
  getUserId,
  setData,
  getData,
  setUserData,
  getUserData,
  deleteUserData
}
