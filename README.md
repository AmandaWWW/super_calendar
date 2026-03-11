# Vibe Calendar

一个基于 `Next.js App Router` 的轻量日历规划应用，包含：
- 阳历 / 阴历转换
- 月历与周视图联动
- AI 目标拆解与任务草案生成
- 冲突检测与重排
- Markdown / JSON / ICS 导出

## 技术栈

- Next.js 15
- React 19
- Tailwind CSS
- Zustand
- FullCalendar
- date-fns
- lunar-javascript
- ics

## 本地运行

```bash
npm install
npm run dev
```

如果本机 `next dev` 不稳定，可改用生产方式本地预览：

```bash
npm run build
npm run start
```

默认地址：

```bash
http://localhost:3000
```

## 环境变量

参考 `.env.example`：

```bash
BAILIAN_API_KEY=your_bailian_api_key
BAILIAN_MODEL=deepseek-v3.1
PLANNER_MODEL_TIMEOUT_MS=55000
```

说明：
- 本地开发可使用 `.env.local`
- 线上部署时在 Vercel 项目中配置环境变量

## 项目结构

```text
app/
  api/generate-plan/route.ts   AI 规划接口
  globals.css                  全局主题与 FullCalendar 样式
  layout.tsx                   根布局
  page.tsx                     首页入口

components/
  vibe-calendar-shell.tsx      主页面三栏骨架
  lunar-converter-card.tsx     阴阳历转换器
  month-calendar-card.tsx      月历
  week-calendar-board.tsx      周视图
  ai-goal-panel.tsx            AI 目标规划输入
  task-board-panel.tsx         任务看板与冲突弹窗

stores/
  use-vibe-store.ts            全局状态

lib/
  calendar-types.ts            类型定义
  lunar.ts                     阴阳历转换
  planner-client.ts            前端请求封装
  task-planning.ts             默认任务与冲突检测
  exporters.ts                 Markdown / JSON / ICS 导出
  errors.ts                    错误消息归一化
```

## 关键流程

1. 左侧选择日期并查看阴阳历信息
2. 中间周视图手动安排时间块
3. 右侧输入目标，调用 AI 生成任务草案
4. 检查冲突后将任务应用到日历
5. 导出任务清单或日历文件

## 部署

### GitHub

```bash
git checkout -b codex/demo-v1
git add .
git commit -m "feat: clean up vibe calendar project"
git push -u origin codex/demo-v1
```

### Vercel

1. 在 Vercel 中导入 GitHub 仓库
2. Framework 选择 `Next.js`
3. 配置环境变量：
   - `BAILIAN_API_KEY`
   - `BAILIAN_MODEL`
   - `PLANNER_MODEL_TIMEOUT_MS`（可选，默认 `55000`）
4. 执行部署

## 备注

- `npm run build` 应保持通过
- `npm run lint` 使用 ESLint CLI
- 本地生成目录 `.next*`、`dist/` 不应提交到仓库
