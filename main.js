const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const { PythonShell } = require('python-shell')

const createWindow = () => {
    const preloadPath = path.join(__dirname, 'preload.js');
    //console.log("Preload script path:", preloadPath); 

    const win = new BrowserWindow({
        center: true,
        darkTheme: true,
        show: false,
        width: 1000,
        height: 800,
        minHeight: 600,
        minWidth: 800,
        icon: 'logo.jpg', //我TM笔养的
        title: 'OraArk',
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            devTools: true,
            nodeIntegration: true,
            contextIsolation: true
        }
    })

    win.loadFile('index.html')
    win.once('ready-to-show', () => {
        win.show()
    })
}

const options = {
    pythonPath: 'python', // 或根据环境调整
    scriptPath: path.join(__dirname, 'start', 'start.py')
};

app.whenReady().then(() => {
    createWindow();
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// 监听渲染-start.py
ipcMain.on('start-python-script', (event) => {
    console.log("接收到渲染进程的请求"); // 调试信息
    const pythonScriptPath = path.join(__dirname, 'start', 'start.py');
    console.log("Python脚本路径:", pythonScriptPath);
    PythonShell.run(pythonScriptPath, options, (err) => {
        if (err) {
            console.error("Python脚本错误:", err);
            event.reply('python-script-result', `错误: ${err.message}`);
        } else {
            event.reply('python-script-result', 'MuMu和MAA已启动');
        }
    });
});