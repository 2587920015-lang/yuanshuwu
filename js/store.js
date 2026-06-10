// store.js - 云端后端（Supabase）+ localStorage缓存
var Store = {
  _ready: false,
  _cfg: function() {
    var c = window.SUPABASE_CONFIG || {};
    return { url: c.url || '', key: c.key || '' };
  },
  _api: function(table) {
    var c = this._cfg();
    return {
      base: c.url + '/rest/v1/' + table,
      headers: { 'apikey': c.key, 'Authorization': 'Bearer ' + c.key, 'Content-Type': 'application/json' }
    };
  },
  _online: function() { return window.SYNC_ENABLED && this._cfg().url && this._cfg().url.indexOf('你的项目') < 0; },

  // 初始化：从云端拉取全部数据
  init: function(cb) {
    var self = this;
    this._cacheInit();
    if (!this._online()) { console.log('[DB] 离线模式'); this._ready = true; if (cb) cb(); return; }

    var tables = ['users', 'orders', 'purchases', 'progress'];
    var done = 0;
    tables.forEach(function(t) {
      var api = self._api(t);
      fetch(api.base + '?limit=1000', { headers: api.headers })
      .then(function(r) { return r.json(); })
      .then(function(rows) {
        var key = { users: 'bs_users', orders: 'bs_orders', purchases: 'bs_purchases_all', progress: 'bs_progress_all' }[t];
        localStorage.setItem(key, JSON.stringify(rows));
      }).catch(function(e) { console.warn('[DB] pull ' + t + ' err:', e.message); })
      .finally(function() {
        done++; if (done >= tables.length) { self._ready = true; console.log('[DB] ☁️ 云端就绪'); if (cb) cb(); }
      });
    });
    // 30秒后超时
    setTimeout(function() { if (!self._ready) { self._ready = true; if (cb) cb(); } }, 5000);
  },

  _cacheInit: function() {
    if (!localStorage.getItem('bs_users')) localStorage.setItem('bs_users', '[]');
    if (!localStorage.getItem('bs_orders')) localStorage.setItem('bs_orders', '[]');
    if (!localStorage.getItem('bs_purchases_all')) localStorage.setItem('bs_purchases_all', '[]');
    if (!localStorage.getItem('bs_progress_all')) localStorage.setItem('bs_progress_all', '[]');
    this._ensureDefaultAdmin();
  },

  // ========== 用户 ==========
  _hash: function(pw) {
    var s = 'bookstore_salt_2024', r = s.split('').reverse().join(''), str = s + pw + r, h = 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
    return 'bk_' + Math.abs(h).toString(36);
  },

  register: function(username, password) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 4) return { ok: false, msg: '密码至少4个字符' };
    var users = this._all('bs_users');
    if (users.some(function(u) { return u.username === username; })) return { ok: false, msg: '该用户名已被注册' };
    var u = { username: username, password_hash: this._hash(password), is_admin: false, created_at: new Date().toISOString() };
    users.push(u);
    this._save('bs_users', users);

    if (this._online()) {
      var api = this._api('users');
      fetch(api.base, { method: 'POST', headers: api.headers, body: JSON.stringify(u) }).catch(function(){});
    }
    return { ok: true, msg: '注册成功，请登录' };
  },

  login: function(username, password, rememberMe) {
    if (!username || !password) return { ok: false, msg: '请输入用户名和密码' };
    var users = this._all('bs_users');
    var h = this._hash(password);
    var u = users.find(function(x) { return x.username === username && x.password_hash === h; });
    if (!u) return { ok: false, msg: '用户名或密码错误' };
    this._setCurrentUser(u);
    if (rememberMe !== false) localStorage.setItem('bs_remember', '1');
    else localStorage.removeItem('bs_remember');
    return { ok: true, user: { username: u.username, is_admin: u.is_admin } };
  },

  logout: function() { localStorage.removeItem('currentUser'); localStorage.removeItem('bs_remember'); },
  getCurrentUser: function() { try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { return null; } },
  isAdmin: function() { var u = this.getCurrentUser(); return u && u.is_admin; },
  _setCurrentUser: function(u) { localStorage.setItem('currentUser', JSON.stringify({ username: u.username, is_admin: u.is_admin || false })); },

  // ========== 购买 ==========
  getUserPurchases: function(uname) {
    var n = uname || (this.getCurrentUser() || {}).username; if (!n) return [];
    return this._all('bs_purchases_all').filter(function(p) { return p.username === n; });
  },

  hasPurchased: function(bookId, uname) {
    var n = uname || (this.getCurrentUser() || {}).username; if (!n) return false;
    return this._all('bs_purchases_all').some(function(p) { return p.book_id === bookId && p.username === n && p.status === 'paid'; });
  },

  // ========== 订单 ==========
  createOrder: function(bookId, bookTitle, price) {
    var user = this.getCurrentUser(); if (!user) return null;
    var oid = 'BK' + Math.random().toString(36).substring(2,6).toUpperCase();
    var order = { order_id: oid, username: user.username, book_id: bookId, book_title: bookTitle, price: price, status: 'pending_verification', created_at: new Date().toISOString(), verified_at: null, verified_by: null };
    var orders = this._all('bs_orders'); orders.unshift(order); this._save('bs_orders', orders);
    if (this._online()) { var api = this._api('orders'); fetch(api.base, { method: 'POST', headers: api.headers, body: JSON.stringify(order) }).catch(function(){}); }
    return order;
  },

  stampOrderPaidTime: function(orderId) {
    var orders = this._all('bs_orders');
    var o = orders.find(function(x) { return x.order_id === orderId; });
    if (!o) return null;
    var n = new Date();
    var ts = '' + n.getFullYear() + ('0'+(n.getMonth()+1)).slice(-2) + ('0'+n.getDate()).slice(-2) + ('0'+n.getHours()).slice(-2) + ('0'+n.getMinutes()).slice(-2);
    o.order_id = o.order_id + ts; o.paid_at = n.toISOString();
    this._save('bs_orders', orders);
    if (this._online()) {
      var api = this._api('orders');
      fetch(api.base + '?order_id=eq.' + encodeURIComponent(orderId), { method: 'PATCH', headers: api.headers, body: JSON.stringify(o) }).catch(function(){});
    }
    return o.order_id;
  },

  getPendingOrders: function() { return this._all('bs_orders').filter(function(o) { return o.status === 'pending_verification'; }); },
  getAllOrders: function() { return this._all('bs_orders'); },
  getUserOrders: function(uname) {
    var n = uname || (this.getCurrentUser() || {}).username;
    return this._all('bs_orders').filter(function(o) { return o.username === n; });
  },

  approveOrder: function(orderId, orderUsername) {
    var admin = this.getCurrentUser(); if (!admin || !admin.is_admin) return { ok: false, msg: '无权限' };
    var orders = this._all('bs_orders');
    var o = orders.find(function(x) { return x.order_id === orderId; });
    if (!o) return { ok: false, msg: '订单不存在' };
    if (o.status !== 'pending_verification') return { ok: false, msg: '已处理' };
    o.status = 'paid'; o.verified_at = new Date().toISOString(); o.verified_by = admin.username;
    this._save('bs_orders', orders);

    var uname = orderUsername || o.username;
    var p = { username: uname, book_id: o.book_id, order_id: o.order_id, price: o.price, book_title: o.book_title, status: 'paid', purchased_at: new Date().toISOString() };
    var purchases = this._all('bs_purchases_all'); purchases.push(p); this._save('bs_purchases_all', purchases);

    if (this._online()) {
      var apiO = this._api('orders');
      var apiP = this._api('purchases');
      fetch(apiO.base + '?order_id=eq.' + encodeURIComponent(orderId), { method: 'PATCH', headers: apiO.headers, body: JSON.stringify(o) }).catch(function(){});
      fetch(apiP.base, { method: 'POST', headers: apiP.headers, body: JSON.stringify(p) }).catch(function(){});
    }
    return { ok: true, msg: '已确认，书籍已加入书架' };
  },

  rejectOrder: function(orderId, reason) {
    var admin = this.getCurrentUser(); if (!admin || !admin.is_admin) return { ok: false, msg: '无权限' };
    var orders = this._all('bs_orders');
    var o = orders.find(function(x) { return x.order_id === orderId; });
    if (!o) return { ok: false, msg: '订单不存在' };
    o.status = 'rejected'; o.verified_at = new Date().toISOString(); o.verified_by = admin.username; o.reject_reason = reason || '未收到付款';
    this._save('bs_orders', orders);
    if (this._online()) {
      var api = this._api('orders');
      fetch(api.base + '?order_id=eq.' + encodeURIComponent(orderId), { method: 'PATCH', headers: api.headers, body: JSON.stringify(o) }).catch(function(){});
    }
    return { ok: true, msg: '已拒绝' };
  },

  // ========== 阅读进度 ==========
  getProgress: function(bookId, uname) {
    var n = uname || (this.getCurrentUser() || {}).username; if (!n) return null;
    return (this._all('bs_progress_all').find(function(p) { return p.username === n && p.book_id === bookId; })) || null;
  },
  saveProgress: function(bookId, chapterIndex, scrollTop, uname) {
    var n = uname || (this.getCurrentUser() || {}).username; if (!n) return;
    var all = this._all('bs_progress_all');
    var existing = all.findIndex(function(p) { return p.username === n && p.book_id === bookId; });
    var obj = { username: n, book_id: bookId, chapter_index: chapterIndex, scroll_top: scrollTop || 0, updated_at: new Date().toISOString() };
    if (existing >= 0) { all[existing] = obj; } else { all.push(obj); }
    this._save('bs_progress_all', all);
    if (this._online()) {
      var api = this._api('progress');
      fetch(api.base + '?username=eq.' + encodeURIComponent(n) + '&book_id=eq.' + encodeURIComponent(bookId), { method: 'PATCH', headers: api.headers, body: JSON.stringify(obj) }).catch(function(){
        fetch(api.base, { method: 'POST', headers: api.headers, body: JSON.stringify(obj) }).catch(function(){});
      });
    }
  },

  // ========== 阅读器设置（仅本地） ==========
  getReaderSettings: function() {
    var n = (this.getCurrentUser() || {}).username || 'guest';
    try { return JSON.parse(localStorage.getItem('rs_' + n) || '{}'); } catch(e) { return {}; }
  },
  saveReaderSettings: function(key, value) {
    var n = (this.getCurrentUser() || {}).username || 'guest';
    var s = this.getReaderSettings(); s[key] = value;
    localStorage.setItem('rs_' + n, JSON.stringify(s));
  },

  // ========== 书籍（不变） ==========
  getAllBooks: function() {
    var books = [];
    if (window.__ALL_BOOKS__) window.__ALL_BOOKS__.forEach(function(b) { books.push(b); });
    else if (window.__BOOK_DATA__) books.push(window.__BOOK_DATA__);
    return books;
  },

  // ========== 导入导出 ==========
  exportAll: function() {
    return JSON.stringify({
      version: 1, exportedAt: new Date().toISOString(),
      users: this._all('bs_users'), orders: this._all('bs_orders'),
      purchases: this._all('bs_purchases_all'), progress: this._all('bs_progress_all')
    }, null, 2);
  },
  importAll: function(jsonStr) {
    try {
      var d = JSON.parse(jsonStr);
      if (d.users) this._save('bs_users', d.users);
      if (d.orders) this._save('bs_orders', d.orders);
      if (d.purchases) this._save('bs_purchases_all', d.purchases);
      if (d.progress) this._save('bs_progress_all', d.progress);
      return { ok: true, msg: '导入成功' };
    } catch(e) { return { ok: false, msg: '格式错误' }; }
  },

  // 强制从云端刷新
  cloudRefresh: function(cb) {
    if (!this._online()) { if (cb) cb(false); return; }
    var self = this, tables = ['users', 'orders', 'purchases', 'progress'], done = 0;
    tables.forEach(function(t) {
      var api = self._api(t);
      fetch(api.base + '?limit=1000', { headers: api.headers })
      .then(function(r) { return r.json(); })
      .then(function(rows) {
        var key = { users: 'bs_users', orders: 'bs_orders', purchases: 'bs_purchases_all', progress: 'bs_progress_all' }[t];
        localStorage.setItem(key, JSON.stringify(rows));
      }).catch(function(e) { console.warn('[DB] refresh err:', e.message); })
      .finally(function() { done++; if (done >= tables.length) { console.log('[DB] ☁️ 刷新完成'); if (cb) cb(true); } });
    });
    setTimeout(function() { if (cb) cb(true); }, 5000);
  },

  // ========== 内部 ==========
  _all: function(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e) { return []; } },
  _save: function(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
  _ensureDefaultAdmin: function() {
    var u = this._all('bs_users');
    if (u.length === 0) {
      u.push({ username: 'xzy', password_hash: this._hash('123xzy'), is_admin: true, created_at: new Date().toISOString() });
      this._save('bs_users', u);
      if (this._online()) { var api = this._api('users'); fetch(api.base, { method: 'POST', headers: api.headers, body: JSON.stringify(u[0]) }).catch(function(){}); }
    }
  }
};
