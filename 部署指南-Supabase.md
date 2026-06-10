# Supabase 云端同步配置指南

配置后，不同手机/电脑打开网站数据自动同步。

---

## 第1步：注册 Supabase 账号

1. 打开浏览器，输入网址：**supabase.com** 然后回车
2. 页面右上角点黄色的 **「Start your project」** 按钮
3. 会跳转到登录页面，点下方的 **「Continue with GitHub」**
4. 如果没有 GitHub 账号：
   - 点 **「Sign up」** → 输入邮箱和密码 → 注册
   - 注册完回到 supabase.com 重新点 Start your project
5. 登录成功后看到欢迎页面

---

## 第2步：创建项目

1. 点 **「New project」** 按钮
2. 填写信息：

   | 字段 | 填什么 |
   |------|--------|
   | **Name** | `xiaoyuan` |
   | **Database Password** | 自己设一个密码，记下来（如 `Xiaoyuan123!`） |
   | **Region** | 选 **Northeast Asia (Tokyo)** |

3. 点绿色的 **「Create project」** 按钮
4. 等待 1-2 分钟，页面显示 "Project is ready" 就完成了

---

## 第3步：创建数据表（SQL）

1. 进入项目后，左侧菜单点击 **「SQL Editor」**（图标是 `</>` 这个）
2. 页面中间有个输入框，把下面这段代码**完整复制粘贴**进去：

```sql
-- 创建同步数据表
create table if not exists sync_data (
  id bigint primary key default 1,
  data text,
  updated_at timestamp default now()
);

-- 开启行级安全
alter table sync_data enable row level security;

-- 允许所有人读写
create policy "allow_all" on sync_data for all using (true);

-- 插入初始数据
insert into sync_data (id, data) values (1, '{}')
on conflict (id) do nothing;
```

3. 右下角点绿色的 **「Run」** 按钮
4. 看到 "Results" 下方显示 "Success" 就成功了

---

## 第4步：获取 API 密钥

1. 左侧菜单点 **「Settings」**（齿轮图标）
2. 在 Settings 的子菜单中点 **「API」**
3. 你会看到两个值：

   | 字段 | 位置 |
   |------|------|
   | **Project URL** | 页面顶部 `https://xxxxxxxxxxxx.supabase.co` |
   | **anon public key** | 下面一长串以 `eyJ` 开头的字符 |

4. **分别复制**这两个值，不要搞混

---

## 第5步：填入网站配置

1. 打开网站文件夹里的 `js\sync-config.js` 文件
2. 用记事本打开，把里面的内容改成这样：

```js
var SYNC_ENABLED = true;

var SUPABASE_CONFIG = {
  url: 'https://你的项目ID.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

替换说明：
- `url` 后面填第4步复制的 **Project URL**
- `key` 后面填第4步复制的 **anon public key**

3. 保存文件 → 关闭

---

## 第6步：重新部署

把整个 `bookstore-web` 文件夹重新上传到 Vercel/Gitee，刷新网页。

打开网页后按 **F12** 打开控制台，如果看到 `☁️ Supabase 云端同步已启用` 就说明成功了。

---

## 验证同步是否生效

1. 在**手机**上打开网站 → 注册一个买家账号 → 买一本书
2. 在**电脑**上打开同一网站 → 登录 `xzy` / `123xzy`
3. ⚙️ 管理面板 → 点 **☁️ 刷新**
4. 如果出现手机上的订单 → ✅ 同步成功

---

## 常见问题

**Q: 控制台显示"离线模式"？**

A: 检查 `sync-config.js` 里 `SYNC_ENABLED` 是不是 `true`，以及 `url` 和 `key` 有没有填对。

**Q: SQL 执行报错？**

A: 把代码分成两次执行：先执行 `create table` 那段，再执行后面的。

**Q: 免费额度够用吗？**

A: 免费版 500MB 数据库，够你用几年。
