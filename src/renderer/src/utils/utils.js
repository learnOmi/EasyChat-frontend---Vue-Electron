import moment from 'moment'

const isEmpty = (str) => {
  return !str || 0 === str.length
}

const getAreaInfo = (data) => {
  if (isEmpty(data)) {
    return '-'
  }
  return data.replace(',', ' ')
}

const formatDate = (timestamp) => {
  const timestampTime = moment(timestamp)
  const days =
    Number.parseInt(moment().format('YYYYMMDD')) - Number.parseInt(timestampTime.format('YYYYMMDD'))
  if (days === 0) {
    return timestampTime.format('HH:mm')
  } else if (days === 1) {
    return '昨天'
  } else if (days >= 2 && days < 7) {
    return timestampTime.format('dddd')
  } else {
    return timestampTime.format('YYYY/MM/DD')
  }
}

const size2Str = (size) => {
  if (size < 1024) {
    return size + 'B'
  } else if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + 'KB'
  } else if (size < 1024 * 1024 * 1024) {
    return (size / 1024 / 1024).toFixed(2) + 'MB'
  } else {
    return (size / 1024 / 1024 / 1024).toFixed(2) + 'GB'
  }
}

export default {
  isEmpty,
  getAreaInfo,
  formatDate,
  size2Str
}
