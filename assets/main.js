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
})();
