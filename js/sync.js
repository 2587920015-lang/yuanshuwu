// sync.js - Supabase 云端同步引擎
// 自动跨设备同步用户、订单、购买记录、阅读进度

var Sync = {
  _api: null,
  _enabled: false,
  _timer: null,
  _lastHash: '',

  // 初始化
  init: function(callback) {
    if (!window.SYNC_ENABLED) {
      console.log('💾 离线模式');
      if (callback) callback(false);
      return;
    }
    var cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || cfg.url.indexOf('你的项目') >= 0 || !cfg.key || cfg.key.indexOf('你的') >= 0) {
      console.log('💾 未配置Supabase，离线模式');
      if (callback) callback(false);
      return;
    }

    this._enabled = true;
    this._api = {
      url: cfg.url + '/rest/v1/sync_data',
      headers: {
        'apikey': cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    console.log('☁️ Supabase 云端同步已启用');

    // 首次：从云端拉取最新数据
    this.pull(callback);
  },

  // 推送本地数据到云端
  push: function() {
    if (!this._enabled) return;
    var self = this;
    var data = this._collectData();
    var hash = this._simpleHash(JSON.stringify(data));
    if (hash === this._lastHash) return; // 数据没变，跳过
    this._lastHash = hash;

    // Upsert: 有就更新，没有就创建
    fetch(this._api.url + '?id=eq.1', {
      method: 'PATCH',
      headers: this._api.headers,
      body: JSON.stringify({
        id: 1,
        data: JSON.stringify(data),
        updated_at: new Date().toISOString()
      })
    }).catch(function(e) {
      console.warn('同步推送失败:', e.message);
    });

    // 如果PATCH没匹配到记录，用POST创建
    fetch(this._api.url, {
      method: 'POST',
      headers: Object.assign({}, this._api.headers, { 'Prefer': 'resolution=ignore-duplicates' }),
      body: JSON.stringify({
        id: 1,
        data: JSON.stringify(data),
        updated_at: new Date().toISOString()
      })
    }).catch(function(){});
  },

  // 从云端拉取最新数据
  pull: function(callback) {
    if (!this._enabled) { if (callback) callback(false); return; }
    var self = this;
    fetch(this._api.url + '?id=eq.1&select=data,updated_at&limit=1', {
      headers: this._api.headers
    }).then(function(r) { return r.json(); })
    .then(function(rows) {
      if (rows && rows.length > 0 && rows[0].data) {
        try {
          var cloudData = JSON.parse(rows[0].data);
          self._applyData(cloudData);
          console.log('✅ 云端数据已同步 (' + (rows[0].updated_at || '') + ')');
          if (callback) callback(true);
        } catch(e) {
          console.warn('云端数据解析失败');
          if (callback) callback(false);
        }
      } else {
        // 云端没有数据，推送本地数据上去
        self.push();
        if (callback) callback(false);
      }
    }).catch(function(e) {
      console.warn('云端连接失败:', e.message);
      if (callback) callback(false);
    });
  },

  // 强制从云端刷新（管理面板用）
  forceRefresh: function(callback) {
    if (!this._enabled) {
      if (callback) callback(false);
      return;
    }
    this.pull(callback);
  },

  // 定时自动同步
  startAutoSync: function() {
    if (!this._enabled) return;
    var self = this;
    // 每10秒自动推送
    this._timer = setInterval(function() {
      self.push();
    }, 10000);
    // 每30秒自动拉取
    setInterval(function() {
      self.pull();
    }, 30000);
  },

  // 收集所有需要同步的数据
  _collectData: function() {
    var data = {
      users: localStorage.getItem('bs_users') || '[]',
      orders: localStorage.getItem('bs_orders') || '[]'
    };
    // 收集各用户的 purchases 和 progress
    data.purchases = {};
    data.progress = {};
    try {
      var users = JSON.parse(localStorage.getItem('bs_users') || '[]');
      users.forEach(function(u) {
        var p = localStorage.getItem('bs_purchases_' + u.username);
        if (p) data.purchases[u.username] = p;
        var pg = localStorage.getItem('bs_progress_' + u.username);
        if (pg) data.progress[u.username] = pg;
      });
    } catch(e) {}
    return data;
  },

  // 将云端数据写入 localStorage
  _applyData: function(cloud) {
    if (cloud.users) localStorage.setItem('bs_users', cloud.users);
    if (cloud.orders) localStorage.setItem('bs_orders', cloud.orders);
    if (cloud.purchases) {
      Object.keys(cloud.purchases).forEach(function(k) {
        localStorage.setItem('bs_purchases_' + k, cloud.purchases[k]);
      });
    }
    if (cloud.progress) {
      Object.keys(cloud.progress).forEach(function(k) {
        localStorage.setItem('bs_progress_' + k, cloud.progress[k]);
      });
    }
  },

  _simpleHash: function(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return h.toString();
  }
};
