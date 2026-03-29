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

export default {
  isEmpty,
  getAreaInfo,
  formatDate
}
