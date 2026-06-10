# 元书屋 - GitHub Pages 部署指南

---

## 第1步：注册 GitHub

1. 打开 [github.com](https://github.com)
2. 点右上角 **Sign up**
3. 输入邮箱 → 设置密码 → 设置用户名（英文，如 `yuanshuwu`）
4. 验证邮箱 → 登录

---

## 第2步：创建仓库

1. 点右上角 **「+」** → **「New repository」**
2. 填写：
   - **Repository name**：`yuanshuwu`（仓库名）
   - **Description**：元书屋
   - 选 **Private**（私有）
3. 点 **「Create repository」**

---

## 第3步：上传文件

1. 在仓库页面点 **「uploading an existing file」**
2. 打开 `d:\VPN\Claude\bookstore-web` 文件夹
3. **全选所有文件和文件夹**，拖到网页上传区域
4. 提交信息填 `初始化网站`
5. 点 **「Commit changes」**

---

## 第4步：开启 GitHub Pages

1. 上传完回到仓库页面 → 点顶部 **「Settings」**
2. 左侧菜单 → **「Pages」**
3. **Branch** 下拉选 `main` → 点 **「Save」**
4. 等待 1-2 分钟 → 页面顶部出现网址：

   ```
   https://你的用户名.github.io/yuanshuwu
   ```

5. 点进去 → 看到登录页 → ✅ 部署成功

---

## 第5步：更新网站

以后改了文件：
1. 仓库页面 → 点 **「Add file」** → **「Upload files」**
2. 把改过的文件拖上去覆盖
3. 提交 → GitHub Pages 自动更新（等1-2分钟生效）

---

## 常见问题

**Q：Settings 里找不到 Pages？**

A：仓库必须是 Public（公开）才有 Pages。改为公开：Settings → 拉到最下面 → Change visibility → Make public

**Q：打开网址显示 404？**

A：等 1-2 分钟再刷新，GitHub 部署需要时间

**Q：国内能访问吗？**

A：GitHub Pages 国内偶尔慢但基本能打开。如果完全打不开就用 Gitee
