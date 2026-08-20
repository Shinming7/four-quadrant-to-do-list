# 开发快速指南

本文档提供开发者进行常见修改和扩展时的快速参考。

**目标读者**：接手该项目的开发者  
**更新日期**：2026-08-20

---

## 🚀 快速开始

### 1. 本地开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 在浏览器中打开 localhost:5173
# 修改代码会自动热重载
```

### 2. 构建和部署

```bash
# 类型检查
npm run type-check

# Lint 检查
npm run lint

# 构建生产版本
npm run build

# 输出检查（dist/ 文件夹会被生成）
```

### 3. 推送到 GitHub

```bash
git add .
git commit -m "feat: 添加新功能说明"
git push origin main

# GitHub Actions 自动触发部署
# 1-2 分钟后访问 https://othing.github.io/Four-quadrant-To-Do-List/
```

---

## 🎨 常见修改任务

### 修改象限名称或数量

**位置**：`src/App.tsx` 第 18-23 行

```typescript
const defaultQuadrants: Quadrant[] = [
  { id: 'q1', name: '紧急且重要', tone: 'coral', deletable: true },
  { id: 'q2', name: '不紧急但重要', tone: 'blue', deletable: true },
  { id: 'q3', name: '紧急但不重要', tone: 'gold', deletable: true },
  { id: 'q4', name: '既不紧急也不重要', tone: 'sage', deletable: true },
]
```

**修改后**：清除浏览器 localStorage 数据
```javascript
localStorage.removeItem('quadrant-board-v2')
localStorage.removeItem('quadrant-layout-mode')
localStorage.removeItem('quadrant-arrangement-mode')
```

### 修改象限颜色

**位置**：`src/App.css` 中搜索 `.quadrant-panel--`

```css
/* 修改颜色主题 */
.quadrant-panel--coral { background: #fff5f3; border-left: 4px solid #ff6b5a; }
.quadrant-panel--blue { background: #f0f4ff; border-left: 4px solid #4a90e2; }
.quadrant-panel--gold { background: #fffbf0; border-left: 4px solid #ffa500; }
.quadrant-panel--sage { background: #f0faf7; border-left: 4px solid #5eb89a; }
```

### 修改初始任务

**位置**：`src/App.tsx` 第 28-32 行

```typescript
const initialTasks: Task[] = [
  { id: 'task-1', title: '修改此任务', completed: false, quadrantId: 'q1' },
  { id: 'task-2', title: '或添加新任务', completed: false, quadrantId: 'q2' },
]
```

### 修改 OCR 识别语言

**位置**：`src/App.tsx` 第 110 行

```typescript
// 当前配置：中文 + 英文
const worker = await window.Tesseract.createWorker('chi_sim+eng', 1, {
  // ...
})

// 改为仅中文
// const worker = await window.Tesseract.createWorker('chi_sim', 1, {

// 改为仅英文
// const worker = await window.Tesseract.createWorker('eng', 1, {

// 改为繁体中文 + 英文
// const worker = await window.Tesseract.createWorker('chi_tra+eng', 1, {
```

**可用语言代码**：
- `eng` - English
- `chi_sim` - 简体中文
- `chi_tra` - 繁体中文
- 其他参考 [Tesseract.js 文档](https://tesseract.projectnaptha.com/)

### 修改拖拽灵敏度

**位置**：`src/App.tsx` 第 104 行

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 }  // 修改此值
    // 更大的值 = 更难触发拖拽（需要更长的移动距离）
    // 更小的值 = 更容易触发拖拽（可能导致误触）
  })
)
```

---

## 🆕 功能开发指南

### 新增功能：任务优先级标记

**步骤 1**：修改数据模型

在 `src/App.tsx` Task 类型中添加优先级字段：
```typescript
type Task = {
  id: string
  title: string
  completed: boolean
  quadrantId: string
  priority?: 'high' | 'medium' | 'low'  // 添加
}
```

**步骤 2**：修改 TaskCard 组件

```typescript
function TaskCard({ task, onToggle, onDelete }: {...}) {
  return (
    <article
      className={`
        task-card
        ${task.completed ? 'is-complete' : ''}
        ${task.priority ? `priority-${task.priority}` : ''}
      `}
    >
      {task.priority && <span className="priority-badge">{task.priority}</span>}
      <p className="task-title">{task.title}</p>
      {/* ... 其他代码 ... */}
    </article>
  )
}
```

**步骤 3**：添加样式 (src/App.css)

```css
.priority-badge {
  display: inline-block;
  padding: 0.2em 0.4em;
  font-size: 0.75em;
  font-weight: bold;
  border-radius: 3px;
  margin-right: 0.5em;
}

.priority-high .priority-badge { background: #ffebee; color: #c62828; }
.priority-medium .priority-badge { background: #fff3e0; color: #e65100; }
.priority-low .priority-badge { background: #e8f5e9; color: #2e7d32; }
```

**步骤 4**：更新 addTask 逻辑

```typescript
const addTask = (quadrantId: string) => {
  const title = window.prompt('任务名称')?.trim()
  const priority = window.prompt('优先级 (high/medium/low)')?.trim()
  
  if (title) setBoard((board) => ({
    ...board,
    tasks: [...board.tasks, {
      id: `task-${Date.now()}`,
      title,
      completed: false,
      quadrantId,
      priority: priority === 'high' || priority === 'medium' ? priority : 'low'
    }]
  }))
}
```

**步骤 5**：更新 normalizeBoard 函数

在规范化任务时处理新字段的默认值。

### 新增功能：任务导出

**步骤 1**：添加导出函数

```typescript
const exportTasks = () => {
  const data = { quadrants, tasks, exportDate: new Date().toISOString() }
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasks-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

**步骤 2**：添加导出按钮

在 `.board-actions` 中添加：
```html
<button onClick={exportTasks}>导出</button>
```

### 新增功能：深色主题

**步骤 1**：检测系统主题偏好

```typescript
const [isDarkMode, setIsDarkMode] = useState(() => 
  window.matchMedia('(prefers-color-scheme: dark)').matches
)

useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches)
  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}, [])
```

**步骤 2**：应用主题类

```typescript
return <main className={`app-shell ${isDarkMode ? 'dark-theme' : ''}`}>
```

**步骤 3**：添加深色模式样式 (src/App.css)

```css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --border-color: #e0e0e0;
}

.app-shell.dark-theme {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #e0e0e0;
  --border-color: #444;
}

body { background: var(--bg-primary); color: var(--text-primary); }
.quadrant-panel { background: var(--bg-secondary); border-color: var(--border-color); }
```

---

## 🧪 测试指南

### 单元测试（可选）

创建 `src/App.test.tsx`：

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeBoard } from './App'

describe('normalizeBoard', () => {
  it('应该处理空数据', () => {
    const result = normalizeBoard(null)
    expect(result.quadrants.length).toBeGreaterThan(0)
    expect(result.tasks).toBeDefined()
  })

  it('应该验证 task 的 quadrantId', () => {
    const board = {
      quadrants: [{ id: 'q1', name: 'Test' }],
      tasks: [{ id: 't1', title: 'Test', quadrantId: 'invalid' }]
    }
    const result = normalizeBoard(board)
    expect(result.tasks[0].quadrantId).toBe('inbox')
  })
})
```

### 手动测试清单

```markdown
- [ ] 新增任务
- [ ] 编辑任务标题
- [ ] 完成/取消完成任务
- [ ] 删除任务
- [ ] 拖拽任务（同象限内）
- [ ] 拖拽任务到其他象限
- [ ] 新增象限
- [ ] 编辑象限名称
- [ ] 删除象限（验证任务迁移）
- [ ] 上传图片 OCR
- [ ] 切换布局模式
- [ ] 切换排列方式
- [ ] 刷新页面验证持久化
- [ ] 离线模式测试
- [ ] 移动设备响应式测试
- [ ] Safari 兼容性测试
```

---

## 🐛 调试技巧

### 1. 查看 localStorage 数据

在浏览器控制台执行：
```javascript
console.log(JSON.parse(localStorage.getItem('quadrant-board-v2')))
```

### 2. 清除所有数据并重置

```javascript
localStorage.clear()
location.reload()
```

### 3. 监控 OCR 处理

在 `importImage` 中添加日志：
```typescript
console.log('OCR Result:', result.data.text)
console.log('Cleaned Text:', titles)
```

### 4. 检查网络请求

打开 DevTools → Network 标签，查看：
- `tesseract.min.js` 是否加载
- 模型文件（chi_sim.json 等）是否下载

### 5. 使用 React DevTools

Chrome/Firefox 扩展 "React Developer Tools" 可查看组件状态和 props。

---

## 📦 依赖管理

### 升级依赖

```bash
# 检查过期的依赖
npm outdated

# 安全地升级所有依赖
npm update

# 升级特定依赖到最新主版本
npm install dnd-kit@latest
```

### 添加新依赖

```bash
# 添加生产依赖
npm install lodash-es

# 添加开发依赖
npm install -D @types/lodash-es
```

### 注意事项

- **Tesseract.js**：从 CDN 加载，不在 package.json 中
- **dnd-kit**：核心拖拽功能，不可替换
- **React**：升级需要测试兼容性（JSX 语法）

---

## 🔐 安全建议

1. **不要在代码中硬编码 API 密钥**
   - 使用环境变量（Vite: `import.meta.env.*`）

2. **验证用户输入**
   - OCR 识别结果过滤（已实现）
   - 用户输入的任务标题也应过滤

3. **CSP 策略**
   - Tesseract CDN 已添加到 index.html
   - 如遇 CSP 违规，检查浏览器控制台

4. **存储限制**
   - localStorage 限制 ~5MB
   - 大量任务可能超出限制

---

## 📈 性能优化

### 1. 减少 OCR 初始化延迟

目前首次 OCR 需等待 ~50MB 模型下载。可优化：

```typescript
// 在后台预加载模型（在 useEffect 中）
useEffect(() => {
  let worker: any
  const preload = async () => {
    try {
      worker = await window.Tesseract?.createWorker('chi_sim+eng', 1)
      // 预加载完毕，保留 worker 引用
    } catch (e) {
      console.log('预加载失败', e)
    }
  }
  preload()
  return () => worker?.terminate()
}, [])
```

### 2. 虚拟化长列表

如任务数 > 100，考虑使用虚拟滚动库（react-window）：

```bash
npm install react-window
```

### 3. 代码分割

对 OCR 功能进行动态导入（Vite 默认支持）：

```typescript
const Tesseract = lazy(() => import('./ocr-loader'))
```

---

## 📚 相关文档

- **HANDOFF.md** - 项目总体移交文档
- **CODE_SNAPSHOT.md** - 关键代码片段快照
- **README.md** - 用户使用说明（如果存在）
- **.github/workflows/deploy-pages.yml** - 部署配置

---

## ✅ 提交前检查清单

```bash
# 1. 类型检查通过
npm run type-check

# 2. Lint 通过
npm run lint

# 3. 构建成功
npm run build

# 4. 本地测试通过
npm run dev  # 手动验证功能

# 5. 提交代码
git add .
git commit -m "feat: 描述你的更改"
git push origin main
```

---

## 🆘 常见错误排查

| 错误 | 原因 | 解决方案 |
|-----|------|--------|
| `Cannot find module 'React'` | React 未导入 | 添加 `import { ... } from 'react'` |
| `Property 'Tesseract' does not exist` | TypeScript 声明缺失 | 检查 `global.d.ts` |
| `Cannot read properties of undefined` | State 未初始化 | 使用 `??` 或 `?.` 安全操作符 |
| `localStorage is not defined` | SSR/Node 环境 | 添加 `typeof window !== 'undefined'` 检查 |
| 白屏 | Service Worker 缓存 | 清除缓存或强制刷新 |

---

## 🎯 下一步建议

1. **收集用户反馈**
   - OCR 识别准确度
   - 移动端体验
   - 性能（特别是 OCR 延迟）

2. **迭代改进**
   - 改进 OCR 文本后处理
   - 增加任务优先级/标签
   - 数据统计仪表板

3. **扩展功能**
   - 多设备同步（需要后端）
   - 任务提醒通知
   - 深色主题

4. **代码维护**
   - 升级 React 和依赖
   - 增加单元测试
   - 代码注释和文档

---

*文档版本：1.0*  
*最后更新：2026-08-20*
