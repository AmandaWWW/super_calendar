# 万能日历生成器 Demo

一个轻量 Web Demo：
- 阳历 / 阴历查询与转换
- 输入目标后自动生成阶段计划与14天行动建议
- 计划生成优先调用阿里云百炼 API，失败时自动回退本地规则

## 技术栈

- React + TypeScript + Vite
- `dayjs`
- `lunar-javascript`
- Vercel Serverless Function（`/api/generate-plan`）

## 本地运行

```bash
npm install
npm run dev
```

## 环境变量

参考 `.env.example`：

```bash
BAILIAN_API_KEY=your_bailian_api_key
BAILIAN_MODEL=qwen-plus
```

说明：
- 本地开发可在项目根目录创建 `.env.local`
- 线上部署在 Vercel Project Settings -> Environment Variables 配置

## 核心接口

- `POST /api/generate-plan`
- 入参：`goal`, `startDate`, `endDate`, `weeklyHours`, `lunarContext`
- 出参：
  - `summary`
  - `stages[]`
  - `daily[]`

## GitHub + PR 流程

```bash
git checkout -b codex/demo-v1
git add .
git commit -m "feat: calendar demo with bailian planner"
git push -u origin codex/demo-v1
```

然后在 GitHub 创建 PR（`codex/demo-v1` -> `main` 或默认主分支）。

## Vercel 通过 GitHub 部署

1. 打开 Vercel，`Add New Project`，导入 `AmandaWWW/super_calendar`
2. Framework 选择 `Vite`
3. 设置环境变量：
   - `BAILIAN_API_KEY`
   - `BAILIAN_MODEL`（可选，默认 `qwen-plus`）
4. 点击 Deploy

## Cloudflare 域名切换到 Vercel

1. 在 Vercel 项目中 `Settings -> Domains` 添加你的域名（例如 `calendar.yourdomain.com`）
2. Vercel 会给出 DNS 记录
3. 到 Cloudflare DNS 添加对应记录（通常是 CNAME 到 Vercel 提供的目标）
4. 等待生效后在 Vercel 验证通过

建议：先用子域名（如 `calendar.xxx.com`）验证，稳定后再切主域。
