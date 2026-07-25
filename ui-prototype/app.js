const tabs = document.querySelectorAll('[data-tab]');
const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const fileList = document.querySelector('#file-list');
const quality = document.querySelector('#quality');
const qualityValue = document.querySelector('#quality-value');
const processButton = document.querySelector('#process-button');
const toast = document.querySelector('#toast');
const sidebar = document.querySelector('#sidebar');
const themeButton = document.querySelector('#theme-button');

tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((item) => { item.classList.toggle('active', item === tab); item.setAttribute('aria-selected', item === tab); });
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.remove('active'));
  document.querySelector(`#${tab.dataset.tab}-panel`).classList.add('active');
}));

quality.addEventListener('input', () => { qualityValue.textContent = `${quality.value}%`; });

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault(); dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => addFiles(event.dataTransfer.files));
fileInput.addEventListener('change', () => addFiles(fileInput.files));
document.querySelector('#add-more').addEventListener('click', () => fileInput.click());

function addFiles(files) {
  [...files].slice(0, 4).forEach((file) => {
    const item = document.createElement('article');
    item.className = 'file-item selected';
    const type = file.type.startsWith('image/') ? 'photo-thumb' : 'doc-thumb';
    item.innerHTML = `<div class="file-thumb ${type}">${type === 'photo-thumb' ? '<span></span>' : '<svg><use href="#i-file" /></svg><b>FILE</b>'}</div><div class="file-copy"><strong>${escapeHtml(file.name)}</strong><span>${formatSize(file.size)} · Ready to inspect</span></div><span class="local-chip"><i></i> LOCAL</span><button class="icon-button file-more" aria-label="Remove file"><svg><use href="#i-x" /></svg></button>`;
    item.querySelector('button').addEventListener('click', () => item.remove());
    fileList.prepend(item);
  });
}

function formatSize(bytes) { return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`; }
function escapeHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }

processButton.addEventListener('click', () => {
  processButton.classList.add('loading'); processButton.querySelector('span').textContent = 'Processing locally…';
  setTimeout(() => {
    processButton.classList.remove('loading'); processButton.querySelector('span').textContent = 'Process 2 files';
    toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200);
  }, 1100);
});

document.querySelector('#menu-button').addEventListener('click', () => sidebar.classList.add('open'));
document.querySelector('#sidebar-close').addEventListener('click', () => sidebar.classList.remove('open'));

themeButton.addEventListener('click', () => {
  const isDark = document.body.dataset.theme === 'dark';
  document.body.dataset.theme = isDark ? 'light' : 'dark';
  themeButton.setAttribute('aria-label', isDark ? 'Switch to dark theme' : 'Switch to light theme');
});
