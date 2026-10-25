# EdgeOne Pages 部署演示（静态页 + 边缘函数）

一个**零第三方依赖**的示例站点，用来验证 EdgeOne Pages 的完整链路：

推送到 `main` → 平台拉取代码 → 执行 `npm run build` → 发布 `dist/` 静态产物 + 注册 `functions/` 接口。

- 前端：HTML / CSS / 原生 JS，没有任何框架和打包器
- 后端：两个 Pages Functions（边缘运行时），一个读节点信息，一个用 KV 存留言
- 页面本身就是文档：部署流程、控制台填表参数、接口说明都写在页面里

## 目录结构

```
.
├── index.html              # 页面结构
├── assets/
│   ├── style.css           # 样式（深色 / 极光背景 / 响应式）
│   └── main.js             # 滚动显现、复制、导航高亮、调用后端接口
├── functions/              # ← 后端：按目录自动生成路由
│   └── api/
│       ├── status.js       # GET  /api/status    运行时 / 边缘节点 / 服务器时间
│       └── messages.js     # GET|POST /api/messages  留言读写（KV）
├── scripts/
│   ├── build.mjs           # 构建：把静态文件复制进 dist/
│   └── serve.mjs           # 本地开发服务器：静态资源 + 执行 functions + KV 模拟
├── robots.txt
└── package.json            # 只有 scripts，没有任何 dependencies
```

## 本地运行

```bash
npm install      # 无依赖，秒完成
npm run build    # 产出 dist/
npm run dev      # 构建 + 在 http://127.0.0.1:4173 同时托管静态资源和函数
```

`npm run dev` 会按线上一致的方式执行 `functions/`，并用 `.data/kv.json` 模拟 KV 绑定，
所以本地就能完整走通「写留言 → 刷新还在」。只跑 `npm run preview` 也可以，但那时没有接口。

想用官方 CLI 调试：`npm i -g edgeone` → `edgeone pages link` → `edgeone pages dev`。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/status` | 返回运行时、边缘节点、访问者位置摘要、服务器时间；KV 是否绑定 |
| GET | `/api/messages` | 读取最近 50 条留言；未绑定 KV 时返回 `kv:false` |
| POST | `/api/messages` | 写入留言，body 为 `{ "name": "可选", "content": "必填" }` |

```bash
curl http://127.0.0.1:4173/api/status
curl -X POST http://127.0.0.1:4173/api/messages \
  -H 'content-type: application/json' \
  -d '{"name":"Sleet","content":"hello edge"}'
```

约束：昵称 ≤ 16 字、内容 ≤ 140 字、最多保留 50 条、`content` 必填。
接口是公开的，正式使用建议自行加限流或校验（例如每 IP 每分钟写入次数）。

## 部署到 EdgeOne Pages

控制台「创建项目 → 配置项目」按下表填写：

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

> 输出目录必须是 `dist`，不能留空 —— 构建脚本只把静态产物写进 `dist/`。
> `functions/` 不需要出现在产物目录里：EdgeOne 会单独识别仓库根目录的 `functions/` 并注册为接口。

### 可选：绑定 KV（留言板需要）

1. 控制台进入「KV 存储」，开通后「创建命名空间」。
2. 项目详情 →「KV 存储」→「绑定命名空间」。
3. **变量名填 `GUESTBOOK_KV`**（代码按这个名字取值），选择刚创建的命名空间。
4. 重新部署一次，留言板右上角会变成「KV 已连接」。

没有绑定 KV 也能正常部署：`/api/status` 照常工作，页面会提示去绑定，POST 返回 503 + 提示文案。
注意 KV 账户当前需要在控制台申请开通。

## 上线后验证

1. 打开平台分配的域名，页面底部显示仓库与分支。
2. 「现在有后端了」区块里 `/api/status` 显示「在线」，能看到真实边缘节点信息。
3. 绑定 KV 后发一条留言，刷新页面依然存在。
4. 再推一次空提交验证自动构建：

   ```bash
   git commit --allow-empty -m "chore: 触发部署" && git push
   ```

## 常见问题

**构建报 `node: command not found`？**
确认构建环境的 Node 版本为 18 或以上（`engines` 已声明 `>=18`）。

**页面 404？**
多半是输出目录填成了 `/` 或 `.`。产物在 `dist/`，必须填 `dist`。

**接口返回 404 / 页面提示「函数未运行」？**
本地：用 `npm run dev` 而不是直接开静态文件；线上：确认 `functions/` 在仓库根目录、且项目根目录设置为 `/`。

**留言板显示「KV 未绑定」？**
变量名必须是 `GUESTBOOK_KV`，绑定后需要重新部署才生效。
