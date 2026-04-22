# Snake

这是一个可直接发布到 GitHub Pages 的纯静态贪食蛇项目。

## 本地结构

- `index.html`：页面入口
- `styles.css`：页面样式
- `app.js`：游戏逻辑
- `requirements.md`：当前需求说明
- `.nojekyll`：GitHub Pages 静态资源直出标记

## 发布到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `snake`。
2. 将当前目录中的所有文件上传到仓库根目录。
3. 打开仓库设置：`Settings` -> `Pages`。
4. 在 `Build and deployment` 中选择：
   - `Source`：`Deploy from a branch`
   - `Branch`：`main`
   - `Folder`：`/ (root)`
5. 保存后等待 GitHub Pages 发布完成。

## 生成的访问地址

如果你的 GitHub 用户名是 `swjade`，仓库名是 `snake`，则外网链接通常是：

`https://swjade.github.io/snake/`

## 说明

- 这是纯前端静态项目，不需要后端服务。
- 修改后只需要重新提交并推送到 GitHub，Pages 会自动更新。
- 如果仓库名不是 `snake`，最终链接中的仓库名部分也会随之变化。
