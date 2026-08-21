# English Tutor System｜英语学习系统

这是面向初高中衔接英语备课、课堂互动和课后复习的一体化项目。仓库已从零散 HTML 归档升级为可持续维护的软件源码库，同时完整保留现有题库、知识库和默听写内容。

## 当前状态（2026-08-21）

- 已收录 9 份有效 HTML 教学内容，词汇范围衔接至 U1—U7。
- 同一套 React + TypeScript 界面同时服务 Windows、Android 和浏览器。
- 支持教师登录、学生代码 + 6 位 PIN 登录、跨网络云同步。
- 支持题库、知识库、默听写、生词卡、做题记录和页面状态。
- 原 HTML 的交互与 UI 作为教学内容继续保留，新软件负责统一入口、账号和同步。

## 仓库结构

```text
apps/english-learning-system/   主程序源码（Web / Windows / Android）
  legacy-content/               已确认的历史及最新 HTML 教学内容
  src/                          React 应用、状态和同步逻辑
  electron/                     Windows 桌面壳
  android/                      Android 工程
  supabase/                     数据库、权限策略和云函数
  scripts/                      构建与教师账号工具
docs/                           需求、架构、内容清单和交接文档
archives/                       历史归档说明
```

## 本地启动

```powershell
cd apps/english-learning-system
npm ci
Copy-Item .env.example .env
# 在 .env 中填写 Supabase URL 和公开 anon key
npm run dev
```

生产构建：`npm run build`。Windows 和 Android 的构建说明见应用目录中的 README。

## 安装包

Windows 便携版和 Android APK 不写入 Git 历史，统一放在 GitHub Releases，并提供 SHA-256 校验值。这样源码仓库保持清晰，安装包也能按版本下载。

## 安全边界

仓库不包含教师密码、数据库密码、service-role key、`.env`、本机路径配置和个人登录凭据。前端只允许使用 Supabase 的公开 anon key；敏感操作由行级权限或云函数完成。

详细文档：

- [完整需求](docs/PROJECT_REQUIREMENTS.md)
- [系统架构](docs/ARCHITECTURE.md)
- [内容清单](docs/CONTENT_INVENTORY.md)
- [后续备课交接](docs/HANDOFF_TO_CODEX.md)
- [发布说明](docs/RELEASES.md)
- [安全说明](docs/SECURITY.md)

