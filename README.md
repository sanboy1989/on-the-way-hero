# On The Way Hero

> 一個為 Calgary 社區設計的順路帶貨平台——讓每一趟出行都有價值，讓每一次購物都不再麻煩。

---

## 項目願景

Calgary 幅員廣闊，跨區取貨耗時費力。**On The Way Hero** 解決的痛點是：

- 買家在 Facebook Marketplace 等平台找到好物，但賣家在城市另一端（如從 NW 到 NE）
- 買家不想專程開車，但又不願錯過心儀商品

平台連接「有需求的買家」與「順路的英雄司機」，讓順路的人代付貨款並運送，買家確認收貨後平台釋放資金，真正實現社區互助與商業閉環。

---

## 核心功能

### 買家端
- 發布帶貨懸賞（商品連結、取貨地點、送達地址、出價）
- 資金預存至平台託管（Escrow）
- 追蹤任務狀態（待接單 → 取貨中 → 送達）
- 確認收貨後評價英雄

### 英雄（司機）端
- 瀏覽附近懸賞任務
- 接單、代付貨款、取貨並送達
- 收貨確認後由平台自動結算（扣除 5% 平台佣金）

### 平台
- 資金託管（Escrow）保障買賣雙方安全
- 5% 佣金於結算時自動抽取
- 用戶信用評分與評價系統
- 爭議處理機制

---

## 技術架構

```
┌─────────────────────────────────────────────────┐
│                   Client (PWA)                  │
│         Next.js + Tailwind CSS + next-pwa       │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                Firebase Services                │
│  ┌──────────┐  ┌───────────┐  ┌─────────────┐  │
│  │   Auth   │  │ Firestore │  │  Functions  │  │
│  │(Google / │  │(任務/用戶 │  │(Escrow 邏輯/│  │
│  │ 電話登入)│  │  /評價)   │  │  佣金結算)  │  │
│  └──────────┘  └───────────┘  └─────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              Google Maps API                    │
│       地址自動補全 / 路線距離計算                  │
└─────────────────────────────────────────────────┘
```

### 技術棧一覽

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端框架 | [Next.js](https://nextjs.org/) 14 (App Router) | SSR + PWA |
| 樣式 | [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS |
| PWA | [next-pwa](https://github.com/shadowwalker/next-pwa) | Service Worker / 離線支援 |
| 認證 | Firebase Auth | Google 登入 / 電話號碼驗證 |
| 資料庫 | Cloud Firestore | 即時任務狀態同步 |
| 後端邏輯 | Firebase Functions | Escrow 託管 / 佣金結算 |
| 地圖 | Google Maps API | 地址搜尋 / 距離計算 |

---

## 本地開發

### 前置需求
- Node.js >= 18
- Firebase CLI：`npm install -g firebase-tools`

### 初始化專案

```bash
# 1. 建立 Next.js 專案（App Router + TypeScript + Tailwind）
npx create-next-app@latest on-the-way-hero \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd on-the-way-hero

# 2. 安裝 PWA 套件
npm install next-pwa
npm install -D @types/next-pwa   # 若有型別需求

# 3. 安裝 Firebase SDK
npm install firebase
npm install firebase-admin        # Functions 端使用

# 4. 安裝 Google Maps
npm install @googlemaps/js-api-loader

# 5. 安裝其他常用工具
npm install zustand               # 狀態管理
npm install react-hook-form zod   # 表單驗證
npm install date-fns              # 日期處理
```

### next.config.js PWA 組態

```js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 你的其他 Next.js 設定
};

module.exports = withPWA(nextConfig);
```

### 環境變數

複製 `.env.local.example` 並填入對應值：

```bash
cp .env.local.example .env.local
```

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
```

### 啟動開發伺服器

```bash
npm run dev
```

---

## 商業模式

| 角色 | 行為 | 資金流向 |
|------|------|----------|
| 買家 | 發布任務，預存貨款 + 報酬至平台 | 資金 → 平台託管 |
| 英雄 | 接單、代付、送達 | 平台 → 英雄（扣 5% 佣金） |
| 平台 | 資金託管 + 爭議仲裁 | 收取 5% 佣金 |

---

## 開發日誌

詳見 [DEV_LOG.md](./DEV_LOG.md)
