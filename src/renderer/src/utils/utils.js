const isEmpty = (str) => {
  return !str || 0 === str.length
}

const getAreaInfo = (data) => {
  if (isEmpty(data)) {
    return '-'
  }
  return data.replace(',', ' ')
}

export default {
  isEmpty,
  getAreaInfo
}
