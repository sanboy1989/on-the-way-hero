# DEV_LOG — On The Way Hero

格式：`[日期] | [任務] | [狀態] | [備註]`

狀態標籤：`待辦` / `進行中` / `完成`

---

| 日期 | 任務 | 狀態 | 備註 |
|------|------|------|------|
| 2026-04-13 | 專案初始化與架構設計 | 完成 | 確定技術棧：Next.js 14 + Firebase + Tailwind + Google Maps API；釐清商業模式（Escrow 託管 + 5% 佣金）；建立 README / DEV_LOG |
| 2026-04-13 | Firestore Schema 設計 | 完成 | 設計 users / missions / transactions 三個 collections；定義 status flow、Security Rules、Index 建議；詳見 FIRESTORE_SCHEMA.md |
| 2026-04-13 | Verified Hero 實名驗證邏輯設計 | 完成 | 兩條路徑：人工審核（Admin Dashboard）/ Persona KYC API；以 Firebase Custom Claims 作為安全閘門，Firestore 欄位作 UI 顯示；詳見 FIRESTORE_SCHEMA.md |
| 2026-04-13 | PWA 介面語言確認 | 完成 | 所有用戶介面改為英文；後台 / 開發文件維持中文 |
| 2026-04-13 | MissionExplorer.tsx 組件開發 | 完成 | 英文 UI；主題色 #FF8C00（橘）+ #333333（深灰）；Google Maps 深色底圖；綠 Pin（起點）→ 藍 Pin（終點）加橘色箭頭連線；Map / List 切換 Toggle；側邊欄任務卡顯示「代墊金額」與「扣佣後收入」；Accept Mission 按鈕（stub）；詳見 src/components/MissionExplorer.tsx |
| 2026-04-13 | Mission 型別定義 | 完成 | src/types/mission.ts — 對應 Firestore Schema，所有金額以 CAD cents (integer) 儲存 |
| 2026-04-13 | 建立 Next.js + next-pwa 初始專案 | 待辦 | 參考 README 初始化指令；需設定 next.config.js PWA 組態與 .env.local |
| 2026-04-13 | Firebase 專案設定 | 待辦 | 建立 Firebase 專案、啟用 Auth / Firestore / Functions；套用 FIRESTORE_SCHEMA.md 安全規則與 Index |
| 2026-04-13 | Google Maps API 整合 | 待辦 | 啟用 Maps JavaScript API + Places API；將 MissionExplorer 中的 mock data 替換為 Firestore 即時查詢 |
| 2026-04-13 | Escrow 資金託管 Cloud Function | 完成 | 實作三支 Functions：holdEscrow（發任務鎖資金）、completeMission（買家確認收貨→釋放）、cancelMission（退款）；Firestore Transaction 保證原子性；payoutTxId / refundTxId 作 Idempotency Key；防重複觸發機制；詳見 functions/src/escrow/ |
| 2026-04-13 | Admin 審核儀表板 | 待辦 | /admin 路由（isAdmin claim 保護）；顯示待審核 ID 照片佇列；或接入 Persona webhook |
| 2026-04-13 | 用戶認證流程 | 待辦 | Google Sign-In + Phone verification；用戶角色選擇（Buyer / Hero / Both） |
| 2026-04-13 | 買家端：Post Mission 表單 | 待辦 | 填寫商品資訊、地址（Google Places 自動補全）、出價；觸發 escrow_hold |
