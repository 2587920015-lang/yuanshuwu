// ============================================
// app.js - 小元书屋 Web App（账号系统+人工审核）
// ============================================

(function() {
  'use strict';

  // ========== 全局状态 ==========
  var currentTab = 'bookstore';
  var currentBook = null;
  var currentChapters = [];
  var currentChapterIndex = 0;
  var readerSettings = { fontSize: 18, nightMode: false };
  var _statusCheckTimer = null;

  // ========== 暴露接口给 HTML onclick ==========
  window.App = {
    switchTab: switchTab,
    startReading: startReading,
    showPayment: showPayment,
    openAdmin: openAdmin
  };

  // ========== 初始化 ==========
  function init() {
    Store.init(function() {
      var user = Store.getCurrentUser();
      if (user) { showMainApp(user); }
      else { showAuth(); }
      var saved = Store.getReaderSettings();
      if (saved.fontSize) readerSettings.fontSize = saved.fontSize;
      if (saved.nightMode) readerSettings.nightMode = saved.nightMode;
    });
  }

  // ========== 登录/注册 ==========
  function showAuth() {
    document.getElementById('view-auth').classList.add('active');
    document.getElementById('top-nav').style.display = 'none';
    document.querySelectorAll('.view:not(#view-auth)').forEach(function(v) {
      v.classList.remove('active');
    });

    // 显示登录表单
    document.getElementById('auth-login-form').style.display = 'block';
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('login-error').textContent = '';
    document.getElementById('reg-error').textContent = '';
  }

  function showMainApp(user) {
    document.getElementById('view-auth').classList.remove('active');
    document.getElementById('top-nav').style.display = 'flex';
    document.getElementById('nav-username').textContent = user.username;

    if (user.isAdmin) {
      document.getElementById('nav-role').textContent = '管理员';
      document.getElementById('btn-admin').style.display = 'inline';
    } else {
      document.getElementById('nav-role').textContent = '';
      document.getElementById('btn-admin').style.display = 'none';
    }

    bindEvents();
    switchTab('bookstore');
    updateBookshelfBadge();
  }

  function bindEvents() {
    // 导航标签
    document.querySelectorAll('.nav-tab').forEach(function(tab) {
      tab.onclick = function() { switchTab(this.dataset.tab); };
    });

    // 退出登录
    document.getElementById('btn-logout').onclick = function() {
      if (confirm('确定退出登录？')) {
        Store.logout();
        stopStatusCheck();
        document.getElementById('nav-tabs').style.display = '';
        document.getElementById('nav-title').innerHTML = '<img src=\"images/logo.png\" style=\"width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:6px;\">小元书屋';
        showAuth();
      }
    };

    // 管理员入口
    document.getElementById('btn-admin').onclick = function() {
      openAdmin();
    };

    // 搜索
    var searchInput = document.getElementById('search-input');
    document.getElementById('search-btn').onclick = doSearch;
    searchInput.onkeydown = function(e) { if (e.key === 'Enter') doSearch(); };
    searchInput.oninput = function() { if (!this.value.trim()) doSearch(); };

    // 分类
    document.querySelectorAll('.cat-tag').forEach(function(tag) {
      tag.onclick = function() {
        document.querySelectorAll('.cat-tag').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        filterAndDisplay();
      };
    });

    // 支付弹窗
    bindPaymentEvents();
  }

  // 登录按钮
  document.getElementById('btn-login').addEventListener('click', function() {
    var username = document.getElementById('login-username').value.trim();
    var password = document.getElementById('login-password').value;
    var rememberMe = document.getElementById('remember-me').checked;
    var result = Store.login(username, password, rememberMe);
    if (result.ok) {
      document.getElementById('login-error').textContent = '';
      document.getElementById('login-username').value = '';
      document.getElementById('login-password').value = '';
      showMainApp(result.user);
    } else {
      document.getElementById('login-error').textContent = result.msg;
    }
  });

  // 注册按钮
  document.getElementById('btn-register').addEventListener('click', function() {
    var username = document.getElementById('reg-username').value.trim();
    var password = document.getElementById('reg-password').value;
    var password2 = document.getElementById('reg-password2').value;

    if (password !== password2) {
      document.getElementById('reg-error').textContent = '两次密码输入不一致';
      return;
    }
    var result = Store.register(username, password);
    if (result.ok) {
      document.getElementById('reg-error').textContent = '';
      document.getElementById('reg-username').value = '';
      document.getElementById('reg-password').value = '';
      document.getElementById('reg-password2').value = '';
      // 切换到登录
      document.getElementById('auth-login-form').style.display = 'block';
      document.getElementById('auth-register-form').style.display = 'none';
      document.getElementById('login-error').textContent = '注册成功，请登录';
      document.getElementById('login-username').value = username;
    } else {
      document.getElementById('reg-error').textContent = result.msg;
    }
  });

  // 切换登录/注册
  document.getElementById('link-to-register').addEventListener('click', function() {
    document.getElementById('auth-login-form').style.display = 'none';
    document.getElementById('auth-register-form').style.display = 'block';
    document.getElementById('reg-error').textContent = '';
  });
  document.getElementById('link-to-login').addEventListener('click', function() {
    document.getElementById('auth-login-form').style.display = 'block';
    document.getElementById('auth-register-form').style.display = 'none';
    document.getElementById('login-error').textContent = '';
  });

  // ========== 导航切换 ==========
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
    var at = document.querySelector('[data-tab="' + tab + '"]');
    if (at) at.classList.add('active');

    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    var view = document.getElementById('view-' + tab);
    if (view) view.classList.add('active');

    document.getElementById('nav-tabs').style.display = '';
    var logo = '<img src=\"images/logo.png\" style=\"width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:6px;\">';
    var titles = { bookstore: logo + '小元书屋', bookshelf: '📖 我的书架' };
    document.getElementById('nav-title').innerHTML = titles[tab] || logo + '小元书屋';
    document.getElementById('btn-admin').style.display =
      Store.isAdmin() ? 'inline' : 'none';

    if (tab === 'bookshelf') { renderBookshelf(); renderMyOrders(); }
    if (tab === 'bookstore') { renderBookstore(); window.scrollTo(0, 0); }

    // 退出阅读器
    var rv = document.getElementById('view-reader');
    if (rv.classList.contains('active')) { closeReader(); }
  }

  // ========== 书店 ==========
  function renderBookstore() {
    updateCustomCategoryTags();
    filterAndDisplay();
  }

  function filterAndDisplay() {
    var allBooks = Store.getAllBooks();
    if (allBooks.length === 0) {
      document.getElementById('book-list').innerHTML =
        '<div class="empty-state"><div class="empty-icon">📚</div><div class="empty-text">暂无书籍</div></div>';
      return;
    }
    var keyword = (document.getElementById('search-input').value || '').trim().toLowerCase();
    var activeCat = document.querySelector('.cat-tag.active');
    var cat = activeCat ? activeCat.dataset.cat : '全部';

    var filtered = allBooks.filter(function(book) {
      if (cat !== '全部' && book.category !== cat) return false;
      if (keyword) {
        return book.title.toLowerCase().indexOf(keyword) >= 0 ||
               book.author.toLowerCase().indexOf(keyword) >= 0;
      }
      return true;
    });

    displayBooks(filtered);
  }

  function doSearch() { filterAndDisplay(); }

  function displayBooks(books) {
    var container = document.getElementById('book-list');
    var empty = document.getElementById('bookstore-empty');
    if (!books || books.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    var user = Store.getCurrentUser();
    var html = '';
    books.forEach(function(book) {
      var bookId = book._id || book.id || '1';
      var purchased = Store.hasPurchased(bookId);
      var coverHtml = book.cover
        ? '<img src="' + book.cover + '" alt="封面">'
        : '<span style="font-size:32px">📕</span>';

      html += '<div class="book-item" data-book-id="' + bookId + '">';
      html += '<div class="book-cover">' + coverHtml + '</div>';
      html += '<div class="book-info">';
      html += '<div class="book-title">' + (purchased ? '✓ ' : '') + escHtml(book.title) + '</div>';
      html += '<div class="book-author">' + escHtml(book.author) + ' · 著</div>';
      html += '<div class="book-meta">';
      html += '<span class="book-cat">' + escHtml(book.category) + '</span>';
      html += '<span>' + formatNum(book.totalWords) + '字</span>';
      html += '<span>' + book.chapterCount + '章</span>';
      html += '</div>';
      html += '<div class="book-price-row">';
      html += '<span class="book-price">¥' + (book.price || '0.99') + '</span>';
      html += '<span class="book-sales">' + (purchased ? '已购买' : '已售' + (book.salesCount || 0)) + '</span>';
      html += '</div></div></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.book-item').forEach(function(item) {
      item.addEventListener('click', function() { showDetail(this.dataset.bookId); });
    });
  }

  // ========== 书籍详情 ==========
  function showDetail(bookId) {
    var book = Store.getAllBooks().find(function(b) { return (b._id||b.id) === bookId; });
    if (!book) return;
    currentBook = book;
    var purchased = Store.hasPurchased(bookId);

    loadChaptersForBook(currentBook, function() {
      var chapters = window.__CHAPTERS_DATA__ || [];
      currentChapters = chapters;

      var coverHtml = book.cover
        ? '<img src="' + book.cover + '" style="width:100%;height:100%;object-fit:cover" alt="封面">'
        : '📕';

      var previewCount = purchased ? chapters.length : Math.min(5, chapters.length);
      var chHtml = '';
      for (var i = 0; i < previewCount; i++) {
        var ch = chapters[i];
        chHtml += '<div class="chapter-preview-item">';
        chHtml += '<span class="chap-idx">' + (ch.index + 1) + '.</span>';
        chHtml += '<span class="chap-title">' + escHtml(ch.title) + '</span>';
        chHtml += '<span class="chap-words">' + formatNum(ch.wordCount) + '字</span></div>';
      }
      if (!purchased && chapters.length > 5) {
        chHtml += '<div class="chapter-locked">以上为部分章节预览，购买后可阅读全部' + chapters.length + '章</div>';
      }

      var html = '<div class="detail-header">';
      html += '<div class="detail-cover">' + coverHtml + '</div>';
      html += '<div class="detail-info">';
      html += '<div class="detail-title">' + escHtml(book.title) + '</div>';
      html += '<div class="detail-author">' + escHtml(book.author) + ' · 著</div>';
      html += '<div class="detail-tags">';
      html += '<span class="detail-tag">' + escHtml(book.category) + '</span>';
      html += '<span class="detail-tag">' + formatNum(book.totalWords) + '字</span>';
      html += '<span class="detail-tag">' + book.chapterCount + '章</span></div>';
      html += '<div class="detail-price-row"><span class="detail-price">¥' + (book.price || '0.99') + '</span></div>';
      html += '</div></div>';
      html += '<div class="detail-section"><h4>📖 简介</h4><div class="detail-desc">' + escHtml(book.description || '暂无简介') + '</div></div>';
      html += '<div class="detail-section"><h4>📑 目录（共' + chapters.length + '章）</h4>' + chHtml + '</div>';

      // 底部栏
      html += '<div class="detail-bottom">';
      if (purchased) {
        html += '<span class="purchased-label">✓ 已购买</span>';
        html += '<button class="btn-read" onclick="App.startReading()">开始阅读</button>';
      } else {
        html += '<span class="price-label">¥' + (book.price || '0.99') + '</span>';
        html += '<button class="btn-buy" style="width:auto" onclick="App.showPayment()">立即购买</button>';
      }
      html += '</div>';

      document.getElementById('detail-content').innerHTML = html;
      document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
      document.getElementById('view-detail').classList.add('active');
      document.getElementById('nav-tabs').style.display = 'none';
      document.getElementById('nav-title').innerHTML = '<span style="cursor:pointer" id="detail-back">← 返回</span> 书籍详情';
      document.getElementById('detail-back').onclick = function() {
        document.getElementById('nav-tabs').style.display = '';
        document.getElementById('nav-title').innerHTML = '<img src=\"images/logo.png\" style=\"width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:6px;\">小元书屋';
        switchTab('bookstore');
      };
    });
  }

  // ========== 支付（人工审核模式） ==========
  function bindPaymentEvents() {
    document.getElementById('modal-close').onclick = hidePayment;
    document.getElementById('modal-payment').onclick = function(e) {
      if (e.target === this) hidePayment();
    };
    document.getElementById('btn-paid').onclick = submitPaymentOrder;
    document.getElementById('btn-check-status').onclick = function() {
      checkOrderStatus();
    };
    document.getElementById('btn-close-pay').onclick = hidePayment;
  }

  function showPayment() {
    var book = currentBook;
    if (!book) return;
    var order = Store.createOrder((book._id || book.id || '1'), book.title, book.price || 0.99);
    if (!order) {
      alert('创建订单失败，请重新登录');
      return;
    }

    document.getElementById('pay-book-title').textContent = book.title;
    document.getElementById('pay-price').textContent = (book.price || '0.99');
    document.getElementById('pay-order-id').textContent = order.orderId;
    document.getElementById('btn-paid-price').textContent = (book.price || '0.99');
    document.getElementById('payment-step-1').style.display = 'block';
    document.getElementById('payment-step-2').style.display = 'none';
    document.getElementById('modal-payment').style.display = 'flex';

    // 存储当前订单号用于状态查询
    window._pendingOrderId = order.orderId;
  }

  function hidePayment() {
    document.getElementById('modal-payment').style.display = 'none';
  }

  function submitPaymentOrder() {
    var orderId = window._pendingOrderId;
    if (!orderId) return;

    // 追加支付时间戳到订单号
    var newOrderId = Store.stampOrderPaidTime(orderId);
    window._pendingOrderId = newOrderId || orderId;
    if (newOrderId) {
      document.getElementById('pay-order-id').textContent = newOrderId;
    }

    // 显示等待审核界面
    document.getElementById('payment-step-1').style.display = 'none';
    document.getElementById('payment-step-2').style.display = 'block';

    // 开始轮询
    startStatusCheck(window._pendingOrderId);
  }

  function startStatusCheck(orderId) {
    stopStatusCheck();
    _statusCheckTimer = setInterval(function() {
      checkOrderStatus();
    }, 5000); // 每5秒检查一次
  }

  function stopStatusCheck() {
    if (_statusCheckTimer) {
      clearInterval(_statusCheckTimer);
      _statusCheckTimer = null;
    }
  }

  function checkOrderStatus() {
    var orderId = window._pendingOrderId;
    if (!orderId) return;

    var orders = Store.getAllOrders();
    var order = orders.find(function(o) { return o.orderId === orderId; });

    if (!order) return;

    if (order.status === 'paid') {
      stopStatusCheck();
      hidePayment();
      alert('✅ 管理员已确认收款！\n《' + order.bookTitle + '》已加入您的书架。');
      updateBookshelfBadge();
      // 刷新当前视图
      if (currentTab === 'bookshelf') renderBookshelf();
    } else if (order.status === 'rejected') {
      stopStatusCheck();
      hidePayment();
      alert('❌ 订单未通过审核\n原因：' + (order.rejectReason || '支付信息不匹配'));
    }
  }

  // ========== 书架 ==========
  function renderBookshelf() {
    var purchases = Store.getUserPurchases();
    var grid = document.getElementById('shelf-grid');
    var empty = document.getElementById('shelf-empty');

    if (purchases.length === 0 || !purchases.some(function(p) { return p.status === 'paid'; })) {
      grid.innerHTML = '';
      empty.style.display = 'block';
      updateBookshelfBadge();
      return;
    }
    empty.style.display = 'none';

    var allBooks = Store.getAllBooks();
    var paidPurchases = purchases.filter(function(p) { return p.status === 'paid'; });
    var html = '';
    paidPurchases.forEach(function(p) {
      var book = allBooks.find(function(b) { return (b._id||b.id) === p.bookId; });
      var progress = Store.getProgress(p.bookId);
      var pct = 0, chInfo = '';
      if (progress && book) {
        pct = Math.round((progress.chapterIndex / book.chapterCount) * 100);
        chInfo = '已读' + (progress.chapterIndex + 1) + '/' + book.chapterCount + '章';
      }
      html += '<div class="shelf-item" data-book-id="' + p.bookId + '">';
      html += '<div class="shelf-cover-w">';
      html += '<div class="cover-placeholder">📕</div>';
      if (pct > 0) html += '<div class="shelf-progress-bar"><div class="shelf-progress-fill" style="width:' + pct + '%"></div></div>';
      html += '</div>';
      html += '<div class="shelf-info">';
      html += '<div class="shelf-title">' + (book ? escHtml(book.title) : '未知') + '</div>';
      html += '<div class="shelf-author">' + (book ? escHtml(book.author) : '') + '</div>';
      if (chInfo) html += '<div class="shelf-progress">' + chInfo + '</div>';
      html += '</div></div>';
    });
    grid.innerHTML = html;

    grid.querySelectorAll('.shelf-item').forEach(function(item) {
      item.onclick = function() {
        var bid = this.dataset.bookId;
        currentBook = Store.getAllBooks().find(function(b) { return (b._id||b.id) === bid; });
        if (!currentBook) return;
        var progress = Store.getProgress(bid);
        loadChaptersForBook(currentBook, function() {
          openReader(progress ? progress.chapterIndex : 0);
        });
      };
    });
    updateBookshelfBadge();
  }

  function renderMyOrders() {
    var orders = Store.getUserOrders();
    var title = document.getElementById('my-orders-title');
    var list = document.getElementById('my-orders-list');

    var pendingOrders = orders.filter(function(o) { return o.status === 'pending_verification'; });
    if (pendingOrders.length === 0) {
      title.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    title.style.display = 'block';
    var html = '';
    pendingOrders.forEach(function(o) {
      var statusText = { pending_verification: '⏳ 等待审核', paid: '✅ 已确认', rejected: '❌ 已拒绝' };
      html += '<div class="order-list-item">';
      html += '<div class="ol-info">';
      html += '<div class="ol-book">' + escHtml(o.bookTitle) + '</div>';
      html += '<div class="ol-meta">¥' + o.price + ' · ' + o.orderId + '</div>';
      html += '</div>';
      html += '<div class="ol-status pending">' + (statusText[o.status] || o.status) + '</div>';
      html += '</div>';
    });
    list.innerHTML = html;
  }

  function updateBookshelfBadge() {
    var purchases = Store.getUserPurchases();
    var count = purchases.filter(function(p) { return p.status === 'paid'; }).length;
    var badge = document.getElementById('badge-bookshelf');
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline'; }
    else { badge.style.display = 'none'; }
  }

  // ========== 开始阅读 ==========
  function startReading() {
    var book = currentBook;
    if (!book) return;
    var bid = book._id || book.id || '1';
    var progress = Store.getProgress(bid);
    var startIdx = 0;
    if (progress && progress.chapterIndex > 0) {
      if (confirm('从上次位置（第' + (progress.chapterIndex + 1) + '章）继续？点击取消从头开始。')) {
        startIdx = progress.chapterIndex;
      }
    }
    loadChaptersForBook(currentBook, function() {
      currentChapters = window.__CHAPTERS_DATA__ || [];
      openReader(startIdx);
    });
  }

  // ========== 阅读器 ==========
  function openReader(index) {
    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    var rv = document.getElementById('view-reader');
    rv.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (readerSettings.nightMode) {
      rv.classList.add('night');
      document.getElementById('btn-night').textContent = '☀️ 日间';
    }

    currentChapterIndex = index;
    loadChapterContent(index);
    bindReaderEvents();
    renderCatalog();
  }

  function closeReader() {
    document.getElementById('view-reader').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('nav-tabs').style.display = '';
    var logo = '<img src=\"images/logo.png\" style=\"width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:6px;\">';
    var titles = { bookstore: logo + '小元书屋', bookshelf: '📖 我的书架' };
    document.getElementById('nav-title').innerHTML = titles[currentTab] || logo + '小元书屋';
    switchTab(currentTab === 'detail' ? 'bookstore' : currentTab);
  }

  function loadChapterContent(index) {
    var chapters = window.__CHAPTERS_DATA__ || [];
    if (index < 0 || index >= chapters.length) return;
    var ch = chapters[index];
    document.getElementById('reader-loading').style.display = 'flex';
    document.getElementById('reader-chapter-name').textContent = ch.title;
    document.getElementById('reader-title').textContent = (currentBook ? currentBook.title : '');

    var paragraphs = ch.content.split('\n').map(function(p) { return p.trim(); }).filter(function(p) { return p.length > 0; });
    var html = '<div class="ch-title">' + escHtml(ch.title) + '</div>';
    html += '<div class="ch-body" style="font-size:' + readerSettings.fontSize + 'px">';
    paragraphs.forEach(function(p) { html += '<p>' + escHtml(p) + '</p>'; });
    html += '</div>';
    html += '<div class="chapter-end">' + (index < chapters.length - 1 ? '— 本章完 —' : '— 全书完 —') + '</div>';

    document.getElementById('reader-content').innerHTML = html;
    document.getElementById('reader-content').scrollTop = 0;
    document.getElementById('reader-loading').style.display = 'none';

    Store.saveProgress((currentBook._id||currentBook.id||'1'), index, 0);
    updateCatalogHighlight();
  }

  function bindReaderEvents() {
    document.getElementById('reader-back').onclick = closeReader;
    document.getElementById('btn-prev').onclick = function() {
      if (currentChapterIndex > 0) { currentChapterIndex--; loadChapterContent(currentChapterIndex); }
    };
    document.getElementById('btn-next').onclick = function() {
      var chs = window.__CHAPTERS_DATA__ || [];
      if (currentChapterIndex < chs.length - 1) { currentChapterIndex++; loadChapterContent(currentChapterIndex); }
    };
    document.getElementById('btn-font-minus').onclick = function() {
      readerSettings.fontSize = Math.max(14, readerSettings.fontSize - 2);
      Store.saveReaderSettings('fontSize', readerSettings.fontSize);
      loadChapterContent(currentChapterIndex);
    };
    document.getElementById('btn-font-plus').onclick = function() {
      readerSettings.fontSize = Math.min(28, readerSettings.fontSize + 2);
      Store.saveReaderSettings('fontSize', readerSettings.fontSize);
      loadChapterContent(currentChapterIndex);
    };
    document.getElementById('btn-night').onclick = function() {
      readerSettings.nightMode = !readerSettings.nightMode;
      Store.saveReaderSettings('nightMode', readerSettings.nightMode);
      var rv = document.getElementById('view-reader');
      if (readerSettings.nightMode) { rv.classList.add('night'); this.textContent = '☀️ 日间'; }
      else { rv.classList.remove('night'); this.textContent = '🌙 夜间'; }
    };
    document.getElementById('btn-catalog').onclick = function() { document.getElementById('catalog-overlay').classList.add('show'); };
    document.getElementById('catalog-overlay').onclick = function(e) { if (e.target === this) this.classList.remove('show'); };
    document.getElementById('catalog-close').onclick = function() { document.getElementById('catalog-overlay').classList.remove('show'); };

    var scrollTimer;
    document.getElementById('reader-content').addEventListener('scroll', function() {
      clearTimeout(scrollTimer);
      var self = this;
      scrollTimer = setTimeout(function() {
        Store.saveProgress((currentBook._id||currentBook.id||'1'), currentChapterIndex, self.scrollTop);
      }, 1000);
    });
  }

  function renderCatalog() {
    var chapters = window.__CHAPTERS_DATA__ || [];
    var html = '';
    chapters.forEach(function(ch) {
      var cls = (ch.index === currentChapterIndex) ? ' catalog-item current' : 'catalog-item';
      html += '<div class="' + cls + '" data-index="' + ch.index + '">';
      html += '<span class="ci">' + (ch.index + 1) + '.</span>';
      html += '<span class="ct">' + escHtml(ch.title) + '</span></div>';
    });
    var list = document.getElementById('catalog-list');
    list.innerHTML = html;
    list.querySelectorAll('.catalog-item').forEach(function(item) {
      item.onclick = function() {
        var idx = parseInt(this.dataset.index);
        currentChapterIndex = idx;
        loadChapterContent(idx);
        document.getElementById('catalog-overlay').classList.remove('show');
      };
    });
  }

  function updateCatalogHighlight() {
    document.querySelectorAll('#catalog-list .catalog-item').forEach(function(item) {
      if (parseInt(item.dataset.index) === currentChapterIndex) item.classList.add('current');
      else item.classList.remove('current');
    });
  }

  // 动态更新分类标签
  function updateCustomCategoryTags() {
    var books = Store.getAllBooks();
    var cats = ['全部'];
    var seen = { '全部': true };
    books.forEach(function(b) {
      if (b.category && !seen[b.category]) {
        seen[b.category] = true;
        cats.push(b.category);
      }
    });
    var html = '';
    cats.forEach(function(c) {
      html += '<span class="cat-tag' + (c === '全部' ? ' active' : '') + '" data-cat="' + c + '">' + c + '</span>';
    });
    document.getElementById('category-bar').innerHTML = html;
    document.querySelectorAll('.cat-tag').forEach(function(tag) {
      tag.onclick = function() {
        document.querySelectorAll('.cat-tag').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        filterAndDisplay();
      };
    });
  }

  // ========== 管理员面板 ==========
  function openAdmin() {
    if (!Store.isAdmin()) { alert('仅管理员可访问'); return; }

    document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
    document.getElementById('view-admin').classList.add('active');
    document.getElementById('nav-tabs').style.display = 'none';
    document.getElementById('nav-title').textContent = '🔐 管理面板';
    document.getElementById('btn-admin').style.display = 'none';

    // 返回按钮（每次进入重新绑定，确保生效）
    document.getElementById('admin-back').onclick = function() {
      document.getElementById('view-admin').classList.remove('active');
      document.getElementById('nav-tabs').style.display = '';
      document.getElementById('nav-title').innerHTML = '<img src=\"images/logo.png\" style=\"width:24px;height:24px;border-radius:4px;vertical-align:middle;margin-right:6px;\">小元书屋';
      document.getElementById('btn-admin').style.display = Store.isAdmin() ? 'inline' : 'none';
      switchTab('bookstore');
    };

    try {
      renderAdminPanel();
    } catch(e) {
      console.error('Admin panel error:', e);
      alert('管理面板加载出错：' + e.message);
    }
  }

  function renderAdminPanel() {
    var pendingOrders = Store.getPendingOrders();
    var allOrders = Store.getAllOrders();
    var processedOrders = allOrders.filter(function(o) { return o.status !== 'pending_verification'; });

    // 统计
    document.getElementById('stat-pending').textContent = pendingOrders.length;
    document.getElementById('stat-total').textContent = allOrders.length;
    var totalRev = allOrders.filter(function(o) { return o.status === 'paid'; })
      .reduce(function(sum, o) { return sum + (o.price || 0); }, 0);
    document.getElementById('stat-revenue').textContent = '¥' + totalRev.toFixed(2);

    // 待审核列表
    var pendingHtml = '';
    if (pendingOrders.length === 0) {
      document.getElementById('admin-empty').style.display = 'block';
    } else {
      document.getElementById('admin-empty').style.display = 'none';
      pendingOrders.forEach(function(o) {
        pendingHtml += '<div class="admin-order-item" data-order="' + o.orderId + '">';
        pendingHtml += '<div class="ao-header">';
        pendingHtml += '<div><div class="ao-book">📕 ' + escHtml(o.bookTitle) + '</div>';
        pendingHtml += '<div class="ao-user">👤 购买者：' + escHtml(o.username) + '</div></div>';
        pendingHtml += '<div style="font-weight:bold;color:#E74C3C">¥' + o.price + '</div></div>';
        pendingHtml += '<div class="ao-meta">📦 订单号：' + o.orderId + '</div>';
        pendingHtml += '<div class="ao-meta">🕐 ' + (o.createdAt ? new Date(o.createdAt).toLocaleString('zh-CN') : '') + '</div>';
        pendingHtml += '<div class="ao-actions">';
        pendingHtml += '<button class="btn-reject" data-action="reject" data-order="' + o.orderId + '">拒绝</button>';
        pendingHtml += '<button class="btn-approve" data-action="approve" data-order="' + o.orderId + '">✓ 确认收款</button>';
        pendingHtml += '</div></div>';
      });
    }
    document.getElementById('admin-pending-list').innerHTML = pendingHtml;

    // 已处理列表 - 显示完整订单详情
    document.querySelector('#view-admin .section-title:last-of-type').textContent =
      '📋 已审核订单（共' + processedOrders.length + '单）';
    var processedHtml = '';
    processedOrders.forEach(function(o) {
      var stClass = o.status === 'paid' ? 'paid' : 'rejected';
      var stText = o.status === 'paid' ? '✅ 已确认' : '❌ 已拒绝';
      var vTime = o.verifiedAt ? new Date(o.verifiedAt).toLocaleString('zh-CN') : '';
      processedHtml += '<div class="order-list-item" style="flex-direction:column;align-items:stretch;">';
      processedHtml += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      processedHtml += '<div class="ol-info">';
      processedHtml += '<div class="ol-book">📕 ' + escHtml(o.bookTitle) + '</div>';
      processedHtml += '<div class="ol-meta">👤 ' + escHtml(o.username) + ' · ¥' + o.price + '</div>';
      processedHtml += '</div>';
      processedHtml += '<div class="ol-status ' + stClass + '">' + stText + '</div>';
      processedHtml += '</div>';
      processedHtml += '<div style="font-size:11px;color:#bbb;margin-top:6px;padding-top:6px;border-top:1px solid #f5f5f5;">';
      processedHtml += '📦 订单号：<span style="color:#666;word-break:break-all;">' + escHtml(o.orderId) + '</span>';
      if (vTime) processedHtml += ' · 🕐 ' + vTime;
      if (o.verifiedBy) processedHtml += ' · 审核人：' + escHtml(o.verifiedBy);
      if (o.status === 'rejected' && o.rejectReason) processedHtml += ' · 原因：' + escHtml(o.rejectReason);
      processedHtml += '</div></div>';
    });
    document.getElementById('admin-processed-list').innerHTML = processedHtml;

    // 绑定按钮事件
    document.querySelectorAll('[data-action="approve"]').forEach(function(btn) {
      btn.onclick = function() {
        var orderId = this.dataset.order;
        var orders = Store.getAllOrders();
        var order = orders.find(function(o) { return o.orderId === orderId; });
        if (!order) { alert('错误：找不到该订单'); return; }
        if (order.status !== 'pending_verification') { alert('该订单已处理'); renderAdminPanel(); return; }
        if (!confirm('确认已收到 ' + escHtml(order.username) + ' 的 ¥' + order.price + ' 付款？\n《' + escHtml(order.bookTitle) + '》将加入用户书架。')) return;
        var result = Store.approveOrder(orderId);
        alert(result.msg);
        renderAdminPanel();
        updateBookshelfBadge();
      };
    });
    document.querySelectorAll('[data-action="reject"]').forEach(function(btn) {
      btn.onclick = function() {
        var orderId = this.dataset.order;
        var orders = Store.getAllOrders();
        var order = orders.find(function(o) { return o.orderId === orderId; });
        if (!order) { alert('错误：找不到该订单'); return; }
        var reason = prompt('拒绝原因（可选）：', '未收到付款记录');
        if (reason === null) return; // 用户点了取消
        var result = Store.rejectOrder(orderId, reason || '未收到付款');
        alert(result.msg);
        renderAdminPanel();
      };
    });

    // 导出数据
    document.getElementById('btn-export').onclick = function() {
      var json = Store.exportAll();
      var blob = new Blob([json], { type:'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'yuanshuwu-backup-' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    };

    // 导入数据
    document.getElementById('btn-import').onclick = function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          var result = Store.importAll(ev.target.result);
          if (result.ok) {
            alert('✅ 数据已导入并合并\n\n' + result.msg);
            renderAdminPanel();
            updateBookshelfBadge();
          } else {
            alert('❌ ' + result.msg);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    };

  }

  // ========== 章节加载（内置+自定义） ==========
  function loadChaptersForBook(book, callback) {
    if (book.source === 'custom') {
      currentChapters = Store.getCustomChapters(book.id || book._id);
      callback();
      return;
    }
    // 内置书籍：按bookId加载
    var bookId = book._id || book.id;
    if (bookId === '1') {
      // 二哈：懒加载 chapters_00.js ~ chapters_06.js
      loadChapterBatch('1', 7, callback);
    } else {
      // 新书：从 chapters_book_X.js 加载
      var key = '__CHAPTERS_' + bookId + '__';
      if (window[key]) {
        currentChapters = window[key];
        callback();
        return;
      }
      // 文件已通过script标签加载，等待一下
      var attempts = 0;
      var timer = setInterval(function() {
        attempts++;
        if (window[key]) {
          clearInterval(timer);
          currentChapters = window[key];
          callback();
        } else if (attempts > 20) {
          clearInterval(timer);
          currentChapters = [];
          callback();
        }
      }, 200);
    }
  }

  var _batchLoaded = {};
  function loadChapterBatch(bookId, totalFiles, callback) {
    if (_batchLoaded[bookId] && window.__CHAPTERS_DATA__ && window.__CHAPTERS_DATA__.length > 0) {
      currentChapters = window.__CHAPTERS_DATA__;
      callback(); return;
    }
    var loaded = 0;
    for (var i = 0; i < totalFiles; i++) {
      var num = (i < 10 ? '0' : '') + i;
      var script = document.createElement('script');
      script.src = 'data/chapters/chapters_' + num + '.js?v=2';
      script.onload = function() {
        loaded++;
        if (loaded >= totalFiles) {
          _batchLoaded[bookId] = true;
          var data = window.__CHAPTERS_DATA__ || [];
          data.sort(function(a, b) { return a.index - b.index; });
          currentChapters = data;
          callback();
        }
      };
      script.onerror = function() {
        loaded++;
        if (loaded >= totalFiles) { _batchLoaded[bookId] = true; callback(); }
      };
      document.body.appendChild(script);
    }
  }

  // ========== 工具函数 ==========
  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  function formatNum(num) {
    if (!num) return '0';
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ========== 启动 ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
