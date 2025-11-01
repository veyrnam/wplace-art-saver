// ==UserScript==
// @name         WPlace Art Saver (WMagnify)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Save wplace.live locations.
// @author       Vyrnam on discord.
// @match        https://wplace.live/*
// @match        http://wplace.live/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'wplace_saved_arts_v1';

    function loadSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    }

    function saveSaved(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function nowString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function isValidWplaceLink(raw) {
        try {
            const url = new URL(raw);
            if (!url.hostname.includes('wplace.live')) return false;
            const lat = url.searchParams.get('lat');
            const lng = url.searchParams.get('lng');
            return lat && lng && !isNaN(lat) && !isNaN(lng);
        } catch { return false; }
    }

    function makeUniqueName(baseName, list) {
        baseName = baseName.trim();
        const matches = list.filter(it => it.name === baseName || it.name.startsWith(baseName + ' #'));
        if (!matches.length) return baseName;
        let max = 1;
        for (const n of matches) {
            const m = n.name.match(new RegExp('^' + baseName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + ' #(\\d+)$'));
            if (m) max = Math.max(max, parseInt(m[1]) + 1);
        }
        return `${baseName} #${max}`;
    }

    const style = document.createElement('style');
    style.textContent = `
    .wm-art-saver {
        position: fixed;
        left: 18px;
        top: 60px;
        width: 300px;
        background: #2b2f36;
        border-radius: 12px;
        padding: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        color: #dbe3ee;
        font-family: 'Segoe UI', Roboto, Arial, sans-serif;
        z-index: 99999;
        user-select: none;
    }
    .wm-art-saver .header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        cursor: grab;
        margin-bottom: 10px;
    }
    .wm-art-saver .title {
        background:#20242a;
        padding:8px 12px;
        border-radius:8px;
        font-weight:600;
        color:#cbd7e6;
    }
    .wm-art-saver .sub {
        color:#9aa6b8;
        font-size:12px;
        margin-bottom:8px;
    }
    .wm-art-saver input[type="text"] {
        width:100%;
        padding:10px;
        border-radius:8px;
        border:none;
        background:#0f1113;
        color:#cbd7e6;
        outline:none;
        font-size:15px;
    }
    .wm-art-saver .label {
        font-size:12px;
        color:#9aa6b8;
        margin:8px 0 6px 0;
    }
    .wm-art-saver .btn {
        padding:8px 12px;
        border-radius:8px;
        background:#4a4e55;
        color:#dbe3ee;
        cursor:pointer;
        border:none;
        margin-top:8px;
        font-weight:600;
    }
    .wm-art-saver .btn-green {
        background: linear-gradient(#2e8f64, #1f7a4f);
        color:#e9fbea;
    }
    .wm-art-saver .list {
        margin-top:12px;
        background:#33363c;
        padding:10px;
        border-radius:10px;
        min-height:100px;
        max-height:260px;
        overflow:auto;
    }
    .art-row {
        background: rgba(0,0,0,0.06);
        padding:8px;
        border-radius:8px;
        margin-bottom:8px;
    }
    .art-row .name {
        font-weight:600;
        font-size:14px;
        margin-bottom:4px;
    }
    .art-row .meta {
        font-size:12px;
        color:#9aa6b8;
        word-break:break-all;
        overflow-wrap:break-word;
        margin-bottom:6px;
    }
    .art-row .actions {
        display:flex;
        gap:6px;
    }
    .view-btn {
        background:#2b3340;
        padding:6px 8px;
        border-radius:8px;
        cursor:pointer;
        font-weight:700;
        border:none;
        color:#cbd7e6;
    }
    .delete-btn {
        background:transparent;
        border:none;
        color:#ff6b6b;
        cursor:pointer;
        font-weight:700;
    }
    .wm-error {
        position: fixed;
        right: 22px;
        top: 20px;
        width: 320px;
        background: #2d2f36;
        border-radius: 10px;
        padding: 14px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        color: #dbe3ee;
        z-index: 100000;
        display:none;
    }
    .wm-error .err-title {
        color:#ff6b6b;
        font-weight:700;
        margin-bottom:6px;
    }
    .wm-error .err-msg {
        font-size:20px;
        color:#e7eefc;
    }`;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'wm-art-saver';
    container.innerHTML = `
      <div class="header">
        <div class="title">Art Saver (wplace)</div>
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="font-size:12px;color:#9aa6b8;padding:6px 8px;border-radius:6px;background:#20242a;">WMagnify</div>
          <img id="wm-discord" src="https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/discord-color-icon.png"
               style="width:20px;height:20px;cursor:pointer;" title="Join Discord"/>
        </div>
      </div>
      <div class="sub">Enter the link of your location.</div>
      <input id="wm-link" type="text" placeholder="Location link" />
      <div class="label">Enter a name for your location (optional)</div>
      <input id="wm-name" type="text" placeholder="Location name (optional)" />
      <div style="display:flex;justify-content:center;">
        <button id="wm-save" class="btn btn-green">Apply and Save</button>
      </div>
      <div class="list" id="wm-list"></div>
    `;
    document.body.appendChild(container);

    document.querySelector('#wm-discord').onclick = () => {
        window.open('https://discord.gg/BKAUjNVYd5', '_blank');
    };

    const errBox = document.createElement('div');
    errBox.className = 'wm-error';
    errBox.innerHTML = `<div class="err-title">Error</div><div class="err-msg">Theres no valid link!</div>`;
    document.body.appendChild(errBox);

    (function makeDraggable(el, handleSelector) {
        const handle = el.querySelector(handleSelector);
        let isDown = false, offsetX = 0, offsetY = 0;
        handle.addEventListener('mousedown', e => {
            isDown = true;
            offsetX = e.clientX - el.getBoundingClientRect().left;
            offsetY = e.clientY - el.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', e => {
            if (!isDown) return;
            el.style.left = Math.max(6, Math.min(window.innerWidth - el.offsetWidth - 6, e.clientX - offsetX)) + 'px';
            el.style.top = Math.max(6, Math.min(window.innerHeight - el.offsetHeight - 6, e.clientY - offsetY)) + 'px';
        });
        document.addEventListener('mouseup', () => isDown = false);
    })(container, '.header');

    const inputLink = container.querySelector('#wm-link');
    const inputName = container.querySelector('#wm-name');
    const saveBtn = container.querySelector('#wm-save');
    const listEl = container.querySelector('#wm-list');
    let savedList = loadSaved();

    function showError(msg) {
        errBox.querySelector('.err-msg').textContent = msg;
        errBox.style.display = 'block';
        clearTimeout(errBox._hide);
        errBox._hide = setTimeout(() => errBox.style.display = 'none', 3000);
    }

    function renderList() {
        listEl.innerHTML = '';
        if (savedList.length === 0) {
            const e = document.createElement('div');
            e.style.color = '#9aa6b8'; e.style.fontSize = '13px';
            e.textContent = 'No saved art yet.';
            listEl.appendChild(e);
            return;
        }
        for (let i = savedList.length - 1; i >= 0; i--) {
            const it = savedList[i];
            const div = document.createElement('div');
            div.className = 'art-row';
            div.innerHTML = `
                <div class="name">${it.name}</div>
                <div class="meta">${it.date} • ${it.link}</div>
                <div class="actions">
                    <button class="view-btn" data-i="${i}">View</button>
                    <button class="delete-btn" data-i="${i}">Delete</button>
                </div>`;
            div.querySelector('.view-btn').onclick = () => window.location.href = it.link;
            div.querySelector('.delete-btn').onclick = () => {
                savedList.splice(i, 1);
                saveSaved(savedList);
                renderList();
            };
            listEl.appendChild(div);
        }
    }

    saveBtn.onclick = () => {
        const link = inputLink.value.trim();
        const name = inputName.value.trim();
        if (!isValidWplaceLink(link)) return showError('Theres no valid link!');
        let finalName = name || '';
        if (!finalName) {
            const base = 'Saved Art';
            const num = savedList.filter(x => x.name.startsWith(base)).length + 1;
            finalName = `${base} #${num}`;
        } else finalName = makeUniqueName(finalName, savedList);
        savedList.push({ name: finalName, link, date: nowString() });
        saveSaved(savedList);
        renderList();
        inputLink.value = ''; inputName.value = '';
    };

    inputLink.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    inputName.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

    renderList();
})();
