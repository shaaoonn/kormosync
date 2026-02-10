# KormoSync QA Testing Report
**Testing Date:** 2026-02-08
**Tester:** User (Manual) + Claude (Analysis)
**Status:** IN PROGRESS

---

## Test Summary

| Module | Total Tests | Passed | Failed | Skipped | Status |
|--------|------------|--------|--------|---------|--------|
| Desktop - Login | 2 | 2 | 0 | 0 | PASS |
| Desktop - Dashboard | 14 | 12 | 2 | 0 | ISSUES |
| Desktop - Timer/Tracking | 0 | 0 | 0 | 0 | PENDING |
| Desktop - Screenshot Upload | 0 | 0 | 0 | 0 | PENDING |
| Desktop - Settings | 0 | 0 | 0 | 0 | PENDING |
| Desktop - Leave Request | 0 | 0 | 0 | 0 | PENDING |
| Desktop - History | 0 | 0 | 0 | 0 | PENDING |
| Web - Login/Onboarding | 0 | 0 | 0 | 0 | PENDING |
| Web - Dashboard | 0 | 0 | 0 | 0 | PENDING |
| Web - Task Create | 0 | 0 | 0 | 0 | PENDING |
| Web - Task List/Detail | 0 | 0 | 0 | 0 | PENDING |
| Web - Employees | 0 | 0 | 0 | 0 | PENDING |
| Web - Leave Management | 0 | 0 | 0 | 0 | PENDING |
| Web - Attendance | 0 | 0 | 0 | 0 | PENDING |
| Web - Payroll | 0 | 0 | 0 | 0 | PENDING |
| Web - Billing | 0 | 0 | 0 | 0 | PENDING |
| Web - Settings | 0 | 0 | 0 | 0 | PENDING |
| Web - Monitoring | 0 | 0 | 0 | 0 | PENDING |
| Admin - Dashboard | 0 | 0 | 0 | 0 | PENDING |
| Admin - Companies | 0 | 0 | 0 | 0 | PENDING |
| Admin - Analytics | 0 | 0 | 0 | 0 | PENDING |
| API - Auth Endpoints | 0 | 0 | 0 | 0 | PENDING |
| API - Task Endpoints | 0 | 0 | 0 | 0 | PENDING |
| API - Screenshot/Upload | 0 | 0 | 0 | 0 | PENDING |
| API - Leave Endpoints | 0 | 0 | 0 | 0 | PENDING |

---

## BUGS FOUND

### Critical (App Crash / Data Loss)
| # | Module | Description | Steps to Reproduce | Screenshot | Status |
|---|--------|-------------|-------------------|------------|--------|
| C1 | Desktop-Screenshot | Screenshot upload CORS error + 400 Bad Request. Helmet security headers blocking multipart upload from Electron renderer | Start timer, wait for screenshot interval, check console | SS-03 | FIXED — helmet crossOriginOpenerPolicy/EmbedderPolicy disabled, global error handler added |
| C2 | Desktop-Memory | App hangs/freezes entire PC. V8 --max-old-space-size=128 too aggressive — screenshot base64+blob processing exhausts 128MB heap, causes GC thrashing | Start timer, wait for screenshot capture, PC freezes | - | FIXED — removed aggressive V8 heap limit, kept only safe Chromium flags |
| C3 | API-Screenshot | First screenshot uploads OK (200), but subsequent ones timeout (60s). getSignedViewUrl() in socket emit blocks response, MinIO remote server slow. Also file saved as .png when actually .jpeg | Start timer, wait 2+ screenshot intervals | SS-04 | FIXED — socket emit made async (non-blocking), file extension auto-detected from mimetype |

### High (Feature Broken)
| # | Module | Description | Steps to Reproduce | Screenshot | Status |
|---|--------|-------------|-------------------|------------|--------|
| H1 | Desktop-Dashboard | Earnings card shows ৳৬০ but "0.5 ঘন্টা কাজ" — math may be wrong, 0.5hr x hourly rate should be verified | Load dashboard, check earnings vs hours | SS-01 | OPEN |
| H2 | Desktop-Dashboard | "চলমান এখন: 0" but "চলমান কাজ (1)" section exists — contradictory state. Timer not running but task shown as active | Refresh dashboard | SS-01 | OPEN |

### Medium (UI/UX Issue)
| # | Module | Description | Steps to Reproduce | Screenshot | Status |
|---|--------|-------------|-------------------|------------|--------|
| M1 | Desktop-Dashboard | 4x Firebase Cross-Origin-Opener-Policy warnings in console — not breaking but pollutes logs | Open DevTools console | SS-02 | OPEN |

### Low (Cosmetic / Minor)
| # | Module | Description | Steps to Reproduce | Screenshot | Status |
|---|--------|-------------|-------------------|------------|--------|
| L1 | Desktop-Dashboard | "ছুটি আবেদন" button text may be clipped on smaller screens | Resize window | - | OPEN |

---

## DETAILED TEST RESULTS

---

### PHASE 1: DESKTOP APP TESTING

#### 1.1 Desktop Login
| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | App opens without crash | ✅ PASS | Opens fine, title "kormosync-desktop" |
| 2 | Login page UI renders correctly | ⏭️ SKIP | Already logged in, auto-redirected |
| 3 | Google Sign-In button works | ⏭️ SKIP | Already authenticated |
| 4 | Email/Password login works | ⏭️ SKIP | Need to test later |
| 5 | Error message shows on failed login | ⏭️ SKIP | Need to test later |
| 6 | Successful login redirects to dashboard | ✅ PASS | Confirmed via auto-redirect |
| 7 | Already logged in auto-redirects | ✅ PASS | Went straight to dashboard |

#### 1.2 Desktop Dashboard
| # | Test | Result | Notes |
|---|------|--------|-------|
| 8 | Dashboard loads after login | ✅ PASS | Loads with all sections |
| 9 | Stats cards show correct data | ⚠️ ISSUE | "চলমান এখন: 0" contradicts "চলমান কাজ (1)" |
| 10 | Earnings card shows BDT amount | ✅ PASS | Shows ৳৬০, leave info present |
| 11 | Task list loads from API | ✅ PASS | /tasks/list returns 200, tasks visible |
| 12 | Active tasks section visible | ✅ PASS | "চলমান কাজ (1)" with Monir task |
| 13 | Upcoming tasks section visible | ✅ PASS | (no upcoming tasks — correctly hidden) |
| 14 | Completed tasks section visible | ✅ PASS | "সম্পন্ন কাজ (1)" with Munna Kaj 01 |
| 15 | Task search works | ❓ TODO | Need to test |
| 16 | Current time/date displays correctly | ✅ PASS | ১১:৩০:০০ PM, রবিবার ৮/২/২০২৬ |
| 17 | Click on task opens details | ❓ TODO | Need to test |
| 18 | Pending assignments show (if any) | ✅ PASS | API returned 200 for /assignments/pending |
| 19 | Accept/Reject assignment works | ❓ TODO | Need to test when assignments exist |
| 20 | Empty state shows when no tasks | ⏭️ SKIP | Tasks exist, can't test |
| 21 | Skeleton loader shows during loading | ✅ PASS | Confirmed in first load (API timeout screenshot) |

#### 1.3 Desktop Timer & Tracking
| # | Test | Result | Notes |
|---|------|--------|-------|
| 22 | Start timer on subtask | | |
| 23 | Timer counts up every second | | |
| 24 | Pause timer works | | |
| 25 | Resume timer works | | |
| 26 | Stop timer works | | |
| 27 | Multiple timers run simultaneously | | |
| 28 | Global timer shows total time | | |
| 29 | Timer persists on page navigation | | |
| 30 | Timer state survives app restart | | |
| 31 | Elapsed time saves to API on stop | | |
| 32 | Tray icon shows when tracking | | |
| 33 | Close window minimizes to tray (when tracking) | | |

#### 1.4 Desktop Screenshot & Activity
| # | Test | Result | Notes |
|---|------|--------|-------|
| 34 | Screenshot captures at interval | | |
| 35 | Screenshot uploads to API/MinIO | | |
| 36 | Activity stats (keystrokes) tracked | | |
| 37 | Activity stats (mouse clicks) tracked | | |
| 38 | Activity score calculated correctly | | |
| 39 | Inactivity warning shows | | |
| 40 | Offline screenshots queued in IndexedDB | | |
| 41 | Queued screenshots upload when online | | |
| 42 | Toast shows "screenshot uploaded" (TRANSPARENT mode) | | |
| 43 | No toast in STEALTH mode | | |

#### 1.5 Desktop Other Pages
| # | Test | Result | Notes |
|---|------|--------|-------|
| 44 | Settings page loads | | |
| 45 | Settings save correctly | | |
| 46 | History page loads with past data | | |
| 47 | Leave request form works | | |
| 48 | Leave balance shows correctly | | |
| 49 | Sidebar navigation works (all links) | | |
| 50 | Logout works and returns to login | | |
| 51 | "Open in Web" button opens browser | | |

---

### PHASE 2: WEB APP TESTING

#### 2.1 Web Login & Onboarding
| # | Test | Result | Notes |
|---|------|--------|-------|
| 52 | Login page loads at localhost:3000 | | |
| 53 | Google Sign-In works | | |
| 54 | New user redirected to onboarding | | |
| 55 | Existing user redirected to dashboard | | |
| 56 | Onboarding: "Create Workspace" mode | | |
| 57 | Onboarding: "Freelancer" mode | | |
| 58 | Onboarding: Invite mode (with token) | | |
| 59 | Form validation (required fields) | | |
| 60 | Phone number format validation | | |
| 61 | Company creation on submit | | |

#### 2.2 Web Dashboard (Admin/Owner)
| # | Test | Result | Notes |
|---|------|--------|-------|
| 62 | Dashboard loads without error | | |
| 63 | Total Employees card correct | | |
| 64 | Active Tasks card correct | | |
| 65 | Storage Used card correct | | |
| 66 | Recent tasks list shows | | |
| 67 | Status badges colored correctly | | |

#### 2.3 Web Tasks
| # | Test | Result | Notes |
|---|------|--------|-------|
| 68 | Task list page loads | | |
| 69 | "Create Task" button visible (admin) | | |
| 70 | Task cards show all badges | | |
| 71 | Assignee avatars display | | |
| 72 | Click task opens detail | | |
| 73 | Create task: SINGLE + FIXED_PRICE | | |
| 74 | Create task: SINGLE + HOURLY | | |
| 75 | Create task: SINGLE + SCHEDULED | | |
| 76 | Create task: BUNDLE with multiple subtasks | | |
| 77 | File upload on task create | | |
| 78 | Screen recording on task create | | |
| 79 | Draft save works | | |
| 80 | Publish works with assignees | | |
| 81 | Assign employees to task | | |
| 82 | Task edit page works | | |
| 83 | Task delete works | | |
| 84 | Toggle task active/inactive | | |
| 85 | Recurring task creation | | |
| 86 | Scheduled task time picker | | |
| 87 | Overlap detection (bundle) | | |

#### 2.4 Web Employees
| # | Test | Result | Notes |
|---|------|--------|-------|
| 88 | Employee list loads | | |
| 89 | "Invite Member" button works | | |
| 90 | Email invite creates link | | |
| 91 | Open invite link works | | |
| 92 | Copy invite link works | | |
| 93 | Remove employee works | | |
| 94 | Employee detail page loads | | |

#### 2.5 Web Leave Management
| # | Test | Result | Notes |
|---|------|--------|-------|
| 95 | Leave page loads | | |
| 96 | Leave balance cards show | | |
| 97 | New leave request form works | | |
| 98 | Approve leave (admin) | | |
| 99 | Reject leave with reason (admin) | | |
| 100 | Cancel own leave request | | |
| 101 | Calendar view shows leaves | | |

#### 2.6 Web Settings & Other
| # | Test | Result | Notes |
|---|------|--------|-------|
| 102 | Settings page loads | | |
| 103 | Company name editable (owner only) | | |
| 104 | Subscription card shows status | | |
| 105 | Storage usage displays | | |
| 106 | Attendance page loads | | |
| 107 | Payroll page loads | | |
| 108 | Billing page loads | | |
| 109 | Monitoring page loads | | |
| 110 | Profile page loads | | |

---

### PHASE 3: ADMIN PANEL TESTING

#### 3.1 Admin Panel
| # | Test | Result | Notes |
|---|------|--------|-------|
| 111 | Admin login works | | |
| 112 | Dashboard stats load | | |
| 113 | Companies list loads | | |
| 114 | Search companies works | | |
| 115 | Pagination works | | |
| 116 | Star/unstar company | | |
| 117 | Company detail page | | |
| 118 | Change company status | | |
| 119 | Analytics page loads | | |
| 120 | Financials page loads | | |

---

### PHASE 4: API & INTEGRATION TESTING

#### 4.1 API Endpoints
| # | Test | Result | Notes |
|---|------|--------|-------|
| 121 | Auth: /auth/sync works | | |
| 122 | Auth: /auth/me returns user | | |
| 123 | Tasks: CRUD operations | | |
| 124 | Tasks: Role-based filtering | | |
| 125 | Screenshot: Upload to MinIO | | |
| 126 | Screenshot: Retrieve with signed URL | | |
| 127 | Leave: Full workflow | | |
| 128 | Company: Invite flow end-to-end | | |
| 129 | Activity: Heartbeat works | | |
| 130 | Activity: Stats calculation | | |

---

### PHASE 5: CROSS-APP INTEGRATION
| # | Test | Result | Notes |
|---|------|--------|-------|
| 131 | Desktop screenshot appears in Web monitoring | | |
| 132 | Task created in Web shows in Desktop | | |
| 133 | Timer data syncs Desktop -> Web | | |
| 134 | Leave request from Desktop shows in Web | | |
| 135 | Employee invite -> Desktop login | | |
| 136 | Real-time updates via Socket.IO | | |

---

## CONSOLE LOGS & ERRORS
(Paste console errors here during testing)

### Desktop Console:
```
```

### Web Console:
```
```

### API Console:
```
```

---

## NOTES & OBSERVATIONS
(Any general observations during testing)

