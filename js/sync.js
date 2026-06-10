// sync.js - Supabase 云端同步引擎
var Sync = {
  _enabled: false,
  _timer: null,
  _lastHash: '',
  _cfg: null,
  _baseUrl: '',
  _headers: {},

  init: function(callback) {
    if (!window.SYNC_ENABLED) { console.log('[sync] 离线模式'); if (callback) callback(false); return; }
    var c = window.SUPABASE_CONFIG;
    if (!c || !c.url || c.url.indexOf('你的项目') >= 0) { console.log('[sync] 未配置'); if (callback) callback(false); return; }
    this._cfg = c;
    this._baseUrl = c.url + '/rest/v1/sync_data';
    this._headers = { 'apikey': c.key, 'Authorization': 'Bearer ' + c.key, 'Content-Type': 'application/json' };
    this._enabled = true;
    console.log('[sync] ☁️ Supabase已启用');
    this._pull(callback);
  },

  push: function() {
    if (!this._enabled) return;
    var data = this._collectData();
    var hash = this._hash(JSON.stringify(data));
    if (hash === this._lastHash) return;
    this._lastHash = hash;
    this._doPush(data);
  },

  _doPush: function(data) {
    var self = this;
    var body = { id: 1, data: JSON.stringify(data), updated_at: new Date().toISOString() };
    // 尝试更新 (upsert)
    fetch(this._baseUrl + '?id=eq.1', {
      method: 'PATCH',
      headers: Object.assign({}, this._headers, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify(body)
    }).then(function(r) {
      if (r.ok) return;
      // PATCH失败则POST创建
      return fetch(self._baseUrl, {
        method: 'POST',
        headers: self._headers,
        body: JSON.stringify(body)
      });
    }).catch(function(e) { console.warn('[sync] push err:', e.message); });
  },

  _pull: function(callback) {
    if (!this._enabled) { if (callback) callback(false); return; }
    var self = this;
    fetch(this._baseUrl + '?id=eq.1&select=data&limit=1', { headers: this._headers })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (rows && rows.length && rows[0].data) {
        var d = JSON.parse(rows[0].data);
        self._apply(d);
        console.log('[sync] ✅ 云端已同步');
        if (callback) callback(true);
      } else {
        self._doPush(self._collectData());
        if (callback) callback(false);
      }
    }).catch(function(e) { console.warn('[sync] pull err:', e.message); if (callback) callback(false); });
  },

  pull: function(cb) { this._pull(cb); },
  forceRefresh: function(cb) { this._pull(cb); },

  startAutoSync: function() {
    if (!this._enabled) return;
    var self = this;
    this._timer = setInterval(function() { self.push(); }, 5000);
    setInterval(function() { self._pull(); }, 15000);
  },

  _collectData: function() {
    var d = { users: localStorage.getItem('bs_users') || '[]', orders: localStorage.getItem('bs_orders') || '[]', purchases: {}, progress: {} };
    try {
      JSON.parse(localStorage.getItem('bs_users') || '[]').forEach(function(u) {
        d.purchases[u.username] = localStorage.getItem('bs_purchases_' + u.username) || '[]';
        d.progress[u.username] = localStorage.getItem('bs_progress_' + u.username) || '{}';
      });
    } catch(e) {}
    return d;
  },

  _apply: function(d) {
    if (d.users) localStorage.setItem('bs_users', d.users);
    if (d.orders) localStorage.setItem('bs_orders', d.orders);
    if (d.purchases) Object.keys(d.purchases).forEach(function(k) { localStorage.setItem('bs_purchases_' + k, d.purchases[k]); });
    if (d.progress) Object.keys(d.progress).forEach(function(k) { localStorage.setItem('bs_progress_' + k, d.progress[k]); });
  },

  _hash: function(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h.toString(); }
};
