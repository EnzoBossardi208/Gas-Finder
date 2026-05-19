// ==================== ESTADO ====================
let currentUser = null;
let currentCity = null;
let currentStations = [];
let allStations = [];
let favorites = JSON.parse(localStorage.getItem('gf_favorites') || '[]');
let compareList = [];
let activeFilters = { sort: 'price', fuel: null, promoOnly: false };
let customPrices = JSON.parse(localStorage.getItem('gf_custom_prices') || '{}');

// ==================== ELEMENTOS ====================
const $ = id => document.getElementById(id);

const loginScreen = $('loginScreen');
const registerScreen = $('registerScreen');
const appScreen = $('appScreen');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const showRegisterBtn = $('showRegisterBtn');
const showLoginBtn = $('showLoginBtn');
const logoutBtn = $('logoutBtn');
const themeBtn = $('themeBtn');
const heroSection = $('heroSection');
const resultsArea = $('resultsArea');
const stationsGrid = $('stationsGrid');
const favGrid = $('favGrid');
const noResults = $('noResults');
const noFavs = $('noFavs');
const loader = $('loader');
const rankingStrip = $('rankingStrip');
const gridCount = $('gridCount');
const promosGrid = $('promosGrid');
const promosSection = $('promosSection');
const compareBtn = $('compareBtn');
const clearCmpBtn = $('clearCmpBtn');
const cmpCount = $('cmpCount');
const compareModal = $('compareModal');
const compareContent = $('compareContent');
const closeCmpModal = $('closeCmpModal');
const updateModal = $('updateModal');
const closeUpdateModal = $('closeUpdateModal');
const updatePricesBtn = $('updatePricesBtn');
const updateStation = $('updateStation');
const saveUpdateBtn = $('saveUpdateBtn');
const stickyCity = $('stickyCity');
const backBtn = $('backBtn');
const heroSearchInput = $('heroSearchInput');
const heroGeoBtn = $('heroGeoBtn');
const reportCity = $('reportCity');
const reportStation = $('reportStation');
const reportFuel = $('reportFuel');
const reportPrice = $('reportPrice');
const reportIsPromo = $('reportIsPromo');
const promoValidityField = $('promoValidityField');
const reportValidity = $('reportValidity');
const reportForm = $('reportForm');
const calcPrice = $('calcPrice');
const calcLiters = $('calcLiters');
const calcBtn = $('calcBtn');
const calcResult = $('calcResult');

// ==================== TEMA ====================
function initTheme() {
  const t = localStorage.getItem('gf_theme') || 'light';
  if (t === 'dark') {
    document.body.classList.add('dark');
    themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}

themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('gf_theme', isDark ? 'dark' : 'light');
  themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
});

initTheme();

// ==================== AUTH ====================
showRegisterBtn.addEventListener('click', e => {
  e.preventDefault();
  loginScreen.classList.remove('active');
  registerScreen.classList.add('active');
});

showLoginBtn.addEventListener('click', e => {
  e.preventDefault();
  registerScreen.classList.remove('active');
  loginScreen.classList.add('active');
});

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const pass = $('loginPassword').value.trim();
  if (!email || !pass) { showAlert('Preencha e-mail e senha.'); return; }
  currentUser = { email, name: email.split('@')[0] };
  loginScreen.classList.remove('active');
  appScreen.classList.add('active');
  initApp();
});

registerForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const pass = $('regPassword').value;
  const confirm = $('regConfirmPassword').value;
  if (!name || !email || !pass) { showAlert('Preencha todos os campos.'); return; }
  if (pass.length < 6) { showAlert('A senha deve ter ao menos 6 caracteres.'); return; }
  if (pass !== confirm) { showAlert('As senhas não coincidem.'); return; }
  showAlert('Conta criada! Faça login.', 'success');
  registerScreen.classList.remove('active');
  loginScreen.classList.add('active');
  registerForm.reset();
});

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  currentCity = null;
  currentStations = [];
  appScreen.classList.remove('active');
  loginScreen.classList.add('active');
  $('loginEmail').value = '';
  $('loginPassword').value = '';
  showView('search');
  heroSection.style.display = '';
  resultsArea.style.display = 'none';
});

// ==================== INIT ====================
function initApp() {
  showView('search');
  heroSection.style.display = '';
  resultsArea.style.display = 'none';
  updateHeroStats();
  populateReportCity();
  renderFavorites();
}

function updateHeroStats() {
  const total = getPostosPorCidade('Vera Cruz').length + getPostosPorCidade('Santa Cruz do Sul').length;
  const promos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].filter(p => p.hasPromotion).length;
  $('totalPostos').textContent = total;
  $('totalPromos').textContent = promos;
  $('vcCount').textContent = getPostosPorCidade('Vera Cruz').length + ' postos';
  $('scsCount').textContent = getPostosPorCidade('Santa Cruz do Sul').length + ' postos';
}

// ==================== VIEWS ====================
function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
  $(`${view}View`).classList.add('active');
  document.querySelector(`[data-view="${view}"]`)?.classList.add('active');
}

document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    showView(view);
    if (view === 'favorites') renderFavorites();
  });
});

// ==================== CITY CARDS ====================
document.querySelectorAll('.city-card').forEach(card => {
  card.addEventListener('click', () => loadCity(card.dataset.city));
});

backBtn.addEventListener('click', () => {
  heroSection.style.display = '';
  resultsArea.style.display = 'none';
  currentCity = null;
  currentStations = [];
});

// ==================== LOAD CITY ====================
function loadCity(cidade) {
  currentCity = cidade;
  stickyCity.textContent = cidade;
  loader.style.display = 'flex';
  heroSection.style.display = 'none';
  resultsArea.style.display = 'block';
  stationsGrid.innerHTML = '';
  noResults.style.display = 'none';

  // Simular carregamento
  setTimeout(() => {
    const postos = getPostosPorCidade(cidade).map(p => applyCustomPrices(p));
    allStations = postos;
    currentStations = postos;
    applyFilters();
    loader.style.display = 'none';
    populateUpdateStation(cidade);
  }, 400);
}

function applyCustomPrices(posto) {
  const cp = customPrices[posto.id];
  if (!cp) return posto;
  return { ...posto, ...cp };
}

// ==================== HERO SEARCH ====================
heroSearchInput.addEventListener('input', function() {
  const q = this.value.trim().toLowerCase();
  if (!q) return;

  // Buscar em todas as cidades
  const allPostos = [
    ...getPostosPorCidade('Vera Cruz'),
    ...getPostosPorCidade('Santa Cruz do Sul')
  ];
  const found = allPostos.find(p =>
    p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
  );
  if (found) {
    heroSearchInput.value = found.name;
    loadCity(found.city);
    setTimeout(() => {
      const card = document.querySelector(`[data-id="${found.id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 600);
  }
});

heroSearchInput.addEventListener('keypress', e => {
  if (e.key === 'Enter') {
    const q = heroSearchInput.value.trim().toLowerCase();
    if (!q) return;
    // Check if matches a city
    const city = CIDADES_DISPONIVEIS.find(c => c.toLowerCase().includes(q));
    if (city) loadCity(city);
  }
});

// ==================== GEOLOCATION ====================
heroGeoBtn.addEventListener('click', handleGeo);

function handleGeo() {
  if (!navigator.geolocation) { showAlert('Geolocalização não suportada neste navegador.'); return; }
  heroGeoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    // Calcular cidade mais próxima baseada em coordenadas
    const centroids = {
      "Vera Cruz": { lat: -29.7150, lng: -52.5083 },
      "Santa Cruz do Sul": { lat: -29.7175, lng: -52.4258 }
    };
    let closest = null;
    let minDist = Infinity;
    for (const [city, coord] of Object.entries(centroids)) {
      const d = Math.sqrt(Math.pow(lat - coord.lat, 2) + Math.pow(lng - coord.lng, 2));
      if (d < minDist) { minDist = d; closest = city; }
    }
    heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
    showAlert(`Localização detectada! Carregando ${closest}...`, 'success');
    setTimeout(() => loadCity(closest), 500);
  }, err => {
    heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
    showAlert('Não foi possível obter a localização. Verifique as permissões.');
  });
}

// ==================== FILTROS ====================
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const sort = chip.dataset.sort;
    const filter = chip.dataset.filter;
    const fuel = chip.dataset.fuel;

    if (sort) {
      document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
      chip.classList.add('active');
      activeFilters.sort = sort;
    }
    if (filter === 'promo') {
      chip.classList.toggle('active');
      activeFilters.promoOnly = chip.classList.contains('active');
    }
    if (fuel) {
      const wasActive = chip.classList.contains('active');
      document.querySelectorAll('[data-fuel]').forEach(b => b.classList.remove('active'));
      if (!wasActive) { chip.classList.add('active'); activeFilters.fuel = fuel; }
      else { activeFilters.fuel = null; }
    }
    applyFilters();
  });
});

function applyFilters() {
  let stations = [...allStations];

  // Filter by name/search
  const q = heroSearchInput.value.trim().toLowerCase();
  if (q && currentCity) {
    stations = stations.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    );
  }

  // Promo filter
  if (activeFilters.promoOnly) {
    stations = stations.filter(s => s.hasPromotion);
  }

  // Fuel filter
  if (activeFilters.fuel === 'gasolina') {
    stations = stations.filter(s => s.gasolinaComum > 0);
  } else if (activeFilters.fuel === 'etanol') {
    stations = stations.filter(s => s.etanol > 0);
  } else if (activeFilters.fuel === 'diesel') {
    stations = stations.filter(s => s.diesel > 0);
  }

  // Sort
  if (activeFilters.sort === 'price') {
    stations.sort((a, b) => a.gasolinaComum - b.gasolinaComum);
  } else if (activeFilters.sort === 'name') {
    stations.sort((a, b) => a.name.localeCompare(b.name));
  }

  currentStations = stations;
  renderStations(stations);
  renderRanking(stations);
  renderPromos(stations);
}

// ==================== RENDER STATIONS ====================
function renderStations(stations) {
  if (!stations.length) {
    stationsGrid.style.display = 'none';
    noResults.style.display = 'block';
    gridCount.textContent = '0 postos encontrados';
    return;
  }
  stationsGrid.style.display = 'grid';
  noResults.style.display = 'none';
  gridCount.textContent = `${stations.length} posto${stations.length > 1 ? 's' : ''} encontrado${stations.length > 1 ? 's' : ''}`;

  const cheapestPrice = Math.min(...stations.map(s => s.gasolinaComum));

  stationsGrid.innerHTML = stations.map(s => {
    const isCheapest = s.gasolinaComum === cheapestPrice;
    const isFav = favorites.includes(s.id);
    const isH24 = s.openingHours === '24h';
    const inCompare = compareList.includes(s.id);

    // Tags
    const tags = [];
    if (isCheapest) tags.push('<span class="tag tag-cheapest"><i class="fas fa-award"></i> Mais barato</span>');
    if (s.hasPromotion) tags.push('<span class="tag tag-promo"><i class="fas fa-tag"></i> Promoção</span>');
    if (isH24) tags.push('<span class="tag tag-h24">24h</span>');

    // Trend (simulado)
    const trendVal = (Math.random() * 0.08).toFixed(2);
    const trendDir = Math.random() > 0.55 ? 'up' : (Math.random() > 0.5 ? 'down' : 'stable');
    const trendHtml = trendDir === 'up'
      ? `<span class="trend-badge trend-up"><i class="fas fa-arrow-up"></i> +R$ ${trendVal} esta semana</span>`
      : trendDir === 'down'
        ? `<span class="trend-badge trend-down"><i class="fas fa-arrow-down"></i> -R$ ${trendVal} esta semana</span>`
        : `<span class="trend-badge trend-stable"><i class="fas fa-minus"></i> Estável esta semana</span>`;

    // Gasolina price display
    let gasHtml;
    if (s.hasPromotion && s.promotionFuel === 'gasolinaComum') {
      gasHtml = `<span class="price-val promo">R$ ${s.promoPrice.toFixed(2)}</span><span class="price-old">R$ ${s.gasolinaComum.toFixed(2)}</span>`;
    } else {
      gasHtml = `<span class="price-val">R$ ${s.gasolinaComum.toFixed(2)}</span>`;
    }

    // Aditivada display
    let aditHtml;
    if (s.hasPromotion && s.promotionFuel === 'gasolinaAditivada') {
      aditHtml = `<span class="price-val promo">R$ ${s.promoPrice.toFixed(2)}</span><span class="price-old">R$ ${s.gasolinaAditivada.toFixed(2)}</span>`;
    } else {
      aditHtml = `<span class="price-val">R$ ${s.gasolinaAditivada.toFixed(2)}</span>`;
    }

    // Etanol display
    let etanolHtml;
    if (s.hasPromotion && s.promotionFuel === 'etanol') {
      etanolHtml = `<span class="price-val promo">R$ ${s.promoPrice.toFixed(2)}</span><span class="price-old">R$ ${s.etanol.toFixed(2)}</span>`;
    } else {
      etanolHtml = `<span class="price-val">R$ ${s.etanol.toFixed(2)}</span>`;
    }

    return `
      <div class="station-card${isCheapest ? ' is-cheapest' : ''}" data-id="${s.id}">
        <div class="card-top">
          <div class="card-name">${s.name}</div>
          <button class="fav-btn${isFav ? ' active' : ''}" data-id="${s.id}" title="${isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}">
            <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
          </button>
        </div>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
        ${trendHtml}
        <div class="card-address">
          <i class="fas fa-map-pin"></i> ${s.address}
        </div>
        <div class="prices-table">
          <div class="price-row">
            <span class="price-fuel">Gasolina</span>
            ${gasHtml}
          </div>
          <div class="price-row">
            <span class="price-fuel">Aditivada</span>
            ${aditHtml}
          </div>
          <div class="price-row">
            <span class="price-fuel">Etanol</span>
            ${etanolHtml}
          </div>
          <div class="price-row">
            <span class="price-fuel">Diesel S10</span>
            <span class="price-val">R$ ${s.dieselS10.toFixed(2)}</span>
          </div>
        </div>
        <div class="card-bottom">
          <div class="card-meta">
            <span><i class="fas fa-clock"></i> ${s.openingHours}</span>
            ${s.phone ? `<span><i class="fas fa-phone"></i> ${s.phone}</span>` : ''}
          </div>
          <div class="card-actions">
            <input type="checkbox" class="cmp-check" data-id="${s.id}" title="Adicionar à comparação" ${inCompare ? 'checked' : ''}>
            <a href="${s.directionsLink}" target="_blank" class="maps-btn" title="Abrir rota no Google Maps">
              <i class="fas fa-route"></i> Rota
            </a>
            <a href="${s.mapsLink}" target="_blank" class="maps-btn" style="background:#1967d2" title="Ver no Google Maps">
              <i class="fas fa-map-marker-alt"></i> Maps
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Events
  stationsGrid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.id));
  });
  stationsGrid.querySelectorAll('.cmp-check').forEach(cb => {
    cb.addEventListener('change', () => toggleCompare(cb.dataset.id, cb.checked));
  });
}

// ==================== RANKING ====================
function renderRanking(stations) {
  const top = [...stations].sort((a, b) => a.gasolinaComum - b.gasolinaComum).slice(0, 5);
  rankingStrip.innerHTML = top.map((s, i) => `
    <div class="rank-item">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name">${s.name.split('–')[0].split('(')[0].trim()}</span>
      <span class="rank-price">R$ ${s.gasolinaComum.toFixed(2)}</span>
    </div>
  `).join('');
}

// ==================== PROMOS ====================
function renderPromos(stations) {
  const promos = stations.filter(s => s.hasPromotion);
  if (!promos.length) {
    promosSection.style.display = 'none';
    return;
  }
  promosSection.style.display = 'block';
  const fuelName = f => ({ gasolinaComum: 'Gasolina', gasolinaAditivada: 'Aditivada', etanol: 'Etanol', diesel: 'Diesel' }[f] || f);
  promosGrid.innerHTML = promos.map(s => `
    <div class="promo-card">
      <div class="promo-station">${s.name}</div>
      <span class="promo-fuel-tag">${fuelName(s.promotionFuel)}</span>
      <div class="promo-big-price">R$ ${s.promoPrice.toFixed(2)}<small style="font-size:0.6em">/L</small></div>
      <div class="promo-validity"><i class="fas fa-clock"></i> Válido até ${s.promoValidity}</div>
    </div>
  `).join('');
}

// ==================== FAVORITES ====================
function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx > -1) favorites.splice(idx, 1);
  else favorites.push(id);
  localStorage.setItem('gf_favorites', JSON.stringify(favorites));
  applyFilters();
  renderFavorites();
}

function renderFavorites() {
  const allPostos = [
    ...getPostosPorCidade('Vera Cruz'),
    ...getPostosPorCidade('Santa Cruz do Sul')
  ].map(p => applyCustomPrices(p));

  const favPostos = allPostos.filter(p => favorites.includes(p.id));
  if (!favPostos.length) {
    favGrid.style.display = 'none';
    noFavs.style.display = 'block';
    return;
  }
  favGrid.style.display = 'grid';
  noFavs.style.display = 'none';
  favGrid.innerHTML = '';
  const tempGrid = document.createElement('div');
  tempGrid.className = 'stations-grid';
  // Render favorites using same logic
  const cheapestGas = Math.min(...favPostos.map(s => s.gasolinaComum));
  tempGrid.innerHTML = favPostos.map(s => {
    const isCheapest = s.gasolinaComum === cheapestGas;
    return `
      <div class="station-card${isCheapest ? ' is-cheapest' : ''}" data-id="${s.id}">
        <div class="card-top">
          <div class="card-name">${s.name}</div>
          <button class="fav-btn active" data-id="${s.id}"><i class="fas fa-heart"></i></button>
        </div>
        <div class="card-tags"><span class="tag tag-h24" style="background:var(--accent-light);color:var(--accent-dark)">${s.city}</span></div>
        <div class="card-address"><i class="fas fa-map-pin"></i> ${s.address}</div>
        <div class="prices-table">
          <div class="price-row"><span class="price-fuel">Gasolina</span><span class="price-val">R$ ${s.gasolinaComum.toFixed(2)}</span></div>
          <div class="price-row"><span class="price-fuel">Aditivada</span><span class="price-val">R$ ${s.gasolinaAditivada.toFixed(2)}</span></div>
          <div class="price-row"><span class="price-fuel">Etanol</span><span class="price-val">R$ ${s.etanol.toFixed(2)}</span></div>
          <div class="price-row"><span class="price-fuel">Diesel</span><span class="price-val">R$ ${s.diesel.toFixed(2)}</span></div>
        </div>
        <div class="card-bottom">
          <div class="card-meta"><span><i class="fas fa-clock"></i> ${s.openingHours}</span></div>
          <div class="card-actions">
            <a href="${s.directionsLink}" target="_blank" class="maps-btn"><i class="fas fa-route"></i> Rota</a>
            <a href="${s.mapsLink}" target="_blank" class="maps-btn" style="background:#1967d2"><i class="fas fa-map-marker-alt"></i> Maps</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
  favGrid.innerHTML = tempGrid.innerHTML;
  favGrid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleFavorite(btn.dataset.id));
  });
}

// ==================== COMPARE ====================
function toggleCompare(id, add) {
  if (add) {
    if (!compareList.includes(id) && compareList.length < 3) {
      compareList.push(id);
    } else if (compareList.length >= 3) {
      showAlert('Você pode comparar no máximo 3 postos.');
      // Uncheck
      const cb = stationsGrid.querySelector(`.cmp-check[data-id="${id}"]`);
      if (cb) cb.checked = false;
      return;
    }
  } else {
    compareList = compareList.filter(i => i !== id);
  }
  cmpCount.textContent = compareList.length;
  compareBtn.disabled = compareList.length === 0;
  clearCmpBtn.style.display = compareList.length ? '' : 'none';
}

compareBtn.addEventListener('click', showCompare);
clearCmpBtn.addEventListener('click', () => {
  compareList = [];
  cmpCount.textContent = '0';
  compareBtn.disabled = true;
  clearCmpBtn.style.display = 'none';
  stationsGrid.querySelectorAll('.cmp-check').forEach(cb => cb.checked = false);
});
closeCmpModal.addEventListener('click', () => compareModal.style.display = 'none');
compareModal.addEventListener('click', e => { if (e.target === compareModal) compareModal.style.display = 'none'; });

function showCompare() {
  const allPostos = [
    ...getPostosPorCidade('Vera Cruz'),
    ...getPostosPorCidade('Santa Cruz do Sul')
  ].map(p => applyCustomPrices(p));

  const selected = allPostos.filter(p => compareList.includes(p.id));
  if (!selected.length) return;

  // Find bests for each fuel
  const bestGas = Math.min(...selected.map(s => s.gasolinaComum));
  const bestAdit = Math.min(...selected.map(s => s.gasolinaAditivada));
  const bestEtanol = Math.min(...selected.map(s => s.etanol));
  const bestDiesel = Math.min(...selected.map(s => s.diesel));

  compareContent.innerHTML = selected.map(s => `
    <div class="cmp-card">
      <h4>${s.name}</h4>
      <div class="cmp-addr">${s.address}</div>
      <div class="cmp-row">
        <span class="cmp-label">Gasolina</span>
        <span class="cmp-price${s.gasolinaComum === bestGas ? ' best' : ''}">R$ ${s.gasolinaComum.toFixed(2)}</span>
      </div>
      <div class="cmp-row">
        <span class="cmp-label">Aditivada</span>
        <span class="cmp-price${s.gasolinaAditivada === bestAdit ? ' best' : ''}">R$ ${s.gasolinaAditivada.toFixed(2)}</span>
      </div>
      <div class="cmp-row">
        <span class="cmp-label">Etanol</span>
        <span class="cmp-price${s.etanol === bestEtanol ? ' best' : ''}">R$ ${s.etanol.toFixed(2)}</span>
      </div>
      <div class="cmp-row">
        <span class="cmp-label">Diesel</span>
        <span class="cmp-price${s.diesel === bestDiesel ? ' best' : ''}">R$ ${s.diesel.toFixed(2)}</span>
      </div>
      <div class="cmp-row">
        <span class="cmp-label">Horário</span>
        <span class="cmp-price" style="font-family:var(--font)">${s.openingHours}</span>
      </div>
    </div>
  `).join('');

  compareModal.style.display = 'flex';
}

// ==================== UPDATE PRICES ====================
updatePricesBtn.addEventListener('click', () => {
  if (!currentCity) return;
  populateUpdateStation(currentCity);
  updateModal.style.display = 'flex';
  $('updateSuccess').style.display = 'none';
});
closeUpdateModal.addEventListener('click', () => updateModal.style.display = 'none');
updateModal.addEventListener('click', e => { if (e.target === updateModal) updateModal.style.display = 'none'; });

updateStation.addEventListener('change', () => {
  const id = updateStation.value;
  const allPostos = [
    ...getPostosPorCidade('Vera Cruz'),
    ...getPostosPorCidade('Santa Cruz do Sul')
  ].map(p => applyCustomPrices(p));
  const posto = allPostos.find(p => p.id === id);
  if (!posto) return;
  $('upGas').value = posto.gasolinaComum.toFixed(2);
  $('upAdit').value = posto.gasolinaAditivada.toFixed(2);
  $('upEtanol').value = posto.etanol.toFixed(2);
  $('upDiesel').value = posto.diesel.toFixed(2);
});

saveUpdateBtn.addEventListener('click', () => {
  const id = updateStation.value;
  const gas = parseFloat($('upGas').value);
  const adit = parseFloat($('upAdit').value);
  const etanol = parseFloat($('upEtanol').value);
  const diesel = parseFloat($('upDiesel').value);

  if ([gas, adit, etanol, diesel].some(v => isNaN(v) || v <= 0)) {
    showAlert('Preencha todos os preços com valores válidos.');
    return;
  }

  if (!customPrices[id]) customPrices[id] = {};
  customPrices[id].gasolinaComum = gas;
  customPrices[id].gasolinaAditivada = adit;
  customPrices[id].etanol = etanol;
  customPrices[id].diesel = diesel;
  customPrices[id].dieselS10 = parseFloat((diesel + 0.10).toFixed(2));
  customPrices[id].updatedAt = new Date().toISOString();

  localStorage.setItem('gf_custom_prices', JSON.stringify(customPrices));

  $('updateSuccess').style.display = 'flex';
  setTimeout(() => {
    updateModal.style.display = 'none';
    $('updateSuccess').style.display = 'none';
    if (currentCity) loadCity(currentCity);
  }, 1500);
});

function populateUpdateStation(cidade) {
  const postos = getPostosPorCidade(cidade);
  updateStation.innerHTML = postos.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  // Trigger change to fill prices
  updateStation.dispatchEvent(new Event('change'));
}

// ==================== REPORT ====================
reportCity.addEventListener('change', () => {
  populateReportStation(reportCity.value);
});

function populateReportCity() {
  reportCity.innerHTML = CIDADES_DISPONIVEIS.map(c => `<option value="${c}">${c}</option>`).join('');
  populateReportStation(reportCity.value);
}

function populateReportStation(cidade) {
  const postos = getPostosPorCidade(cidade);
  reportStation.innerHTML = postos.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

reportIsPromo.addEventListener('change', () => {
  promoValidityField.style.display = reportIsPromo.checked ? '' : 'none';
});

reportForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = reportStation.value;
  const fuel = reportFuel.value;
  const price = parseFloat(reportPrice.value);
  const isPromo = reportIsPromo.checked;
  const validity = isPromo ? reportValidity.value : null;

  if (!id || !fuel || isNaN(price) || price <= 0) {
    showAlert('Preencha todos os campos corretamente.');
    return;
  }

  if (!customPrices[id]) customPrices[id] = {};
  customPrices[id][fuel] = price;
  if (isPromo) {
    customPrices[id].hasPromotion = true;
    customPrices[id].promotionFuel = fuel;
    customPrices[id].promoPrice = price;
    if (validity) customPrices[id].promoValidity = validity;
  }
  customPrices[id].updatedAt = new Date().toISOString();
  localStorage.setItem('gf_custom_prices', JSON.stringify(customPrices));

  $('reportSuccess').style.display = 'flex';
  reportForm.reset();
  promoValidityField.style.display = 'none';
  setTimeout(() => { $('reportSuccess').style.display = 'none'; }, 3000);

  // Recarregar se a cidade reportada é a atual
  const stationData = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].find(p => p.id === id);
  if (stationData && currentCity === stationData.city) {
    loadCity(currentCity);
  }
});

// ==================== CALCULATOR ====================
calcBtn.addEventListener('click', () => {
  const price = parseFloat(calcPrice.value);
  const liters = parseFloat(calcLiters.value);
  if (isNaN(price) || isNaN(liters) || price <= 0 || liters <= 0) {
    showAlert('Preencha preço e litros corretamente.');
    return;
  }
  const total = (price * liters).toFixed(2);
  calcResult.style.display = 'block';
  calcResult.innerHTML = `R$ ${total} para ${liters}L a R$ ${price.toFixed(2)}/L`;
});

// ==================== ALERT HELPER ====================
function showAlert(msg, type = 'error') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: 80px; right: 20px; z-index: 9999;
    background: ${type === 'success' ? 'var(--accent)' : 'var(--red)'};
    color: #fff; padding: 0.85rem 1.25rem; border-radius: 10px;
    font-size: 0.9rem; font-weight: 600; font-family: var(--font);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-width: 320px;
    animation: slideUp 0.25s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}