# Tutor · 测试版

一个以原有互动备课 HTML 为内容资产、同时面向 Android 学生端和 Windows 教师端的统一学习系统。

## 已完成的应用底座

- 手机和 PC 共用 React + TypeScript 业务代码。
- Windows 使用 Electron 便携版；Android 使用 Capacitor。
- 内容分为：`考题`、`默听写`、`知识库`。
- 已建立 9 份现有 HTML 的内容清单与兼容打开入口。
- 本地离线保存登录、打开内容、作答、播放、词卡、提交和同步等事件。
- 已建立“当前状态 + 不可覆盖事件流”的 Supabase 数据模型。
- 学习事件、生词卡和旧 HTML 的答题状态支持离线优先、联网后双向合并。
- 教师可创建学生编号与 6 位 PIN，并查看已关联学生的云端学习记录。
- 学生：学生编号 + 6 位 PIN；教师：邮箱 + 密码。
- 解析默认仅教师可见，预留提交后、定时和手动开放策略。

## 本机运行

```powershell
npm install
npm run dev
```

浏览器访问 `http://127.0.0.1:5173`。云端版需要使用真实教师账号，或由教师在系统内创建学生代码和 6 位 PIN；仓库不提供公共演示密码。

## 云端配置

1. 在 Supabase 新建项目并用 CLI 连接本目录。
2. 执行 `npx supabase db push` 部署 `supabase/migrations/`。
3. 执行 `npx supabase functions deploy create-student` 部署受教师权限保护的学生账号创建函数。
4. 复制 `.env.example` 为 `.env`，填写项目 URL 和 public anon key。
5. Storage 私有桶及访问策略由数据库迁移自动创建；学生 PIN 由 Supabase Auth 安全保存，不进入客户端代码。

首次教师账号由管理员脚本创建（只需提供真实邮箱，密码自动生成）：

```powershell
pwsh -NoProfile -File scripts/create-teacher.ps1 -Email "teacher@example.com" -DisplayName "老师"
```

脚本使用 Supabase CLI 的登录状态。临时密码只显示一次，并以当前 Windows 用户可解密的 DPAPI 形式备份到已忽略的 `supabase/.temp/`；登录后请在“设置”中修改密码。

## 打包

Windows 便携版：

```powershell
npm run desktop:pack
```

脚本会直接复用 `node_modules/electron/dist` 与已校验的本地 `rcedit`，不再重复下载 Electron 运行时；成品同时复制到 `release-ready/`。

Android：

```powershell
npm run android:add
npm run android:sync
npm run android:open
```

直接重新生成可安装测试 APK：

```powershell
npm run android:build:debug
```

Android 构建需要：

- Android Studio
- JDK 21
- Android SDK
- Gradle Wrapper 8.11.1（已包含在工程中）
- 编译平台：Android API 35 / Build Tools 35.0.0

## 目录说明

- `src/`：两端共用界面、业务与本地数据层。
- `electron/`：Windows 安全壳。
- `legacy-content/`：原 HTML 资产，保持原 UI 与功能。
- `supabase/schema.sql`：云端表、索引和行级权限的可读源文件。
- `supabase/migrations/`：可由 Supabase CLI 重复部署的正式迁移。
- `supabase/functions/create-student/`：仅教师可调用的学生账号创建函数。
- `release/`：Windows 打包结果（构建后生成）。
- `android/`：Android 工程（首次 `android:add` 后生成）。

## 数据记录边界

系统记录与学习有关的行为：答题变化、提交、得分、重做、解析/翻译展开、词卡、听写播放、打印、教师批改、版本和同步错误。不会记录系统级键盘输入、位置、通讯录或原始麦克风录音。
