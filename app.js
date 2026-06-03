const supabaseUrl = 'https://tteozknocjjbsjjehqel.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZW96a25vY2pqYnNqamVocWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTczOTYsImV4cCI6MjA5NTI5MzM5Nn0.FDRqKNW3BvuyqS4vmYnY3CiD4ug2cPXsZMBDMeEvH_o'; 
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// ==================== PONTE COM O SUPABASE ====================
let POSTOS_DATA = {};
let CIDADES_DISPONIVEIS = [];

function getPostosPorCidade(cidade) {
  return POSTOS_DATA[cidade] || [];
}

// 1. BUSCA OS POSTOS DO BANCO
async function buscarPostosDoBanco() {
    const { data: postos, error } = await clienteSupabase
        .from('postos')
        .select('*');

    if (error) {
        console.error("Erro ao buscar postos do Supabase:", error);
        return;
    }

    const POSTOS_DATA_DO_BANCO = {};

    postos.forEach(posto => {
        if (!POSTOS_DATA_DO_BANCO[posto.cidade]) {
            POSTOS_DATA_DO_BANCO[posto.cidade] = [];
        }

        POSTOS_DATA_DO_BANCO[posto.cidade].push({
            id: posto.codigo_posto,
            city: posto.cidade,
            name: posto.nome,
            brand: posto.bandeira,
            address: posto.endereco,
            lat: parseFloat(posto.latitude) || 0,
            lng: parseFloat(posto.longitude) || 0,
            mapsLink: posto.link_maps,
            directionsLink: posto.link_maps,
            gasolinaComum: parseFloat(posto.gasolina_comum || 0),
            gasolinaAditivada: parseFloat(posto.gasolina_aditivada || 0),
            etanol: parseFloat(posto.etanol || 0),
            diesel: parseFloat(posto.diesel || 0),
            dieselS10: parseFloat(posto.diesel_s10 || 0),
            hasPromotion: posto.has_promotion,
            promotionFuel: posto.promotion_fuel,
            promoPrice: parseFloat(posto.promo_price || 0),
            promoValidity: posto.promo_validity,
            openingHours: posto.opening_hours || '24h',
            phone: posto.phone || '',
            dono_id: posto.dono_id
        });
    });

    POSTOS_DATA = POSTOS_DATA_DO_BANCO;
    CIDADES_DISPONIVEIS = Object.keys(POSTOS_DATA);
    
    if (currentUser) {
        if (currentUser.role === 'driver') {
            updateHeroStats();
            populateReportCity();
            if (currentCity) applyFilters(); 
        } else if (currentUser.role === 'station_owner') {
            initManageView();
        }
    }
}

// 2. ATUALIZA PREÇOS TRAVADO POR SEGURANÇA (DONO SÓ EDITA O DELE)
async function atualizarPrecosNoBanco(codigoPosto, novosDados) {
    // Se for o admin de testes local, permite atualizar sem checar dono_id rígido do Supabase Auth
    if (currentUser && currentUser.role === 'admin') {
        const { error } = await clienteSupabase
            .from('postos')
            .update({
                gasolina_comum: parseFloat(novosDados.gasolinaComum),
                gasolina_aditivada: parseFloat(novosDados.gasolinaAditivada),
                etanol: parseFloat(novosDados.etanol),
                diesel: parseFloat(novosDados.diesel),
                diesel_s10: parseFloat(novosDados.dieselS10),
                has_promotion: novosDados.hasPromotion,
                promotion_fuel: novosDados.promotionFuel,
                promo_price: parseFloat(novosDados.promoPrice),
                promo_validity: novosDados.promoValidity
            })
            .eq('codigo_posto', codigoPosto);
            
        if (error) { console.error(error); return false; }
        return true;
    }

    // Fluxo seguro para usuários normais logados
    const { data: postoAtual } = await clienteSupabase.from('postos').select('dono_id').eq('codigo_posto', codigoPosto).single();
    
    if (!postoAtual || postoAtual.dono_id !== currentUser.uid) {
        showAlert("Erro de Segurança: Você não é o dono cadastrado deste posto!", "error");
        return false;
    }

    const { error } = await clienteSupabase
        .from('postos')
        .update({
            gasolina_comum: parseFloat(novosDados.gasolinaComum),
            gasolina_aditivada: parseFloat(novosDados.gasolinaAditivada),
            etanol: parseFloat(novosDados.etanol),
            diesel: parseFloat(novosDados.diesel),
            diesel_s10: parseFloat(novosDados.dieselS10),
            has_promotion: novosDados.hasPromotion,
            promotion_fuel: novosDados.promotionFuel,
            promo_price: parseFloat(novosDados.promoPrice),
            promo_validity: novosDados.promoValidity
        })
        .eq('codigo_posto', codigoPosto);

    if (error) {
        console.error("Erro ao salvar no Supabase:", error);
        showAlert("Erro ao salvar os dados no servidor!", "error");
        return false;
    }
    return true;
}

// 3. VINCULA POSTO EXISTENTE AO DONO ATUAL
async function vincularPostoAoDono(codigoPosto) {
    if (currentUser && currentUser.role === 'admin') return true;

    const { error } = await clienteSupabase
        .from('postos')
        .update({ dono_id: currentUser.uid })
        .eq('codigo_posto', codigoPosto);

    if (error) {
        console.error("Erro ao vincular dono:", error);
        return false;
    }
    return true;
}

// 4. CRIA NOVO POSTO ATRIBUINDO O LOGADO COMO DONO AUTOMÁTICO
async function criarNovoPostoNoBanco(dados) {
    const codigoUnico = dados.cidade.substring(0, 3).toLowerCase() + '-' + Date.now();
    
    let linkFinalMaps = dados.linkMaps;
    if (!linkFinalMaps) {
        const busca = encodeURIComponent(`${dados.nome} ${dados.endereco} ${dados.cidade}`);
        linkFinalMaps = `https://www.google.com/maps/search/?api=1&query=${busca}`;
    }

    const novoPosto = {
        codigo_posto: codigoUnico,
        cidade: dados.cidade,
        nome: dados.nome,
        bandeira: dados.bandeira || 'Branca',
        endereco: dados.endereco || 'Endereço não informado',
        link_maps: linkFinalMaps,
        gasolina_comum: 0, gasolina_aditivada: 0, etanol: 0, diesel: 0, diesel_s10: 0,
        has_promotion: false,
        opening_hours: 'Horário comercial',
        dono_id: (currentUser && currentUser.role === 'admin') ? null : currentUser.uid
    };

    const { error } = await clienteSupabase.from('postos').insert([novoPosto]);

    if (error) {
        console.error("Erro ao criar posto:", error);
        showAlert("Erro ao criar o posto.", "error");
        return null;
    }
    return codigoUnico;
}

buscarPostosDoBanco();

// ==================== ESTADO GLOBAL CONTROLES DOS COMPONENTES ====================
let currentUser = null;
let currentCity = null;
let currentStations = [];
let allStations = [];
let favorites = JSON.parse(localStorage.getItem('gf_favorites') || '[]');
let compareList = [];
let activeFilters = { sort: 'price', fuel: null, promoOnly: false };
let customPrices = JSON.parse(localStorage.getItem('gf_custom_prices') || '{}');
let notifications = JSON.parse(localStorage.getItem('gf_notifications') || '[]');
let managedStationId = localStorage.getItem('gf_managed_station') || null;

// ==================== ELEMENTOS HTML ====================
const $ = id => document.getElementById(id);

const loginScreen = $('loginScreen');
const registerScreen = $('registerScreen');
const roleScreen = $('roleScreen');
const appScreen = $('appScreen');
const loginForm = $('loginForm');
const registerForm = $('registerForm');
const showRegisterBtn = $('showRegisterBtn');
const showLoginBtn = $('showLoginBtn');
const backToLoginFromRole = $('backToLoginFromRole');
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

const notificationsView = $('notificationsView');
const manageView = $('manageView');
const notificationsList = $('notificationsList');
const noNotifications = $('noNotifications');
const clearNotificationsBtn = $('clearNotificationsBtn');
const claimStationSection = $('claimStationSection');
const manageStationSection = $('manageStationSection');
const claimCity = $('claimCity');
const claimStationSelect = $('claimStationSelect');
const claimStationBtn = $('claimStationBtn');
const managedStationName = $('managedStationName');
const saveManageBtn = $('saveManageBtn');
const changeStationBtn = $('changeStationBtn');
const manageSuccess = $('manageSuccess');

// ==================== TEMA ====================
function initTheme() {
  const t = localStorage.getItem('gf_theme') || 'light';
  if (t === 'dark') {
    document.body.classList.add('dark');
    if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
  }
}
const themeBtnHandler = () => {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('gf_theme', isDark ? 'dark' : 'light');
  if (themeBtn) themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
};
initTheme();
if (themeBtn) themeBtn.addEventListener('click', themeBtnHandler);

// ==================== AUTENTICAÇÃO REAL COM SUPABASE ====================
if (showRegisterBtn) { showRegisterBtn.addEventListener('click', e => { e.preventDefault(); loginScreen.classList.remove('active'); registerScreen.classList.add('active'); }); }
if (showLoginBtn) { showLoginBtn.addEventListener('click', e => { e.preventDefault(); registerScreen.classList.remove('active'); loginScreen.classList.add('active'); }); }

// FORMULÁRIO DE LOGIN AUTO-GERENCIADO COM CHECAGEM DE CARGO SECRETA
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;

    if (!email || !password) { showAlert('Preencha todos os campos para continuar.'); return; }

    const btnTextoOriginal = loginForm.querySelector('button[type="submit"]').textContent;
    loginForm.querySelector('button[type="submit"]').textContent = 'Autenticando...';

    // Login Real via Supabase Auth
    const { data, error } = await clienteSupabase.auth.signInWithPassword({ email, password });
    loginForm.querySelector('button[type="submit"]').textContent = btnTextoOriginal;

    if (error) {
        showAlert('E-mail ou senha inválidos. Tente novamente.');
        return;
    }

    // 🌟 NOVA CHECAGEM PRIVADA: Verifica se o usuário tem o cargo de admin nos metadados ocultos do banco
    if (data.user && data.user.user_metadata && data.user.user_metadata.role === 'admin') {
        currentUser = { 
            email: data.user.email, 
            name: 'Administrador', 
            role: 'admin', 
            uid: data.user.id 
        };
        loginScreen.classList.remove('active');
        appScreen.classList.add('active'); // Pula a tela de escolher perfil (vai direto)
        
        // Ativa o elemento visual do seu painel administrativo se ele existir no HTML
        const painel = $('painel-admin');
        if (painel) {
            painel.style.display = 'block';
}

        initApp();
        showAlert('Logado no Modo Administrador!', 'success');
        return;
    }

    // Fluxo normal para Motoristas e Donos de Posto comuns
    currentUser = { 
        email: data.user.email, 
        name: data.user.email.split('@')[0],
        uid: data.user.id
    };
    loginScreen.classList.remove('active');
    roleScreen.classList.add('active'); 
  });
}

// FORMULÁRIO DE CADASTRO REAL
if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const pass = $('regPassword').value;
    const confirm = $('regConfirmPassword').value;

    if (!name || !email || !pass) { showAlert('Preencha todos os campos obrigatórios.'); return; }
    if (pass.length < 6) { showAlert('A senha necessita ter no mínimo 6 caracteres.'); return; }
    if (pass !== confirm) { showAlert('As senhas digitadas não batem.'); return; }

    const btnTextoOriginal = registerForm.querySelector('button[type="submit"]').textContent;
    registerForm.querySelector('button[type="submit"]').textContent = 'Criando Usuário...';

    const { data, error } = await clienteSupabase.auth.signUp({ email, password: pass });

    registerForm.querySelector('button[type="submit"]').textContent = btnTextoOriginal;

    if (error) {
        showAlert('Erro ao registrar: ' + error.message);
        return;
    }

    showAlert('Conta criada com sucesso!', 'success');
    currentUser = { email: data.user.email, name: name, uid: data.user.id };
    registerScreen.classList.remove('active');
    roleScreen.classList.add('active');
    registerForm.reset();
  });
}

if (backToLoginFromRole) {
  backToLoginFromRole.addEventListener('click', e => {
    e.preventDefault();
    currentUser = null;
    roleScreen.classList.remove('active');
    loginScreen.classList.add('active');
  });
}

// ==================== ROLE SELECTION ====================
document.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => selectRole(card.dataset.role));
});
function selectRole(role) {
  if (!currentUser) return;
  currentUser.role = role;
  roleScreen.classList.remove('active');
  appScreen.classList.add('active');
  initApp();
}

// ==================== LOGOUT ====================
async function logout() {
  await clienteSupabase.auth.signOut();
  currentUser = null; currentCity = null; currentStations = []; managedStationId = null;
  localStorage.removeItem('gf_managed_station');
  appScreen.classList.remove('active'); loginScreen.classList.add('active');
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  if($('searchView')) $('searchView').classList.add('active');
  if(heroSection) heroSection.style.display = '';
  if(resultsArea) resultsArea.style.display = 'none';
  if($('btnCriarPostoHtml')) $('btnCriarPostoHtml').remove();
  if($('btnCriarPostoEdicaoHtml')) $('btnCriarPostoEdicaoHtml').remove();
}

// ==================== INIT ====================
function initApp() {
  buildNav();
  updateNotifBadge();
  if (currentUser.role === 'driver') {
    showView('search');
    if(heroSection) heroSection.style.display = '';
    if(resultsArea) resultsArea.style.display = 'none';
    updateHeroStats(); 
    populateReportCity();
    renderFavorites();
  } else if (currentUser.role === 'station_owner') {
    showView('manage');
    initManageView();
  } else if (currentUser.role === 'admin') { // 🌟 Adicione este pedaço
    showView('manage'); 
    const painel = $('painel-admin');
    if (painel) {
    painel.style.display = 'block';
}
  }
}

// ==================== BUILD NAV ====================
function buildNav() {
  const nav = $('mainNav');
  if(!nav) return;
  
  if (currentUser.role === 'driver') {
    // ... mantém seu código atual do driver ...
  } else if (currentUser.role === 'station_owner' || currentUser.role === 'admin') { // 🌟 Altere esta linha
    nav.innerHTML = `
      <button class="nav-item active" data-view="manage"><i class="fas fa-store"></i><span>Painel Geral</span></button>
      <button class="nav-item" data-view="notifications" id="notifNavBtn"><i class="fas fa-bell"></i><span>Notificações</span><span class="notif-badge" id="notifBadge">0</span></button>
      <button class="nav-item" id="themeBtn"><i class="fas fa-moon"></i></button>
      <button class="nav-item logout-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i><span>Sair</span></button>
    `;
  } else {
    nav.innerHTML = `
      <button class="nav-item active" data-view="manage"><i class="fas fa-store"></i><span>Meu Posto</span></button>
      <button class="nav-item" data-view="notifications" id="notifNavBtn"><i class="fas fa-bell"></i><span>Notificações</span><span class="notif-badge" id="notifBadge">0</span></button>
      <button class="nav-item" id="themeBtn"><i class="fas fa-moon"></i></button>
      <button class="nav-item logout-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i><span>Sair</span></button>
    `;
  }
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.view);
    });
  });
  if($('logoutBtn')) $('logoutBtn').addEventListener('click', logout);
  if($('themeBtn')) $('themeBtn').addEventListener('click', themeBtnHandler);
}

function updateHeroStats() {
  const total = getPostosPorCidade('Vera Cruz').length + getPostosPorCidade('Santa Cruz do Sul').length;
  const promos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].filter(p => p.hasPromotion).length;
  if($('totalPostos')) $('totalPostos').textContent = total;
  if($('totalPromos')) $('totalPromos').textContent = promos;
  if($('vcCount')) $('vcCount').textContent = getPostosPorCidade('Vera Cruz').length + ' postos';
  if($('scsCount')) $('scsCount').textContent = getPostosPorCidade('Santa Cruz do Sul').length + ' postos';
}

function showView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-view]').forEach(b => b.classList.remove('active'));
  const viewMap = { 'search': 'searchView', 'favorites': 'favoritesView', 'report': 'reportView', 'notifications': 'notificationsView', 'manage': 'manageView' };
  if ($(viewMap[view])) $(viewMap[view]).classList.add('active');
  const navBtn = document.querySelector(`[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');
  if (view === 'notifications') renderNotifications();
  if (view === 'favorites') renderFavorites();
  if (view === 'manage') initManageView();
}

// ==================== CIDADES E BUSCA (DRIVERS) ====================
document.querySelectorAll('.city-card').forEach(card => {
  card.addEventListener('click', () => loadCity(card.dataset.city));
});
if(backBtn) {
  backBtn.addEventListener('click', () => {
    heroSection.style.display = ''; resultsArea.style.display = 'none'; currentCity = null; currentStations = [];
  });
}

function loadCity(cidade) {
  currentCity = cidade;
  if(stickyCity) stickyCity.textContent = cidade;
  if(loader) loader.style.display = 'flex';
  if(heroSection) heroSection.style.display = 'none';
  if(resultsArea) resultsArea.style.display = 'block';
  if(stationsGrid) stationsGrid.innerHTML = '';
  if(noResults) noResults.style.display = 'none';
  
  setTimeout(() => {
    allStations = getPostosPorCidade(cidade).map(p => applyCustomPrices(p));
    currentStations = allStations;
    applyFilters();
    if(loader) loader.style.display = 'none';
    populateUpdateStation(cidade);
  }, 400);
}

function applyCustomPrices(posto) {
  const cp = customPrices[posto.id];
  if (!cp) return posto;
  return { ...posto, ...cp };
}

if(heroSearchInput) {
  heroSearchInput.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    if (!q) return;
    const allPostos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')];
    const found = allPostos.find(p => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
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
      const city = CIDADES_DISPONIVEIS.find(c => c.toLowerCase().includes(q));
      if (city) loadCity(city);
    }
  });
}

// GEOLOCATION
if(heroGeoBtn) heroGeoBtn.addEventListener('click', handleGeo);
function handleGeo() {
  if (!navigator.geolocation) { showAlert('Geolocalização não suportada.'); return; }
  heroGeoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude; const lng = pos.coords.longitude;
    const centroids = { "Vera Cruz": { lat: -29.7150, lng: -52.5083 }, "Santa Cruz do Sul": { lat: -29.7175, lng: -52.4258 } };
    let closest = null; let minDist = Infinity;
    for (const [city, coord] of Object.entries(centroids)) {
      const d = Math.sqrt(Math.pow(lat - coord.lat, 2) + Math.pow(lng - coord.lng, 2));
      if (d < minDist) { minDist = d; closest = city; }
    }
    heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
    showAlert(`Carregando ${closest}...`, 'success');
    setTimeout(() => loadCity(closest), 500);
  }, err => {
    heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
    showAlert('Não foi possível obter a localização.');
  });
}

// FILTROS
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const sort = chip.dataset.sort; const filter = chip.dataset.filter; const fuel = chip.dataset.fuel;
    if (sort) { document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active')); chip.classList.add('active'); activeFilters.sort = sort; }
    if (filter === 'promo') { chip.classList.toggle('active'); activeFilters.promoOnly = chip.classList.contains('active'); }
    if (fuel) {
      const wasActive = chip.classList.contains('active');
      document.querySelectorAll('[data-fuel]').forEach(b => b.classList.remove('active'));
      if (!wasActive) { chip.classList.add('active'); activeFilters.fuel = fuel; } else { activeFilters.fuel = null; }
    }
    applyFilters();
  });
});

function applyFilters() {
  let stations = [...allStations];
  const q = heroSearchInput ? heroSearchInput.value.trim().toLowerCase() : '';
  if (q && currentCity) {
    stations = stations.filter(s => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q));
  }
  if (activeFilters.promoOnly) stations = stations.filter(s => s.hasPromotion);
  if (activeFilters.fuel === 'gasolina') stations = stations.filter(s => s.gasolinaComum > 0);
  else if (activeFilters.fuel === 'etanol') stations = stations.filter(s => s.etanol > 0);
  else if (activeFilters.fuel === 'diesel') stations = stations.filter(s => s.diesel > 0 || s.dieselS10 > 0);
  
  if (activeFilters.sort === 'price') stations.sort((a, b) => a.gasolinaComum - b.gasolinaComum);
  else if (activeFilters.sort === 'name') stations.sort((a, b) => a.name.localeCompare(b.name));
  
  currentStations = stations;
  renderStations(stations);
  renderRanking(stations);
  renderPromos(stations);
}

// RENDER STATIONS (MOTORISTA)
function renderStations(stations) {
  if (!stationsGrid) return;
  if (!stations.length) {
    stationsGrid.style.display = 'none';
    if(noResults) noResults.style.display = 'block';
    if(gridCount) gridCount.textContent = '0 postos encontrados';
    return;
  }
  stationsGrid.style.display = 'grid';
  if(noResults) noResults.style.display = 'none';
  if(gridCount) gridCount.textContent = `${stations.length} posto${stations.length > 1 ? 's' : ''}`;
  
  const cheapestPrice = Math.min(...stations.map(s => s.gasolinaComum).filter(v => v > 0));

  stationsGrid.innerHTML = stations.map(s => {
    const isCheapest = s.gasolinaComum === cheapestPrice && cheapestPrice > 0;
    const isFav = favorites.includes(s.id);
    const inCompare = compareList.includes(s.id);

    const tags = [];
    if (isCheapest) tags.push('<span class="tag tag-cheapest"><i class="fas fa-award"></i> Mais barato</span>');
    if (s.hasPromotion) tags.push('<span class="tag tag-promo"><i class="fas fa-tag"></i> Promoção</span>');
    if (s.openingHours === '24h') tags.push('<span class="tag tag-h24">24h</span>');

    const trendVal = (Math.random() * 0.08).toFixed(2);
    const trendDir = Math.random() > 0.55 ? 'up' : (Math.random() > 0.5 ? 'down' : 'stable');
    const trendHtml = trendDir === 'up'
      ? `<span class="trend-badge trend-up"><i class="fas fa-arrow-up"></i> +R$ ${trendVal}</span>`
      : trendDir === 'down' ? `<span class="trend-badge trend-down"><i class="fas fa-arrow-down"></i> -R$ ${trendVal}</span>`
      : `<span class="trend-badge trend-stable"><i class="fas fa-minus"></i> Estável</span>`;
      
    const getPriceHtml = (fuelVal, isPromoMatch, oldVal) => {
        if(fuelVal === 0) return `<span class="price-val" style="color:#aaa">--</span>`;
        if(isPromoMatch) return `<span class="price-val promo">R$ ${s.promoPrice.toFixed(2)}</span><span class="price-old">R$ ${oldVal.toFixed(2)}</span>`;
        return `<span class="price-val">R$ ${fuelVal.toFixed(2)}</span>`;
    }

    let gasHtml = getPriceHtml(s.gasolinaComum, s.hasPromotion && s.promotionFuel === 'gasolinaComum', s.gasolinaComum);
    let aditHtml = getPriceHtml(s.gasolinaAditivada, s.hasPromotion && s.promotionFuel === 'gasolinaAditivada', s.gasolinaAditivada);
    let etanolHtml = getPriceHtml(s.etanol, s.hasPromotion && s.promotionFuel === 'etanol', s.etanol);
    let dieselHtml = getPriceHtml(s.dieselS10 || s.diesel, s.hasPromotion && s.promotionFuel === 'dieselS10', s.dieselS10 || s.diesel);

    return `
      <div class="station-card${isCheapest ? ' is-cheapest' : ''}" data-id="${s.id}">
        <div class="card-top">
          <div class="card-name">${s.name}</div>
          <button class="fav-btn${isFav ? ' active' : ''}" data-id="${s.id}"><i class="${isFav ? 'fas' : 'far'} fa-heart"></i></button>
        </div>
        ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
        ${trendHtml}
        <div class="card-address"><i class="fas fa-map-pin"></i> ${s.address}</div>
        <div class="prices-table">
          <div class="price-row"><span class="price-fuel">Gasolina</span>${gasHtml}</div>
          <div class="price-row"><span class="price-fuel">Aditivada</span>${aditHtml}</div>
          <div class="price-row"><span class="price-fuel">Etanol</span>${etanolHtml}</div>
          <div class="price-row"><span class="price-fuel">Diesel</span>${dieselHtml}</div>
        </div>
        <div class="card-bottom">
          <div class="card-meta">
            <span><i class="fas fa-clock"></i> ${s.openingHours}</span>
          </div>
          <div class="card-actions">
            <input type="checkbox" class="cmp-check" data-id="${s.id}" ${inCompare ? 'checked' : ''}>
            ${s.mapsLink ? `<a href="${s.mapsLink}" target="_blank" class="maps-btn"><i class="fas fa-route"></i> Rota</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  stationsGrid.querySelectorAll('.fav-btn').forEach(btn => { btn.addEventListener('click', () => toggleFavorite(btn.dataset.id)); });
  stationsGrid.querySelectorAll('.cmp-check').forEach(cb => { cb.addEventListener('change', () => toggleCompare(cb.dataset.id, cb.checked)); });
}

function renderRanking(stations) {
  if(!rankingStrip) return;
  const valid = stations.filter(s => s.gasolinaComum > 0);
  const top = [...valid].sort((a, b) => a.gasolinaComum - b.gasolinaComum).slice(0, 5);
  rankingStrip.innerHTML = top.map((s, i) => `
    <div class="rank-item">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name">${s.name.split('–')[0]}</span>
      <span class="rank-price">R$ ${s.gasolinaComum.toFixed(2)}</span>
    </div>
  `).join('');
}

function renderPromos(stations) {
  if(!promosSection || !promosGrid) return;
  const promos = stations.filter(s => s.hasPromotion);
  if (!promos.length) { promosSection.style.display = 'none'; return; }
  promosSection.style.display = 'block';
  const fuelName = f => ({ gasolinaComum: 'Gasolina', gasolinaAditivada: 'Aditivada', etanol: 'Etanol', diesel: 'Diesel' }[f] || f);
  promosGrid.innerHTML = promos.map(s => `
    <div class="promo-card">
      <div class="promo-station">${s.name}</div>
      <span class="promo-fuel-tag">${fuelName(s.promotionFuel)}</span>
      <div class="promo-big-price">R$ ${s.promoPrice.toFixed(2)}</div>
      <div class="promo-validity"><i class="fas fa-clock"></i> Até ${s.promoValidity || '--'}</div>
    </div>
  `).join('');
}

// ==================== FAVORITES ====================
function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx > -1) favorites.splice(idx, 1); else favorites.push(id);
  localStorage.setItem('gf_favorites', JSON.stringify(favorites));
  applyFilters(); renderFavorites();
}

function renderFavorites() {
  if(!favGrid || !noFavs) return;
  const allPostos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].map(p => applyCustomPrices(p));
  const favPostos = allPostos.filter(p => favorites.includes(p.id));
  if (!favPostos.length) { favGrid.style.display = 'none'; noFavs.style.display = 'block'; return; }
  favGrid.style.display = 'grid'; noFavs.style.display = 'none';
  
  favGrid.innerHTML = favPostos.map(s => `
    <div class="station-card" data-id="${s.id}">
      <div class="card-top">
        <div class="card-name">${s.name}</div>
        <button class="fav-btn active" data-id="${s.id}"><i class="fas fa-heart"></i></button>
      </div>
      <div class="card-tags"><span class="tag tag-h24">${s.city}</span></div>
      <div class="card-address"><i class="fas fa-map-pin"></i> ${s.address}</div>
      <div class="prices-table">
        <div class="price-row"><span class="price-fuel">Gasolina</span><span class="price-val">R$ ${s.gasolinaComum.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Aditivada</span><span class="price-val">R$ ${s.gasolinaAditivada.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Etanol</span><span class="price-val">R$ ${s.etanol.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Diesel</span><span class="price-val">R$ ${(s.dieselS10 || s.diesel).toFixed(2)}</span></div>
      </div>
    </div>
  `).join('');
}

// ==================== COMPARADOR ====================
function toggleCompare(id, checked) {
  if (checked) {
    if (compareList.length >= 3) { showAlert('Limite máximo de 3 postos na comparação.'); applyFilters(); return; }
    if (!compareList.includes(id)) compareList.push(id);
  } else { compareList = compareList.filter(x => x !== id); }
  updateCompareBar();
}

function updateCompareBar() {
  if(!compareBtn || !cmpCount) return;
  if (compareList.length > 0) { compareBtn.style.display = 'flex'; cmpCount.textContent = compareList.length; } 
  else { compareBtn.style.display = 'none'; }
}

if(clearCmpBtn) { clearCmpBtn.addEventListener('click', () => { compareList = []; updateCompareBar(); applyFilters(); }); }
if(compareBtn) compareBtn.addEventListener('click', () => { if (compareList.length < 2) { showAlert('Selecione 2 postos para comparar.'); return; } renderCompareModal(); });
if(closeCmpModal) { closeCmpModal.addEventListener('click', () => { compareModal.style.display = 'none'; }); }

function renderCompareModal() {
  if(!compareModal || !compareContent) return;
  const allPostos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].map(p => applyCustomPrices(p));
  const list = allPostos.filter(p => compareList.includes(p.id));

  compareContent.innerHTML = list.map(s => `
    <div class="cmp-col">
      <div class="cmp-header">${s.name}</div>
      <div class="cmp-cell"><b>Cidade:</b> ${s.city}</div>
      <div class="cmp-cell"><b>Gasolina:</b> R$ ${s.gasolinaComum.toFixed(2)}</div>
      <div class="cmp-cell"><b>Aditivada:</b> R$ ${s.gasolinaAditivada.toFixed(2)}</div>
      <div class="cmp-cell"><b>Etanol:</b> R$ ${s.etanol.toFixed(2)}</div>
      <div class="cmp-cell"><b>Diesel:</b> R$ ${(s.dieselS10 || s.diesel).toFixed(2)}</div>
    </div>
  `).join('');
  compareModal.style.display = 'flex';
}

// ==================== MANUAL REPORT FROM DRIVERS ====================
if(updatePricesBtn) { updatePricesBtn.addEventListener('click', () => { updateModal.style.display = 'flex'; }); }
if(closeUpdateModal) { closeUpdateModal.addEventListener('click', () => { updateModal.style.display = 'none'; }); }
if(updateStation) {
  updateStation.addEventListener('change', () => {
    const p = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].map(p=>applyCustomPrices(p)).find(x => x.id === updateStation.value);
    if (p) { $('upGas').value = p.gasolinaComum; $('upAdit').value = p.gasolinaAditivada; $('upEtanol').value = p.etanol; $('upDiesel').value = p.dieselS10 || p.diesel; }
  });
}
if(saveUpdateBtn) {
  saveUpdateBtn.addEventListener('click', () => {
    const id = updateStation.value; if (!id) return;
    const g = parseFloat($('upGas').value); const a = parseFloat($('upAdit').value); const e = parseFloat($('upEtanol').value); const d = parseFloat($('upDiesel').value);
    if ([g, a, e, d].some(isNaN)) { showAlert('Preencha os campos validamente.'); return; }
    if (!customPrices[id]) customPrices[id] = {};
    Object.assign(customPrices[id], { gasolinaComum: g, gasolinaAditivada: a, etanol: e, dieselS10: d, diesel: d });
    localStorage.setItem('gf_custom_prices', JSON.stringify(customPrices));
    $('updateSuccess').style.display = 'flex';
    setTimeout(() => { updateModal.style.display = 'none'; $('updateSuccess').style.display = 'none'; if (currentCity) loadCity(currentCity); }, 1500);
  });
}

function populateUpdateStation(cidade) {
  if(!updateStation) return;
  const postos = getPostosPorCidade(cidade);
  updateStation.innerHTML = postos.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  updateStation.dispatchEvent(new Event('change'));
}

if(reportCity) { reportCity.addEventListener('change', () => { populateReportStation(reportCity.value); }); }
function populateReportCity() {
  if(!reportCity) return;
  reportCity.innerHTML = CIDADES_DISPONIVEIS.map(c => `<option value="${c}">${c}</option>`).join('');
  populateReportStation(reportCity.value);
}
function populateReportStation(cidade) {
  if(!reportStation) return;
  reportStation.innerHTML = getPostosPorCidade(cidade).map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
if(reportIsPromo) { reportIsPromo.addEventListener('change', () => { if(promoValidityField) promoValidityField.style.display = reportIsPromo.checked ? '' : 'none'; }); }

if(reportForm) {
  reportForm.addEventListener('submit', e => {
    e.preventDefault();
    const id = reportStation.value; const fuel = reportFuel.value; const price = parseFloat(reportPrice.value);
    const isPromo = reportIsPromo.checked; const validity = isPromo ? reportValidity.value : null;
    if (!id || !fuel || isNaN(price) || price <= 0) { showAlert('Preencha todos os campos corretamente.'); return; }
    if (!customPrices[id]) customPrices[id] = {};
    customPrices[id][fuel] = price;
    if (isPromo) { Object.assign(customPrices[id], { hasPromotion: true, promotionFuel: fuel, promoPrice: price, promoValidity: validity || '--' }); }
    localStorage.setItem('gf_custom_prices', JSON.stringify(customPrices));
    const originalP = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].find(x => x.id === id);
    
    notifications.unshift({
      id: 'notif-' + Date.now(), stationId: id, stationName: originalP ? originalP.name : 'Posto', city: originalP ? originalP.city : '',
      type: isPromo ? 'promo' : 'price', timestamp: new Date().toISOString(), read: false,
      changes: { direction: 'down', details: `Preço de ${fuel} reportado: R$ ${price.toFixed(2)}` }
    });
    localStorage.setItem('gf_notifications', JSON.stringify(notifications));
    showAlert('Obrigado! Preço reportado.', 'success');
    reportForm.reset(); if(promoValidityField) promoValidityField.style.display = 'none'; updateNotifBadge();
  });
}

// ==================== CALCULADORA ====================
if(calcBtn) {
  calcBtn.addEventListener('click', () => {
    const p = parseFloat(calcPrice.value); const l = parseFloat(calcLiters.value);
    if (isNaN(p) || isNaN(l) || p <= 0 || l <= 0) { showAlert('Valores inválidos.'); return; }
    calcResult.innerHTML = `Total estimado: <b style="color:var(--accent-dark)">R$ ${(p * l).toFixed(2)}</b>`;
  });
}

// ==================== NOTIFICAÇÕES ====================
function updateNotifBadge() {
  const badge = $('notifBadge'); if (!badge) return;
  const unread = notifications.filter(n => !n.read).length;
  badge.textContent = unread; badge.style.display = unread > 0 ? 'block' : 'none';
}

function renderNotifications() {
  if (!notificationsList) return;
  if (notifications.length === 0) { notificationsList.innerHTML = ''; if(noNotifications) noNotifications.style.display = 'block'; return; }
  if(noNotifications) noNotifications.style.display = 'none';
  notificationsList.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <div class="notif-icon ${n.type === 'promo' ? 'promo' : 'price-down'}"><i class="fas ${n.type === 'promo' ? 'fa-tag' : 'fa-gas-pump'}"></i></div>
      <div class="notif-content">
        <div class="notif-title">${n.stationName}</div>
        <div class="notif-desc">${n.changes ? n.changes.details : 'Preços atualizados.'}</div>
      </div>
    </div>
  `).join('');
}
if(clearNotificationsBtn) {
  clearNotificationsBtn.addEventListener('click', () => { notifications.forEach(n => n.read = true); localStorage.setItem('gf_notifications', JSON.stringify(notifications)); renderNotifications(); updateNotifBadge(); });
}

// ==================== PAINEL DO POSTO PARCEIRO SEGURO ====================
function initManageView() {
  if (!manageStationSection || !claimStationSection) return;

  // Verifica se o usuário logado tem algum posto cujo dono_id corresponde ao seu UID exclusivo
  const todosOsPostos = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')];
  const postoDoUsuario = todosOsPostos.find(p => p.dono_id === currentUser.uid);

  if (postoDoUsuario) {
      managedStationId = postoDoUsuario.id;
      localStorage.setItem('gf_managed_station', managedStationId);
  }

  if (managedStationId) {
    // 1. USUÁRIO JÁ TEM POSTO VINCULADO
    claimStationSection.style.display = 'none';
    manageStationSection.style.display = 'block';
    loadManagedStationData();
    
    if (!$('btnCriarPostoEdicaoHtml')) {
      const divEdicao = document.createElement('div');
      divEdicao.id = 'btnCriarPostoEdicaoHtml';
      divEdicao.style.cssText = 'margin-top: 25px; border-top: 1px dashed #ccc; padding-top: 15px; text-align: center;';
      divEdicao.innerHTML = `
        <button id="btnCriarPostoEdicao" style="width: 100%; padding: 0.8rem; background: transparent; border: 2px dashed #ff9800; color: #ff9800; border-radius: 8px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-plus"></i> Cadastrar Outro Posto Novo
        </button>
      `;
      manageStationSection.appendChild(divEdicao);
      $('btnCriarPostoEdicao').addEventListener('click', (e) => { e.preventDefault(); abrirModalCriarPosto(); });
    }
  } else {
    // 2. REIVINDICAR OU CRIAR PRIMEIOR POSTO
    manageStationSection.style.display = 'none';
    claimStationSection.style.display = 'block';
    populateClaimCity();
    
    if (!$('btnCriarPostoHtml')) {
      const criarBtnDiv = document.createElement('div');
      criarBtnDiv.id = 'btnCriarPostoHtml';
      criarBtnDiv.style.marginTop = '20px';
      criarBtnDiv.innerHTML = `
        <p style="font-size: 0.9rem; text-align:center; color: var(--text-muted); margin-bottom: 8px;">Não encontrou seu posto na lista?</p>
        <button id="btnCriarPosto" style="width: 100%; padding: 0.8rem; background: transparent; border: 2px dashed var(--accent, #1967d2); color: var(--accent, #1967d2); border-radius: 8px; cursor: pointer; font-weight: bold;">
          <i class="fas fa-plus"></i> Cadastrar Novo Posto
        </button>
      `;
      claimStationSection.appendChild(criarBtnDiv);
      $('btnCriarPosto').addEventListener('click', (e) => { e.preventDefault(); abrirModalCriarPosto(); });
    }
  }
}

function populateClaimCity() {
  if(!claimCity) return;
  claimCity.innerHTML = `
    <option value="">Selecione a cidade...</option>
    <option value="Vera Cruz">Vera Cruz</option>
    <option value="Santa Cruz do Sul">Santa Cruz do Sul</option>
  `;
  if(claimStationSelect) claimStationSelect.innerHTML = '<option value="">Selecione o posto...</option>';
}

if(claimCity) {
  claimCity.addEventListener('change', () => {
    const city = claimCity.value;
    if (!city || !claimStationSelect) return;
    // Só mostra na lista para vincular os postos que ainda NÃO possuem dono cadastrado
    const postosSemDono = getPostosPorCidade(city).filter(p => !p.dono_id);
    claimStationSelect.innerHTML = '<option value="">Selecione o posto...</option>' + postosSemDono.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  });
}

if(claimStationBtn) {
  claimStationBtn.addEventListener('click', async () => {
    const id = claimStationSelect ? claimStationSelect.value : '';
    if (!id) { showAlert('Selecione um posto para gerenciar.'); return; }
    
    const vinculado = await vincularPostoAoDono(id);
    if(vinculado) {
        managedStationId = id;
        localStorage.setItem('gf_managed_station', id);
        await buscarPostosDoBanco();
        initManageView();
        showAlert('Posto vinculado à sua conta com sucesso!', 'success');
    }
  });
}

if(changeStationBtn) {
  changeStationBtn.addEventListener('click', async () => {
    // Desvincula o dono no banco ao deslogar do posto
    if (managedStationId && currentUser.email !== 'admin@gasfinder.com') {
        await clienteSupabase.from('postos').update({ dono_id: null }).eq('codigo_posto', managedStationId);
    }
    managedStationId = null;
    localStorage.removeItem('gf_managed_station');
    if($('btnCriarPostoHtml')) $('btnCriarPostoHtml').remove();
    if($('btnCriarPostoEdicaoHtml')) $('btnCriarPostoEdicaoHtml').remove();
    await buscarPostosDoBanco();
    initManageView();
  });
}

function abrirModalCriarPosto() {
    const modalHtml = `
        <div id="modalNovoPosto" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 99999; display: flex; justify-content: center; align-items: center;">
            <div style="background: var(--bg, #fff); padding: 2rem; border-radius: 12px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); font-family: sans-serif; max-height: 90vh; overflow-y: auto;">
                <h3 style="margin-top:0; margin-bottom: 1.5rem; color: var(--text);">Cadastrar Novo Posto</h3>
                
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: bold;">Cidade do Posto</label>
                <select id="npCidade" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 6px; background: var(--bg, #fff); color: var(--text);">
                    <option value="">Selecione a cidade...</option>
                    <option value="Vera Cruz">Vera Cruz</option>
                    <option value="Santa Cruz do Sul">Santa Cruz do Sul</option>
                </select>

                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: bold;">Nome do Posto</label>
                <input type="text" id="npNome" placeholder="Ex: Posto BR Centro" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 6px; background: transparent; color: var(--text);">
                
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: bold;">Bandeira</label>
                <input type="text" id="npBandeira" placeholder="Ex: Ipiranga, Shell, Branca" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 6px; background: transparent; color: var(--text);">
                
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: bold;">Endereço Completo</label>
                <input type="text" id="npEndereco" placeholder="Rua principal, 123" style="width: 100%; padding: 0.8rem; margin-bottom: 1rem; border: 1px solid #ccc; border-radius: 6px; background: transparent; color: var(--text);">

                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; font-weight: bold;">Link do Google Maps</label>
                <input type="text" id="npMaps" placeholder="Cole o link do Maps aqui" style="width: 100%; padding: 0.8rem; margin-bottom: 1.5rem; border: 1px solid #ccc; border-radius: 6px; background: transparent; color: var(--text);">
                
                <div style="display: flex; gap: 10px;">
                    <button id="npCancelar" style="flex: 1; padding: 0.8rem; background: #e0e0e0; color: #333; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Cancelar</button>
                    <button id="npSalvar" style="flex: 1; padding: 0.8rem; background: var(--accent, #1967d2); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Criar Posto</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if ($('claimCity') && $('claimCity').value) { $('npCidade').value = $('claimCity').value; }
    $('npCancelar').addEventListener('click', () => { $('modalNovoPosto').remove(); });

    $('npSalvar').addEventListener('click', async () => {
        const cidadeSelecionada = $('npCidade').value;
        const nome = $('npNome').value.trim();
        const bandeira = $('npBandeira').value.trim();
        const endereco = $('npEndereco').value.trim();
        const linkMaps = $('npMaps').value.trim();

        if(!cidadeSelecionada || !nome) { showAlert("Preencha Cidade e Nome do Posto!"); return; }

        $('npSalvar').textContent = 'Salvando...'; $('npSalvar').disabled = true;

        const novoId = await criarNovoPostoNoBanco({
            cidade: cidadeSelecionada, nome: nome, bandeira: bandeira, endereco: endereco, linkMaps: linkMaps
        });

        if(novoId) {
            $('modalNovoPosto').remove();
            if($('btnCriarPostoHtml')) $('btnCriarPostoHtml').remove();
            if($('btnCriarPostoEdicaoHtml')) $('btnCriarPostoEdicaoHtml').remove();
            
            await buscarPostosDoBanco(); 
            managedStationId = novoId;
            localStorage.setItem('gf_managed_station', novoId);
            initManageView();
            showAlert("Posto criado! Altere os preços.", "success");
        } else {
            $('npSalvar').textContent = 'Criar Posto'; $('npSalvar').disabled = false;
        }
    });
}

function loadManagedStationData() {
  const p = [...getPostosPorCidade('Vera Cruz'), ...getPostosPorCidade('Santa Cruz do Sul')].find(x => x.id === managedStationId);
  if (!p) return;
  if(managedStationName) managedStationName.textContent = p.name;
  $('mgGas').value = p.gasolinaComum || 0;
  $('mgAdit').value = p.gasolinaAditivada || 0;
  $('mgEtanol').value = p.etanol || 0;
  $('mgDiesel').value = p.dieselS10 || p.diesel || 0;
  $('mgIsPromo').checked = p.hasPromotion || false;
  $('mgPromoFuel').value = p.promotionFuel || 'gasolinaComum';
  $('mgPromoPrice').value = p.promoPrice || 0;
  $('mgPromoValidity').value = p.promoValidity && p.promoValidity !== '--' ? p.promoValidity : '';
  
  if ($('mgIsPromo').checked && $('promoFieldsContainer')) {
      $('promoFieldsContainer').style.display = 'block';
  } else if ($('promoFieldsContainer')) {
      $('promoFieldsContainer').style.display = 'none';
  }
}

if ($('mgIsPromo')) {
    $('mgIsPromo').addEventListener('change', () => {
        if ($('promoFieldsContainer')) $('promoFieldsContainer').style.display = $('mgIsPromo').checked ? 'block' : 'none';
    });
}

if(saveManageBtn) {
  saveManageBtn.addEventListener('click', async () => {
    const gas = parseFloat($('mgGas').value); const adit = parseFloat($('mgAdit').value);
    const etanol = parseFloat($('mgEtanol').value); const diesel = parseFloat($('mgDiesel').value);

    if ([gas, adit, etanol, diesel].some(v => isNaN(v) || v <= 0)) {
      showAlert('Preencha os preços com valores maiores que zero.'); return;
    }

    const novosPrecos = {
        gasolinaComum: gas, gasolinaAditivada: adit, etanol: etanol, diesel: diesel, dieselS10: diesel, 
        hasPromotion: $('mgIsPromo').checked, promotionFuel: $('mgPromoFuel').value,
        promoPrice: parseFloat($('mgPromoPrice').value) || 0, promoValidity: $('mgPromoValidity').value || '--'
    };

    const salvo = await atualizarPrecosNoBanco(managedStationId, novosPrecos);
    if (!salvo) return;
    await buscarPostosDoBanco();
    
    const isPromo = $('mgIsPromo').checked;
    notifications.unshift({
      id: 'notif-' + Date.now(), stationId: managedStationId, stationName: $('managedStationName').textContent, city: '',
      type: isPromo ? 'promo' : 'price', timestamp: new Date().toISOString(), read: false,
      changes: { direction: 'down', details: isPromo ? `Oferta Ativa!` : `Preços Atualizados pelo Dono` }
    });
    localStorage.setItem('gf_notifications', JSON.stringify(notifications));
    
    if(manageSuccess) { manageSuccess.style.display = 'flex'; setTimeout(() => { manageSuccess.style.display = 'none'; }, 2000); }
    showAlert('Preços salvos no servidor com sucesso!', 'success');
  });
}

// ==================== ALERT HELPER ====================
function showAlert(msg, type = 'error') {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; top: 80px; right: 20px; z-index: 999999;
    background: ${type === 'success' ? 'var(--accent)' : 'var(--red)'};
    color: #fff; padding: 0.85rem 1.25rem; border-radius: 10px;
    font-size: 0.9rem; font-weight: 600; font-family: var(--font);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2); animation: slideUp 0.25s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// Monitor de Sessão Ativa (Evita deslogar ao apertar F5)
clienteSupabase.auth.onAuthStateChange(async (event, session) => {
    if (session && session.user) {
        const userMetadata = session.user.user_metadata;
        if (userMetadata && userMetadata.role === 'admin') {
            currentUser = { 
                email: session.user.email, 
                name: 'Administrador', 
                role: 'admin', 
                uid: session.user.id 
            };
            const painel = $('painel-admin');
            if (painel) {
                painel.style.display = 'block';
}
            loginScreen.classList.remove('active');
            appScreen.classList.add('active');
            initApp();
        }
    }
});


// ==================== ALTERNADOR DE VISÃO ULTRA SEGURO (ADMIN / MOTORISTA) ====================
document.addEventListener('DOMContentLoaded', () => {
    const btnAlternar = document.getElementById('btn-alternar-visao');
    const adminContainer = document.getElementById('admin-switch-container');
    
    // Simula a verificação do admin (adapte para pegar do seu currentUser real quando integrar)
    // Mostra a barra preta lá em cima se for admin
    if (adminContainer && currentUser && currentUser.role === 'admin') {
        adminContainer.style.display = 'flex';
    }

    if (btnAlternar) {
        btnAlternar.addEventListener('click', () => {
            const telaPesquisa = document.getElementById('searchView'); // Visão Motorista
            const telaPosto = document.getElementById('manageView');    // Visão Gerente/Admin
            
            // Oculte todas as views primeiro (mesma lógica que sua navegação deve usar)
            document.querySelectorAll('#appScreen .view').forEach(v => v.classList.remove('active'));

            if (btnAlternar.innerHTML.includes('Motorista')) {
                // 1. Mudar para a visão do Motorista
                if (telaPesquisa) telaPesquisa.classList.add('active');
                
                // Modifica o botão para modo de retorno
                btnAlternar.innerHTML = '<i class="fas fa-toggle-off"></i> Voltar para Painel Admin';
                btnAlternar.style.background = '#dc3545'; // Vermelho
                
                showAlert('Visão de Motorista ativada.', 'success');
            } else {
                // 2. Voltar para a visão de Admin / Posto
                if (telaPosto) telaPosto.classList.add('active');
                
                // Modifica o botão de volta para o padrão admin
                btnAlternar.innerHTML = '<i class="fas fa-toggle-on"></i> Mudar para Visão Motorista';
                btnAlternar.style.background = 'var(--blue, #007bff)'; // Azul
                
                showAlert('Visão de Administrador ativada.', 'success');
            }
        });
    }
});