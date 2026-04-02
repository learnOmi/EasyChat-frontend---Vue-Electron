import store from './store'
import { selectByMessageId } from './db/ChatMessageModel'
import { selectSettingInfo, updateUserSetting } from './db/UserSettingModel'
import { getWindow } from './windowProxy'
const fs = require('fs')
const fse = require('fs-extra')
const NODE_ENV = process.env.NODE_ENV
const path = require('path')
const { app, dialog, shell } = require('electron')
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
      command = `${ffprobePath} -v error -select_streams v:0 -show_entries stream=codec_name "${savePath}"`
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
          command = `${ffmpegPath} -y -i "${savePath}" -c:v libx264 -crf 20 "${tempPath}"`
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
      command = `${ffmpegPath} -i "${savePath}" -y -vframes 1 -vf "scale=min(170\\,iw*min(170/iw\\,170/ih)):min(170\\,ih*min(170/iw\\,170/ih))" "${coverPath}"`
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

  if (showCover) {
    localPath = localPath + cover_image_suffix
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

/**
 * 处理文件获取请求，支持图片、视频等文件的本地读取、远程下载及流式传输。
 *
 * 该接口具备以下功能：
 * 1. 参数校验与规范化。
 * 2. 检查本地文件是否存在，不存在则触发下载逻辑。
 * 3. 支持强制刷新文件（forceGet）。
 * 4. 针对视频文件支持 HTTP Range 请求，实现分段加载和播放。
 * 5. 统一的错误处理机制。
 *
 * @route GET /file
 *
 * @param {Object} req - Express 请求对象
 * @param {Object} req.query - 请求查询参数
 * @param {String} req.query.partType - 文件所属部分类型 (例如: 'avatar', 'chat')
 * @param {String|Number} req.query.fileType - 文件类型标识 (例如: '1' 代表视频, '0' 代表图片)
 * @param {String|Number} req.query.fileId - 文件的唯一标识 ID
 * @param {Boolean} [req.query.showCover=false] - 是否获取封面图 (true/false)
 * @param {Boolean} [req.query.forceGet=false] - 是否强制重新下载并覆盖本地文件 (true/false)
 *
 * @param {Object} res - Express 响应对象
 *
 * @returns {void} 直接通过 res 对象返回文件流或错误信息
 */
expressServer.get('/file', async (req, res) => {
  // 1. 参数解构与基础校验
  const { partType, fileType, fileId, showCover, forceGet } = req.query

  // 统一参数校验逻辑
  if (!partType || !fileType || !fileId) {
    return res.status(400).send('参数错误')
  }

  // 2. 规范化布尔值和类型
  const isShowCover = String(showCover) === 'true'
  const isForceGet = String(forceGet) === 'true'
  const isVideo = String(fileType) === '1'

  try {
    // 3. 获取本地路径
    const localPath = await getLocalFilePath(partType, isShowCover, fileId)

    // 4. 文件存在性检查与下载逻辑
    // 使用 fs.promises.access 替代 existsSync，更符合异步风格
    const fileExists = await fs.promises
      .access(localPath)
      .then(() => true)
      .catch(() => false)

    if (!fileExists || isForceGet) {
      // 特殊处理头像强制更新
      if (isForceGet && partType === 'avatar') {
        await downLoadFile(fileId, true, localPath + cover_image_suffix, partType)
      }
      // 下载主文件
      await downLoadFile(fileId, isShowCover, localPath, partType)
    }

    // 5. 设置通用响应头
    res.setHeader('Access-Control-Allow-Origin', '*')

    // 修正 Content-Type 逻辑，确保格式正确 (例如 "image/png" 而不是 "imagepng")
    // 注意：这里假设 FILE_TYPE_CONTENT_TYPE 返回类似 "image/" 的前缀
    const ext = path.extname(localPath).substring(1)
    const contentType = `${FILE_TYPE_CONTENT_TYPE[fileType] || 'application/octet-stream'}${ext}`
    res.setHeader('Content-Type', contentType)

    // 6. 流传输处理
    // 如果是封面图或非视频文件，直接全量传输
    if (isShowCover || !isVideo) {
      const stream = fs.createReadStream(localPath)
      return stream.pipe(res)
    }

    // 7. 视频文件流处理 (支持 Range 请求)
    const stat = await fs.promises.stat(localPath)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

      // 边界检查：防止请求范围超出文件大小
      if (start >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`)
        return res.status(416).send('Requested Range Not Satisfiable')
      }

      const chunksize = end - start + 1
      const stream = fs.createReadStream(localPath, { start, end })

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType
      })

      stream.pipe(res)
    } else {
      // 视频不支持 Range 请求时的回退（通常浏览器会请求 Range）
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes' // 告诉客户端支持 Range
      })
      fs.createReadStream(localPath).pipe(res)
    }
  } catch (err) {
    // 8. 统一错误处理
    console.error('文件服务错误:', err)
    // 确保在错误发生时没有发送过响应头
    if (!res.headersSent) {
      res.status(500).send('服务器内部错误')
    } else {
      res.end()
    }
  }
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

    // 1. 确保目录存在
    const folder = path.dirname(savePath)
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }

    // 1. 安全获取 Content-Type，防止 undefined
    const contentType = res.headers['content-type'] || ''

    // 2. 获取 Content-Length，并转换为数字
    const contentLength = parseInt(res.headers['content-length'] || '0', 10)

    // 3. 判断是否为有效文件流
    // 如果 Content-Length 为 0，或者 Content-Type 是 JSON，都视为无效/错误响应
    const isValidFileStream =
      contentLength > 0 && !contentType.toLowerCase().includes('application/json')

    const fileStream = fs.createWriteStream(savePath)
    let sourceStream

    if (!isValidFileStream) {
      // 下载失败或返回了空数据/错误信息
      console.warn(
        `下载文件失败或返回空数据: fileId=${fileId}, length=${contentLength}, type=${contentType}`
      )

      // 读取默认图片
      let resourcesPath = getResourcePath()
      const defaultImagePath =
        partType === 'avatar'
          ? path.join(resourcesPath, '/assets/default.png')
          : path.join(resourcesPath, '/assets/404.png')

      sourceStream = fs.createReadStream(defaultImagePath)
    } else {
      // 有效文件流
      sourceStream = res.data
    }

    // 4. 管道传输
    await new Promise((resolve, reject) => {
      sourceStream.pipe(fileStream)

      sourceStream.on('error', (err) => {
        console.error('Source stream error:', err)
        // 清理可能写入的不完整数据
        fileStream.close()
        if (fs.existsSync(savePath)) {
          fs.unlinkSync(savePath)
        }
        reject(err)
      })

      fileStream.on('error', (err) => {
        console.error('File write stream error:', err)
        reject(err)
      })

      fileStream.on('finish', () => {
        fileStream.close()
        resolve()
      })
    })
  } catch (err) {
    console.error('downLoadFile error:', err)
    // 发生异常时，删除不完整的文件
    if (fs.existsSync(savePath)) {
      fs.unlinkSync(savePath)
    }
    throw err
  }
}

const createCover = async (fileBuffer) => {
  const ffmpegPath = getFFmpegPath()
  let avatarPath = await getLocalFilePath('avatar', false, store.getUserId() + '_temp')
  let coverPath = await getLocalFilePath('avatar', false, store.getUserId() + '_temp_cover')
  let targetDir = path.dirname(avatarPath)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }
  fs.writeFileSync(avatarPath, Buffer.from(fileBuffer))
  const command = `${ffmpegPath} -y -i "${avatarPath}" -vframes 1 -vf "scale=170:170:force_original_aspect_ratio=decrease" -q:v 2 "${coverPath}"`
  await execCommand(command)
  return {
    avatarStream: fs.readFileSync(avatarPath),
    coverStream: fs.readFileSync(coverPath)
  }
}

const saveAs = async ({ partType, fileId }) => {
  let fileName = ''
  if (partType == 'avatar') {
    fileName = fileId + image_suffix
  } else if (partType == 'chat') {
    let messageInfo = selectByMessageId(fileId)
    fileName = messageInfo.fileName
  }
  const localPath = await getLocalFilePath(partType, false, fileId)

  const options = {
    title: '保存文件',
    defaultPath: fileName
  }
  let result = await dialog.showSaveDialog(options)
  if (result.canceled || result.filePath == '') {
    return
  }
  const filePath = result.filePath

  fs.copyFileSync(localPath, filePath)
}

const openLocalFolder = async () => {
  const userId = store.getUserId()
  let settingInfo = await selectSettingInfo(userId)
  const sysSettng = JSON.parse(settingInfo.sysSetting)
  const localFileFolder = sysSettng.localFileFolder + userId + '\\'
  if (!fs.existsSync(localFileFolder)) {
    fs.mkdirSync(localFileFolder, { recursive: true })
  }
  shell.openPath('file://' + localFileFolder)
}

const changeLocalFolder = async () => {
  const userId = store.getUserId()
  let settingInfo = await selectSettingInfo(userId)
  const sysSettng = JSON.parse(settingInfo.sysSetting)
  const localFileFolder = sysSettng.localFileFolder + userId + '\\'
  const options = {
    properties: ['openDirectory'],
    defaultPath: localFileFolder
  }
  let result = await dialog.showOpenDialog(options)
  if (result.canceled || result.filePaths.length == 0) {
    return
  }

  const newFilePath = result.filePaths[0] + userId + '\\'
  if (localFileFolder !== newFilePath) {
    const userId = store.getUserId()
    getWindow('main').webContents.send('copyingCallback', true)
    fse.copySync(localFileFolder, newFilePath, { recursive: true }, async (err) => {
      if (err) {
        console.error('Error copying files:', err)
      } else {
        console.log('Files copied successfully!')
      }
    })
    const newSysSetting = {
      ...sysSettng,
      localFileFolder: newFilePath + '\\'
    }
    await updateUserSetting(userId, JSON.stringify(newSysSetting))
    store.setUserData('localFileFolder', newSysSetting.localFileFolder + store.getUserId())
    getWindow('main').webContents.send('getSysSettingCallback', JSON.stringify(newSysSetting))
  }
}

export {
  saveFile2Local,
  startLocalServer,
  closeLocalServer,
  createCover,
  saveAs,
  openLocalFolder,
  changeLocalFolder
}
