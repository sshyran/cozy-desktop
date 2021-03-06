'use strict'

const electron = require('electron')
const {ipcRenderer, remote, shell} = electron

const path = remote.require('path-extra')
const pkg = remote.require('./package.json')
const defaultDir = path.join(path.homedir(), 'Cozy')
const container = document.getElementById('container')

const Elm = require('./elm').Main
const elmectron = Elm.embed(container, {
  folder: defaultDir,
  locale: remote.app.locale,
  locales: {
    en: remote.require('./locales/en.json'),
    fr: remote.require('./locales/fr.json')
  },
  version: pkg.version
})

const errMessage = (err) => {
  if (!err) {
    return null
  } else if (err.code === 'ENOTFOUND') {
    return "The host can't be found"
  } else if (err.message) {
    return err.message
  } else {
    return `${err}`
  }
}

// Glue code between Elm and the main process
ipcRenderer.on('cozy-pong', (event, url) => {
  elmectron.ports.pong.send(url)
})
elmectron.ports.pingCozy.subscribe((url) => {
  ipcRenderer.send('ping-cozy', url)
})

ipcRenderer.on('remote-registered', (event, err) => {
  err = errMessage(err)
  elmectron.ports.registration.send(err)
})
elmectron.ports.registerRemote.subscribe((remote) => {
  ipcRenderer.send('register-remote', {
    url: remote[0],
    password: remote[1]
  })
})

ipcRenderer.on('folder-chosen', (event, folder) => {
  elmectron.ports.folder.send(folder)
})
ipcRenderer.on('folder-error', (event, err) => {
  elmectron.ports.folderError.send(err)
})
elmectron.ports.chooseFolder.subscribe(() => {
  ipcRenderer.send('choose-folder')
})

ipcRenderer.on('synchronization', (event, url, deviceName) => {
  elmectron.ports.synchonization.send([url, deviceName])
})
elmectron.ports.startSync.subscribe((folder) => {
  ipcRenderer.send('start-sync', folder)
})

ipcRenderer.on('new-release-available', (event, notes, name) => {
  console.log('new-release-available', notes, name)
  elmectron.ports.newRelease.send([notes, name])
})
elmectron.ports.quitAndInstall.subscribe(() => {
  ipcRenderer.send('quit-and-install')
})

ipcRenderer.on('auto-launch', (event, enabled) => {
  elmectron.ports.autolaunch.send(enabled)
})
elmectron.ports.autoLauncher.subscribe((enabled) => {
  ipcRenderer.send('auto-launcher', enabled)
})

ipcRenderer.on('go-to-tab', (event, tab) => {
  elmectron.ports.gototab.send(tab)
})

ipcRenderer.on('unlinked', (event) => {
  elmectron.ports.unlink.send(true)
})
elmectron.ports.unlinkCozy.subscribe(() => {
  ipcRenderer.send('unlink-cozy')
})

ipcRenderer.on('mail-sent', (event, err) => {
  err = errMessage(err)
  elmectron.ports.mail.send(err)
})
elmectron.ports.sendMail.subscribe((body) => {
  ipcRenderer.send('send-mail', body)
})

ipcRenderer.on('offline', () => {
  elmectron.ports.offline.send(true)
})

ipcRenderer.on('up-to-date', () => {
  elmectron.ports.updated.send(true)
})

ipcRenderer.on('transfer', (event, info) => {
  elmectron.ports.transfer.send(info)
})
ipcRenderer.on('delete-file', (event, info) => {
  elmectron.ports.remove.send(info)
})

ipcRenderer.on('disk-space', (event, info) => {
  elmectron.ports.diskSpace.send(info)
})

ipcRenderer.on('sync-error', (event, err) => {
  elmectron.ports.syncError.send(err)
})

elmectron.ports.restart.subscribe(() => {
  ipcRenderer.send('restart')
})

// Open external links in the browser
function tryToOpenExternalLink (event, target) {
  if (target && target.matches('a[href^="https"]')) {
    event.preventDefault()
    shell.openExternal(target.href)
  }
}
document.addEventListener('click', (event) => {
  tryToOpenExternalLink(event, event.target)
  tryToOpenExternalLink(event, event.target.parentElement)
})

// Give focus to DOM nodes
elmectron.ports.focus.subscribe((selector) => {
  // We wait that the CSS transition has finished before focusing the node
  setTimeout(() => {
    const nodes = document.querySelectorAll(selector)
    if (nodes && nodes.length > 0) {
      nodes[0].focus()
    }
  }, 300)
})

// Chrome-like "inspect element" for Electron
if (process.env.WATCH === 'true' || process.env.DEBUG === 'true') {
  const debugMenu = require('debug-menu')
  debugMenu.install()
  window.elmectron = elmectron
}
