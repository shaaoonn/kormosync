import { contextBridge, ipcRenderer } from 'electron';

// --------- Expose API to the Widget ---------
contextBridge.exposeInMainWorld('electronWidget', {
    expandApp: () => ipcRenderer.send('EXPAND_APP'),
    minimizeWidget: () => ipcRenderer.send('MINIMIZE_WIDGET'),
    onUpdate: (callback: (data: any) => void) => {
        ipcRenderer.on('UPDATE_WIDGET', (_event, data) => callback(data));
    }
});
