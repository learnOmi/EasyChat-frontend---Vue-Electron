import store from './store'
import { selectByMessageId } from './db/ChatMessageModel'
const fs = require('fs')
const fse = require('fs-extra')
const NODE_ENV = process.env.NODE_ENV
const path = require('path')
const { app, ipcMain, shell } = require('electron')
const { exec } = require('child_process')
const FormData = require('form-data')
const axios = require('axios')
const express = require('express')
const expressServer = express()
const moment = require('moment')
moment.locale('zh-cn', {})

const cover_image_suffix = '_cover.png'
const image_suffix = '.png'
const ffprobePath = '/assets/ffmpeg/ffprobe.exe'
const ffmpegPath = '/assets/ffmpeg/ffmpeg.exe'
const FILE_TYPE_CONTENT_TYPE = {
  0: 'image/',
  1: 'video/',
  2: 'application/octet-stream'
}

const saveFile2Local = async (messageId, fileBuffer, fileType) => {
  // 获取ffmpeg和ffprobe的路径
  const ffmpegPath = getFFmpegPath()
  const ffprobePath = getFFprobePath()
  // 获取本地保存路径
  let savePath = await getLocalFilePath('chat', false, messageId)
  let saveDir = path.dirname(savePath)
  // 初始化封面路径
  let coverPath = null
  // 将源文件复制到本地保存路径
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true })
  }
  fs.writeFileSync(savePath, Buffer.from(fileBuffer))

  // 图片和视频文件处理
  if (fileType !== 2) {
    let command
    if (fileType !== 0) {
      // 使用ffprobe检测视频流的编码格式
      command = `${ffprobePath} -v error -select_streams v:0 -show_entries stream=codec_name '${savePath}'`
      let result = await execCommand(command)
      // 解析输出结果获取编码格式
      let codec = result
        .replaceAll('\r\n', '')
        .substring(result.indexOf('=') + 1)
        .substring(0, result.indexOf('['))
      // 如果是hevc编码，使用ffmpeg转码为h264
      if ('hevc' == codec) {
        const tempPath = savePath + '.tmp'
        try {
          command = `${ffmpegPath} -y -i '${savePath}' -c:v libx264 -crf 20 '${tempPath}'`
          await execCommand(command)

          // 只有转码成功（代码走到这里），才进行替换
          fs.unlinkSync(savePath)
          fs.renameSync(tempPath, savePath)
        } catch (err) {
          console.error('转码失败:', err)
          // 转码失败时，尝试清理可能产生的临时文件，防止垃圾文件堆积
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath)
          }
          // 这里可以根据需求选择是否重新抛出错误 throw err
        }
      }

      // 设置封面文件路径
      coverPath = savePath + cover_image_suffix
      // 使用ffmpeg生成缩略图，缩放到170x170
      command = `${ffmpegPath} -i '${savePath}' -y -vframes 1 -vf 'scale=min(170\\,iw*min(170/iw\\,170/ih)):min(170\\,ih*min(170/iw\\,170/ih))' '${coverPath}'`
      await execCommand(command)
    } else {
      coverPath = savePath + cover_image_suffix
      command = `${ffmpegPath} -y -i "${savePath}" -vframes 1 -vf "scale=170:170:force_original_aspect_ratio=decrease" -q:v 2 "${coverPath}"`
      await execCommand(command)
    }
  }

  // 上传文件到服务器
  await uploadFile(messageId, savePath, coverPath)
}

const uploadFile = async (messageId, savePath, coverPath) => {
  const fileStream = fs.createReadStream(savePath)
  let coverStream = null

  let form = new FormData()
  form.append('messageId', messageId)
  form.append('file', fileStream)

  if (coverPath) {
    coverStream = fs.createReadStream(coverPath)
    form.append('cover', coverStream)
  }

  const url = getDomain() + '/api/chat/uploadFile'
  const token = store.getUserData('token')
  const config = {
    headers: {
      'Content-Type': 'multipart/form-data',
      token: token
    }
  }

  try {
    await axios.post(url, form, config)
  } catch (err) {
    console.log('uploadFile error', err)
  } finally {
    // 确保在请求结束后关闭文件流
    fileStream.destroy()
    if (coverStream) {
      coverStream.destroy()
    }
  }
}

const execCommand = async (command) => {
  return new Promise((resolve, reject) => {
    console.log('execCommand: ', command)
    exec(command, (err, stdout, stderr) => {
      if (err) {
        console.log('execCommand error: ', err)
        reject(err)
      } else {
        resolve(stdout)
      }
    })
  })
}

const getDomain = () => {
  return NODE_ENV !== 'development' ? store.getData('prodDomain') : store.getData('devDomain')
}

const getResourcePath = () => {
  let resourcesPath = app.getAppPath()
  if (NODE_ENV !== 'development') {
    resourcesPath = path.dirname(app.getPath('exe') + '/resources')
  }
  return resourcesPath
}

const getFFprobePath = () => {
  return path.join(getResourcePath(), ffprobePath)
}

const getFFmpegPath = () => {
  return path.join(getResourcePath(), ffmpegPath)
}

const getLocalFilePath = async (partType, showCover, fileId) => {
  let localFolder = store.getUserData('localFileFolder')
  let localPath = null
  if (partType == 'avatar') {
    localFolder = path.join(localFolder, 'avatar')
    if (!fs.existsSync(localFolder)) {
      fs.mkdirSync(localFolder, { recursive: true })
    }
    localPath = path.join(localFolder, fileId + image_suffix)
  } else if (partType == 'chat') {
    let messageInfo = await selectByMessageId(fileId)
    const month = moment(Number.parseInt(messageInfo.sendTime)).format('YYYYMM')
    localFolder = path.join(localFolder, month)
    if (!fs.existsSync()) {
      fs.mkdirSync(localFolder, { recursive: true })
    }
    let fileSuffix = messageInfo.fileName
    fileSuffix = fileSuffix.substring(fileSuffix.lastIndexOf('.'))
    localPath = path.join(localFolder, fileId + fileSuffix)
  }

  return localPath
}

let server = null
const startLocalServer = (serverPort) => {
  server = expressServer.listen(serverPort, () => {
    console.log('本地图片服务在http://localhost:' + serverPort + '启动')
  })
}

const closeLocalServer = () => {
  if (server) {
    server.close()
  }
}

expressServer.get('/file', async (req, res) => {
  let { partType, fileType, fileId, showCover, forceGet } = req.query
  if (!partType || !fileType || !fileId) {
    res.status(400).send('参数错误')
    return
  }
  showCover = showCover == undefined ? false : Boolean(showCover)
  const localPath = await getLocalFilePath(partType, showCover, fileId)

  // 检查文件是否存在并下载
  if (!fs.existsSync(localPath) || forceGet == 'true') {
    if (forceGet == 'true' && partType == 'avatar') {
      await downLoadFile(fileId, true, localPath + cover_image_suffix, partType)
    }
    await downLoadFile(fileId, showCover, localPath, partType)
  }

  const fileSuffix = localPath.substring(localPath.lastIndexOf('.') + 1)
  let contentType = FILE_TYPE_CONTENT_TYPE[fileType] + fileSuffix
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', contentType)

  const readStream = fs.createReadStream(localPath)

  // 监听错误事件，防止文件读取错误导致连接挂起
  readStream.on('error', (err) => {
    console.error('文件读取流错误:', err)
    res.status(500).send('文件读取失败')
    // 发生错误时手动关闭流
    readStream.destroy()
  })

  // 使用 pipe 传输数据，并监听 'close' 事件确保流结束
  readStream.pipe(res)

  res.on('close', () => {
    // 当响应连接关闭时，确保读取流也被销毁
    readStream.destroy()
  })

  return
})

// 从服务器下载文件
const downLoadFile = async (fileId, showCover, savePath, partType) => {
  showCover = showCover + ''
  let url = `${getDomain()}/api/chat/downloadFile`
  const token = store.getUserData('token')
  const config = {
    responseType: 'stream',
    headers: {
      token: token,
      'Content-Type': 'multipart/form-data'
    }
  }

  try {
    const res = await axios.post(
      url,
      {
        fileId: fileId,
        showCover: showCover
      },
      config
    )
    const folder = path.dirname(savePath)
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    const fileStream = fs.createWriteStream(savePath)
    // 使用 Promise 包装流操作，以便 await
    await new Promise((resolve, reject) => {
      let sourceStream

      // 判断是否返回了错误信息（假设 200 OK 但 Content-Type 是 json 表示业务错误）
      if (res.headers['content-type'] == 'application/json') {
        let resourcesPath = getResourcePath()
        const defaultImagePath =
          partType === 'avatar'
            ? path.join(resourcesPath, '/assets/default.png')
            : path.join(resourcesPath, '/assets/404.png')

        sourceStream = fs.createReadStream(defaultImagePath)
      } else {
        sourceStream = res.data
      }

      // 管道传输
      sourceStream.pipe(fileStream)

      // 监听错误事件
      sourceStream.on('error', (err) => {
        console.error('Source stream error:', err)
        reject(err)
      })

      fileStream.on('error', (err) => {
        console.error('File write stream error:', err)
        reject(err)
      })

      // 监听完成事件
      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })
    })
  } catch (err) {
    console.error('downLoadFile error:', err)
    // 可以选择删除不完整的文件
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath)
    }
    throw err
  }
}

export { saveFile2Local, startLocalServer, closeLocalServer }
