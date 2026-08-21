const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('desktopBridge', {
  platform: process.platform,
  isDesktop: true,
})
