// popup.js - Script para el panel de administración

let currentEditId = null;
let currentEditCategory = null;
let currentEditTemplateId = null;

// Cargar textos guardados
async function loadSavedTexts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['savedTexts'], (result) => {
      resolve(result.savedTexts || {});
    });
  });
}

// Cargar categorías personalizadas
async function loadCustomCategories() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['customCategories'], (result) => {
      resolve(result.customCategories || getDefaultCategories());
    });
  });
}

// Cargar plantillas de formularios
async function loadFormTemplates() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['formTemplates'], (result) => {
      resolve(result.formTemplates || []);
    });
  });
}

// Categorías por defecto (sin emojis)
function getDefaultCategories() {
  return {
    evaluaciones: { label: 'Evaluaciones de Pacientes', color: '#4CAF50' },
    notas: { label: 'Notas de Progreso', color: '#2196F3' },
    diagnosticos: { label: 'Diagnósticos Comunes', color: '#FF9800' },
    instrucciones: { label: 'Instrucciones de Cuidado', color: '#9C27B0' }
  };
}

// Guardar textos
async function saveSavedTexts(texts) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ savedTexts: texts }, resolve);
  });
}

// Guardar categorías
async function saveCustomCategories(categories) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ customCategories: categories }, resolve);
  });
}

// Guardar plantillas de formularios
async function saveFormTemplates(templates) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ formTemplates: templates }, resolve);
  });
}

// Generar ID único
function generateId() {
  return Date.now();
}

// Generar key única para categoría
function generateCategoryKey(label) {
  return label.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 20) + '_' + Date.now();
}

// Renderizar textos
async function renderTexts() {
  const container = document.getElementById('texts-container');
  const savedTexts = await loadSavedTexts();
  const categories = await loadCustomCategories();

  container.innerHTML = '';

  // Actualizar estadísticas
  updateStats(savedTexts, categories);

  for (const [key, category] of Object.entries(categories)) {
    const items = savedTexts[key] || [];

    const section = document.createElement('div');
    section.className = 'category-section';
    section.style.borderLeft = `4px solid ${category.color}`;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'category-title';
    titleDiv.innerHTML = `
      <span>${category.label} (${items.length})</span>
      <div class="category-actions">
        <button class="btn-icon btn-edit-category" data-key="${key}" title="Editar categoría">Edit</button>
        <button class="btn-icon btn-delete-category" data-key="${key}" title="Eliminar categoría">Del</button>
      </div>
    `;
    section.appendChild(titleDiv);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: #999; font-size: 12px; padding: 10px; text-align: center;';
      empty.textContent = 'No hay textos en esta categoría';
      section.appendChild(empty);
    } else {
      items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'text-item';
        itemDiv.innerHTML = `
          <div class="text-item-actions">
            <button class="btn-icon btn-edit" data-id="${item.id}" data-category="${key}" title="Editar">Edit</button>
            <button class="btn-icon btn-delete" data-id="${item.id}" data-category="${key}" title="Eliminar">Del</button>
          </div>
          <div class="text-item-title">${item.title}</div>
          <div class="text-item-content">${item.text}</div>
        `;
        section.appendChild(itemDiv);
      });
    }

    container.appendChild(section);
  }

  // Agregar event listeners para textos
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      const category = e.target.getAttribute('data-category');
      editText(id, category);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      const category = e.target.getAttribute('data-category');
      deleteText(id, category);
    });
  });

  // Event listeners para categorías
  document.querySelectorAll('.btn-edit-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = e.target.closest('.btn-edit-category').getAttribute('data-key');
      editCategory(key);
    });
  });

  document.querySelectorAll('.btn-delete-category').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = e.target.closest('.btn-delete-category').getAttribute('data-key');
      deleteCategory(key);
    });
  });
}

// Renderizar plantillas de formularios
async function renderFormTemplates() {
  const container = document.getElementById('templates-container');
  const templates = await loadFormTemplates();

  container.innerHTML = '';

  if (templates.length === 0) {
    container.innerHTML = '<div style="color: #999; text-align: center; padding: 40px;">No hay plantillas de signos vitales. Crea una para autocompletar formularios rápidamente.</div>';
    return;
  }

  templates.forEach(template => {
    const templateDiv = document.createElement('div');
    templateDiv.className = 'template-item';

    const fieldsPreview = `
      Temp: ${template.fields.temperature || '-'} | 
      BP: ${template.fields.bp_prior_1 || '-'}/${template.fields.bp_prior_2 || '-'} | 
      HR: ${template.fields.heart_rate_prior || '-'} | 
      Resp: ${template.fields.respirations_prior || '-'}
    `;

    templateDiv.innerHTML = `
      <div class="template-actions">
        <button class="btn-icon btn-edit-template" data-id="${template.id}" title="Editar">Edit</button>
        <button class="btn-icon btn-delete-template" data-id="${template.id}" title="Eliminar">Del</button>
      </div>
      <div class="template-name">${template.name}</div>
      <div class="template-preview">${fieldsPreview}</div>
    `;
    container.appendChild(templateDiv);
  });

  // Event listeners para plantillas
  document.querySelectorAll('.btn-edit-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      editTemplate(id);
    });
  });

  document.querySelectorAll('.btn-delete-template').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      deleteTemplate(id);
    });
  });
}

// Actualizar estadísticas
function updateStats(savedTexts, categories) {
  const statsContainer = document.getElementById('stats-container');
  statsContainer.innerHTML = '';

  let totalTexts = 0;
  for (const [key, category] of Object.entries(categories)) {
    const count = savedTexts[key]?.length || 0;
    totalTexts += count;

    const statCard = document.createElement('div');
    statCard.className = 'stat-card';
    statCard.style.borderTop = `3px solid ${category.color}`;
    statCard.innerHTML = `
      <div class="stat-number">${count}</div>
      <div class="stat-label">${category.label}</div>
    `;
    statsContainer.appendChild(statCard);
  }

  // Total
  const totalCard = document.createElement('div');
  totalCard.className = 'stat-card stat-card-total';
  totalCard.innerHTML = `
    <div class="stat-number">${totalTexts}</div>
    <div class="stat-label">Total</div>
  `;
  statsContainer.appendChild(totalCard);
}

// Abrir modal para agregar texto
async function openAddModal() {
  currentEditId = null;
  currentEditCategory = null;
  document.getElementById('modal-title').textContent = 'Agregar Nuevo Texto';

  const categories = await loadCustomCategories();
  const select = document.getElementById('input-category');
  select.innerHTML = '';

  for (const [key, category] of Object.entries(categories)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = category.label;
    select.appendChild(option);
  }

  document.getElementById('input-title').value = '';
  document.getElementById('input-text').value = '';
  document.getElementById('modal-edit').classList.add('active');
}

// Editar texto
async function editText(id, category) {
  const savedTexts = await loadSavedTexts();
  const categories = await loadCustomCategories();
  const item = savedTexts[category]?.find(i => i.id === id);

  if (item) {
    currentEditId = id;
    currentEditCategory = category;
    document.getElementById('modal-title').textContent = 'Editar Texto';

    const select = document.getElementById('input-category');
    select.innerHTML = '';

    for (const [key, cat] of Object.entries(categories)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = cat.label;
      if (key === category) option.selected = true;
      select.appendChild(option);
    }

    document.getElementById('input-title').value = item.title;
    document.getElementById('input-text').value = item.text;
    document.getElementById('modal-edit').classList.add('active');
  }
}

// Eliminar texto
async function deleteText(id, category) {
  if (confirm('¿Estás seguro de que quieres eliminar este texto?')) {
    const savedTexts = await loadSavedTexts();
    savedTexts[category] = savedTexts[category].filter(i => i.id !== id);
    await saveSavedTexts(savedTexts);
    renderTexts();
  }
}

// Guardar texto (nuevo o editado)
async function saveText(category, title, text) {
  const savedTexts = await loadSavedTexts();

  if (currentEditId && currentEditCategory) {
    const oldCategory = currentEditCategory;

    if (oldCategory === category) {
      const item = savedTexts[category]?.find(i => i.id === currentEditId);
      if (item) {
        item.title = title;
        item.text = text;
      }
    } else {
      const itemIndex = savedTexts[oldCategory]?.findIndex(i => i.id === currentEditId) ?? -1;
      if (itemIndex !== -1) {
        const item = savedTexts[oldCategory].splice(itemIndex, 1)[0];
        item.title = title;
        item.text = text;
        if (!savedTexts[category]) savedTexts[category] = [];
        savedTexts[category].push(item);
      }
    }
  } else {
    const newItem = {
      id: generateId(),
      title: title,
      text: text
    };
    if (!savedTexts[category]) savedTexts[category] = [];
    savedTexts[category].push(newItem);
  }

  await saveSavedTexts(savedTexts);
  closeModal();
  renderTexts();
}

// Abrir modal para agregar categoría
function openAddCategoryModal() {
  document.getElementById('modal-category-title').textContent = 'Agregar Nueva Categoría';
  document.getElementById('category-key-input').value = '';
  document.getElementById('category-key-input').disabled = false;
  document.getElementById('category-label-input').value = '';
  document.getElementById('category-color-input').value = '#4CAF50';
  document.getElementById('modal-category').classList.add('active');
}

// Editar categoría
async function editCategory(key) {
  const categories = await loadCustomCategories();
  const category = categories[key];

  if (category) {
    document.getElementById('modal-category-title').textContent = 'Editar Categoría';
    document.getElementById('category-key-input').value = key;
    document.getElementById('category-key-input').disabled = true;
    document.getElementById('category-label-input').value = category.label;
    document.getElementById('category-color-input').value = category.color;
    document.getElementById('modal-category').classList.add('active');
  }
}

// Eliminar categoría
async function deleteCategory(key) {
  const savedTexts = await loadSavedTexts();
  const itemCount = savedTexts[key]?.length || 0;

  if (itemCount > 0) {
    if (!confirm(`Esta categoría tiene ${itemCount} texto(s). ¿Estás seguro de eliminarla? Los textos se perderán.`)) {
      return;
    }
  } else {
    if (!confirm('¿Estás seguro de eliminar esta categoría?')) {
      return;
    }
  }

  const categories = await loadCustomCategories();
  delete categories[key];
  delete savedTexts[key];

  await saveCustomCategories(categories);
  await saveSavedTexts(savedTexts);
  renderTexts();
}

// Guardar categoría
async function saveCategory(key, label, color) {
  const categories = await loadCustomCategories();
  const savedTexts = await loadSavedTexts();

  if (!key) {
    key = generateCategoryKey(label);
  }

  if (!categories[key]) {
    savedTexts[key] = [];
  }

  categories[key] = { label, color };

  await saveCustomCategories(categories);
  await saveSavedTexts(savedTexts);
  closeCategoryModal();
  renderTexts();
}

// Abrir modal para agregar plantilla
function openAddTemplateModal() {
  currentEditTemplateId = null;
  document.getElementById('modal-template-title').textContent = 'Agregar Plantilla de Signos Vitales';
  document.getElementById('template-name-input').value = '';
  document.getElementById('template-temp').value = '';
  document.getElementById('template-bp-prior-1').value = '';
  document.getElementById('template-bp-prior-2').value = '';
  document.getElementById('template-bp-post-1').value = '';
  document.getElementById('template-bp-post-2').value = '';
  document.getElementById('template-hr-prior').value = '';
  document.getElementById('template-hr-post').value = '';
  document.getElementById('template-resp-prior').value = '';
  document.getElementById('template-resp-post').value = '';
  document.getElementById('modal-template').classList.add('active');
}

// Editar plantilla
async function editTemplate(id) {
  const templates = await loadFormTemplates();
  const template = templates.find(t => t.id === id);

  if (template) {
    currentEditTemplateId = id;
    document.getElementById('modal-template-title').textContent = 'Editar Plantilla';
    document.getElementById('template-name-input').value = template.name;
    document.getElementById('template-temp').value = template.fields.temperature || '';
    document.getElementById('template-bp-prior-1').value = template.fields.bp_prior_1 || '';
    document.getElementById('template-bp-prior-2').value = template.fields.bp_prior_2 || '';
    document.getElementById('template-bp-post-1').value = template.fields.bp_post_1 || '';
    document.getElementById('template-bp-post-2').value = template.fields.bp_post_2 || '';
    document.getElementById('template-hr-prior').value = template.fields.heart_rate_prior || '';
    document.getElementById('template-hr-post').value = template.fields.heart_rate_post || '';
    document.getElementById('template-resp-prior').value = template.fields.respirations_prior || '';
    document.getElementById('template-resp-post').value = template.fields.respirations_post || '';
    document.getElementById('modal-template').classList.add('active');
  }
}

// Eliminar plantilla
async function deleteTemplate(id) {
  if (confirm('¿Estás seguro de eliminar esta plantilla?')) {
    const templates = await loadFormTemplates();
    const filtered = templates.filter(t => t.id !== id);
    await saveFormTemplates(filtered);
    renderFormTemplates();
  }
}

// Guardar plantilla
async function saveTemplate(name, fields) {
  const templates = await loadFormTemplates();

  if (currentEditTemplateId) {
    const template = templates.find(t => t.id === currentEditTemplateId);
    if (template) {
      template.name = name;
      template.fields = fields;
    }
  } else {
    templates.push({
      id: generateId(),
      name: name,
      fields: fields
    });
  }

  await saveFormTemplates(templates);
  closeTemplateModal();
  renderFormTemplates();
}

// Cerrar modales
function closeModal() {
  document.getElementById('modal-edit').classList.remove('active');
  currentEditId = null;
  currentEditCategory = null;
}

function closeCategoryModal() {
  document.getElementById('modal-category').classList.remove('active');
}

function closeTemplateModal() {
  document.getElementById('modal-template').classList.remove('active');
  currentEditTemplateId = null;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
      });
      document.getElementById(`tab-${tabName}`).style.display = 'block';

      if (tabName === 'templates') {
        renderFormTemplates();
      }
    });
  });

  // Botón agregar texto
  document.getElementById('btn-add-new')?.addEventListener('click', openAddModal);

  // Botón agregar categoría
  document.getElementById('btn-add-category')?.addEventListener('click', openAddCategoryModal);

  // Botón agregar plantilla
  document.getElementById('btn-add-template')?.addEventListener('click', openAddTemplateModal);

  // Formulario texto
  document.getElementById('form-text')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const category = document.getElementById('input-category').value;
    const title = document.getElementById('input-title').value.trim();
    const text = document.getElementById('input-text').value.trim();

    if (title && text) {
      saveText(category, title, text);
    }
  });

  // Formulario categoría
  document.getElementById('form-category')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('category-key-input').value.trim();
    const label = document.getElementById('category-label-input').value.trim();
    const color = document.getElementById('category-color-input').value;

    if (label) {
      saveCategory(key, label, color);
    }
  });

  // Formulario plantilla
  document.getElementById('form-template')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('template-name-input').value.trim();
    const fields = {
      temperature: document.getElementById('template-temp').value.trim(),
      bp_prior_1: document.getElementById('template-bp-prior-1').value.trim(),
      bp_prior_2: document.getElementById('template-bp-prior-2').value.trim(),
      bp_post_1: document.getElementById('template-bp-post-1').value.trim(),
      bp_post_2: document.getElementById('template-bp-post-2').value.trim(),
      heart_rate_prior: document.getElementById('template-hr-prior').value.trim(),
      heart_rate_post: document.getElementById('template-hr-post').value.trim(),
      respirations_prior: document.getElementById('template-resp-prior').value.trim(),
      respirations_post: document.getElementById('template-resp-post').value.trim()
    };

    if (name) {
      saveTemplate(name, fields);
    }
  });

  // Botones cancelar
  document.getElementById('btn-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel-category')?.addEventListener('click', closeCategoryModal);
  document.getElementById('btn-cancel-template')?.addEventListener('click', closeTemplateModal);

  // Cerrar modales al hacer click fuera
  document.getElementById('modal-edit')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-edit') closeModal();
  });

  document.getElementById('modal-category')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-category') closeCategoryModal();
  });

  document.getElementById('modal-template')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-template') closeTemplateModal();
  });

  // Cargar datos iniciales
  renderTexts();

  // ── Exportar Backup ──────────────────────────────────────
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    const savedTexts = await loadSavedTexts();
    const customCategories = await loadCustomCategories();
    const formTemplates = await loadFormTemplates();

    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      savedTexts,
      customCategories,
      formTemplates
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinnser-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Importar Backup ──────────────────────────────────────
  document.getElementById('input-import')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const status = document.getElementById('import-status');
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);

        // Validar que tenga la estructura correcta
        if (!backup.savedTexts || !backup.customCategories) {
          status.textContent = 'Archivo invalido.';
          status.style.color = '#c00';
          return;
        }

        // Sobreescribir todo
        await saveSavedTexts(backup.savedTexts);
        await saveCustomCategories(backup.customCategories);
        await saveFormTemplates(backup.formTemplates || []);

        status.textContent = 'Importado correctamente.';
        status.style.color = '#333';

        // Refrescar la UI
        renderTexts();

        // Limpiar el input para poder reimportar el mismo archivo si hace falta
        e.target.value = '';

        // Quitar el mensaje tras 3 segundos
        setTimeout(() => { status.textContent = ''; }, 3000);

      } catch (err) {
        status.textContent = 'Error al leer el archivo.';
        status.style.color = '#c00';
      }
    };

    reader.readAsText(file);
  });
});
