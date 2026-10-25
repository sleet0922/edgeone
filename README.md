# EdgeOne Pages 部署演示

一个**零第三方依赖**的静态站点，用来验证 EdgeOne Pages 的 Git 自动部署链路：
推送到 `main` → 平台拉取代码 → 执行 `npm run build` → 发布 `dist/`。

页面本身就是这套流程的说明文档，包含创建项目时每个字段该怎么填。

## 目录结构

```
.
├── index.html          # 页面结构
├── assets/
│   ├── style.css       # 样式（深色 / 极光背景 / 响应式）
│   └── main.js         # 原生 JS：滚动显现、复制、导航高亮
├── scripts/
│   ├── build.mjs       # 构建：把静态文件复制进 dist/
│   └── serve.mjs       # 本地预览服务器（仅本地用）
├── robots.txt
└── package.json        # 只有 scripts，没有任何 dependencies
```

## 本地运行

```bash
npm install      # 无依赖，秒完成
npm run build    # 产出 dist/
npm run preview  # http://127.0.0.1:4173
```

## 部署到 EdgeOne Pages

在控制台「创建项目 → 配置项目」中按下表填写：

| 字段 | 填写 |
| --- | --- |
| 项目名称 | `edgeone`（随意） |
| 加速区域 | 全球可用区（含中国大陆） |
| 生产分支 | `main` |
| 框架预设 | `Other` |
| 根目录 | `/` |
| 输出目录 | `dist` |
| 构建命令 | `npm run build` |
| 安装命令 | `npm install` |

> 输出目录必须是 `dist`，不能留空 —— 构建脚本只把产物写进 `dist/`。
> 绑定自定义域名到大陆节点需要 ICP 备案；平台分配的默认域名可直接预览。

## 上线后验证

1. 打开平台分配的域名，能看到页面即表示资源已分发。
2. 页面底部显示的仓库与分支应与 GitHub 一致。
3. 再推一次空提交验证自动构建：

   ```bash
   git commit --allow-empty -m "chore: 触发部署" && git push
   ```

   控制台的「部署记录」里应新增一条构建。

## 常见问题

**构建命令报 `node: command not found`？**
在控制台的构建配置里确认 Node 版本选择为 18 或以上（本仓库 `engines` 已声明 `>=18`）。

**页面 404？**
多半是输出目录填成了 `/` 或 `.`。产物在 `dist/`，必须填 `dist`。

**想换成自己的站点？**
直接改 `index.html`、`assets/style.css`、`assets/main.js`，其余配置不用动。
