// Indigo Academy West admin panel.
// Editors sign in with a username and password (see auth.js); the site owner can also use a GitHub token.
// A static app (served at /admin/ by GitHub Pages) that edits content/*.json and assets/img/ in the
// GitHub repository through the GitHub API. Publishing makes one commit; the "Build site" workflow
// (.github/workflows/build.yml) then rebuilds docs/ and GitHub Pages serves the new version.
(function () {
  'use strict';

  // ---------- configuration ----------
  // On <owner>.github.io/<repo>/admin/ the repository is read from the address; elsewhere these defaults apply.
  var CFG = { owner: 'ademtkn', repo: 'indigoacademywest', branch: 'main' };
  var m = location.hostname.match(/^([\w-]+)\.github\.io$/);
  if (m && location.pathname.split('/')[1]) { CFG.owner = m[1]; CFG.repo = location.pathname.split('/')[1]; }
  var API = 'https://api.github.com';
  var SITE_URL = location.pathname.indexOf('/admin') >= 0 ? location.pathname.replace(/admin\/.*$/, '') : '../';
  var LANGS = ['en', 'ky', 'ru'];
  var LANG_TAG = { en: 'EN', ky: 'KG', ru: 'RU' };
  var FILES = { en: 'content/en.json', ky: 'content/ky.json', ru: 'content/ru.json', site: 'content/site.json', editors: 'content/editors.json' };
  var EMPTY_EDITORS = '{\n  "vault": null,\n  "editors": []\n}\n';
  var AUTH = window.ADMIN_AUTH;
  var IMG_ROOT = 'assets/img/';
  // Keys that hold the same value in every language: edited once, written to all three files
  var SHARED = ['icon', 'image'];
  // Technical keys that are never shown
  var HIDDEN = ['code', 'htmlLang', 'label', 'langName', 'ogLocale'];
  var BUILT_IN = ['home', 'about', 'primary', 'secondary', 'admissions', 'life', 'staff', 'news', 'contact'];
  var KEY_TOKEN = 'iaw-admin-token', KEY_AUTH = 'iaw-admin-auth', KEY_FAILS = 'iaw-admin-fails', KEY_UI = 'iaw-admin-ui';

  function store_(kind) {
    return {
      get: function (k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, v); } catch (e) {} },
      del: function (k) { try { window[kind].removeItem(k); } catch (e) {} },
    };
  }
  var store = store_('localStorage'), session = store_('sessionStorage');

  var I = window.ADMIN_I18N;
  var ICONS = {};
  var uiLang = store.get(KEY_UI) || (/^ky/.test(navigator.language) ? 'ky' : /^ru/.test(navigator.language) ? 'ru' : 'en');
  if (!I[uiLang]) uiLang = 'en';
  var T = function () { return I[uiLang]; };

  var S = {
    token: null, user: null,
    me: { mode: 'token', user: null, k: null },   // k: vault key (editor sign-in), user: { username, name, role }
    head: null,          // { commit, tree, date, message }
    blobs: {},           // repo path → blob sha (assets/img/* and content/*)
    orig: {},            // file key → JSON text as published
    data: {},            // file key → parsed, edited data
    uploads: {},         // repo path → { b64, url }
    deletes: {},         // repo path → true
    view: 'overview', page: 'home', editLang: 'en',
    thumbs: {},          // repo path → object URL
  };

  // ---------- small helpers ----------
  // Builds DOM nodes without innerHTML, so text typed by editors can never become markup.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { append(el, x); });
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function svgIcon(name, cls) {
    var span = h('span', { class: 'ico ' + (cls || ''), 'aria-hidden': 'true' });
    var d = ICONS[name] || UI_ICONS[name] || '';
    span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
    return span;
  }
  var UI_ICONS = {
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M3 3l18 18M10.6 6.2A10.5 10.5 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.3 7.5C3.7 9.2 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>', text: '<path d="M5 6h14M5 11h14M5 16h9"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>', people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.3 4 2.1 4.5 4.9"/>',
    school: '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11v5c3 2 7 2 10 0v-5"/>', check: '<path d="M5 12l5 5 9-10"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  };
  function get(obj, path) { return path.reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function set(obj, path, v) {
    var o = obj;
    for (var i = 0; i < path.length - 1; i++) { if (o[path[i]] == null) o[path[i]] = typeof path[i + 1] === 'number' ? [] : {}; o = o[path[i]]; }
    o[path[path.length - 1]] = v;
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function humanize(k) { return String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, function (c) { return c.toUpperCase(); }); }
  // Groups (objects, lists) prefer section names; single texts prefer field names
  function fieldLabel(k, group) { var a = T().fields[k], b = T().sections[k]; return (group ? b || a : a || b) || humanize(k); }
  function local(v) { return v == null ? '' : typeof v === 'string' ? v : v[uiLang] || v.en || ''; }
  function b64ToText(b64) {
    var bin = atob(b64.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function json(x) { return JSON.stringify(x, null, 2) + '\n'; }

  // ---------- GitHub API ----------
  function gh(method, path, body) {
    return fetch(API + path, {
      method: method,
      headers: { Authorization: 'Bearer ' + S.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.message || r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }
  var repoPath = function () { return '/repos/' + CFG.owner + '/' + CFG.repo; };

  function signIn(token) {
    S.token = token;
    return gh('GET', repoPath()).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) { var e = new Error('readOnly'); e.code = 'readOnly'; throw e; }
      return gh('GET', '/user').then(function (u) { S.user = u; }, function () { S.user = null; });
    }, function (e) {
      e.code = e.status === 401 ? 'bad' : e.status === 404 || e.status === 403 ? 'noRepo' : 'network';
      throw e;
    });
  }

  function loadAll() {
    return gh('GET', repoPath() + '/git/ref/heads/' + CFG.branch).then(function (ref) {
      return gh('GET', repoPath() + '/git/commits/' + ref.object.sha);
    }).then(function (c) {
      S.head = { commit: c.sha, tree: c.tree.sha, date: c.committer && c.committer.date, message: c.message };
      return gh('GET', repoPath() + '/git/trees/' + c.tree.sha + '?recursive=1');
    }).then(function (tree) {
      S.blobs = {};
      tree.tree.forEach(function (e) { if (e.type === 'blob') S.blobs[e.path] = e.sha; });
      return Promise.all(Object.keys(FILES).map(function (k) {
        // content/editors.json may not exist yet: start from an empty list
        var got = S.blobs[FILES[k]] ? gh('GET', repoPath() + '/git/blobs/' + S.blobs[FILES[k]]).then(function (b) { return b64ToText(b.content); })
          : Promise.resolve(k === 'editors' ? EMPTY_EDITORS : '{}\n');
        return got.then(function (text) { S.orig[k] = text; S.data[k] = JSON.parse(text); });
      }));
    }).then(function () {
      S.uploads = {}; S.deletes = {};
      return fetch('icons.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (x) { ICONS = x; }, function () {});
    });
  }

  function thumb(path) {
    if (S.uploads[path]) return Promise.resolve(S.uploads[path].url);
    if (S.thumbs[path]) return Promise.resolve(S.thumbs[path]);
    var sha = S.blobs[IMG_ROOT + path];
    if (!sha) return Promise.resolve(null);
    return gh('GET', repoPath() + '/git/blobs/' + sha).then(function (b) {
      var bin = atob(b.content.replace(/\s/g, '')), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: /\.png$/.test(path) ? 'image/png' : 'image/jpeg' }));
      S.thumbs[path] = url;
      return url;
    }, function () { return null; });
  }
  function imageExists(path) {
    if (!path) return false;
    if (S.uploads[path]) return true;
    return !!S.blobs[IMG_ROOT + path] && !S.deletes[path];
  }

  // ---------- change tracking ----------
  function changedFiles() {
    return Object.keys(FILES).filter(function (k) { return json(S.data[k]) !== S.orig[k]; });
  }
  function changeCount() {
    return changedFiles().length + Object.keys(S.uploads).length + Object.keys(S.deletes).length;
  }
  var dirtyTimer;
  function markDirty() {
    clearTimeout(dirtyTimer);
    dirtyTimer = setTimeout(updateBar, 150);
  }

  // ---------- images ----------
  // Downscales the chosen file in the browser and returns JPEG base64 (keeps the repository and the site light).
  function prepareImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          if (!blob) return reject(new Error('encode'));
          var fr = new FileReader();
          fr.onload = function () { resolve({ b64: String(fr.result).split(',')[1], url: URL.createObjectURL(blob) }); };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function pickImage(path, maxSide, done) {
    var input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      toast(T().images.busy);
      prepareImage(f, maxSide).then(function (res) {
        S.uploads[path] = res; delete S.deletes[path];
        markDirty(); toast(null);
        if (done) done();
      }, function () { toast(T().images.bad, 'error'); });
    });
    document.body.appendChild(input);
    input.click();
  }
  function removeImage(path) {
    if (S.uploads[path]) delete S.uploads[path];
    if (S.blobs[IMG_ROOT + path]) S.deletes[path] = true;
    markDirty();
  }
  // A photo frame with upload / replace / remove controls
  function photoBox(path, opts) {
    opts = opts || {};
    var frame = h('div', { class: 'photo-frame' + (opts.portrait ? ' is-portrait' : '') });
    var state = h('p', { class: 'photo-state' });
    var box = h('div', { class: 'photo-box' }, frame);
    function paint() {
      frame.textContent = '';
      state.textContent = S.uploads[path] ? T().images.pending : S.deletes[path] ? T().images.pendingDel : '';
      if (imageExists(path)) {
        thumb(path).then(function (url) { if (url) frame.appendChild(h('img', { src: url, alt: '', loading: 'lazy' })); });
      } else frame.appendChild(h('span', { class: 'photo-empty' }, svgIcon('photo'), h('span', { text: T().images.empty })));
      actions.textContent = '';
      actions.appendChild(h('button', { type: 'button', class: 'btn btn--small', onclick: function () { pickImage(path, opts.max || 1800, function () { paint(); if (opts.onChange) opts.onChange(); }); } },
        svgIcon('upload'), imageExists(path) ? T().images.replace : T().images.upload));
      if (imageExists(path)) actions.appendChild(h('button', { type: 'button', class: 'btn btn--small btn--quiet', onclick: function () { removeImage(path); paint(); if (opts.onChange) opts.onChange(); } }, svgIcon('trash'), T().images.remove));
    }
    var actions = h('div', { class: 'photo-actions' });
    box.appendChild(actions); box.appendChild(state);
    paint();
    return box;
  }

  // ---------- generic three-language editor ----------
  function langCols(render) {
    return h('div', { class: 'langs' }, LANGS.map(function (l) {
      return h('div', { class: 'lang-col', 'data-lang': l }, h('span', { class: 'lang-tag', title: T().langs[l] }, LANG_TAG[l]), render(l));
    }));
  }
  function autoGrow(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
  function textInput(l, path, id) {
    var v = get(S.data[l], path);
    var ta = h('textarea', { rows: 1, id: id + '-' + l, lang: l, value: v == null ? '' : v, spellcheck: 'true' });
    ta.addEventListener('input', function () { set(S.data[l], path, ta.value); autoGrow(ta); markDirty(); });
    requestAnimationFrame(function () { autoGrow(ta); });
    return ta;
  }
  var idSeq = 0;
  function textField(path, label) {
    var id = 'f' + (++idSeq);
    return h('div', { class: 'field' }, h('label', { class: 'field-label', for: id + '-' + uiLangCol() }, label), langCols(function (l) { return textInput(l, path, id); }));
  }
  function uiLangCol() { return LANGS.indexOf(uiLang) >= 0 ? uiLang : 'en'; }
  function setAll(path, v) { LANGS.forEach(function (l) { set(S.data[l], path, v); }); markDirty(); }

  function iconField(path) {
    var cur = get(S.data.en, path);
    var preview = svgIcon(cur, 'icon-preview');
    var sel = h('select', { onchange: function () { setAll(path, sel.value); preview.replaceWith(preview = svgIcon(sel.value, 'icon-preview')); } },
      Object.keys(ICONS).filter(function (n) { return ['menu', 'close', 'arrow'].indexOf(n) < 0; }).map(function (n) { return h('option', { value: n, selected: n === cur }, n); }));
    return h('div', { class: 'field field--inline' }, h('span', { class: 'field-label' }, T().content.icon), preview, sel);
  }
  function imageField(path, pageKey) {
    var cur = get(S.data.en, path);
    var target = cur || 'photos/pages/' + pageKey + '-' + Date.now().toString(36) + '.jpg';
    var box = photoBox(target, { onChange: function () { setAll(path, imageExists(target) ? target : ''); } });
    return h('div', { class: 'field' }, h('span', { class: 'field-label' }, T().fields.image), box);
  }

  // Item title for list cards: the first text of the item in the panel language
  function itemTitle(path, i) {
    var it = get(S.data[uiLangCol()], path.concat(i)) || get(S.data.en, path.concat(i));
    if (typeof it === 'string') return it;
    if (it && typeof it === 'object') {
      var keys = ['t', 'title', 'q', 'k', 'n', 'time', 'm'];
      for (var j = 0; j < keys.length; j++) if (it[keys[j]]) return it[keys[j]] + (keys[j] === 'n' && it.l ? ' — ' + it.l : '');
      var first = Object.keys(it).map(function (k) { return it[k]; }).filter(function (v) { return typeof v === 'string' && v; })[0];
      if (first) return first;
    }
    return T().content.item + ' ' + (i + 1);
  }
  // Empty copy of a list item: texts blank, shared values (icons) kept
  function blank(x, key) {
    if (typeof x === 'string') return SHARED.indexOf(key) >= 0 ? x : '';
    if (Array.isArray(x)) return [];
    if (x && typeof x === 'object') { var o = {}; Object.keys(x).forEach(function (k) { o[k] = k === 'image' ? '' : blank(x[k], k); }); return o; }
    return x;
  }
  var TEMPLATES = { sections: { eyebrow: '', title: '', body: '', image: '' } };

  function listOps(path, i, rerender) {
    function apply(fn) { LANGS.forEach(function (l) { var arr = get(S.data[l], path); if (!Array.isArray(arr)) set(S.data[l], path, arr = []); fn(arr, l); }); markDirty(); rerender(); }
    return h('div', { class: 'item-ops' },
      h('button', { type: 'button', class: 'icon-btn', title: T().content.up, 'aria-label': T().content.up, disabled: i === 0, onclick: function () { apply(function (a) { if (i > 0 && i < a.length) a.splice(i - 1, 0, a.splice(i, 1)[0]); }); } }, svgIcon('up')),
      h('button', { type: 'button', class: 'icon-btn', title: T().content.down, 'aria-label': T().content.down, disabled: i >= get(S.data.en, path).length - 1, onclick: function () { apply(function (a) { if (i < a.length - 1) a.splice(i + 1, 0, a.splice(i, 1)[0]); }); } }, svgIcon('down')),
      h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: T().content.remove, 'aria-label': T().content.remove, onclick: function () {
        confirmBox(T().content.removeConfirm, '', T().content.remove, function () { apply(function (a) { a.splice(i, 1); }); });
      } }, svgIcon('trash')));
  }
  function addButton(path, rerender) {
    return h('button', { type: 'button', class: 'btn btn--small btn--add', onclick: function () {
      var key = path[path.length - 1];
      LANGS.forEach(function (l) {
        var arr = get(S.data[l], path);
        if (!Array.isArray(arr)) set(S.data[l], path, arr = []);
        var tpl = TEMPLATES[key] ? clone(TEMPLATES[key]) : arr.length ? blank(clone(arr[0]), key) : '';
        if (typeof tpl === 'object' && arr.length) Object.keys(tpl).forEach(function (k) { if (SHARED.indexOf(k) >= 0 && k !== 'image') tpl[k] = get(S.data.en, path.concat(0, k)); });
        arr.push(tpl);
      });
      markDirty(); rerender();
    } }, svgIcon('plus'), T().content.add);
  }

  function editNode(path, pageKey, depth) {
    var key = path[path.length - 1];
    var ref = get(S.data.en, path);
    if (HIDDEN.indexOf(key) >= 0) return null;
    if (key === 'icon') return iconField(path);
    if (key === 'image') return imageField(path, pageKey);
    if (typeof ref === 'string' || ref == null) return textField(path, fieldLabel(key));
    if (Array.isArray(ref)) {
      var wrap = h('div', { class: 'list' });
      var render = function () {
        wrap.textContent = '';
        var arr = get(S.data.en, path) || [];
        wrap.appendChild(h('div', { class: 'list-head' }, h('h4', { text: fieldLabel(key, true) })));
        arr.forEach(function (it, i) {
          if (typeof it === 'string') {
            var id = 'f' + (++idSeq);
            wrap.appendChild(h('div', { class: 'list-row' }, h('span', { class: 'list-n', text: i + 1 }), langCols(function (l) { return textInput(l, path.concat(i), id); }), listOps(path, i, render)));
          } else {
            var card = h('details', { class: 'item', open: arr.length <= 4 || depth > 1 },
              h('summary', null, h('span', { class: 'item-n', text: i + 1 }), h('span', { class: 'item-title', text: itemTitle(path, i) }), listOps(path, i, render)),
              h('div', { class: 'item-body' }, Object.keys(it).map(function (k) { return editNode(path.concat(i, k), pageKey, depth + 1); })));
            wrap.appendChild(card);
          }
        });
        wrap.appendChild(addButton(path, render));
      };
      render();
      return wrap;
    }
    if (typeof ref === 'object') {
      var kids = Object.keys(ref).map(function (k) { return editNode(path.concat(k), pageKey, depth + 1); });
      if (depth === 0) return h('div', { class: 'node-root' }, kids);
      var Tag = depth === 1 ? 'section' : 'fieldset';
      return h(Tag, { class: depth === 1 ? 'block' : 'group' }, h(depth === 1 ? 'h3' : 'legend', { text: fieldLabel(key, true) }), kids);
    }
    return null;
  }

  // ---------- views ----------
  var views = {};

  views.overview = function (main) {
    var t = T();
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.overview.hello }), h('p', { class: 'lead', text: t.overview.lead })));
    var cards = h('div', { class: 'cards' }, ['menu', 'content', 'images', 'staff', 'school', 'editors'].map(function (v) {
      return h('button', { type: 'button', class: 'card', onclick: function () { go(v); } }, svgIcon(NAV_ICON[v], 'card-ico'), h('strong', { text: t.nav[v] }), h('span', { text: t.overview.cards[v] }));
    }));
    main.appendChild(cards);
    if (S.head) {
      var when = S.head.date ? new Date(S.head.date).toLocaleString(uiLang === 'ky' ? 'ky-KG' : uiLang === 'ru' ? 'ru-RU' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
      main.appendChild(h('div', { class: 'panel last' }, h('p', { class: 'eyebrow', text: t.overview.last }),
        h('p', null, h('strong', { text: when }), ' · ', S.head.message.split('\n')[0]),
        h('a', { href: 'https://github.com/' + CFG.owner + '/' + CFG.repo + '/commits/' + CFG.branch, target: '_blank', rel: 'noopener', class: 'link' }, t.overview.history, svgIcon('ext'))));
    }
  };

  views.menu = function (main) {
    var t = T(), site = S.data.site;
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.nav.menu }), h('p', { class: 'lead', text: t.menu.lead })));
    var list = h('ol', { class: 'menu-list' });
    function render() {
      list.textContent = '';
      site.pages.forEach(function (p, i) {
        var isHome = p.key === 'home';
        var shown = p.menu !== false;
        var id = 'm' + (++idSeq);
        var row = h('li', { class: 'menu-row' + (shown ? '' : ' is-hidden') },
          h('div', { class: 'menu-meta' },
            h('span', { class: 'menu-n', text: i + 1 }),
            h('div', null,
              h('strong', { text: local(navLabels(p.key)) || p.key }),
              h('span', { class: 'muted', text: (isHome ? t.menu.home : p.custom ? t.menu.custom : '') + (isHome || p.custom ? ' · ' : '') + p.file })),
            h('div', { class: 'menu-actions' },
              isHome ? null : h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: shown, onchange: function (e) { p.menu = e.target.checked; markDirty(); render(); } }), h('span', { text: t.menu.show })),
              h('button', { type: 'button', class: 'icon-btn', title: t.menu.up, 'aria-label': t.menu.up, disabled: i <= 1 || isHome, onclick: function () { site.pages.splice(i - 1, 0, site.pages.splice(i, 1)[0]); markDirty(); render(); } }, svgIcon('up')),
              h('button', { type: 'button', class: 'icon-btn', title: t.menu.down, 'aria-label': t.menu.down, disabled: isHome || i === site.pages.length - 1, onclick: function () { site.pages.splice(i + 1, 0, site.pages.splice(i, 1)[0]); markDirty(); render(); } }, svgIcon('down')),
              h('button', { type: 'button', class: 'btn btn--small btn--quiet', onclick: function () { S.page = p.key; go('content'); } }, svgIcon('text'), t.menu.edit),
              p.custom ? h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: t.menu.del, 'aria-label': t.menu.del, onclick: function () { deletePage(p, render); } }, svgIcon('trash')) : null)),
          h('div', { class: 'langs langs--compact' }, LANGS.map(function (l) {
            var inp = h('input', { type: 'text', id: id + '-' + l, lang: l, value: S.data[l].nav[p.key] || '', 'aria-label': t.langs[l] });
            inp.addEventListener('input', function () { S.data[l].nav[p.key] = inp.value; markDirty(); });
            return h('div', { class: 'lang-col', 'data-lang': l }, h('span', { class: 'lang-tag' }, LANG_TAG[l]), inp);
          })));
        list.appendChild(row);
      });
    }
    render();
    main.appendChild(list);
    main.appendChild(addPageForm(render));
  };
  function navLabels(key) { var o = {}; LANGS.forEach(function (l) { o[l] = S.data[l].nav[key]; }); return o; }

  function addPageForm(after) {
    var t = T().menu;
    var form = h('form', { class: 'panel add-page', novalidate: true });
    var slug = h('input', { type: 'text', id: 'new-slug', placeholder: t.slugPh, autocomplete: 'off', spellcheck: 'false' });
    var titles = {};
    var err = h('p', { class: 'form-error', role: 'alert' });
    form.appendChild(h('h2', { text: t.add }));
    form.appendChild(h('p', { class: 'muted', text: t.addLead }));
    form.appendChild(h('label', { for: 'new-slug', class: 'field-label' }, t.slug));
    form.appendChild(slug);
    form.appendChild(h('span', { class: 'field-label' }, t.pageTitle));
    form.appendChild(h('div', { class: 'langs langs--compact' }, LANGS.map(function (l) {
      titles[l] = h('input', { type: 'text', id: 'new-title-' + l, lang: l, 'aria-label': T().langs[l] });
      return h('div', { class: 'lang-col', 'data-lang': l }, h('span', { class: 'lang-tag' }, LANG_TAG[l]), titles[l]);
    })));
    form.appendChild(err);
    form.appendChild(h('button', { type: 'submit', class: 'btn btn--primary' }, svgIcon('plus'), t.create));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = slug.value.trim().toLowerCase();
      var key = s.replace(/-/g, '_');
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(s)) { err.textContent = t.slugBad; return; }
      var taken = S.data.site.pages.some(function (p) { return p.key === key || p.file === s + '.html'; }) || key in S.data.en || ['index', 'admin', 'assets'].indexOf(s) >= 0;
      if (taken) { err.textContent = t.slugTaken; return; }
      if (LANGS.some(function (l) { return !titles[l].value.trim(); })) { err.textContent = t.titleNeeded; return; }
      LANGS.forEach(function (l) {
        var title = titles[l].value.trim();
        S.data[l].nav[key] = title;
        S.data[l][key] = { title: title, descr: '', lead: '', sections: [{ eyebrow: '', title: '', body: '', image: '' }] };
      });
      var at = S.data.site.pages.findIndex(function (p) { return p.key === 'contact'; });
      S.data.site.pages.splice(at < 0 ? S.data.site.pages.length : at, 0, { key: key, file: s + '.html', menu: true, custom: true });
      slug.value = ''; LANGS.forEach(function (l) { titles[l].value = ''; }); err.textContent = '';
      markDirty(); after();
      S.page = key; go('content');
    });
    return form;
  }
  function deletePage(p, after) {
    confirmBox(T().menu.delConfirm(local(navLabels(p.key))), '', T().menu.del, function () {
      // remove the page's own photos too
      (get(S.data.en, [p.key, 'sections']) || []).forEach(function (s) { if (s.image) removeImage(s.image); });
      S.data.site.pages = S.data.site.pages.filter(function (x) { return x !== p; });
      LANGS.forEach(function (l) { delete S.data[l][p.key]; delete S.data[l].nav[p.key]; });
      markDirty(); after();
    });
  }

  views.content = function (main) {
    var t = T();
    var choices = S.data.site.pages.map(function (p) { return { key: p.key, label: local(navLabels(p.key)) || p.key }; })
      .concat([{ key: '_general', label: t.content.general }, { key: '_ai', label: t.content.assistant }, { key: '_root', label: t.content.chooser }]);
    if (!choices.some(function (c) { return c.key === S.page; })) S.page = 'home';
    var sel = h('select', { id: 'page-pick', onchange: function () { S.page = sel.value; go('content'); } },
      choices.map(function (c) { return h('option', { value: c.key, selected: c.key === S.page }, c.label); }));
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.nav.content }), h('p', { class: 'lead', text: t.content.lead }),
      h('div', { class: 'picker' }, h('label', { for: 'page-pick', class: 'field-label' }, t.content.pick), sel)));
    main.appendChild(langTabs());
    var roots = S.page === '_general' ? ['brand', 'common', 'nav'] : S.page === '_ai' ? ['ai'] : S.page === '_root' ? ['root'] : null;
    var body = h('div', { class: 'editor' });
    if (roots) roots.forEach(function (r) { body.appendChild(editNode([r], r, 1)); });
    else body.appendChild(editNode([S.page], S.page, 0));
    main.appendChild(body);
  };

  views.images = function (main) {
    var t = T();
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.nav.images }), h('p', { class: 'lead', text: t.images.lead }), h('p', { class: 'muted', text: t.images.staffNote })));
    var byPage = {};
    S.data.site.photos.forEach(function (ph) { (byPage[ph.page] = byPage[ph.page] || []).push(ph); });
    S.data.site.pages.forEach(function (p) {
      var slots = (byPage[p.key] || []).map(function (ph) { return { file: ph.file, label: local(ph.label) }; });
      if (p.custom) (get(S.data.en, [p.key, 'sections']) || []).forEach(function (sec, i) {
        if (sec.image) slots.push({ file: sec.image, label: (local({ en: get(S.data.en, [p.key, 'sections', i, 'title']), ky: get(S.data.ky, [p.key, 'sections', i, 'title']), ru: get(S.data.ru, [p.key, 'sections', i, 'title']) }) || T().content.item + ' ' + (i + 1)) });
      });
      if (!slots.length) return;
      main.appendChild(h('section', { class: 'block' }, h('h3', { text: local(navLabels(p.key)) || p.key }),
        h('div', { class: 'photo-grid' }, slots.map(function (s) { return h('figure', { class: 'photo-card' }, photoBox(s.file), h('figcaption', { text: s.label })); }))));
    });
  };

  views.staff = function (main) {
    var t = T(), site = S.data.site;
    var depts = S.data[uiLangCol()].staff.depts;
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.nav.staff }), h('p', { class: 'lead', text: t.staff.lead }), h('p', { class: 'muted', text: t.staff.deptHint })));
    main.appendChild(langTabs());
    var list = h('ol', { class: 'staff-list' });
    function render() {
      list.textContent = '';
      site.staff.forEach(function (p, i) {
        var id = 's' + (++idSeq);
        var deptSel = h('select', { id: id + '-dept', onchange: function () { p.dept = deptSel.value; markDirty(); } },
          Object.keys(depts).map(function (d) { return h('option', { value: d, selected: d === p.dept }, depts[d]); }));
        var person = function (field) {
          return langCols(function (l) {
            var inp = h('input', { type: 'text', lang: l, id: id + '-' + field + '-' + l, value: (p[field] && p[field][l]) || '', 'aria-label': T().staff[field] + ' (' + T().langs[l] + ')' });
            inp.addEventListener('input', function () { p[field] = p[field] || {}; p[field][l] = inp.value; markDirty(); });
            return inp;
          });
        };
        list.appendChild(h('li', { class: 'staff-row' },
          h('div', { class: 'staff-photo' }, photoBox(p.photo, { portrait: true, max: 1000 })),
          h('div', { class: 'staff-fields' },
            h('div', { class: 'staff-top' },
              h('strong', { text: local(p.name) || T().staff.noName }),
              h('div', { class: 'item-ops' },
                h('button', { type: 'button', class: 'icon-btn', title: t.content.up, 'aria-label': t.content.up, disabled: i === 0, onclick: function () { site.staff.splice(i - 1, 0, site.staff.splice(i, 1)[0]); markDirty(); render(); } }, svgIcon('up')),
                h('button', { type: 'button', class: 'icon-btn', title: t.content.down, 'aria-label': t.content.down, disabled: i === site.staff.length - 1, onclick: function () { site.staff.splice(i + 1, 0, site.staff.splice(i, 1)[0]); markDirty(); render(); } }, svgIcon('down')),
                h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: t.staff.del, 'aria-label': t.staff.del, onclick: function () {
                  confirmBox(t.staff.delConfirm(local(p.name)), '', t.staff.del, function () { removeImage(p.photo); site.staff.splice(i, 1); markDirty(); render(); });
                } }, svgIcon('trash')))),
            h('div', { class: 'field field--inline' }, h('label', { for: id + '-dept', class: 'field-label' }, t.staff.dept), deptSel),
            h('div', { class: 'field' }, h('span', { class: 'field-label' }, t.staff.name), person('name')),
            h('div', { class: 'field' }, h('span', { class: 'field-label' }, t.staff.role), person('role')))));
      });
    }
    render();
    main.appendChild(list);
    main.appendChild(h('button', { type: 'button', class: 'btn btn--primary', onclick: function () {
      var nid = 'p' + Date.now().toString(36);
      site.staff.push({ id: nid, dept: Object.keys(depts)[0], name: { en: '', ky: '', ru: '' }, role: { en: '', ky: '', ru: '' }, photo: 'staff/' + nid + '.jpg' });
      markDirty(); render();
      list.lastChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } }, svgIcon('plus'), t.staff.add));
  };

  views.school = function (main) {
    var t = T(), sc = S.data.site.school;
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: t.nav.school }), h('p', { class: 'lead', text: t.school.lead })));
    function plain(key, label, type) {
      var id = 'sc-' + key;
      var inp = h('input', { type: type || 'text', id: id, value: sc[key] || '', spellcheck: 'false' });
      inp.addEventListener('input', function () { sc[key] = key === 'whatsapp' ? inp.value.replace(/\D/g, '') : inp.value.trim(); markDirty(); });
      return h('div', { class: 'field' }, h('label', { for: id, class: 'field-label' }, label), inp);
    }
    var phones = h('div', { class: 'list' });
    function renderPhones() {
      phones.textContent = '';
      phones.appendChild(h('div', { class: 'list-head' }, h('h4', { text: t.school.phones })));
      sc.phones.forEach(function (p, i) {
        var inp = h('input', { type: 'tel', id: 'sc-phone-' + i, value: p.label, 'aria-label': t.school.phone + ' ' + (i + 1) });
        inp.addEventListener('input', function () { p.label = inp.value.trim(); p.tel = '+' + inp.value.replace(/\D/g, ''); markDirty(); });
        phones.appendChild(h('div', { class: 'list-row' }, h('span', { class: 'list-n', text: i + 1 }), inp,
          h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: T().content.remove, 'aria-label': T().content.remove, disabled: sc.phones.length < 2, onclick: function () { sc.phones.splice(i, 1); markDirty(); renderPhones(); } }, svgIcon('trash'))));
      });
      phones.appendChild(h('button', { type: 'button', class: 'btn btn--small btn--add', onclick: function () { sc.phones.push({ label: '+996 ', tel: '+996' }); markDirty(); renderPhones(); } }, svgIcon('plus'), t.school.addPhone));
    }
    renderPhones();
    main.appendChild(h('section', { class: 'block' }, h('h3', { text: t.nav.school }), phones,
      plain('whatsapp', t.school.whatsapp, 'tel'), plain('instagram', t.school.instagram, 'url'), plain('handle', t.school.handle), plain('map', t.school.map, 'url'), plain('network', t.school.network, 'url')));
    main.appendChild(langTabs());
    main.appendChild(h('section', { class: 'block' }, h('h3', { text: t.school.address }),
      ['address', 'addressShort', 'hoursVal'].map(function (k) { return textField(['common', k], fieldLabel(k)); })));
    main.appendChild(h('details', { class: 'block advanced' }, h('summary', null, h('h3', { text: t.school.advanced })),
      plain('url', t.school.url, 'url'), plain('customDomain', t.school.customDomain), plain('aiEndpoint', t.school.aiEndpoint, 'url')));
  };

  // On narrow screens only one language column is shown at a time; these tabs switch it.
  function langTabs() {
    return h('div', { class: 'lang-tabs', role: 'tablist' }, LANGS.map(function (l) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.editLang === l), onclick: function () {
        S.editLang = l; document.documentElement.dataset.editLang = l;
        document.querySelectorAll('.lang-tabs [role=tab]').forEach(function (b, i) { b.setAttribute('aria-selected', String(LANGS[i % 3] === l)); });
      } }, h('b', { text: LANG_TAG[l] }), ' ', T().langs[l]);
    }));
  }

  // ---------- publish ----------
  function publish() {
    var t = T().publish;
    if (!changeCount()) { toast(t.nothing); return; }
    var missing = S.data.site.pages.some(function (p) { return p.menu !== false && LANGS.some(function (l) { return !String(S.data[l].nav[p.key] || '').trim(); }); });
    if (missing) { toast(t.labelsNeeded, 'error'); go('menu'); return; }
    var items = changedFiles().map(function (k) { return h('li', null, svgIcon('text'), t.files[FILES[k]]); })
      .concat(Object.keys(S.uploads).map(function (p) { return h('li', null, svgIcon('upload'), t.up + ': ' + p); }))
      .concat(Object.keys(S.deletes).map(function (p) { return h('li', null, svgIcon('trash'), t.del + ': ' + p); }));
    var msg = h('input', { type: 'text', id: 'pub-msg', maxlength: 120 });
    modal(t.title, [h('p', { text: t.lead }), h('ul', { class: 'change-list' }, items), h('label', { for: 'pub-msg', class: 'field-label' }, t.message), msg],
      t.go, function () { commit(msg.value.trim()); }, t.cancel);
  }

  function commit(note) {
    var t = T().publish;
    var changed = changedFiles();
    var uploads = Object.keys(S.uploads), deletes = Object.keys(S.deletes);
    setBusy(true, t.saving);
    var who = S.me.user ? (S.me.user.name || S.me.user.username) : S.user ? (S.user.name || S.user.login) : '';
    var message = (note || 'Update site content') + '\n\nPublished from the admin panel' + (who ? ' by ' + who : '') + '.';
    var entries = [];
    // texts as utf-8 blobs, photos as base64 blobs
    var blobJobs = changed.map(function (k) {
      return gh('POST', repoPath() + '/git/blobs', { content: json(S.data[k]), encoding: 'utf-8' }).then(function (b) { entries.push({ path: FILES[k], mode: '100644', type: 'blob', sha: b.sha }); });
    }).concat(uploads.map(function (p) {
      return gh('POST', repoPath() + '/git/blobs', { content: S.uploads[p].b64, encoding: 'base64' }).then(function (b) { entries.push({ path: IMG_ROOT + p, mode: '100644', type: 'blob', sha: b.sha }); });
    }));
    deletes.forEach(function (p) { entries.push({ path: IMG_ROOT + p, mode: '100644', type: 'blob', sha: null }); });

    var base = S.head;
    Promise.all(blobJobs).then(function () {
      return gh('GET', repoPath() + '/git/ref/heads/' + CFG.branch);
    }).then(function (ref) {
      if (ref.object.sha === base.commit) return base;
      // Someone published in the meantime: continue on top of theirs unless they changed the same files.
      return gh('GET', repoPath() + '/compare/' + base.commit + '...' + ref.object.sha).then(function (cmp) {
        var ours = entries.map(function (e) { return e.path; });
        var clash = (cmp.files || []).some(function (f) { return ours.indexOf(f.filename) >= 0; });
        if (clash) { var e = new Error('conflict'); e.code = 'conflict'; throw e; }
        return gh('GET', repoPath() + '/git/commits/' + ref.object.sha).then(function (c) { return { commit: c.sha, tree: c.tree.sha }; });
      });
    }).then(function (parent) {
      return gh('POST', repoPath() + '/git/trees', { base_tree: parent.tree, tree: entries }).then(function (tree) {
        return gh('POST', repoPath() + '/git/commits', { message: message, tree: tree.sha, parents: [parent.commit] });
      });
    }).then(function (c) {
      return gh('PATCH', repoPath() + '/git/refs/heads/' + CFG.branch, { sha: c.sha, force: false }).then(function () { return c; });
    }).then(function (c) {
      // Published: this commit is the new baseline
      changed.forEach(function (k) { S.orig[k] = json(S.data[k]); });
      uploads.forEach(function (p) { S.thumbs[p] = S.uploads[p].url; });
      S.uploads = {}; S.deletes = {};
      S.head = { commit: c.sha, tree: c.tree.sha, date: c.committer && c.committer.date, message: c.message };
      setBusy(false); updateBar(); render();
      return refreshBlobs().then(function () { watchBuild(c.sha); });
    }).catch(function (e) {
      setBusy(false);
      if (e.code === 'conflict') { toast(t.conflict, 'error', 12000); return reloadBase(); }
      toast(t.error, 'error', 8000);
    });
  }
  function refreshBlobs() {
    return gh('GET', repoPath() + '/git/trees/' + S.head.tree + '?recursive=1').then(function (tree) {
      S.blobs = {}; tree.tree.forEach(function (e) { if (e.type === 'blob') S.blobs[e.path] = e.sha; });
    }, function () {});
  }
  // After a conflict: keep the editor's data, take the newest published version as the baseline,
  // and leave the editor's changes on top of it.
  function reloadBase() {
    var mine = clone(S.data);
    return loadAll().then(function () { S.data = mine; updateBar(); render(); });
  }
  // Follow the "Build site" workflow run for the published commit (needs Actions: read; otherwise a plain message).
  function watchBuild(sha) {
    var t = T().publish, tries = 0;
    toast(t.saved, 'ok', 0);
    (function poll() {
      tries++;
      gh('GET', repoPath() + '/actions/runs?head_sha=' + sha + '&per_page=5').then(function (r) {
        var run = (r.workflow_runs || [])[0];
        if (!run) { if (tries < 20) return setTimeout(poll, 6000); return toast(t.unknownStatus, 'ok', 8000); }
        if (run.status !== 'completed') { toast(t.building, 'ok', 0); return setTimeout(poll, 6000); }
        // the Pages deployment follows the build by a few seconds
        if (run.conclusion === 'success') setTimeout(function () { toast(t.live, 'ok', 10000); }, 25000);
        else toast(t.failedBuild, 'error', 0);
      }, function () { toast(t.unknownStatus, 'ok', 8000); });
    })();
  }

  // ---------- shell ----------
  var NAV_ICON = { overview: 'home', menu: 'menu', content: 'text', images: 'photo', staff: 'people', school: 'school', editors: 'key' };
  UI_ICONS.key = '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l3 3M14 8l2 2"/>';
  var app = document.getElementById('app');
  var mainEl, barCount, publishBtn, discardBtn, toastEl, busyEl;

  function go(view) {
    S.view = view;
    try { history.replaceState(null, '', '#' + view); } catch (e) {}
    render();
    window.scrollTo(0, 0);
  }
  function uiSwitch() {
    return h('div', { class: 'ui-lang', role: 'group', 'aria-label': T().top.uiLang }, LANGS.map(function (l) {
      return h('button', { type: 'button', 'aria-pressed': String(l === uiLang), lang: l, onclick: function () {
        uiLang = l; store.set(KEY_UI, l); document.documentElement.lang = l; render();
      } }, LANG_TAG[l]);
    }));
  }
  function render() {
    document.documentElement.lang = uiLang;
    document.title = T().title + ' · Indigo Academy West';
    if (!S.head) { if (app.querySelector('.login')) loginScreen(); return; }
    var t = T();
    app.textContent = '';
    mainEl = h('main', { class: 'main', id: 'main' });
    barCount = h('span', { class: 'bar-count', 'aria-live': 'polite' });
    publishBtn = h('button', { type: 'button', class: 'btn btn--gold', onclick: publish }, svgIcon('check'), t.top.publish);
    discardBtn = h('button', { type: 'button', class: 'btn btn--ghost', onclick: function () {
      modal(t.discard.title, [h('p', { text: t.discard.lead })], t.discard.go, function () { setBusy(true, T().loading); loadAll().then(function () { setBusy(false); render(); }); }, t.discard.cancel);
    } }, t.top.discard);
    app.appendChild(h('header', { class: 'top' },
      h('a', { class: 'top-brand', href: SITE_URL, target: '_blank', rel: 'noopener' }, h('img', { src: '../assets/img/logo-round.png', alt: '', width: 36, height: 36 }), h('span', null, h('b', { text: 'Indigo Academy West' }), h('small', { text: t.title }))),
      h('div', { class: 'top-bar' }, barCount, discardBtn, publishBtn),
      h('div', { class: 'top-tools' }, uiSwitch(),
        h('a', { class: 'btn btn--ghost btn--small', href: SITE_URL, target: '_blank', rel: 'noopener', 'aria-label': t.top.view }, svgIcon('ext'), h('span', { class: 'btn-text', text: t.top.view })),
        h('button', { type: 'button', class: 'btn btn--ghost btn--small', onclick: logout, title: whoText(), 'aria-label': t.top.logout }, svgIcon('out'), h('span', { class: 'btn-text', text: t.top.logout })))));
    app.appendChild(h('nav', { class: 'side', 'aria-label': t.title }, h('ul', null, Object.keys(t.nav).map(function (v) {
      return h('li', null, h('a', { href: '#' + v, 'aria-current': v === S.view ? 'page' : null, onclick: function (e) { e.preventDefault(); go(v); } }, svgIcon(NAV_ICON[v]), h('span', { text: t.nav[v] })));
    })), h('p', { class: 'side-who', text: whoText() })));
    app.appendChild(mainEl);
    (views[S.view] || views.overview)(mainEl);
    // on phones the section menu is a scrolling strip: keep the current section in view
    var cur = app.querySelector('.side [aria-current]');
    if (cur && window.innerWidth <= 900) cur.parentNode.parentNode.parentNode.scrollLeft = cur.offsetLeft - 16;
    updateBar();
  }
  function updateBar() {
    if (!barCount) return;
    var n = changeCount();
    barCount.textContent = T().top.changes(n);
    barCount.classList.toggle('has-changes', n > 0);
    publishBtn.disabled = !n; discardBtn.disabled = !n;
  }

  function toast(text, kind, ms) {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastEl); }
    clearTimeout(toastEl._t);
    if (!text) { toastEl.hidden = true; return; }
    toastEl.hidden = false;
    toastEl.className = 'toast toast--' + (kind || 'info');
    toastEl.textContent = '';
    toastEl.appendChild(h('span', { text: text }));
    toastEl.appendChild(h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'OK', onclick: function () { toastEl.hidden = true; } }, svgIcon('close')));
    if (ms !== 0) toastEl._t = setTimeout(function () { toastEl.hidden = true; }, ms || 4000);
  }
  function setBusy(on, text) {
    if (!busyEl) { busyEl = h('div', { class: 'busy', role: 'status' }, h('span', { class: 'spinner' }), h('p')); document.body.appendChild(busyEl); }
    busyEl.hidden = !on;
    if (text) busyEl.querySelector('p').textContent = text;
  }
  function modal(title, body, okLabel, onOk, cancelLabel) {
    var prev = document.activeElement;
    var close = function () { wrap.remove(); if (prev && prev.focus) prev.focus(); };
    var ok = h('button', { type: 'button', class: 'btn btn--primary', onclick: function () { close(); onOk(); } }, okLabel);
    var wrap = h('div', { class: 'modal-wrap', onclick: function (e) { if (e.target === wrap) close(); } },
      h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h2', { text: title }), h('div', { class: 'modal-body' }, body),
        h('div', { class: 'modal-actions' }, h('button', { type: 'button', class: 'btn btn--ghost', onclick: close }, cancelLabel || 'Cancel'), ok)));
    wrap.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(wrap);
    ok.focus();
  }
  function confirmBox(text, extra, okLabel, onOk) { modal(text, extra ? [h('p', { text: extra })] : [], okLabel, onOk, T().menu.cancel); }

  // ---------- editors ----------
  // content/editors.json (published as admin/editors.json) holds the GitHub token in a vault that each
  // editor's password unlocks (auth.js). Changes here are published with the rest through "Publish".
  function whoText() {
    var t = T().ed;
    return S.me.user ? t.who(S.me.user.name || S.me.user.username) : t.owner;
  }
  function isAdmin() { return S.me.mode === 'token' || (S.me.user && S.me.user.role === 'admin'); }
  function makePassword() {
    // 6 characters with at least one letter and one digit; no look-alikes (0/O, 1/l/I)
    var all = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', out;
    do {
      out = Array.prototype.map.call(crypto.getRandomValues(new Uint32Array(6)), function (x) { return all[x % all.length]; }).join('');
    } while (!/[A-Za-z]/.test(out) || !/\d/.test(out));
    return out;
  }
  // Password input: keeps only Latin letters and digits, at most 6
  function pwInput(id) {
    var inp = h('input', { type: 'password', id: id, maxlength: 6, autocomplete: 'new-password', autocapitalize: 'off', spellcheck: 'false' });
    inp.addEventListener('input', function () { var v = inp.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6); if (v !== inp.value) inp.value = v; });
    return inp;
  }
  function pwPair(prefix, label, withGenerate) {
    var t = T().ed;
    var a = pwInput(prefix + '-a'), b = pwInput(prefix + '-b');
    var gen = withGenerate ? h('button', { type: 'button', class: 'btn btn--small btn--quiet', onclick: function () { var p = makePassword(); a.value = b.value = p; a.type = b.type = 'text'; } }, t.generate) : null;
    return { a: a, b: b, check: function () { return !AUTH.PASSWORD.test(a.value) ? t.errPw : a.value !== b.value ? t.errPw2 : ''; },
      el: h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: prefix + '-a', class: 'field-label' }, label || t.pass), h('div', { class: 'pw-row' }, a, gen), h('span', { class: 'hint', text: t.passHint })),
        h('div', { class: 'field' }, h('label', { for: prefix + '-b', class: 'field-label' }, t.pass2), b)) };
  }
  function busy(btn, on) {
    btn.disabled = on;
    if (on) { btn.dataset.l = btn.textContent; btn.textContent = T().ed.working; } else if (btn.dataset.l) btn.textContent = btn.dataset.l;
  }

  views.editors = function (main) {
    var t = T().ed, db = S.data.editors, list = db.editors = db.editors || [], admin = isAdmin();
    var saved = (JSON.parse(S.orig.editors).editors || []).map(function (x) { return x.username; });
    var again = function () { markDirty(); go('editors'); };
    var fail = function (btn) { return function (e) { busy(btn, false); toast(String((e && e.message) || e), 'error', 8000); }; };
    main.appendChild(h('header', { class: 'view-head' }, h('h1', { text: T().nav.editors }), h('p', { class: 'lead', text: t.lead })));

    // One card per editor: name, role, new password, delete
    var card = function (e, i) {
      var mine = S.me.user && S.me.user.username === e.username;
      var pp = pwPair('pw-' + i, t.newPass), err = h('p', { class: 'form-error', role: 'alert' });
      var setBtn = h('button', { type: 'button', class: 'btn btn--small', onclick: function () {
        var m = pp.check(); err.textContent = m; if (m) return;
        busy(setBtn, true);
        AUTH.lock(S.me.k, pp.a.value, e).then(function (rec) { list[list.indexOf(e)] = rec; toast(t.pending, 'ok', 6000); again(); }).catch(fail(setBtn));
      } }, t.setPw);
      var nameInp = h('input', { type: 'text', id: 'ed-name-' + i, value: e.name || '' });
      nameInp.addEventListener('input', function () { e.name = nameInp.value; markDirty(); });
      var roleSel = h('select', { id: 'ed-role-' + i }, ['editor', 'admin'].map(function (r) { return h('option', { value: r, selected: e.role === r }, r === 'admin' ? t.roleAdmin : t.roleEditor); }));
      roleSel.addEventListener('change', function () {
        if (roleSel.value !== 'admin' && e.role === 'admin' && list.filter(function (x) { return x.role === 'admin'; }).length === 1) { toast(t.lastAdmin, 'error', 6000); roleSel.value = 'admin'; return; }
        e.role = roleSel.value; markDirty();
      });
      return h('li', { class: 'user-row' },
        h('div', { class: 'user-main' },
          h('span', { class: 'avatar', text: (e.name || e.username).trim().charAt(0).toUpperCase() }),
          h('div', null, h('strong', { text: (e.name || e.username) + (mine ? ' (' + t.you + ')' : '') }), h('span', { class: 'muted', text: e.username })),
          saved.indexOf(e.username) < 0 ? h('span', { class: 'badge badge--blocked', text: t.unsaved }) : h('span', { class: 'badge badge--' + e.role, text: e.role === 'admin' ? t.admin : t.editor }),
          admin && !mine ? h('button', { type: 'button', class: 'icon-btn icon-btn--danger', title: T().content.remove, 'aria-label': T().content.remove, onclick: function () {
            if (e.role === 'admin' && list.filter(function (x) { return x.role === 'admin'; }).length === 1) { toast(t.lastAdmin, 'error', 6000); return; }
            confirmBox(t.confirmDel(e.name || e.username), '', T().content.remove, function () { list.splice(list.indexOf(e), 1); again(); });
          } }, svgIcon('trash')) : null),
        admin ? h('div', { class: 'form-grid' },
          h('div', { class: 'field' }, h('label', { for: 'ed-name-' + i, class: 'field-label' }, t.name), nameInp),
          h('div', { class: 'field' }, h('label', { for: 'ed-role-' + i, class: 'field-label' }, t.role), roleSel)) : null,
        S.me.k ? h('details', { class: 'pw-box' }, h('summary', { text: mine ? t.myPw : t.setPw }), pp.el, err, setBtn) : null);
    };

    if (!admin) {
      main.appendChild(h('ul', { class: 'user-list' }, list.filter(function (e) { return S.me.user && e.username === S.me.user.username; }).map(card)));
      return;
    }
    if (!db.vault) {
      var on = h('button', { type: 'button', class: 'btn btn--primary', onclick: function () {
        busy(on, true);
        AUTH.newVault(S.token).then(function (r) { db.vault = r.vault; S.me.k = r.key; keepSession(); again(); }).catch(fail(on));
      } }, svgIcon('key'), t.setupBtn);
      main.appendChild(h('section', { class: 'panel add-page' }, h('h2', { text: t.setupTitle }), h('p', { class: 'muted', text: t.setupHelp }), on));
      return;
    }
    var reset = S.me.mode === 'token' ? h('button', { type: 'button', class: 'btn btn--small icon-btn--danger', onclick: function () {
      confirmBox(t.resetConfirm, '', t.reset, function () {
        AUTH.newVault(S.token).then(function (r) { db.vault = r.vault; db.editors = []; S.me.k = r.key; keepSession(); again(); });
      });
    } }, t.reset) : null;
    if (!S.me.k) {
      main.appendChild(h('section', { class: 'panel add-page' }, h('p', { text: t.noKey }), reset));
      return;
    }
    main.appendChild(h('p', { class: 'note-box', text: t.security }));
    main.appendChild(list.length ? h('ul', { class: 'user-list' }, list.map(card)) : h('p', { class: 'panel muted', text: t.empty }));

    // Add an editor
    var name = h('input', { type: 'text', id: 'ed-name', autocomplete: 'off' });
    var user = h('input', { type: 'text', id: 'ed-user', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
    var pp = pwPair('ed-new', t.pass, true);
    var role = h('select', { id: 'ed-role' }, ['editor', 'admin'].map(function (r) { return h('option', { value: r, selected: r === (list.length ? 'editor' : 'admin') }, r === 'admin' ? t.roleAdmin : t.roleEditor); }));
    var err = h('p', { class: 'form-error', role: 'alert' });
    name.addEventListener('input', function () { if (!user.dataset.touched) user.value = slugName(name.value); });
    user.addEventListener('input', function () { user.dataset.touched = '1'; });
    var add = h('button', { type: 'button', class: 'btn btn--primary', onclick: function () {
      var u = user.value.trim().toLowerCase();
      var m = !AUTH.USERNAME.test(u) ? t.errUser : list.some(function (x) { return x.username === u; }) ? t.errExists : pp.check();
      err.textContent = m; if (m) return;
      busy(add, true);
      AUTH.lock(S.me.k, pp.a.value, { username: u, name: name.value.trim(), role: role.value }).then(function (rec) {
        list.push(rec); toast(t.added(rec.name || rec.username, pp.a.value), 'ok', 0); again();
      }).catch(fail(add));
    } }, svgIcon('plus'), t.add);
    main.appendChild(h('section', { class: 'panel add-page' }, h('h2', { text: t.add }),
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' }, h('label', { for: 'ed-name', class: 'field-label' }, t.name), name),
        h('div', { class: 'field' }, h('label', { for: 'ed-user', class: 'field-label' }, t.username), user, h('span', { class: 'hint', text: t.userHint }))),
      pp.el,
      h('div', { class: 'field' }, h('label', { for: 'ed-role', class: 'field-label' }, t.role), role), err, add));

    // Replace the GitHub token stored for editors
    var tok = h('input', { type: 'password', id: 'ed-token', autocomplete: 'off', placeholder: 'github_pat_…' });
    var tb = h('button', { type: 'button', class: 'btn btn--small', onclick: function () {
      var v = tok.value.trim(); if (!v) return;
      busy(tb, true);
      fetch(API + repoPath(), { headers: { Authorization: 'Bearer ' + v, Accept: 'application/vnd.github+json' } }).then(function (r) {
        if (!r.ok) throw new Error(t.tokenBad);
        return r.json();
      }).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw new Error(t.tokenBad);
        return AUTH.sealToken(S.me.k, v);
      }).then(function (vault) { db.vault = vault; S.token = v; keepSession(); toast(t.pending, 'ok', 6000); again(); }).catch(fail(tb));
    } }, t.tokenBtn);
    main.appendChild(h('section', { class: 'panel add-page' }, h('h2', { text: t.token }), h('p', { class: 'muted', text: t.tokenHelp }),
      h('label', { for: 'ed-token', class: 'field-label' }, T().login.token), tok, tb));
    if (reset) main.appendChild(h('section', { class: 'panel add-page' }, h('p', { class: 'muted', text: t.resetHelp }), reset));
  };
  // "Айгүл Асанова" → aygul.asanova (Cyrillic transliterated)
  function slugName(s) {
    var map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', ң: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return s.toLowerCase().split('').map(function (c) { return map[c] != null ? map[c] : c; }).join('')
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 30);
  }

  // ---------- sign-in ----------
  // Stored sign-in: { mode: 'password' | 'token', token, k: vault key (base64), user: { username, name, role } }
  var auth = {
    get: function () { try { return JSON.parse(store.get(KEY_AUTH) || session.get(KEY_AUTH) || 'null'); } catch (e) { return null; } },
    set: function (a, remember) { store.del(KEY_AUTH); session.del(KEY_AUTH); (remember ? store : session).set(KEY_AUTH, JSON.stringify(a)); },
    clear: function () { store.del(KEY_AUTH); session.del(KEY_AUTH); store.del(KEY_TOKEN); session.del(KEY_TOKEN); },
  };
  // After the vault key or token changes, keep the stored sign-in in step
  function keepSession() {
    var a = auth.get() || { mode: S.me.mode, user: S.me.user };
    a.token = S.token; if (S.me.k) a.k = AUTH.b64(S.me.k);
    auth.set(a, !!store.get(KEY_AUTH));
  }
  // Wrong passwords: after 5 tries the form waits 30 s, then twice as long after every further miss
  var fails = {
    get: function () { try { return JSON.parse(store.get(KEY_FAILS) || '{"n":0,"until":0}'); } catch (e) { return { n: 0, until: 0 }; } },
    add: function () { var f = fails.get(); f.n++; if (f.n >= 5) f.until = Date.now() + 30000 * Math.pow(2, f.n - 5); store.set(KEY_FAILS, JSON.stringify(f)); },
    reset: function () { store.del(KEY_FAILS); },
  };
  function editorsFile() {
    return fetch('editors.json?ts=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; });
  }

  // The sign-in form follows editors.json (no editors → token) unless the person switched it by hand
  var loginMode = null, loginManual = false;
  function loginScreen(errText) {
    var t = T().login, e = T().ed;
    var err = h('p', { class: 'form-error', role: 'alert', text: errText || '' });
    var note = h('p', { class: 'login-note', hidden: true, text: e.noEditors });
    var user = h('input', { type: 'text', id: 'username', autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false' });
    var pass = h('input', { type: 'password', id: 'password', maxlength: 6, autocomplete: 'current-password', autocapitalize: 'off', spellcheck: 'false' });
    var tok = h('input', { type: 'password', id: 'token', autocomplete: 'off', spellcheck: 'false', placeholder: 'github_pat_…' });
    var remember = h('input', { type: 'checkbox', id: 'remember', checked: true });
    var btn = h('button', { type: 'submit', class: 'btn btn--primary btn--block' }, t.submit);
    var pwFields = h('div', { class: 'login-fields' }, h('label', { for: 'username', class: 'field-label' }, e.user), user, h('label', { for: 'password', class: 'field-label' }, e.pass), pass);
    var tokFields = h('div', { class: 'login-fields' }, h('label', { for: 'token', class: 'field-label' }, t.token), tok);
    var help = h('details', { class: 'help' }, h('summary', { text: t.help }), h('ol', null, t.steps.map(function (s) { return h('li', { text: s }); })),
      h('a', { class: 'link', href: 'https://github.com/settings/personal-access-tokens/new', target: '_blank', rel: 'noopener' }, t.open, svgIcon('ext')));
    var sw = h('button', { type: 'button', class: 'linkish', onclick: function () { loginManual = true; setMode(loginMode === 'password' ? 'token' : 'password'); err.textContent = ''; } });
    function setMode(m) {
      loginMode = m;
      pwFields.hidden = m !== 'password'; tokFields.hidden = help.hidden = m !== 'token';
      sw.textContent = m === 'password' ? e.toToken : e.toPw;
      (m === 'password' ? user : tok).focus();
    }
    app.textContent = '';
    var form = h('form', { class: 'login-card', novalidate: true },
      h('div', { class: 'login-top' }, h('img', { src: '../assets/img/logo-round.png', alt: 'Indigo Academy', width: 84, height: 84 }), uiSwitch()),
      h('p', { class: 'eyebrow', text: 'Indigo Academy West' }),
      h('h1', { text: t.heading }), h('p', { class: 'muted', text: t.lead }), note,
      pwFields, tokFields,
      h('label', { class: 'check' }, remember, h('span', { text: t.remember })),
      err, btn, sw, help);
    app.appendChild(h('div', { class: 'login' }, form));
    setMode(loginManual && loginMode ? loginMode : 'password');
    editorsFile().then(function (db) {
      var none = !db.vault || !(db.editors || []).length;
      note.hidden = !none;
      if (!loginManual) setMode(none ? 'token' : 'password');
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      err.textContent = '';
      if (loginMode === 'token') {
        var v = tok.value.trim();
        if (!v) { err.textContent = t.errors.bad; return; }
        btn.disabled = true; btn.textContent = t.checking;
        var a = { mode: 'token', token: v };
        return signIn(v).then(function () { auth.set(a, remember.checked); begin(a); }, function (e2) {
          btn.disabled = false; btn.textContent = t.submit; err.textContent = t.errors[e2.code] || t.errors.network;
        });
      }
      var username = user.value.trim().toLowerCase(), password = pass.value;
      var wait = Math.ceil((fails.get().until - Date.now()) / 1000);
      if (wait > 0) { err.textContent = e.wait(wait); return; }
      btn.disabled = true; btn.textContent = t.checking;
      editorsFile().then(function (db) {
        var rec = (db.editors || []).filter(function (x) { return x.username === username; })[0];
        if (!rec || !db.vault || !AUTH.PASSWORD.test(password)) throw 'wrong';
        return AUTH.unlock(rec, password).then(function (key) {
          return AUTH.openVault(key, db.vault).then(function (token) {
            return { mode: 'password', token: token, k: AUTH.b64(key), user: { username: rec.username, name: rec.name, role: rec.role } };
          });
        }, function () { throw 'wrong'; });
      }).then(function (a) {
        fails.reset(); auth.set(a, remember.checked); begin(a);
      }).catch(function (x) {
        if (x === 'wrong') fails.add();
        btn.disabled = false; btn.textContent = t.submit;
        err.textContent = x === 'wrong' ? e.wrong : t.errors.network;
        pass.value = ''; pass.focus();
      });
    });
  }

  // Signed in (either way): check the token, load the content, and for editors confirm they still exist.
  function begin(a) {
    S.me = { mode: a.mode || 'token', user: a.user || null, k: a.k ? AUTH.unb64(a.k) : null };
    setBusy(true, T().loading);
    signIn(a.token).then(loadAll).then(function () {
      if (S.me.user) {
        var rec = (S.data.editors.editors || []).filter(function (x) { return x.username === S.me.user.username; })[0];
        if (!rec) throw { gone: true };
        S.me.user.role = rec.role; S.me.user.name = rec.name;
      }
      setBusy(false);
      var v = location.hash.slice(1);
      if (views[v]) S.view = v;
      document.documentElement.dataset.editLang = S.editLang;
      render();
    }).catch(function (x) {
      setBusy(false); auth.clear(); S.head = null; S.token = null;
      loginScreen(x && x.gone ? T().ed.wrong : x && x.code === 'bad' ? (S.me.mode === 'password' ? T().ed.expired : T().login.errors.bad)
        : x && x.code ? T().login.errors[x.code] || T().login.errors.network : T().loadError);
    });
  }

  function logout() {
    var go_ = function () { auth.clear(); S.token = null; S.head = null; S.me = { mode: 'token', user: null, k: null }; loginManual = false; toast(null); loginScreen(); };
    if (changeCount()) modal(T().publish.leave, [], T().top.logout, go_, T().discard.cancel); else go_();
  }

  window.addEventListener('beforeunload', function (e) { if (S.head && changeCount()) { e.preventDefault(); e.returnValue = T().publish.leave; return T().publish.leave; } });

  var saved = auth.get();
  if (!saved) { var old = store.get(KEY_TOKEN) || session.get(KEY_TOKEN); if (old) saved = { mode: 'token', token: old }; }
  if (saved && saved.token) begin(saved); else loginScreen();
})();
