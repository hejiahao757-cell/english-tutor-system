const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { fileURLToPath } = require('url')

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#eef3f4',
    title: 'Tutor · 测试版',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'
  if (!app.isPackaged) win.loadURL(devUrl)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  win.webContents.setWindowOpenHandler(({ url }) => {
    const secureChild = {
      autoHideMenuBar: true,
      backgroundColor: '#ffffff',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    }
    if (!app.isPackaged && url.startsWith(devUrl)) {
      return { action: 'allow', overrideBrowserWindowOptions: secureChild }
    }
    if (app.isPackaged && url.startsWith('file:')) {
      const requested = path.resolve(fileURLToPath(url))
      const legacyRoot = path.resolve(__dirname, '..', 'dist', 'legacy-content')
      if (requested === legacyRoot || requested.startsWith(`${legacyRoot}${path.sep}`)) {
        return { action: 'allow', overrideBrowserWindowOptions: secureChild }
      }
    }
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
