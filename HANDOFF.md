# 四象限待办清单 (Four-Quadrant To-Do List) - 项目移交文档

**项目状态**：功能完整，优化进行中  
**最后更新**：2026-08-20  
**移交人**：Copilot  
**下一步维护者**：Codex Agent

---

## 📋 快速概览

四象限待办清单是一个 **PWA 应用**，帮助用户用经典的时间管理矩阵组织任务。支持：
- ✅ 动态象限（用户可增删改象限）
- ✅ 图片 OCR 识别（本地处理，无上传）
- ✅ 拖拽排序（跨象限任务移动）
- ✅ 离线使用（Service Worker）
- ✅ 响应式移动界面

**部署地址**：https://othing.github.io/Four-quadrant-To-Do-List/

---

## 🛠 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.2.8 |
| 类型 | TypeScript | 5.4.2 |
| 构建 | Vite | 8.2.0 |
| 拖拽 | dnd-kit | 6.3.1 |
| OCR | Tesseract.js (CDN) | 7.0.0 |
| 存储 | localStorage | - |
| PWA | Service Worker | - |
| 部署 | GitHub Pages | - |

**关键链接**：
- Tesseract.js CDN: `https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js`
- dnd-kit 文档: https://docs.dndkit.com/
- Vite 文档: https://vitejs.dev/

---

## 📁 项目结构

```
Four-quadrant To-Do List/
├── src/
│   ├── App.tsx              # 主应用组件（所有状态管理、UI、业务逻辑）
│   ├── App.css              # 样式（四象限、任务、OCR UI）
│   ├── global.d.ts          # TypeScript 声明（Tesseract.js 类型）
│   ├── main.tsx             # 应用入口
│   └── vite-env.d.ts        # Vite 环境类型
├── public/
│   ├── service-worker.js    # PWA 离线支持
│   └── favicon.svg          # 四色应用图标
├── index.html               # HTML 入口（加载 Tesseract CDN）
├── vite.config.ts           # Vite 配置
├── tsconfig.json            # TypeScript 配置
├── package.json             # 依赖和脚本
├── .github/
│   └── workflows/
│       └── deploy-pages.yml # GitHub Actions 自动部署
├── HANDOFF.md               # 本文件
└── dist/                    # 构建输出
```

**核心代码在 `src/App.tsx` 中**（~400 行单文件组件）

---

## 🎯 已完成功能

### ✅ 核心功能
- **动态象限管理**
  - 用户可自定义象限名称和个数
  - 始终保留"待分类"(INBOX) 不可删除区域
  - 删除象限时自动迁移任务到待分类
  
- **任务管理**
  - 添加/编辑/完成/删除任务
  - 跨象限拖拽排序（使用 dnd-kit）
  - localStorage 自动保存
  
- **图片 OCR 识别**
  - 上传图片 → 本地识别 → 逐行解析 → 批量导入
  - 支持中英混杂识别
  - 改进的文本清理：移除符号、合并被夹空的词组
  
- **响应式设计**
  - 桌面：2×2 象限网格
  - 移动：自适应纵向堆栈
  - 排列切换：2×2 / 纵向
  - 排版切换：固定 / 随任务量流动
  
- **PWA 离线支持**
  - Service Worker 缓存静态资源
  - 离线可用（需首次在线加载）

### ✅ 最近改进（v2 版本重构）
- 从固定象限 → 动态象限架构
- localStorage v1 → v2 数据模型迁移
- 新增 OCR 文本优化逻辑（2026-08-20）
  - 扩展符号过滤
  - 合并被错误拆分的短行
  - 更严格的有效性检查

---

## 🔄 数据模型

### Board 结构
```typescript
interface Board {
  quadrants: Quadrant[]  // 用户自定义象限列表
  tasks: Task[]          // 所有任务（quadrantId 关联）
}

interface Quadrant {
  id: string
  name: string           // 象限名称（可编辑）
}

interface Task {
  id: string
  title: string          // 任务标题
  completed: boolean     // 完成状态
  quadrantId: string     // 所属象限 ID
}
```

### 初始化象限（硬编码）
```typescript
const DEFAULT_QUADRANTS: Quadrant[] = [
  { id: 'urgent-important', name: '紧急且重要' },
  { id: 'not-urgent-important', name: '不紧急但重要' },
  { id: 'urgent-not-important', name: '紧急但不重要' },
  { id: 'neither', name: '既不紧急也不重要' }
]

const INBOX_ID = 'inbox'  // 待分类区域（始终存在）
```

### 存储键
```
localStorage['quadrant-board-v2']  // 当前版本
localStorage['quadrant-board']      // 旧版本（自动迁移）
```

---

## 🚀 开发命令

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
# 访问 http://localhost:5173
```

### 构建生产版本
```bash
npm run build
# 输出到 dist/
```

### 类型检查
```bash
npm run type-check
```

### Lint 检查
```bash
npm run lint
```

### 部署到 GitHub Pages
```bash
# 提交到 main 分支
git push origin main
# GitHub Actions 自动触发 .github/workflows/deploy-pages.yml
# 约 1-2 分钟后访问 https://othing.github.io/Four-quadrant-To-Do-List/
```

---

## 🔑 关键代码片段

### OCR 图片识别（改进后）

**位置**：`src/App.tsx` 行 ~89-110

```typescript
const cleanOcrText = (text: string): string[] => {
  const lines = text.split(/\r?\n/)
  const cleaned: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    if (!line) continue
    // 移除前置符号和数字
    line = line.replace(/^\s*[-*•·\d.、【】\[\]()（）]+\s*/, '').trim()
    if (!line || line.length < 2) continue
    // 合并多个空格
    line = line.replace(/\s+/g, ' ')
    // 如果短行且以标点开头，合并到前一行
    if (cleaned.length > 0 && line.length <= 4 && /^[、，。；：？！,.:;?!]/.test(line)) {
      cleaned[cleaned.length - 1] += line
      continue
    }
    // 验证包含有效字符
    if (/[\u4e00-\u9fff\w]/.test(line)) {
      cleaned.push(line)
    }
  }
  return cleaned.filter((line) => line.length >= 2)
}

const importImage = async (file: File) => {
  // ... 初始化
  const worker = await window.Tesseract.createWorker('chi_sim+eng', 1, {
    logger: (message) => setOcrStatus(`${message.status} ${Math.round(message.progress * 100)}%`)
  })
  const result = await worker.recognize(file)
  await worker.terminate()
  
  // 使用清理函数
  const titles = cleanOcrText(result.data.text)
  // ... 导入任务
}
```

**改进点**：
- 处理"袜子 夹"这类被夹空的词组
- 移除空行和纯符号行
- 合并标点符号行到前一项
- 验证包含中文或英文字符

### 拖拽排序（跨象限）

**位置**：`src/App.tsx` 行 ~74-81

支持：
- 在象限内排序任务
- 跨象限移动任务
- 拖拽到象限区域头部添加

### 象限 CRUD

**位置**：`src/App.tsx` 行 ~112-140

- `addQuadrant()`：新增象限
- `removeQuadrant(id)`：删除象限，迁移任务到待分类
- 编辑象限：通过 `onRename` 回调修改名称

---

## ⚙️ 配置文件说明

### vite.config.ts
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/Four-quadrant-To-Do-List/',  // GitHub Pages 路径
})
```

### tsconfig.json
- 目标：ES2020
- 模块：ESNext
- JSX：react-jsx（React 19 新语法）

### index.html
```html
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js"></script>
<!-- 加载 Tesseract OCR 库 -->
```

---

## 🐛 已知问题与改进方向

### 当前问题
1. **OCR 字符精度**
   - 某些字体或手写体识别不准
   - 无法自动修正 0/O、1/l 等易混淆字符
   - **解决方案**：可收集用户反馈的错误样本，建立纠正映射表

2. **移动端 Safari 缓存**
   - 旧 Service Worker 可能导致白屏
   - **解决方案**：用户清除 Safari 缓存或用隐私浏览；后续可更新 Service Worker 版本号强制更新

3. **Tesseract.js 加载延迟**
   - 首次 OCR 需等待模型下载（~50MB）
   - **优化方向**：可考虑后台预加载或显示更详细的进度

### 可选改进
- [ ] 添加任务优先级标记（不同颜色）
- [ ] 导出任务列表（JSON/CSV）
- [ ] 撤销/重做功能
- [ ] 深色主题
- [ ] 多语言支持
- [ ] OCR 信心度显示与手动校准
- [ ] 任务统计仪表板

---

## 🧪 测试建议

### 功能测试
- [ ] 新增/编辑/删除象限
- [ ] 添加/完成/删除任务
- [ ] 拖拽任务（象限内、跨象限）
- [ ] 上传图片 OCR（中文、英文、混合）
- [ ] 本地存储持久化（刷新后数据保留）
- [ ] 离线使用（断网后仍可操作）

### 响应式测试
- [ ] 桌面浏览器（1920px+）
- [ ] 平板（768px）
- [ ] 手机（375px）
- [ ] iPhone Safari（缓存问题）
- [ ] Android Chrome

### 性能测试
- [ ] OCR 识别耗时
- [ ] 任务列表滚动帧率
- [ ] localStorage 大小限制

---

## 📞 常见问题

### Q: 如何更改初始象限？
**A**: 编辑 `src/App.tsx` 中的 `DEFAULT_QUADRANTS`，然后清除 localStorage 数据。

### Q: 如何自定义 OCR 语言？
**A**: 修改 `importImage()` 中的 `createWorker('chi_sim+eng', ...)` 参数。Tesseract 支持 `eng`、`chi_sim`、`chi_tra` 等。

### Q: 如何禁用 PWA？
**A**: 在 `index.html` 中移除 `<link rel="manifest">` 和 `<script>` 注册 Service Worker 的代码。

### Q: 如何修改部署路径？
**A**: 更新 `vite.config.ts` 中的 `base` 选项，并确保 GitHub 仓库设置正确的 Pages 分支。

---

## 📚 相关资源

- **React 文档**: https://react.dev
- **Vite 文档**: https://vitejs.dev
- **dnd-kit 文档**: https://docs.dndkit.com
- **Tesseract.js 文档**: https://tesseract.projectnaptha.com/
- **localStorage MDN**: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- **PWA 指南**: https://web.dev/progressive-web-apps/

---

## 🎓 代码审查要点

当修改代码时，请注意：

1. **状态管理**：所有状态在 `App.tsx` 中用 React hooks 管理（`useState`、`useEffect`）
2. **类型安全**：所有数据结构已在 `global.d.ts` 定义或内联声明
3. **样式作用域**：CSS 在 `App.css` 中，使用 BEM 命名约定
4. **浏览器兼容性**：需支持 iOS Safari 15+、Chrome 90+
5. **离线优先**：任何网络操作都应有离线降级方案
6. **性能**：避免在渲染中创建大对象；使用 `useCallback` 优化拖拽处理

---

## ✍️ 提交规范

```bash
# 功能新增
git commit -m "feat: 添加任务优先级"

# 问题修复
git commit -m "fix: 修复 Safari OCR 显示问题"

# 文档更新
git commit -m "docs: 更新 HANDOFF 文档"

# 样式调整
git commit -m "style: 优化移动端布局"

# 性能优化
git commit -m "perf: 减少 OCR 初始化延迟"
```

---

## 📝 最后的话

这个项目已具备完整的功能和架构。核心逻辑集中在 `App.tsx` 中，易于维护和扩展。

**建议下一步**：
1. 收集用户反馈（特别是 OCR 识别问题）
2. 迭代改进 OCR 文本后处理
3. 可视化数据统计功能
4. 性能监控和错误追踪

祝你使用愉快！🎉

---

*文档生成时间：2026-08-20*
