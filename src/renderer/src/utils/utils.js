import moment from 'moment'
moment.locale('zh-cn', {
  months: '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
  monthsShort: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
  weekdays: '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
  weekdaysShort: '周日_周一_周二_周三_周四_周五_周六'.split('_'),
  weekdaysMin: '日_一_二_三_四_五_六'.split('_'),
  longDateFormat: {
    LT: 'HH:mm',
    LTS: 'HH:mm:ss',
    L: 'YYYY/MM/DD',
    LL: 'YYYY年MM月DD日',
    LLL: 'YYYY年MM月DD日 HH:mm',
    LLLL: 'YYYY年MM月DD日 HH:mm:ss',
    l: 'YYYY/MM/DD',
    ll: 'YYYY年MM月DD日',
    lll: 'YYYY年MM月DD日 HH:mm',
    llll: 'YYYY年MM月DD日 HH:mm:ss'
  }
})
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
