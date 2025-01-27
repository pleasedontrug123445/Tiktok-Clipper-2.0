// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const { startMonitoring, getClipsForStreamer } = require('./twitch');

function createWindow () {
    // Create the browser window
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // For simplicity, enable Node integration
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load index.html
    win.loadFile('index.html');

    // Optional: open DevTools
    win.webContents.openDevTools();
}

// Start Twitch monitoring as soon as app is ready
app.whenReady().then(() => {
    startMonitoring();
    createWindow();

    app.on('activate', () => {
        // On macOS, re-create a window if none are open
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC: when the renderer asks for "get-clips", return the stored clips
ipcMain.handle('get-clips', async (event, streamerName) => {
  const clips = getClipsForStreamer(streamerName);
  return clips;
});
