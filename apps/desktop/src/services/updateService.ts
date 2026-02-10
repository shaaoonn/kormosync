import { useAppStore } from '../store/useAppStore';
import electronService from './electron';

class UpdateService {
    private static instance: UpdateService;
    private isUpdateAvailable: boolean = false;
    // private isDownloading: boolean = false; 

    private constructor() {
        if (electronService.available) {
            this.initListeners();
        }
    }

    public static getInstance(): UpdateService {
        if (!UpdateService.instance) {
            UpdateService.instance = new UpdateService();
        }
        return UpdateService.instance;
    }

    private initListeners() {
        electronService.onUpdateAvailable((info) => {
            console.log('Update available:', info);
            this.isUpdateAvailable = true;
            useAppStore.getState().addToast('info', 'নতুন আপডেট উপলব্ধ!');
        });

        electronService.onUpdateDownloaded((info) => {
            console.log('Update downloaded:', info);
            // this.isDownloading = false;
            useAppStore.getState().addToast('success', 'আপডেট ডাউনলোড সম্পন্ন। রিস্টার্ট করতে ক্লিক করুন।');
        });

        electronService.onDownloadProgress(() => {
            // this.isDownloading = true;
            // console.log(`Download progress: ${progress.percent}%`);
        });

        electronService.onUpdateError((error) => {
            // this.isDownloading = false;
            console.error('Update error:', error);
            useAppStore.getState().addToast('error', 'আপডেট চেক করতে ব্যর্থ হয়েছে');
        });
    }

    public checkForUpdates() {
        if (electronService.available) {
            console.log('Checking for updates...');
            electronService.checkForUpdates();
        }
    }

    public downloadUpdate() {
        if (electronService.available && this.isUpdateAvailable) {
            electronService.downloadUpdate();
        }
    }

    public quitAndInstall() {
        if (electronService.available) {
            electronService.quitAndInstall();
        }
    }
}

export const updateService = UpdateService.getInstance();
export default updateService;
