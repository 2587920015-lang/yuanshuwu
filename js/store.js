// ============================================
// store.js - 数据管理（localStorage）
// 跨设备同步：通过管理面板导入/导出 JSON
// ============================================

var Store = {
  init: function(callback) {
    this._ensureDefaultAdmin();
    if (callback) callback();
  },

  // ========== 导入/导出（跨设备同步） ==========

  // 导出所有数据为JSON字符串
  exportAll: function() {
    var data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      users: this._getUsers(),
      orders: this._getOrders(),
      purchases: {},
      progress: {}
    };
    var users = this._getUsers();
    users.forEach(function(u) {
      data.purchases[u.username] = Store._getUserPurchases(u.username);
      data.progress[u.username] = Store._getUserProgress(u.username);
    });
    return JSON.stringify(data, null, 2);
  },

  // 导入数据（合并模式：新用户和订单会追加，已有用户不覆盖）
  importAll: function(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (!data.version || !data.users) {
        return { ok: false, msg: '无效的备份文件' };
      }

      // 合并用户（不覆盖已存在的用户密码）
      var existingUsers = this._getUsers();
      var existingMap = {};
      existingUsers.forEach(function(u) { existingMap[u.username] = u; });

      var newUsers = [];
      data.users.forEach(function(u) {
        if (!existingMap[u.username]) {
          newUsers.push(u); // 新用户直接加
        }
        // 已有用户保留原密码
      });
      var mergedUsers = existingUsers.concat(newUsers);
      this._saveUsers(mergedUsers);

      // 合并购买记录
      if (data.purchases) {
        Object.keys(data.purchases).forEach(function(uname) {
          var existing = Store._getUserPurchases(uname);
          var incoming = data.purchases[uname] || [];
          var merged = existing.concat(
            incoming.filter(function(ip) {
              return !existing.some(function(ep) { return ep.orderId === ip.orderId; });
            })
          );
          Store._saveUserPurchases(uname, merged);
        });
      }

      // 合并阅读进度（保留较新的）
      if (data.progress) {
        Object.keys(data.progress).forEach(function(uname) {
          var existing = Store._getUserProgress(uname) || {};
          var incoming = data.progress[uname] || {};
          Object.keys(incoming).forEach(function(bid) {
            if (!existing[bid] || (incoming[bid].updatedAt > existing[bid].updatedAt)) {
              existing[bid] = incoming[bid];
            }
          });
          Store._saveUserProgress(uname, existing);
        });
      }

      // 合并订单
      var existingOrders = this._getOrders();
      var orderIds = {};
      existingOrders.forEach(function(o) { orderIds[o.orderId] = true; });
      var newOrders = (data.orders || []).filter(function(o) { return !orderIds[o.orderId]; });
      this._saveOrders(existingOrders.concat(newOrders));

      return { ok: true, msg: '数据已合并' };
    } catch(e) {
      return { ok: false, msg: '文件格式错误: ' + e.message };
    }
  },

  // ========== 账号管理 ==========
  _hash: function(password) {
    var salt = 'bookstore_salt_2024';
    var str = salt + password + salt.split('').reverse().join('');
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i); hash = ((hash << 5) - hash) + ch; hash = hash & hash;
    }
    return 'bk_' + Math.abs(hash).toString(36);
  },

  register: function(username, password) {
    if (!username || !password) return { ok: false, msg: '用户名和密码不能为空' };
    if (username.length < 2) return { ok: false, msg: '用户名至少2个字符' };
    if (password.length < 4) return { ok: false, msg: '密码至少4个字符' };
    var users = this._getUsers();
    if (users.some(function(u) { return u.username === username; })) {
      return { ok: false, msg: '该用户名已被注册' };
    }
    users.push({ username: username, password: this._hash(password), isAdmin: false, createdAt: new Date().toISOString() });
    this._saveUsers(users);
    this._saveUserPurchases(username, []);
    this._saveUserProgress(username, {});
    return { ok: true, msg: '注册成功，请登录' };
  },

  login: function(username, password, rememberMe) {
    if (!username || !password) return { ok: false, msg: '请输入用户名和密码' };
    var users = this._getUsers();
    var hashed = this._hash(password);
    var user = users.find(function(u) { return u.username === username && u.password === hashed; });
    if (!user) return { ok: false, msg: '用户名或密码错误' };
    this._setCurrentUser(user);
    // 记住登录：勾选后下次打开无需重新登录
    if (rememberMe !== false) {
      localStorage.setItem('bs_remember', '1');
    } else {
      localStorage.removeItem('bs_remember');
    }
    return { ok: true, user: { username: user.username, isAdmin: user.isAdmin } };
  },

  // 检查是否需要自动登录
  shouldAutoLogin: function() {
    return localStorage.getItem('bs_remember') === '1' && this.getCurrentUser();
  },

  logout: function() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('bs_remember');
  },
  getCurrentUser: function() {
    try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch(e) { return null; }
  },
  isAdmin: function() {
    var user = this.getCurrentUser(); return user && user.isAdmin;
  },

  getUserPurchases: function(username) {
    var uname = username || (this.getCurrentUser() || {}).username;
    return uname ? this._getUserPurchases(uname) : [];
  },

  hasPurchased: function(bookId, username) {
    var uname = username || (this.getCurrentUser() || {}).username;
    if (!uname) return false;
    return this._getUserPurchases(uname).some(function(p) { return p.bookId === bookId && p.status === 'paid'; });
  },

  addPurchase: function(username, bookId, orderId, price, bookTitle) {
    var purchases = this._getUserPurchases(username);
    if (purchases.some(function(p) { return p.bookId === bookId && p.status === 'paid'; })) return false;
    purchases.push({ bookId: bookId, orderId: orderId, price: price, bookTitle: bookTitle, status: 'paid', purchasedAt: new Date().toISOString() });
    this._saveUserPurchases(username, purchases);
    return true;
  },

  createOrder: function(bookId, bookTitle, price) {
    var user = this.getCurrentUser(); if (!user) return null;
    var prefix = 'BK' + Math.random().toString(36).substring(2,6).toUpperCase();
    var orderId = prefix; // 支付时追加时间戳
    var order = { orderId:orderId, username:user.username, bookId:bookId, bookTitle:bookTitle, price:price, status:'pending_verification', createdAt:new Date().toISOString(), verifiedAt:null, verifiedBy:null };
    var orders = this._getOrders(); orders.unshift(order); this._saveOrders(orders);
    return order;
  },

  // 用户点击"我已支付"时调用，追加支付时间戳
  stampOrderPaidTime: function(orderId) {
    var orders = this._getOrders();
    var order = orders.find(function(o) { return o.orderId === orderId; });
    if (!order) return null;
    var now = new Date();
    var ts = '' + now.getFullYear() +
              ('0' + (now.getMonth()+1)).slice(-2) +
              ('0' + now.getDate()).slice(-2) +
              ('0' + now.getHours()).slice(-2) +
              ('0' + now.getMinutes()).slice(-2);
    var newOrderId = order.orderId + ts;
    order.orderId = newOrderId;
    order.paidAt = now.toISOString();
    this._saveOrders(orders);
    return newOrderId;
  },

  getPendingOrders: function() {
    return this._getOrders().filter(function(o) { return o.status === 'pending_verification'; });
  },
  getAllOrders: function() { return this._getOrders(); },
  getUserOrders: function(username) {
    var uname = username || (this.getCurrentUser() || {}).username;
    return this._getOrders().filter(function(o) { return o.username === uname; });
  },

  approveOrder: function(orderId) {
    var admin = this.getCurrentUser();
    if (!admin || !admin.isAdmin) return { ok:false, msg:'无权限' };
    var orders = this._getOrders();
    var order = orders.find(function(o) { return o.orderId === orderId; });
    if (!order) return { ok:false, msg:'订单不存在' };
    if (order.status !== 'pending_verification') return { ok:false, msg:'订单已处理' };
    order.status = 'paid'; order.verifiedAt = new Date().toISOString(); order.verifiedBy = admin.username;
    this._saveOrders(orders);
    this.addPurchase(order.username, order.bookId, order.orderId, order.price, order.bookTitle);
    return { ok:true, msg:'已确认，书籍已加入用户书架' };
  },

  rejectOrder: function(orderId, reason) {
    var admin = this.getCurrentUser();
    if (!admin || !admin.isAdmin) return { ok:false, msg:'无权限' };
    var orders = this._getOrders();
    var order = orders.find(function(o) { return o.orderId === orderId; });
    if (!order) return { ok:false, msg:'订单不存在' };
    order.status = 'rejected'; order.verifiedAt = new Date().toISOString(); order.verifiedBy = admin.username; order.rejectReason = reason || '支付信息不匹配';
    this._saveOrders(orders);
    return { ok:true, msg:'已拒绝' };
  },

  getProgress: function(bookId, username) {
    var uname = username || (this.getCurrentUser() || {}).username;
    if (!uname) return null;
    return (this._getUserProgress(uname) || {})[bookId] || null;
  },
  saveProgress: function(bookId, chapterIndex, scrollTop, username) {
    var uname = username || (this.getCurrentUser() || {}).username;
    if (!uname) return;
    var all = this._getUserProgress(uname) || {};
    all[bookId] = { chapterIndex:chapterIndex, scrollTop:scrollTop||0, updatedAt:Date.now() };
    this._saveUserProgress(uname, all);
  },
  getReaderSettings: function() {
    var uname = (this.getCurrentUser()||{}).username || 'guest';
    try { return JSON.parse(localStorage.getItem('readerSettings_'+uname) || '{}'); } catch(e) { return {}; }
  },
  saveReaderSettings: function(key, value) {
    var uname = (this.getCurrentUser()||{}).username || 'guest';
    var s = this.getReaderSettings(); s[key] = value;
    localStorage.setItem('readerSettings_'+uname, JSON.stringify(s));
  },

  // ========== 内部 ==========
  _getUsers: function() { try { return JSON.parse(localStorage.getItem('bs_users')||'[]'); } catch(e){ return []; } },
  _saveUsers: function(u) { localStorage.setItem('bs_users', JSON.stringify(u)); },
  _setCurrentUser: function(u) { localStorage.setItem('currentUser', JSON.stringify({ username:u.username, isAdmin:u.isAdmin||false })); },
  _getUserPurchases: function(n) { try { return JSON.parse(localStorage.getItem('bs_purchases_'+n)||'[]'); } catch(e){ return []; } },
  _saveUserPurchases: function(n,d) { localStorage.setItem('bs_purchases_'+n, JSON.stringify(d)); },
  _getUserProgress: function(n) { try { return JSON.parse(localStorage.getItem('bs_progress_'+n)||'{}'); } catch(e){ return {}; } },
  _saveUserProgress: function(n,d) { localStorage.setItem('bs_progress_'+n, JSON.stringify(d)); },
  _getOrders: function() { try { return JSON.parse(localStorage.getItem('bs_orders')||'[]'); } catch(e){ return []; } },
  _saveOrders: function(o) { localStorage.setItem('bs_orders', JSON.stringify(o)); },

  // ========== 自定义书籍管理 ==========
  getCustomBooks: function() {
    try { return JSON.parse(localStorage.getItem('bs_custom_books')||'[]'); } catch(e){ return []; }
  },
  saveCustomBook: function(book) {
    var books = this.getCustomBooks();
    books.push(book);
    localStorage.setItem('bs_custom_books', JSON.stringify(books));
  },
  deleteCustomBook: function(bookId) {
    var books = this.getCustomBooks().filter(function(b) { return b.id !== bookId; });
    localStorage.setItem('bs_custom_books', JSON.stringify(books));
    localStorage.removeItem('bs_custom_chapters_' + bookId);
  },
  getCustomChapters: function(bookId) {
    try { return JSON.parse(localStorage.getItem('bs_custom_chapters_'+bookId)||'[]'); } catch(e){ return []; }
  },
  saveCustomChapters: function(bookId, chapters) {
    localStorage.setItem('bs_custom_chapters_'+bookId, JSON.stringify(chapters));
  },
  // 获取所有书籍（4本内置 + 自定义）
  getAllBooks: function() {
    var books = [];
    if (window.__ALL_BOOKS__) {
      window.__ALL_BOOKS__.forEach(function(b) { books.push(b); });
    } else if (window.__BOOK_DATA__) {
      var b = window.__BOOK_DATA__;
      b.source = 'builtin';
      books.push(b);
    }
    this.getCustomBooks().forEach(function(b) {
      b.source = 'custom';
      books.push(b);
    });
    return books;
  },

  _ensureDefaultAdmin: function() {
    var u = this._getUsers();
    if (u.length === 0) {
      u.push({ username:'xzy', password:this._hash('123xzy'), isAdmin:true, createdAt:new Date().toISOString() });
      this._saveUsers(u); this._saveUserPurchases('xzy',[]); this._saveUserProgress('xzy',{});
    }
  }
};
