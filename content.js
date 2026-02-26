// content.js - Script que se ejecuta en las páginas web

let activeInput = null;
let dropdownMenu = null;

// Cargar textos guardados del storage
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

// Crear el menú desplegable
function createDropdownMenu() {
  const menu = document.createElement('div');
  menu.id = 'kinnser-autofill-menu';
  menu.className = 'kinnser-autofill-dropdown';
  menu.innerHTML = `
    <div class="kinnser-autofill-header">
      <input type="text" id="kinnser-search" placeholder="Buscar..." class="kinnser-search">
      <button id="kinnser-close" class="kinnser-close-btn">×</button>
    </div>
    <div class="kinnser-autofill-content" id="kinnser-content"></div>
  `;
  document.body.appendChild(menu);
  return menu;
}

// Crear menú de plantillas de signos vitales
function createVitalsMenu() {
  const menu = document.createElement('div');
  menu.id = 'kinnser-vitals-menu';
  menu.className = 'kinnser-vitals-dropdown';
  menu.innerHTML = `
    <div class="kinnser-vitals-header">
      <span class="kinnser-vitals-title">Autocompletar Signos Vitales</span>
      <button id="kinnser-vitals-close" class="kinnser-close-btn">×</button>
    </div>
    <div class="kinnser-vitals-content" id="kinnser-vitals-content"></div>
  `;
  document.body.appendChild(menu);
  return menu;
}

// Mostrar el menú con las opciones
async function showMenu(inputElement) {
  activeInput = inputElement;

  if (!dropdownMenu) {
    dropdownMenu = createDropdownMenu();
    setupMenuEvents();
  }

  const savedTexts = await loadSavedTexts();
  const categories = await loadCustomCategories();
  renderMenuContent(savedTexts, categories);

  const rect = inputElement.getBoundingClientRect();
  dropdownMenu.style.top = `${rect.bottom + window.scrollY + 5}px`;
  dropdownMenu.style.left = `${rect.left + window.scrollX}px`;
  dropdownMenu.style.display = 'block';

  setTimeout(() => {
    document.getElementById('kinnser-search').focus();
  }, 100);
}

// Detectar si estamos en un formulario de signos vitales
function isVitalsForm() {
  const hasTemp = document.querySelector('input[name*="temperature" i], input[id*="temperature" i]');
  const hasBP = document.querySelector('input[name*="bp" i], input[id*="bp" i], input[name*="pressure" i]');
  const hasHR = document.querySelector('input[name*="heart" i], input[id*="pulse" i]');

  return hasTemp || hasBP || hasHR;
}

// Mostrar botones flotantes
function showVitalsButton() {
  // Eliminar contenedor anterior si existe
  const existingContainer = document.getElementById('kinnser-floating-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // Contenedor de ambos botones
  const container = document.createElement('div');
  container.id = 'kinnser-floating-container';
  container.className = 'kinnser-floating-container';

  // Botón 1: Autocompletar signos vitales (icono sync + rayo)
  const vitalsBtn = document.createElement('button');
  vitalsBtn.id = 'kinnser-vitals-floating-btn';
  vitalsBtn.className = 'kinnser-vitals-floating-btn';
  vitalsBtn.title = 'Autocompletar Signos Vitales';
  vitalsBtn.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Arco de sincronización superior -->
      <path d="M20 12a8 8 0 0 0-8-8" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M4 12a8 8 0 0 0 8 8" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Flechas de sincronización -->
      <polyline points="17,7 20,4 23,7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="1,17 4,20 7,17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Rayo central -->
      <polygon points="13,2 9,13 12,13 11,22 15,11 12,11" fill="white"/>
    </svg>
  `;
  vitalsBtn.addEventListener('click', async () => {
    await showVitalsTemplateMenu(vitalsBtn);
  });

  // Botón 2: Función Prior solamente (letra P)
  const pBtn = document.createElement('button');
  pBtn.id = 'kinnser-p-floating-btn';
  pBtn.className = 'kinnser-p-floating-btn';
  pBtn.title = 'Solo Temperatura y Prior';
  pBtn.textContent = 'P';
  pBtn.addEventListener('click', async () => {
    await showVitalsTemplateMenu(pBtn, true); // true indica que es solo Prior
  });

  container.appendChild(pBtn);
  container.appendChild(vitalsBtn);
  document.body.appendChild(container);
}

// Mostrar menú de plantillas de signos vitales - POPUP ARRIBA
async function showVitalsTemplateMenu(buttonElement, onlyPrior = false) {
  const templates = await loadFormTemplates();

  const menuId = onlyPrior ? 'kinnser-p-menu' : 'kinnser-vitals-menu';
  let menu = document.getElementById(menuId);
  if (!menu) {
    menu = createVitalsMenu(menuId, onlyPrior ? 'Solo Temperatura y Prior' : 'Autocompletar Signos Vitales');
    setupVitalsMenuEvents(menuId, buttonElement.id);
  }

  const contentId = menuId + '-content';
  const content = document.getElementById(contentId);
  content.innerHTML = '';

  if (templates.length === 0) {
    content.innerHTML = `
      <div class="kinnser-vitals-empty">
        <p>No tienes plantillas de signos vitales.</p>
        <p>Crea una en el panel de gestión de la extensión.</p>
      </div>
    `;
  } else {
    templates.forEach(template => {
      const templateDiv = document.createElement('div');
      templateDiv.className = 'kinnser-vitals-item';
      templateDiv.innerHTML = `
        <div class="kinnser-vitals-item-name">${template.name}</div>
        <div class="kinnser-vitals-item-preview">
          ${onlyPrior ?
          `Temp: ${template.fields.temperature || '-'} | BP: ${template.fields.bp_prior_1 || '-'}/${template.fields.bp_prior_2 || '-'}` :
          `Temp: ${template.fields.temperature || '-'} | BP: ${template.fields.bp_prior_1 || '-'}/${template.fields.bp_prior_2 || '-'} → ${template.fields.bp_post_1 || '-'}/${template.fields.bp_post_2 || '-'}`
        }
        </div>
      `;
      templateDiv.addEventListener('click', () => {
        fillVitalsForm(template.fields, onlyPrior);
        hideVitalsMenu(menuId);
      });
      content.appendChild(templateDiv);
    });
  }

  // POSICIONAR POPUP ARRIBA DEL BOTÓN
  const rect = buttonElement.getBoundingClientRect();
  const menuHeight = 300;
  menu.style.top = `${rect.top + window.scrollY - menuHeight - 10}px`;
  menu.style.left = `${rect.left + window.scrollX - 200}px`;
  menu.style.display = 'block';
}

// Crear menú de plantillas genérico
function createVitalsMenu(id, title) {
  const menu = document.createElement('div');
  menu.id = id;
  menu.className = 'kinnser-vitals-dropdown';
  menu.innerHTML = `
    <div class="kinnser-vitals-header">
      <span class="kinnser-vitals-title">${title}</span>
      <button id="${id}-close" class="kinnser-close-btn">×</button>
    </div>
    <div class="kinnser-vitals-content" id="${id}-content"></div>
  `;
  document.body.appendChild(menu);

  // Evento cerrar específico
  document.getElementById(`${id}-close`).addEventListener('click', () => hideVitalsMenu(id));

  return menu;
}

// Función para llenar campo con múltiples intentos de eventos
function fillField(input, value) {
  if (!input || !value) return false;

  input.value = value;
  input.focus();

  const events = [
    new Event('focus', { bubbles: true }),
    new Event('input', { bubbles: true }),
    new Event('change', { bubbles: true }),
    new Event('blur', { bubbles: true }),
    new KeyboardEvent('keydown', { key: value, bubbles: true }),
    new KeyboardEvent('keypress', { key: value, bubbles: true }),
    new KeyboardEvent('keyup', { key: value, bubbles: true })
  ];

  events.forEach(event => input.dispatchEvent(event));

  if (input.value !== value) {
    input.value = value;
  }

  return true;
}

// Función para seleccionar opción en un select por índice
function selectOptionByIndex(select, index) {
  if (!select || select.options.length <= index) return false;

  select.selectedIndex = index;

  const events = [
    new Event('focus', { bubbles: true }),
    new Event('change', { bubbles: true }),
    new Event('input', { bubbles: true }),
    new Event('blur', { bubbles: true })
  ];

  events.forEach(event => select.dispatchEvent(event));
  return true;
}

// Buscar inputs de texto en una fila específica (excluyendo dropdowns)
function findInputsInRow(rowLabel) {
  const allElements = Array.from(document.querySelectorAll('*'));

  for (const element of allElements) {
    const text = element.textContent.trim();

    // Buscar el elemento que contiene EXACTAMENTE la etiqueta de la fila
    if (text === rowLabel && text.length < 20) {
      // Encontrar el contenedor de la fila
      const row = element.closest('tr, div[class*="row"]') || element.parentElement;

      if (row) {
        // Buscar SOLO inputs de texto, excluyendo dropdowns y selects
        const inputs = Array.from(row.querySelectorAll('input')).filter(input => {
          // Excluir dropdowns, selects, readonly, hidden
          const isTextInput = (input.type === 'text' || !input.type) &&
            input.tagName === 'INPUT' &&
            !input.hasAttribute('readonly') &&
            !input.hasAttribute('hidden');

          // Verificar que el input sea visible
          const isVisible = input.offsetWidth > 0 && input.offsetHeight > 0;

          return isTextInput && isVisible;
        });

        return inputs;
      }
    }
  }
  return [];
}

// Autocompletar formulario de signos vitales - FILTRO POR BOTÓN
function fillVitalsForm(fields, onlyPrior = false) {
  console.log(`=== Iniciando autocompletado (${onlyPrior ? 'SOLO Prior' : 'Prior y Post'}) ===`);
  console.log('Valores a llenar:', fields);
  let filledCount = 0;

  // 1. TEMPERATURA - Buscar de forma específica
  if (fields.temperature) {
    const tempLabels = Array.from(document.querySelectorAll('*')).filter(el => {
      const text = el.textContent.trim();
      return text === 'Temperature:';
    });

    if (tempLabels.length > 0) {
      const tempSection = tempLabels[0].closest('tr, div, table') || tempLabels[0].parentElement;
      if (tempSection) {
        // Llenar valor de temperatura
        const tempInputs = Array.from(tempSection.querySelectorAll('input')).filter(input => {
          return (input.type === 'text' || !input.type) &&
            input.offsetWidth > 0 &&
            input.offsetHeight > 0;
        });

        if (tempInputs.length > 0 && fillField(tempInputs[0], fields.temperature)) {
          console.log('✓ Temperatura llenada:', fields.temperature);
          filledCount++;
        }

        // Llenar select "taken" (Temporal - 5ta opción = índice 4)
        const tempSelects = Array.from(tempSection.querySelectorAll('select'));
        if (tempSelects.length > 0) {
          if (selectOptionByIndex(tempSelects[0], 4)) {
            console.log('✓ Select "taken" completado (Temporal)');
            filledCount++;
          }
        }
      }
    }
  }

  // Helper: obtener inputs visibles de texto de un elemento fila
  function getRowInputs(rowEl) {
    return Array.from(rowEl.querySelectorAll('input')).filter(input => {
      return (input.type === 'text' || !input.type) &&
        input.tagName === 'INPUT' &&
        !input.hasAttribute('readonly') &&
        !input.hasAttribute('hidden') &&
        input.offsetWidth > 0 &&
        input.offsetHeight > 0;
    });
  }

  // Helper: obtener selects visibles de un elemento fila
  function getRowSelects(rowEl) {
    return Array.from(rowEl.querySelectorAll('select')).filter(select => {
      return select.offsetWidth > 0 && select.offsetHeight > 0;
    });
  }

  // 2. PRIOR - Encontrar la fila Prior (la que tiene texto exacto "Prior" sin ser select)
  console.log('\n--- Llenando fila PRIOR ---');
  let priorRowEl = null;
  const allElements = Array.from(document.querySelectorAll('*'));
  for (const el of allElements) {
    if (el.tagName === 'SELECT') continue; // ignorar selects (su textContent mezcla todas las opciones)
    const text = el.textContent.trim();
    if (text === 'Prior' && text.length < 20) {
      const row = el.closest('tr') || el.parentElement;
      if (row && getRowInputs(row).length >= 2) {
        priorRowEl = row;
        break;
      }
    }
  }

  const priorInputs = priorRowEl ? getRowInputs(priorRowEl) : [];
  console.log('Inputs encontrados en fila Prior:', priorInputs.length);

  if (priorInputs.length >= 4) {
    if (fields.bp_prior_1 && fillField(priorInputs[0], fields.bp_prior_1)) {
      console.log('✓ BP Prior 1 llenado:', fields.bp_prior_1);
      filledCount++;
    }
    if (fields.bp_prior_2 && fillField(priorInputs[1], fields.bp_prior_2)) {
      console.log('✓ BP Prior 2 llenado:', fields.bp_prior_2);
      filledCount++;
    }
    if (fields.heart_rate_prior && fillField(priorInputs[2], fields.heart_rate_prior)) {
      console.log('✓ Heart Rate Prior llenado:', fields.heart_rate_prior);
      filledCount++;
    }
    if (fields.respirations_prior && fillField(priorInputs[3], fields.respirations_prior)) {
      console.log('✓ Respirations Prior llenado:', fields.respirations_prior);
      filledCount++;
    }
  }

  // Llenar dropdowns en fila Prior (Sitting y Left)
  const priorSelects = priorRowEl ? getRowSelects(priorRowEl) : [];
  if (priorSelects.length >= 2) {
    // Si la fila empieza con un select de etiqueta (Prior/Post), desfasamos los índices
    const offset = priorSelects[0].textContent.includes('Prior') || priorSelects[0].textContent.includes('Post') ? 1 : 0;

    if (priorSelects.length >= offset + 2) {
      if (selectOptionByIndex(priorSelects[offset], 2)) { // Position: 3ra opción = índice 2 (Sitting)
        console.log('✓ Position Prior completado (Sitting)');
        filledCount++;
      }
      if (selectOptionByIndex(priorSelects[offset + 1], 1)) { // Side: 2da opción = índice 1 (Left)
        console.log('✓ Side Prior completado (Left)');
        filledCount++;
      }
    }
  }

  if (onlyPrior) {
    console.log('\n=== Autocompletado Prior finalizado (modo selectivo) ===');
    showNotification(`✓ ${filledCount} campos completados (Solo Prior)`);
    return;
  }

  // 3. POST - Navegar desde la fila Prior: 2 filas hacia abajo (Prior → During → Post)
  console.log('\n--- Llenando fila POST ---');
  let postInputs = [];

  if (priorRowEl) {
    const parentBody = priorRowEl.parentElement;
    if (parentBody) {
      const siblingRows = Array.from(parentBody.children).filter(el => el.tagName === 'TR');
      const priorIdx = siblingRows.indexOf(priorRowEl);
      // Post está 2 filas después de Prior (saltando la fila During)
      if (priorIdx !== -1 && priorIdx + 2 < siblingRows.length) {
        const postRowEl = siblingRows[priorIdx + 2];
        postInputs = getRowInputs(postRowEl);
        console.log('Fila Post encontrada por navegación (index ' + (priorIdx + 2) + ')');
      }
    }
  }

  // Fallback: búsqueda por texto si la navegación no dio suficientes inputs
  if (postInputs.length < 4) {
    console.log('Fallback: buscando fila Post por texto...');
    postInputs = findInputsInRow('Post');
  }

  console.log('Inputs encontrados en fila Post:', postInputs.length);

  if (postInputs.length >= 4) {
    if (fields.bp_post_1 && fillField(postInputs[0], fields.bp_post_1)) {
      console.log('✓ BP Post 1 llenado:', fields.bp_post_1);
      filledCount++;
    }
    if (fields.bp_post_2 && fillField(postInputs[1], fields.bp_post_2)) {
      console.log('✓ BP Post 2 llenado:', fields.bp_post_2);
      filledCount++;
    }
    if (fields.heart_rate_post && fillField(postInputs[2], fields.heart_rate_post)) {
      console.log('✓ Heart Rate Post llenado:', fields.heart_rate_post);
      filledCount++;
    }
    if (fields.respirations_post && fillField(postInputs[3], fields.respirations_post)) {
      console.log('✓ Respirations Post llenado:', fields.respirations_post);
      filledCount++;
    }
  }

  // Llenar dropdowns en fila Post (Sitting y Left)
  // Re-obtener el elemento de fila para Post de forma segura
  let postRowElFinal = null;
  if (priorRowEl) {
    const siblingRows = Array.from(priorRowEl.parentElement.children).filter(el => el.tagName === 'TR');
    const priorIdx = siblingRows.indexOf(priorRowEl);
    if (priorIdx !== -1 && priorIdx + 2 < siblingRows.length) {
      postRowElFinal = siblingRows[priorIdx + 2];
    }
  }

  const postSelects = postRowElFinal ? getRowSelects(postRowElFinal) : [];
  if (postSelects.length >= 2) {
    const offset = postSelects[0].textContent.includes('Prior') || postSelects[0].textContent.includes('Post') ? 1 : 0;
    if (postSelects.length >= offset + 2) {
      if (selectOptionByIndex(postSelects[offset], 2)) { // Position: Sitting
        console.log('✓ Position Post completado (Sitting)');
        filledCount++;
      }
      if (selectOptionByIndex(postSelects[offset + 1], 1)) { // Side: Left
        console.log('✓ Side Post completado (Left)');
        filledCount++;
      }
    }
  }

  console.log('\n=== Total de campos llenados:', filledCount, '===');
  console.log('NOTA: Los campos During se dejan vacíos intencionalmente\n');

  // Mostrar notificación
  if (filledCount > 0) {
    showNotification(`✓ ${filledCount} campos completados (Prior y Post)`);
  } else {
    showNotification('⚠ No se encontraron campos. Abre la consola (Cmd+Option+I) para detalles.');
  }
}

// Mostrar notificación temporal
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'kinnser-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('kinnser-notification-show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('kinnser-notification-show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Renderizar el contenido del menú
function renderMenuContent(savedTexts, categories, searchTerm = '') {
  const content = document.getElementById('kinnser-content');
  content.innerHTML = '';

  let hasResults = false;

  for (const [key, category] of Object.entries(categories)) {
    const items = savedTexts[key] || [];
    const filteredItems = searchTerm
      ? items.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.text.toLowerCase().includes(searchTerm.toLowerCase())
      )
      : items;

    if (filteredItems.length > 0) {
      hasResults = true;
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'kinnser-category';

      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'kinnser-category-header';
      categoryHeader.style.color = category.color;
      categoryHeader.textContent = category.label;
      categoryDiv.appendChild(categoryHeader);

      filteredItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'kinnser-item';
        itemDiv.innerHTML = `
          <div class="kinnser-item-title">${item.title}</div>
          <div class="kinnser-item-preview">${item.text.substring(0, 80)}...</div>
        `;
        itemDiv.addEventListener('click', () => insertText(item.text));
        categoryDiv.appendChild(itemDiv);
      });

      content.appendChild(categoryDiv);
    }
  }

  if (!hasResults) {
    content.innerHTML = '<div class="kinnser-no-results">No se encontraron resultados</div>';
  }
}

// Configurar eventos del menú
function setupMenuEvents() {
  document.getElementById('kinnser-close').addEventListener('click', hideMenu);

  document.getElementById('kinnser-search').addEventListener('input', async (e) => {
    const savedTexts = await loadSavedTexts();
    const categories = await loadCustomCategories();
    renderMenuContent(savedTexts, categories, e.target.value);
  });

  document.addEventListener('click', (e) => {
    if (dropdownMenu &&
      !dropdownMenu.contains(e.target) &&
      e.target !== activeInput) {
      hideMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (dropdownMenu && dropdownMenu.style.display === 'block') {
      if (e.key === 'Escape') {
        hideMenu();
      }
    }
  });
}

// Configurar eventos del menú de signos vitales
function setupVitalsMenuEvents(menuId, buttonId) {
  document.addEventListener('click', (e) => {
    const menu = document.getElementById(menuId);
    const button = document.getElementById(buttonId);
    if (menu &&
      !menu.contains(e.target) &&
      e.target !== button) {
      hideVitalsMenu(menuId);
    }
  });
}

// Insertar texto en el input
function insertText(text) {
  if (activeInput) {
    if (activeInput.tagName === 'TEXTAREA' || activeInput.tagName === 'INPUT') {
      activeInput.value = text;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      activeInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (activeInput.isContentEditable) {
      activeInput.textContent = text;
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    activeInput.focus();
  }
  hideMenu();
}

// Ocultar menú
function hideMenu() {
  if (dropdownMenu) {
    dropdownMenu.style.display = 'none';
    document.getElementById('kinnser-search').value = '';
  }
}

// Ocultar menú de signos vitales
function hideVitalsMenu(id) {
  const menu = id ? document.getElementById(id) : document.querySelector('.kinnser-vitals-dropdown[style*="display: block"]');
  if (menu) {
    menu.style.display = 'none';
  }
}

// Detectar doble click para abrir el menú
document.addEventListener('dblclick', (e) => {
  const target = e.target;

  if ((target.tagName === 'TEXTAREA' ||
    (target.tagName === 'INPUT' && target.type === 'text') ||
    target.isContentEditable) &&
    !target.closest('#kinnser-autofill-menu')) {
    showMenu(target);
  }
});

// Detectar si estamos en un formulario de signos vitales y mostrar botón
window.addEventListener('load', () => {
  setTimeout(() => {
    if (isVitalsForm()) {
      showVitalsButton();
    }
  }, 1000);
});

// Re-detectar en cambios de DOM
const observer = new MutationObserver(() => {
  if (isVitalsForm() && !document.getElementById('kinnser-floating-container')) {
    showVitalsButton();
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('Kinnser AutoFill extension loaded! Double-click on any text field to use.');
