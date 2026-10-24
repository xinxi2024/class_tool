# ClassKit · 班级活动工具箱

ClassKit 是一个不绑定学校、班级、人数或日期的静态活动工具网站。它使用 HTML、CSS、原生 JavaScript ES Modules、JSON 和浏览器 LocalStorage；不需要后端、数据库、账号、构建步骤或第三方 API。

## 本地运行

页面使用 ES Modules 和 JSON `fetch`，请通过静态 HTTP 服务器打开，不要直接双击 `index.html`。

Windows PowerShell：

```powershell
cd C:\Users\信\OneDrive\桌面\支线-中转站\test
py -m http.server 8000
```

然后访问 `http://localhost:8000`。停止服务时在终端按 `Ctrl+C`。

## 功能清单

- **班级组织**：随机分组（姓名名单或匿名人数、按组数或每组人数均衡分配、复制和恢复结果）；随机抽签（单人/多人、允许重复、历史）。
- **趣味游戏**：数字炸弹；谁是卧底（单设备轮流看词、投票记录、揭晓、多卧底、自定义词对）；你画我猜（题目难度、计时、自定义词库）；逛三园、海龟汤、猜歌名、词语接龙、数字 7、传话画画。
- **现场互动**：正计时/倒计时、暂停、重置和全屏；独立积分板；单设备逐票统计和百分比。
- **计时提示**：倒计时到零时播放浏览器本地合成的双音提示；开始时初始化音频，避免外部音频依赖。
- **活动流程**：环节时长与工具入口、主持模式、内置示例模板、模板修改/复制/删除、活动 JSON 导入导出。
- **通用设置**：浅色/深色主题、全量 JSON 备份恢复、恢复默认、LocalStorage 不可用提示。
- **简洁导航与主题**：侧栏按班级组织、趣味游戏、现场互动、通用工具归类；明暗主题均采用黑白灰配色。
- **离线**：静态资源通过 Service Worker 缓存，首次访问加载完成后可离线再次打开；不支持 Service Worker 的浏览器仍可在线正常使用。
- **原词库保留**：你画我猜、谁是卧底、传话画画各 48 条，共 144 条，保存在 `data/words.json`。通用配置和活动模板保存在 `data/config.json`。

## 运行测试

需要 Node.js 18 或更新版本，无第三方测试依赖：

```powershell
npm test
```

测试覆盖均衡分组、匿名编号、抽签重复规则、数字边界、卧底分配、本地存储和种子数据。

## GitHub Pages 部署

1. 把本目录作为 GitHub 仓库根目录并推送到 `main` 分支。
2. 在仓库打开 **Settings → Pages**，选择 **Deploy from a branch**，分支选 `main`，目录选 `/(root)`，保存。
3. 等 GitHub Pages 完成首次发布后，用仓库页面显示的站点链接访问。

CSS、脚本、数据和 Service Worker 都使用相对路径，支持 `https://用户名.github.io/仓库名/` 子路径。不需要写死仓库名。也可按需要把 `index.html` 所在目录改为 Pages 发布目录。

## 数据与限制

- 本地配置以 `classkit:v1:<站点目录>:<模块>` 分模块保存；无法访问浏览器存储时会提示。完整备份为 JSON；导入完整备份会替换当前浏览器的 ClassKit 数据，导入单个活动 JSON 会新增模板。
- 词库和配置通过 `data/words.json`、`data/config.json` 管理。可编辑后部署新版本；玩家在卧底模式里的词条会自动遮挡，但静态网页无法阻止设备截屏、拍照或旁观。
- 投票仅在一台设备上逐票录入，不提供跨设备实时同步。猜歌只播放主持人选择的本地音频；不上传、不持久化音频文件，刷新后需重新选择。
- 浏览器清除站点数据会删除本地配置。跨设备迁移请先导出、再导入 JSON 备份。
- 主要面向当前版本的 Chromium、Safari 和 Firefox。较老的微信内置浏览器若缺少 ES Modules、Service Worker 或 `structuredClone` 等 API，可能无法获得全部体验；Service Worker 不可用时仍可正常在线访问。

## 目录结构

```text
index.html          页面框架
styles.css          响应式样式和浅/深色主题
src/app.js          页面路由、工具交互与本地配置
src/core.js         随机分组、抽签、数字与卧底纯函数
src/store.js        分版本 LocalStorage 和备份导入导出
data/words.json     预设游戏词库
data/config.json    游戏内容与活动模板
sw.js               静态资源离线缓存
tests/core.test.js  无依赖逻辑测试
```

## 后续可扩展

新增题库或活动模板优先编辑 JSON；新增独立工具时，在 `src/app.js` 添加独立页面/处理器，并在首页分类中登记入口。若未来要做跨设备同步或多人实时投票，再单独设计可选服务端接口，现版本不会模拟这类能力。
