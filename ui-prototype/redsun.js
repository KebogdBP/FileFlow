const sourceButtons = document.querySelectorAll('[data-source]');
const fileInput = document.querySelector('#redsun-file');
const drop = document.querySelector('#redsun-drop');
const uploaded = document.querySelector('#uploaded-file');
const quality = document.querySelector('#redsun-quality');
const qualityValue = document.querySelector('#redsun-quality-value');
const processButton = document.querySelector('#redsun-process');
const toast = document.querySelector('#redsun-toast');
const nav = document.querySelector('#site-nav');

sourceButtons.forEach((button) => button.addEventListener('click', () => {
  sourceButtons.forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.source-panel').forEach((panel) => panel.classList.remove('active'));
  document.querySelector(`#${button.dataset.source}-source`).classList.add('active');
}));

quality.addEventListener('input', () => { qualityValue.textContent = `${quality.value}%`; });
fileInput.addEventListener('change', () => updateFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.add('drag'); }));
['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove('drag'); }));
drop.addEventListener('drop', (event) => updateFile(event.dataTransfer.files[0]));

function updateFile(file) {
  if (!file) return;
  uploaded.querySelector('strong').textContent = file.name;
  uploaded.querySelector('small').textContent = `${formatSize(file.size)} · Ready to inspect`;
  uploaded.querySelector('.file-art').textContent = (file.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase();
}
function formatSize(bytes) { return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`; }

processButton.addEventListener('click', () => {
  processButton.classList.add('loading'); processButton.querySelector('span').textContent = 'Processing locally…';
  setTimeout(() => {
    processButton.classList.remove('loading'); processButton.querySelector('span').textContent = 'Process file';
    toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3200);
  }, 1100);
});

document.querySelector('#menu-toggle').addEventListener('click', () => nav.classList.toggle('open'));
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));
