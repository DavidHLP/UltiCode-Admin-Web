## 快速入门 — 给 AI 编码代理的指南

目标：帮助 AI 代理快速理解本仓库的架构、常用模式和开发流程，能安全、准确地编辑与新增代码。

要先读的关键文件（按优先级）：
- `package.json` — 可用脚本：`dev` (vite 开发)、`build`、`preview`、`lint`、`type-check`。
- `src/main.ts` — 全局插件：Pinia、PrimeVue、Toast/Confirmation 服务与主题注册点。
- `src/router/index.ts` — 路由结构、懒加载组件模式与鉴权/路由 meta 约定（`requiresAuth`, `guestOnly`, `breadcrumb`）。
- `src/stores/auth.ts` — Pinia 的认证状态实现：localStorage 持久化键 `admin-console-auth`，token 刷新/过期逻辑、`authorizationHeader` getter。
- `src/utils/request.ts` — axios 实例：API 基址取自 `VITE_API_BASE_URL`，全局拦截器实现自动刷新、统一响应包装 `ApiResponse` 的解析（`isSuccess` 字段）和错误行为（401 => 重试刷新或跳转登录）。

重要架构/约定（必须遵守）：
- 路由组件均使用懒加载（dynamic import），新增页面请在 `src/router/index.ts` 的合适位置添加 route record，并设置 `meta` 字段（例如 `requiresAuth: true`）。
- 后端响应被封装为 ApiResponse：{ isSuccess: boolean, data?, error? }。前端通过 `unwrapResponse` / `requestData` 提取 `data`。实现后端或 mock 接口时请保持此结构。
- 认证：access/refresh token 存储在 `src/stores/auth.ts`，前端会在请求拦截器中在必要时自动刷新 token。刷新接口路径会被跳过刷新重试（见 `AUTH_REFRESH_ENDPOINT`）。
- 当 axios 响应 data 中 `isSuccess === false` 时，拦截器会将其转换为抛出错误，调用方通常以 try/catch 处理。

开发与调试要点：
- 快速启动：`npm run dev`（或 `pnpm/yarn`，请按团队包管理器）。
- 静态类型检查：`npm run type-check` (vue-tsc)。
- 修复 lint：`npm run lint`。
- API 本地联调：`VITE_API_BASE_URL` 环境变量用于指向后端（开发时默认 `http://localhost:9999`）；在没有真实后端时，前端常使用 `src/service/*.js` 中的 mock 数据。

常见代码模式与示例：
- 受保护路由示例（`src/router/index.ts`）：
  - `if (to.meta.requiresAuth && !authStore.isAuthenticated) { next({name: 'login', query: {redirect: to.fullPath}}) }`
- 认证持久化：`STORAGE_KEY = 'admin-console-auth'`，载入与持久化都在 `src/stores/auth.ts` 内实现。
- axios 自动刷新逻辑（要点）：
  - 若 access token 接近过期（阈值 15s），拦截器会触发 `authStore.refresh()` 并重试原请求。
  - 并发刷新通过 `refreshPromise` 去重，避免重复发起刷新请求。
- Mock / 本地数据位置：`src/service/ProductService.js`, `CountryService.js`, `CustomerService.js` 等，适合用于快速 UI 验证或单元测试替身。

新增代码/PR 的最佳实践（针对 AI 生成代码）：
- 先运行 `npm run type-check` 与 `npm run lint`，确保类型与 ESLint 检查通过。
- 修改后端交互时，优先复用 `src/utils/request.ts` 提供的 `requestData` 接口，保持返回值遵循 `ApiResponse` 或使用 `unwrapResponse`。
- 新增页面请遵循已有目录结构：`src/views/admin/`、`src/views/interaction/`、`src/views/uikit/` 等；组件命名使用 PascalCase，并在 `router` 中以懒加载导入。

注意与陷阱（agent 必读）：
- 不要绕过 `authorizationHeader` 或直接从 localStorage 读取 token；应通过 `useAuthStore()` 获取并让拦截器统一处理刷新逻辑。
- 对 401 的处理有两层：自动刷新（若 refreshToken 有效）或清理 auth 并跳转登录；请不要在业务代码直接对 401 做全局假设，使用请求库抛出的 Error 信息。
- `import.meta.env` 用于运行时配置（例如 `VITE_API_BASE_URL`），在生成/预览环境要确认 env 是否已注入。

如果本文件遗漏了任何对你分配任务关键的信息，请指出要改进的方向（例如：需要补充哪些 API 端点、测试命令或 CI 配置），我会迭代更新。

—— 结束 ——
