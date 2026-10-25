/* =========================================================
   EdgeOne Pages demo — 交互脚本（原生 JS，无依赖）
   - 滚动显现
   - 复制到剪贴板 + 轻提示
   - 导航高亮
   - 极光跟随指针（尊重 reduced-motion）
   ========================================================= */
(function () {
  'use strict';

  window.__demoReady = true;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- 1. 滚动显现 ---------- */
  var revealables = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!('IntersectionObserver' in window) || reduceMotion) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 2. 轻提示 ---------- */
  var toastEl = document.querySelector('[data-toast]');
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.classList.remove('is-on');
    }, 1900);
  }

  /* ---------- 3. 复制 ---------- */
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy') || '';
      var done = function (ok) {
        toast(ok ? '已复制：' + text : '复制失败，请手动选择文本');
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { done(true); },
          function () { done(legacyCopy(text)); }
        );
      } else {
        done(legacyCopy(text));
      }
    });
  });

  /* ---------- 4. 导航高亮 ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll('section[id]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));

  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          var active = link.getAttribute('href') === '#' + entry.target.id;
          link.style.color = active ? '#fff' : '';
          link.style.background = active ? 'rgba(255,255,255,.07)' : '';
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- 5. 极光轻微跟随指针 ---------- */
  var aurora = document.querySelector('.aurora');
  if (aurora && finePointer && !reduceMotion) {
    var raf = null;
    var curX = 0, curY = 0, tgtX = 0, tgtY = 0;

    window.addEventListener('pointermove', function (e) {
      tgtX = (e.clientX / window.innerWidth - 0.5) * 26;
      tgtY = (e.clientY / window.innerHeight - 0.5) * 18;
      if (raf === null) raf = window.requestAnimationFrame(tick);
    }, { passive: true });

    function tick() {
      curX += (tgtX - curX) * 0.06;
      curY += (tgtY - curY) * 0.06;
      aurora.style.transform = 'translate3d(' + curX.toFixed(2) + 'px,' + curY.toFixed(2) + 'px,0)';
      if (Math.abs(tgtX - curX) > 0.2 || Math.abs(tgtY - curY) > 0.2) {
        raf = window.requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    }
  }

  /* ---------- 6. 年份 ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ---------- 7. 后端接口 ---------- */
  var API = { status: '/api/status', messages: '/api/messages' };

  var statusList = document.querySelector('[data-status-list]');
  var statusRaw = document.querySelector('[data-status-raw]');
  var refreshBtn = document.querySelector('[data-status-refresh]');

  var guestForm = document.querySelector('[data-guest-form]');
  var guestList = document.querySelector('[data-guest-list]');
  var guestHint = document.querySelector('[data-form-hint]');
  var guestSubmit = document.querySelector('[data-guest-submit]');
  var kvTag = document.querySelector('[data-kv-tag]');
  var kvReady = false;

  function field(name) {
    return document.querySelector('[data-field="' + name + '"]');
  }

  function setField(name, text, state) {
    var el = field(name);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('is-ok', 'is-bad', 'is-pending');
    if (state) el.classList.add(state);
  }

  function setHint(text, state) {
    if (!guestHint) return;
    guestHint.textContent = text;
    guestHint.className = 'form-hint' + (state ? ' ' + state : '');
  }

  function timeUTC(iso) {
    var date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return date.toISOString().slice(11, 19) + ' UTC';
  }

  function ago(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 6e4) return '刚刚';
    if (diff < 36e5) return Math.floor(diff / 6e4) + ' 分钟前';
    if (diff < 864e5) return Math.floor(diff / 36e5) + ' 小时前';
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function loadStatus() {
    if (!statusList) return;
    setField('state', '检测中…', 'is-pending');

    var started = performance.now();
    fetch(API.status, { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var ms = Math.round(performance.now() - started);
        var edge = data.edge || {};

        setField('state', '在线', 'is-ok');
        setField('runtime', data.runtime || 'EdgeOne Pages Functions');
        setField('edge', edge.colo || edge.region || '未知');
        setField(
          'geo',
          [edge.city, edge.region, edge.country].filter(Boolean).join(' · ') || '未知'
        );
        setField('time', timeUTC(data.server && data.server.time));
        setField('latency', ms + ' ms');

        if (statusRaw) statusRaw.textContent = JSON.stringify(data, null, 2);
      })
      .catch(function () {
        setField('state', '函数未运行', 'is-bad');
        ['runtime', 'edge', 'geo', 'time', 'latency'].forEach(function (key) {
          setField(key, '—');
        });
        if (statusRaw) {
          statusRaw.textContent = '没有拿到 JSON。当前可能是纯静态预览：\n运行 npm run dev，或部署到 EdgeOne Pages 后再访问。';
        }
        setKvState(false, '接口不可用：本地纯静态预览不会执行 functions。运行 npm run dev 试试。');
      });
  }

  function setKvState(ready, message) {
    kvReady = ready;
    if (kvTag) {
      kvTag.textContent = ready ? 'KV 已连接' : 'KV 未绑定';
      kvTag.className = 'tag ' + (ready ? 'is-ok' : 'is-warn');
    }
    if (guestSubmit) {
      guestSubmit.disabled = !ready;
      guestSubmit.textContent = '发送';
    }
    var textarea = guestForm && guestForm.querySelector('textarea');
    var input = guestForm && guestForm.querySelector('input[name="name"]');
    if (textarea) textarea.disabled = !ready;
    if (input) input.disabled = !ready;

    if (message) setHint(message, ready ? 'is-ok' : 'is-bad');
    else setHint(ready ? '写入会落到 Pages KV，刷新后依然在。' : '');
  }

  function renderEmpty() {
    if (!guestList) return;
    guestList.innerHTML = '';
    var li = document.createElement('li');
    li.className = 'guest-empty';
    li.textContent = '还没有留言，来做第一个。';
    guestList.appendChild(li);
  }

  function renderMessages(items) {
    if (!guestList) return;
    guestList.innerHTML = '';

    if (!items || !items.length) {
      renderEmpty();
      return;
    }

    items.forEach(function (item) {
      var li = document.createElement('li');

      var head = document.createElement('div');
      head.className = 'guest-item-head';

      var name = document.createElement('span');
      name.className = 'guest-name';
      name.textContent = item.name || '匿名';

      var time = document.createElement('time');
      time.textContent = ago(item.at);

      var text = document.createElement('p');
      text.className = 'guest-text';
      text.textContent = item.content;

      head.appendChild(name);
      head.appendChild(time);
      li.appendChild(head);
      li.appendChild(text);
      guestList.appendChild(li);
    });
  }

  function loadMessages() {
    if (!guestList) return;

    fetch(API.messages, { cache: 'no-store', headers: { accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.kv) setKvState(true);
        else setKvState(false, data.hint || 'KV 尚未绑定，留言功能暂不可用。');
        renderMessages(data.messages);
      })
      .catch(function () {
        setKvState(false, '接口不可用：本地纯静态预览不会执行 functions。运行 npm run dev 试试。');
      });
  }

  if (guestForm) {
    guestForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!kvReady) return;

      var data = new FormData(guestForm);
      var content = String(data.get('content') || '').trim();
      var name = String(data.get('name') || '').trim();
      var textarea = guestForm.querySelector('textarea');

      if (!content) {
        setHint('写点内容再发送。', 'is-bad');
        if (textarea) textarea.focus();
        return;
      }

      if (guestSubmit) {
        guestSubmit.disabled = true;
        guestSubmit.textContent = '发送中…';
      }

      fetch(API.messages, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name, content: content }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            return { ok: res.ok, body: body };
          });
        })
        .then(function (result) {
          if (!result.ok || !result.body || !result.body.ok) {
            throw new Error((result.body && result.body.message) || '发送失败');
          }
          guestForm.reset();
          setHint('已写入 KV，刷新页面也还在。', 'is-ok');
          toast('留言已保存');
          loadMessages();
        })
        .catch(function (err) {
          setHint(err.message || '发送失败，请稍后再试。', 'is-bad');
        })
        .finally(function () {
          if (guestSubmit) {
            guestSubmit.disabled = !kvReady;
            guestSubmit.textContent = '发送';
          }
        });
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener('click', function () {
      loadStatus();
      loadMessages();
    });
  }

  if (statusList || guestList) {
    loadStatus();
    loadMessages();
  }
})();
