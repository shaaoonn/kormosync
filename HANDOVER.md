# 📘 KormoSync Project Handover

## 🚀 Project Overview
**KormoSync** is an employee monitoring and productivity tracking software similar to Hubstaff or TimeDoctor. It consists of a desktop time tracker, a web dashboard for employees and managers, and a super-admin panel.

---

## 🏗️ Architecture (Monorepo)
The project is structured as a monorepo in `e:\KormoSync`.

| Service | Path | Tech Stack | Description |
|---------|------|------------|-------------|
| **Backend API** | `/` (Root) | Node.js, Express, Prisma, PostgreSQL, Socket.IO | Main API server, real-time sync, database. |
| **Desktop App** | `/kormosync-desktop` | Electron, React, Vite, TypeScript | Time tracker, screenshot capture, activity monitoring. |
| **User Dashboard** | `/kormosync-web` | Next.js 14, Tailwind CSS | Web interface for employees/clients to view reports. |
| **Admin Panel** | `/kormosync-admin` | Next.js 14, Tailwind CSS | Super admin for managing companies/subscriptions. |

---

## 🛠️ Infrastructure & Tech Stack
- **Database:** PostgreSQL (Hosted on Coolify)
- **Object Storage:** MinIO (Self-hosted S3 compatible, on Coolify)
- **Authentication:** Firebase Auth (both web and desktop)
- **Real-time:** Socket.IO (for live activity feeds)
- **Deployment:** Coolify (Self-hosted PaaS)

---

## ⚙️ Environment Configuration (`.env`)
The root `.env` file manages server config. Key variables:
- `DATABASE_URL`: PostgreSQL connection string.
- `MINIO_*`: Storage credentials (Endpoint, Access Key, Secret).
- `GOOGLE_APPLICATION_CREDENTIALS`: Firebase service account path.

---

## ✅ Current State & Recent Implementation

### 1. **Desktop App**
- **Time Tracking:** Working. Tracks raw time for tasks.
- **Activity Monitoring:** Captures keystrokes/mouse clicks (simulated/placeholder logic currently in place).
- **Screenshot Capture:**
  - Uses `screenshot-desktop` in Electron main process.
  - Exposure via `window.electron.captureScreenshot()`.
  - Dashboard.tsx captures every 5 minutes and uploads to server. (Implemented, pending full verification).
- **Live Sync:** Sends real-time updates via Socket.IO to web dashboard.

### 2. **Backend API**
- **MinIO Integration:** Implemented in `src/utils/mninioClient.ts`.
- **Screenshot Routes:** `/api/screenshots/upload` handles storage and DB entry.
- **Socket Events:** Emits `tracking:start`, `tracking:tick`, `screenshot:new`.

### 3. **Database**
- **Prisma Schema:** Updated to include `Screenshot` model related to `User` and `Task`.

---

## 📝 Pending Tasks / Next Steps for New Developer

1.  **Verify Screenshot Upload:**
    - Test the desktop app's 5-minute interval upload.
    - Check if images appear in MinIO bucket `kormosync`.
    - Verify they load in the Web Activity Monitor.

2.  **Floating Widget Refinement:**
    - The floating widget logic exists in `main.ts` but needs UI polish in `widget.html` or a React component.

3.  **Real Activity Hooks:**
    - Currently, `keystrokes` and `mouseClicks` are sent as placeholders (`0`).
    - Need to integrate a native Node.js library (like `uiohook-napi` or similar) in Electron to count actual inputs globally.

4.  **Notifications:**
    - Implement system notifications for "Task Assigned" or "Idle Time Alert".

---

## 🏃 How to Run Locally

### 1. Backend
```bash
cd e:\KormoSync
npm install
npm run dev
# Runs on port 8000
```

### 2. Desktop App
```bash
cd e:\KormoSync\kormosync-desktop
npm install
npm run dev
# Opens Electron window
```

### 3. Web Dashboard
```bash
cd e:\KormoSync\kormosync-web
npm install
npm run dev
# Runs on port 3001
```

---

## 🔑 Credentials (Development)
- **MinIO Console:** `https://console-x8s4k00s04g0484ow888wwoc.213.136.79.44.sslip.io`
- **Database:** (Configured in .env)

---
*Generated on: 2026-01-23*
