/* ==========================================================================
   GasFinder RS — app.js
   ========================================================================== */

// ==================== 1. CONFIG ====================
const supabaseUrl = "https://tteozknocjjbsjjehqel.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZW96a25vY2pqYnNqamVocWVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTczOTYsImV4cCI6MjA5NTI5MzM5Nn0.FDRqKNW3BvuyqS4vmYnY3CiD4ug2cPXsZMBDMeEvH_o";
const ADMIN_EMAIL = "suporte@gasfinder.com";
const VAPID_PUBLIC_KEY = "SUA_CHAVE_PUBLICA_VAPID_AQUI";

const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// ==================== 2. STATE ====================
let POSTOS_DATA = {};
let CIDADES_DISPONIVEIS = [];
let currentUser = null;
let currentCity = null;
let currentStations = [];
let allStations = [];
let favorites = JSON.parse(localStorage.getItem("gf_favorites") || "[]");
let compareList = [];
let activeFilters = { sort: "price", fuel: null, promoOnly: false };
let customPrices = JSON.parse(localStorage.getItem("gf_custom_prices") || "{}");
let notifications = JSON.parse(localStorage.getItem("gf_notifications") || "[]");
let managedStationId = localStorage.getItem("gf_managed_station") || null;
let authBootstrapped = false;

// ==================== 3. DOM HELPERS ====================
const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const registerScreen = $("registerScreen");
const roleScreen = $("roleScreen");
const appScreen = $("appScreen");
const loginForm = $("loginForm");
const registerForm = $("registerForm");
const showRegisterBtn = $("showRegisterBtn");
const showLoginBtn = $("showLoginBtn");
const backToLoginFromRole = $("backToLoginFromRole");
const heroSection = $("heroSection");
const resultsArea = $("resultsArea");
const stationsGrid = $("stationsGrid");
const favGrid = $("favGrid");
const noResults = $("noResults");
const noFavs = $("noFavs");
const loader = $("loader");
const rankingStrip = $("rankingStrip");
const gridCount = $("gridCount");
const promosGrid = $("promosGrid");
const promosSection = $("promosSection");
const compareBtn = $("compareBtn");
const clearCmpBtn = $("clearCmpBtn");
const cmpCount = $("cmpCount");
const compareModal = $("compareModal");
const compareContent = $("compareContent");
const closeCmpModal = $("closeCmpModal");
const updateModal = $("updateModal");
const closeUpdateModal = $("closeUpdateModal");
const updatePricesBtn = $("updatePricesBtn");
const updateStation = $("updateStation");
const saveUpdateBtn = $("saveUpdateBtn");
const stickyCity = $("stickyCity");
const backBtn = $("backBtn");
const heroSearchInput = $("heroSearchInput");
const heroGeoBtn = $("heroGeoBtn");
const reportCity = $("reportCity");
const reportStation = $("reportStation");
const reportFuel = $("reportFuel");
const reportPrice = $("reportPrice");
const reportIsPromo = $("reportIsPromo");
const promoValidityField = $("promoValidityField");
const reportValidity = $("reportValidity");
const reportForm = $("reportForm");
const calcPrice = $("calcPrice");
const calcLiters = $("calcLiters");
const calcBtn = $("calcBtn");
const calcResult = $("calcResult");
const notificationsList = $("notificationsList");
const noNotifications = $("noNotifications");
const clearNotificationsBtn = $("clearNotificationsBtn");
const claimStationSection = $("claimStationSection");
const manageStationSection = $("manageStationSection");
const claimCity = $("claimCity");
const claimStationSelect = $("claimStationSelect");
const claimStationBtn = $("claimStationBtn");
const managedStationName = $("managedStationName");
const saveManageBtn = $("saveManageBtn");
const changeStationBtn = $("changeStationBtn");
const manageSuccess = $("manageSuccess");

// ==================== 4. UTILS ====================
function formatarTempo(dataIso) {
  if (!dataIso) return "Atualização recente";
  const data = new Date(dataIso);
  const agora = new Date();
  const diffMs = agora - data;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMins / 60);
  const diffDias = Math.floor(diffHoras / 24);
  if (diffMins < 60) return `Atualizado há ${diffMins === 0 ? 1 : diffMins} min`;
  if (diffHoras < 24) return `Atualizado há ${diffHoras}h`;
  if (diffDias === 1) return `Atualizado ontem`;
  return `Atualizado há ${diffDias} dias`;
}

function showAlert(msg, type = "error") {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed; top: 80px; right: 20px; z-index: 999999;
    background: ${type === "success" ? "var(--accent)" : "var(--red)"};
    color: #fff; padding: 0.85rem 1.25rem; border-radius: 10px;
    font-size: 0.9rem; font-weight: 600; font-family: var(--font);
    box-shadow: 0 8px 24px rgba(0,0,0,0.2); animation: slideUp 0.25s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPostosPorCidade(cidade) {
  return POSTOS_DATA[cidade] || [];
}

function getTodosPostos() {
  return Object.values(POSTOS_DATA).flat();
}

function applyCustomPrices(posto) {
  const cp = customPrices[posto.id];
  if (!cp) return posto;
  return { ...posto, ...cp };
}

function fuelLabel(fuel) {
  return (
    {
      gasolinaComum: "Gasolina",
      gasolinaAditivada: "Aditivada",
      etanol: "Etanol",
      diesel: "Diesel",
      dieselS10: "Diesel S10",
    }[fuel] || fuel
  );
}

function saveRole(role) {
  if (role) localStorage.setItem("gf_user_role", role);
  else localStorage.removeItem("gf_user_role");
}

function getSavedRole() {
  return localStorage.getItem("gf_user_role");
}

function showScreen(screenEl) {
  [loginScreen, registerScreen, roleScreen, appScreen].forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (screenEl) screenEl.classList.add("active");
}

function isAdminUser(user = currentUser) {
  return user && (user.role === "admin" || user.email === ADMIN_EMAIL);
}

// ==================== 5. SUPABASE / DATA API ====================
function mapPostoFromDb(posto) {
  return {
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
    hasPromotion: !!posto.has_promotion,
    promotionFuel: posto.promotion_fuel,
    promoPrice: parseFloat(posto.promo_price || 0),
    promoValidity: posto.promo_validity,
    openingHours: posto.opening_hours || "24h",
    phone: posto.phone || "",
    dono_id: posto.dono_id,
    updated_at: posto.updated_at,
  };
}

async function buscarPostosDoBanco() {
  const { data: postos, error } = await clienteSupabase.from("postos").select("*");

  if (error) {
    console.error("Erro ao buscar postos do Supabase:", error);
    return;
  }

  const mapped = {};
  (postos || []).forEach((posto) => {
    if (!mapped[posto.cidade]) mapped[posto.cidade] = [];
    mapped[posto.cidade].push(mapPostoFromDb(posto));
  });

  POSTOS_DATA = mapped;
  CIDADES_DISPONIVEIS = Object.keys(POSTOS_DATA);
  updateHeroStats();
  updateCityCounters();
  populateReportCity();

  if (currentUser) {
    if (currentUser.role === "driver" && currentCity) applyFilters();
    if (currentUser.role === "station_owner" || isAdminUser()) {
      if ($("manageView")?.classList.contains("active")) initManageView();
      if (isAdminUser()) carregarPostosAdmin();
    }
  }
}

async function atualizarPrecosNoBanco(codigoPosto, novosDados) {
  if (!currentUser) return false;

  if (!isAdminUser()) {
    const { data: postoAtual } = await clienteSupabase
      .from("postos")
      .select("dono_id")
      .eq("codigo_posto", codigoPosto)
      .single();

    if (!postoAtual || postoAtual.dono_id !== currentUser.uid) {
      showAlert("Erro de Segurança: Você não é o dono cadastrado deste posto!", "error");
      return false;
    }
  }

  const { error } = await clienteSupabase
    .from("postos")
    .update({
      gasolina_comum: parseFloat(novosDados.gasolinaComum) || 0,
      gasolina_aditivada: parseFloat(novosDados.gasolinaAditivada) || 0,
      etanol: parseFloat(novosDados.etanol) || 0,
      diesel: parseFloat(novosDados.diesel) || 0,
      diesel_s10: parseFloat(novosDados.dieselS10) || 0,
      has_promotion: !!novosDados.hasPromotion,
      promotion_fuel: novosDados.promotionFuel || "",
      promo_price: parseFloat(novosDados.promoPrice) || 0,
      promo_validity: novosDados.promoValidity || null,
      updated_at: new Date().toISOString(),
    })
    .eq("codigo_posto", codigoPosto);

  if (error) {
    console.error("Erro ao salvar no Supabase:", error);
    showAlert("Erro ao salvar os dados no servidor!", "error");
    return false;
  }
  return true;
}

async function vincularPostoAoDono(codigoPosto) {
  if (!currentUser) return false;
  if (isAdminUser()) return true;

  const { error } = await clienteSupabase
    .from("postos")
    .update({ dono_id: currentUser.uid })
    .eq("codigo_posto", codigoPosto)
    .is("dono_id", null);

  if (error) {
    console.error("Erro ao vincular posto:", error);
    showAlert("Não foi possível vincular o posto. Talvez já tenha dono.", "error");
    return false;
  }
  return true;
}

async function criarNovoPostoNoBanco(dados) {
  const codigoUnico =
    dados.cidade.substring(0, 3).toLowerCase() + "-" + Date.now();

  let linkFinalMaps = dados.linkMaps;
  if (!linkFinalMaps) {
    const busca = encodeURIComponent(
      `${dados.nome} ${dados.endereco || ""} ${dados.cidade}`,
    );
    linkFinalMaps = `https://www.google.com/maps/search/?api=1&query=${busca}`;
  }

  const novoPosto = {
    codigo_posto: codigoUnico,
    cidade: dados.cidade,
    nome: dados.nome,
    bandeira: dados.bandeira || "Branca",
    endereco: dados.endereco || "Endereço não informado",
    link_maps: linkFinalMaps,
    gasolina_comum: 0,
    gasolina_aditivada: 0,
    etanol: 0,
    diesel: 0,
    diesel_s10: 0,
    has_promotion: false,
    opening_hours: "Horário comercial",
    dono_id: isAdminUser() ? null : currentUser.uid,
  };

  const { error } = await clienteSupabase.from("postos").insert([novoPosto]);
  if (error) {
    console.error("Erro ao criar posto:", error);
    showAlert("Erro ao criar o posto.", "error");
    return null;
  }
  return codigoUnico;
}

async function apagarPostoAdmin(codigoPosto) {
  if (
    !confirm("Tem certeza que deseja apagar este posto? Esta ação é irreversível.")
  ) {
    return;
  }

  const { error } = await clienteSupabase
    .from("postos")
    .delete()
    .eq("codigo_posto", codigoPosto);

  if (error) {
    console.error("Erro ao apagar posto:", error);
    showAlert("Erro ao apagar o posto.", "error");
    return;
  }

  showAlert("Posto apagado com sucesso!", "success");
  await buscarPostosDoBanco();
  carregarPostosAdmin();
  if (currentCity) applyFilters();
}

window.apagarPostoAdmin = apagarPostoAdmin;

async function editarPostoAdmin(codigoPosto) {
  const posto = getTodosPostos().find((p) => p.id === codigoPosto);
  if (!posto) {
    showAlert("Posto não encontrado.", "error");
    return;
  }

  managedStationId = codigoPosto;
  localStorage.setItem("gf_managed_station", codigoPosto);
  showView("manageView");
  initManageView();
  showAlert(`Editando: ${posto.name}`, "success");
}

window.editarPostoAdmin = editarPostoAdmin;

// ==================== 6. THEME ====================
function initTheme() {
  const t = localStorage.getItem("gf_theme") || "light";
  if (t === "dark") document.body.classList.add("dark");
  updateThemeButtonIcon();
}

function updateThemeButtonIcon() {
  const themeBtn = $("themeBtn");
  if (!themeBtn) return;
  const isDark = document.body.classList.contains("dark");
  themeBtn.innerHTML = isDark
    ? '<i class="fas fa-sun"></i>'
    : '<i class="fas fa-moon"></i>';
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("gf_theme", isDark ? "dark" : "light");
  updateThemeButtonIcon();
}

initTheme();

$("themeBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleTheme();
});

// ==================== 7. AUTH ====================
function buildCurrentUser(user, roleOverride) {
  const isAdmin = user.email === ADMIN_EMAIL;
  const savedRole = roleOverride || getSavedRole();
  return {
    email: user.email,
    name: isAdmin ? "Administrador Master" : user.email.split("@")[0],
    uid: user.id,
    role: isAdmin ? "admin" : savedRole || null,
  };
}

async function handleAuthenticatedUser(user, { skipRoleScreen = false } = {}) {
  currentUser = buildCurrentUser(user);

  if (isAdminUser(currentUser)) {
    currentUser.role = "admin";
    saveRole("admin");
    showScreen(appScreen);
    initApp();
    return;
  }

  if (currentUser.role === "driver" || currentUser.role === "station_owner") {
    showScreen(appScreen);
    initApp();
    return;
  }

  if (skipRoleScreen) {
    showScreen(roleScreen);
    return;
  }

  showScreen(roleScreen);
}

if (showRegisterBtn) {
  showRegisterBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen(registerScreen);
  });
}

if (showLoginBtn) {
  showLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen(loginScreen);
  });
}

if (backToLoginFromRole) {
  backToLoginFromRole.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    if (!email || !password) {
      showAlert("Preencha todos os campos para continuar.");
      return;
    }

    const btn = loginForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = "Autenticando...";

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
      email,
      password,
    });
    btn.textContent = original;

    if (error) {
      showAlert("E-mail ou senha inválidos. Tente novamente.");
      return;
    }

    authBootstrapped = true;
    await handleAuthenticatedUser(data.user);
    if (isAdminUser()) showAlert("Logado no Modo Administrador!", "success");
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("regName").value.trim();
    const email = $("regEmail").value.trim();
    const pass = $("regPassword").value;
    const confirm = $("regConfirmPassword").value;

    if (!name || !email || !pass) {
      showAlert("Preencha todos os campos obrigatórios.");
      return;
    }
    if (pass.length < 6) {
      showAlert("A senha necessita ter no mínimo 6 caracteres.");
      return;
    }
    if (pass !== confirm) {
      showAlert("As senhas digitadas não batem.");
      return;
    }

    const btn = registerForm.querySelector('button[type="submit"]');
    const original = btn.textContent;
    btn.textContent = "Criando Usuário...";

    const { data, error } = await clienteSupabase.auth.signUp({
      email,
      password: pass,
      options: { data: { nome: name } },
    });
    btn.textContent = original;

    if (error) {
      showAlert("Erro ao registrar: " + error.message);
      return;
    }

    if (data.user?.id) {
      await clienteSupabase.from("perfis").upsert({
        id: data.user.id,
        nome: name,
        updated_at: new Date().toISOString(),
      });
    }

    showAlert("Conta criada com sucesso!", "success");
    authBootstrapped = true;
    currentUser = {
      email: data.user.email,
      name,
      uid: data.user.id,
      role: null,
    };
    registerForm.reset();
    showScreen(roleScreen);
  });
}

document.querySelectorAll(".role-card").forEach((card) => {
  card.addEventListener("click", () => selectRole(card.dataset.role));
});

function selectRole(role) {
  if (!currentUser) return;
  if (role !== "driver" && role !== "station_owner") return;
  currentUser.role = role;
  saveRole(role);
  showScreen(appScreen);
  initApp();
}

async function logout() {
  await clienteSupabase.auth.signOut();
  currentUser = null;
  currentCity = null;
  currentStations = [];
  managedStationId = null;
  localStorage.removeItem("gf_managed_station");
  saveRole(null);

  const adminPanel = $("adminPanelSection");
  const adminSwitch = $("admin-switch-container");
  if (adminPanel) adminPanel.style.display = "none";
  if (adminSwitch) adminSwitch.style.display = "none";

  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  if ($("searchView")) $("searchView").classList.add("active");
  if (heroSection) heroSection.style.display = "";
  if (resultsArea) resultsArea.style.display = "none";
  if ($("btnCriarPostoHtml")) $("btnCriarPostoHtml").remove();
  if ($("btnCriarPostoEdicaoHtml")) $("btnCriarPostoEdicaoHtml").remove();

  showScreen(loginScreen);
}

clienteSupabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT" || !session) {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      showScreen(loginScreen);
    }
    return;
  }

  // Restaura sessão no F5; evita reiniciar se o login/registro já montou o app
  if (event === "INITIAL_SESSION" && !authBootstrapped && session.user) {
    authBootstrapped = true;
    await handleAuthenticatedUser(session.user);
  }
});

// ==================== 8. SHELL UI (nav / views / init) ====================
function buildNav() {
  const nav = $("mainNav");
  if (!nav || !currentUser) return;

  const role = currentUser.role;

  if (role === "driver") {
    nav.innerHTML = `
      <button class="nav-item active" data-target="searchView">
        <i class="fas fa-search"></i><span>Buscar</span>
      </button>
      <button class="nav-item" data-target="favoritesView">
        <i class="fas fa-heart"></i><span>Favoritos</span>
      </button>
      <button class="nav-item" data-target="reportView">
        <i class="fas fa-bullhorn"></i><span>Avisar</span>
      </button>
      <button class="nav-item" data-target="notificationsView" style="position:relative">
        <i class="fas fa-bell"></i><span>Avisos</span>
        <span id="notifBadge" style="display:none;position:absolute;top:2px;right:8px;background:#e74c3c;color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:10px;">0</span>
      </button>
    `;
  } else if (role === "station_owner") {
    nav.innerHTML = `
      <button class="nav-item active" data-target="manageView">
        <i class="fas fa-gas-pump"></i><span>Meu Posto</span>
      </button>
      <button class="nav-item" data-target="notificationsView" style="position:relative">
        <i class="fas fa-bell"></i><span>Avisos</span>
        <span id="notifBadge" style="display:none;position:absolute;top:2px;right:8px;background:#e74c3c;color:#fff;font-size:0.65rem;padding:1px 5px;border-radius:10px;">0</span>
      </button>
    `;
  } else if (role === "admin") {
    nav.innerHTML = `
      <button class="nav-item active" data-target="adminPanelSection">
        <i class="fas fa-user-shield"></i><span>Admin</span>
      </button>
      <button class="nav-item" data-target="manageView">
        <i class="fas fa-gas-pump"></i><span>Postos</span>
      </button>
      <button class="nav-item" data-target="searchView">
        <i class="fas fa-search"></i><span>Buscar</span>
      </button>
    `;
  }

  bindNavListeners();
  updateThemeButtonIcon();
  updateNotifBadge();
}

function bindNavListeners() {
  document.querySelectorAll("#mainNav .nav-item[data-target]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      showView(btn.dataset.target);
    });
  });
}

function showView(viewId) {
  const adminPanel = $("adminPanelSection");
  document.querySelectorAll("#appScreen .view").forEach((v) => {
    v.classList.remove("active");
    if (v.id === "adminPanelSection") v.style.display = "none";
  });

  const target = $(viewId);
  if (target) {
    target.classList.add("active");
    if (viewId === "adminPanelSection") target.style.display = "block";
  }

  document.querySelectorAll("#mainNav .nav-item[data-target]").forEach((b) => {
    b.classList.toggle("active", b.dataset.target === viewId);
  });

  if (viewId === "notificationsView") renderNotifications();
  if (viewId === "favoritesView") renderFavorites();
  if (viewId === "manageView") initManageView();
  if (viewId === "adminPanelSection") {
    if (adminPanel) adminPanel.style.display = "block";
    carregarPostosAdmin();
  }
  if (viewId === "profileView") carregarPerfil();
}

function updateHeroStats() {
  const todos = getTodosPostos();
  const total = todos.length;
  const promos = todos.filter((p) => p.hasPromotion).length;
  if ($("totalPostos")) $("totalPostos").textContent = total;
  if ($("totalPromos")) $("totalPromos").textContent = promos;
}

function updateCityCounters() {
  const countVeraCruz = getPostosPorCidade("Vera Cruz").length;
  const countSantaCruz = getPostosPorCidade("Santa Cruz do Sul").length;
  const spanVeraCruz = $("counter-vera-cruz");
  const spanSantaCruz = $("counter-santa-cruz");
  if (spanVeraCruz) {
    spanVeraCruz.textContent = `${countVeraCruz} posto${countVeraCruz !== 1 ? "s" : ""}`;
  }
  if (spanSantaCruz) {
    spanSantaCruz.textContent = `${countSantaCruz} posto${countSantaCruz !== 1 ? "s" : ""}`;
  }
}

function verificarPermissaoAdmin() {
  const adminPanel = $("adminPanelSection");
  const adminSwitch = $("admin-switch-container");
  if (!adminPanel) return;

  if (isAdminUser()) {
    if (adminSwitch) adminSwitch.style.display = "flex";
    carregarPostosAdmin();
  } else {
    adminPanel.style.display = "none";
    if (adminSwitch) adminSwitch.style.display = "none";
  }
}

function inicializarAlternadorVisao() {
  const btn = $("btn-alternar-visao");
  if (!btn || btn.dataset.listenerAtivo === "true") return;
  btn.dataset.listenerAtivo = "true";

  btn.addEventListener("click", () => {
    if (!isAdminUser()) return;
    const goingToDriver = btn.innerHTML.includes("Motorista");
    if (goingToDriver) {
      showView("searchView");
      btn.innerHTML = '<i class="fas fa-toggle-off"></i> Voltar para Painel Admin';
      btn.style.background = "#dc3545";
      showAlert("Visão de Motorista ativada.", "success");
    } else {
      showView("adminPanelSection");
      btn.innerHTML = '<i class="fas fa-toggle-on"></i> Mudar para Visão Motorista';
      btn.style.background = "var(--blue, #007bff)";
      showAlert("Visão de Administrador ativada.", "success");
    }
  });
}

function initApp() {
  if (!currentUser) return;

  buildNav();
  updateHeroStats();
  updateCityCounters();
  populateReportCity();
  updateNotifBadge();
  verificarPermissaoAdmin();

  if (currentUser.role === "station_owner") {
    showView("manageView");
  } else if (currentUser.role === "admin") {
    inicializarAlternadorVisao();
    showView("adminPanelSection");
  } else {
    showView("searchView");
  }

  carregarPerfil();
}

// ==================== 9. DRIVER — search / filters / render ====================
document.querySelectorAll(".city-card").forEach((card) => {
  card.addEventListener("click", () => loadCity(card.dataset.city));
});

if (backBtn) {
  backBtn.addEventListener("click", () => {
    if (heroSection) heroSection.style.display = "";
    if (resultsArea) resultsArea.style.display = "none";
    currentCity = null;
    currentStations = [];
  });
}

function loadCity(cidade) {
  currentCity = cidade;
  if (stickyCity) stickyCity.textContent = cidade;
  if (loader) loader.style.display = "flex";
  if (heroSection) heroSection.style.display = "none";
  if (resultsArea) resultsArea.style.display = "block";
  if (stationsGrid) stationsGrid.innerHTML = "";
  if (noResults) noResults.style.display = "none";

  setTimeout(() => {
    allStations = getPostosPorCidade(cidade).map((p) => applyCustomPrices(p));
    currentStations = allStations;
    applyFilters();
    if (loader) loader.style.display = "none";
    populateUpdateStation(cidade);
  }, 300);
}

if (heroSearchInput) {
  let searchTimer = null;

  heroSearchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    const q = this.value.trim().toLowerCase();
    if (q.length < 3) return;

    searchTimer = setTimeout(() => {
      const found = getTodosPostos().find(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.address || "").toLowerCase().includes(q),
      );
      if (!found) return;
      loadCity(found.city);
      setTimeout(() => {
        const card = document.querySelector(`[data-id="${found.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 450);
    }, 400);
  });

  heroSearchInput.addEventListener("keypress", (e) => {
    if (e.key !== "Enter") return;
    clearTimeout(searchTimer);
    const q = heroSearchInput.value.trim().toLowerCase();
    if (!q) return;

    const found = getTodosPostos().find(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q),
    );
    if (found) {
      loadCity(found.city);
      setTimeout(() => {
        const card = document.querySelector(`[data-id="${found.id}"]`);
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 450);
      return;
    }

    const city = CIDADES_DISPONIVEIS.find((c) => c.toLowerCase().includes(q));
    if (city) loadCity(city);
  });
}

if (heroGeoBtn) heroGeoBtn.addEventListener("click", handleGeo);

function handleGeo() {
  if (!navigator.geolocation) {
    showAlert("Geolocalização não suportada.");
    return;
  }
  heroGeoBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const centroids = {
        "Vera Cruz": { lat: -29.715, lng: -52.5083 },
        "Santa Cruz do Sul": { lat: -29.7175, lng: -52.4258 },
      };
      let closest = null;
      let minDist = Infinity;
      for (const [city, coord] of Object.entries(centroids)) {
        const d = Math.hypot(lat - coord.lat, lng - coord.lng);
        if (d < minDist) {
          minDist = d;
          closest = city;
        }
      }
      heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';

      // ~0.2° ≈ 20 km — fora da área coberta
      if (minDist > 0.2) {
        showAlert("Você está fora da área coberta (Vera Cruz / Santa Cruz do Sul).");
        return;
      }

      showAlert(`Carregando ${closest}...`, "success");
      setTimeout(() => loadCity(closest), 400);
    },
    () => {
      heroGeoBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
      showAlert("Não foi possível obter a localização.");
    },
  );
}

document.querySelectorAll(".filter-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const sort = chip.dataset.sort;
    const filter = chip.dataset.filter;
    const fuel = chip.dataset.fuel;

    if (sort) {
      document.querySelectorAll("[data-sort]").forEach((b) => b.classList.remove("active"));
      chip.classList.add("active");
      activeFilters.sort = sort;
    }
    if (filter === "promo") {
      chip.classList.toggle("active");
      activeFilters.promoOnly = chip.classList.contains("active");
    }
    if (fuel) {
      const wasActive = chip.classList.contains("active");
      document.querySelectorAll("[data-fuel]").forEach((b) => b.classList.remove("active"));
      if (!wasActive) {
        chip.classList.add("active");
        activeFilters.fuel = fuel;
      } else {
        activeFilters.fuel = null;
      }
    }
    applyFilters();
  });
});

function applyFilters() {
  let stations = [...allStations];
  const q = heroSearchInput ? heroSearchInput.value.trim().toLowerCase() : "";

  if (q && currentCity) {
    stations = stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address || "").toLowerCase().includes(q),
    );
  }
  if (activeFilters.promoOnly) stations = stations.filter((s) => s.hasPromotion);
  if (activeFilters.fuel === "gasolina")
    stations = stations.filter((s) => s.gasolinaComum > 0);
  else if (activeFilters.fuel === "etanol")
    stations = stations.filter((s) => s.etanol > 0);
  else if (activeFilters.fuel === "diesel")
    stations = stations.filter((s) => s.diesel > 0 || s.dieselS10 > 0);

  if (activeFilters.sort === "price")
    stations.sort((a, b) => a.gasolinaComum - b.gasolinaComum);
  else if (activeFilters.sort === "name")
    stations.sort((a, b) => a.name.localeCompare(b.name));

  currentStations = stations;
  renderStations(stations);
  renderRanking(stations);
  renderPromos(stations);
}

function renderStations(stations) {
  if (!stationsGrid) return;

  if (!stations.length) {
    stationsGrid.style.display = "none";
    if (noResults) noResults.style.display = "block";
    if (gridCount) gridCount.textContent = "0 postos encontrados";
    return;
  }

  stationsGrid.style.display = "grid";
  if (noResults) noResults.style.display = "none";
  if (gridCount) {
    gridCount.textContent = `${stations.length} posto${stations.length > 1 ? "s" : ""}`;
  }

  const prices = stations.map((s) => s.gasolinaComum).filter((v) => v > 0);
  const cheapestPrice = prices.length ? Math.min(...prices) : 0;

  stationsGrid.innerHTML = stations
    .map((s) => {
      const isCheapest = s.gasolinaComum === cheapestPrice && cheapestPrice > 0;
      const isFav = favorites.includes(s.id);
      const inCompare = compareList.includes(s.id);
      const tags = [];

      if (isCheapest) {
        tags.push(
          '<span class="tag tag-cheapest"><i class="fas fa-award"></i> Mais barato</span>',
        );
      }
      if (s.hasPromotion) {
        tags.push(
          '<span class="tag tag-promo"><i class="fas fa-tag"></i> Promoção</span>',
        );
      }
      if (s.openingHours === "24h") {
        tags.push('<span class="tag tag-h24">24h</span>');
      }

      const updatedHtml = s.updated_at
        ? `<span class="trend-badge trend-stable"><i class="fas fa-clock"></i> ${formatarTempo(s.updated_at)}</span>`
        : "";

      const getPriceHtml = (fuelVal, isPromoMatch, oldVal) => {
        if (!fuelVal || fuelVal === 0)
          return `<span class="price-val" style="color:#aaa">--</span>`;
        if (isPromoMatch)
          return `<span class="price-val promo">R$ ${s.promoPrice.toFixed(2)}</span><span class="price-old">R$ ${oldVal.toFixed(2)}</span>`;
        return `<span class="price-val">R$ ${fuelVal.toFixed(2)}</span>`;
      };

      const gasHtml = getPriceHtml(
        s.gasolinaComum,
        s.hasPromotion && s.promotionFuel === "gasolinaComum",
        s.gasolinaComum,
      );
      const aditHtml = getPriceHtml(
        s.gasolinaAditivada,
        s.hasPromotion && s.promotionFuel === "gasolinaAditivada",
        s.gasolinaAditivada,
      );
      const etanolHtml = getPriceHtml(
        s.etanol,
        s.hasPromotion && s.promotionFuel === "etanol",
        s.etanol,
      );
      const dieselHtml = getPriceHtml(
        s.dieselS10 || s.diesel,
        s.hasPromotion &&
          (s.promotionFuel === "dieselS10" || s.promotionFuel === "diesel"),
        s.dieselS10 || s.diesel,
      );

      return `
      <div class="station-card${isCheapest ? " is-cheapest" : ""}" data-id="${s.id}">
        <div class="card-top">
          <div class="card-name">${s.name}</div>
          <button class="fav-btn${isFav ? " active" : ""}" data-id="${s.id}">
            <i class="${isFav ? "fas" : "far"} fa-heart"></i>
          </button>
        </div>
        ${tags.length ? `<div class="card-tags">${tags.join("")}</div>` : ""}
        ${updatedHtml}
        <div class="card-address"><i class="fas fa-map-pin"></i> ${s.address || ""}</div>
        <div class="prices-table">
          <div class="price-row"><span class="price-fuel">Gasolina</span>${gasHtml}</div>
          <div class="price-row"><span class="price-fuel">Aditivada</span>${aditHtml}</div>
          <div class="price-row"><span class="price-fuel">Etanol</span>${etanolHtml}</div>
          <div class="price-row"><span class="price-fuel">Diesel</span>${dieselHtml}</div>
        </div>
        <div class="card-bottom">
          <div class="card-meta">
            <span><i class="fas fa-clock"></i> ${s.openingHours || "--"}</span>
          </div>
          <div class="card-actions">
            <input type="checkbox" class="cmp-check" data-id="${s.id}" ${inCompare ? "checked" : ""}>
            ${s.mapsLink ? `<a href="${s.mapsLink}" target="_blank" rel="noopener" class="maps-btn"><i class="fas fa-route"></i> Rota</a>` : ""}
          </div>
        </div>
      </div>`;
    })
    .join("");

  stationsGrid.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.id));
  });
  stationsGrid.querySelectorAll(".cmp-check").forEach((cb) => {
    cb.addEventListener("change", () => toggleCompare(cb.dataset.id, cb.checked));
  });
}

function renderRanking(stations) {
  if (!rankingStrip) return;
  const top = [...stations]
    .filter((s) => s.gasolinaComum > 0)
    .sort((a, b) => a.gasolinaComum - b.gasolinaComum)
    .slice(0, 5);

  rankingStrip.innerHTML = top
    .map(
      (s, i) => `
    <div class="rank-item">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name">${s.name.split("–")[0]}</span>
      <span class="rank-price">R$ ${s.gasolinaComum.toFixed(2)}</span>
    </div>`,
    )
    .join("");
}

function renderPromos(stations) {
  if (!promosSection || !promosGrid) return;
  const promos = stations.filter((s) => s.hasPromotion);

  if (!promos.length) {
    promosSection.style.display = "none";
    return;
  }

  promosSection.style.display = "block";
  promosGrid.innerHTML = promos
    .map(
      (s) => `
    <div class="promo-card">
      <div class="promo-station">${s.name}</div>
      <span class="promo-fuel-tag">${fuelLabel(s.promotionFuel)}</span>
      <div class="promo-big-price">R$ ${(s.promoPrice || 0).toFixed(2)}</div>
      <div class="promo-validity"><i class="fas fa-calendar-alt"></i> Validade: ${s.promoValidity || "--"}</div>
    </div>`,
    )
    .join("");
}

// ==================== 10. FAVORITES ====================
function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx > -1) favorites.splice(idx, 1);
  else favorites.push(id);
  localStorage.setItem("gf_favorites", JSON.stringify(favorites));
  if (currentCity) applyFilters();
  renderFavorites();
}

function renderFavorites() {
  if (!favGrid || !noFavs) return;
  const favPostos = getTodosPostos()
    .map((p) => applyCustomPrices(p))
    .filter((p) => favorites.includes(p.id));

  if (!favPostos.length) {
    favGrid.style.display = "none";
    noFavs.style.display = "block";
    return;
  }

  favGrid.style.display = "grid";
  noFavs.style.display = "none";
  favGrid.innerHTML = favPostos
    .map(
      (s) => `
    <div class="station-card" data-id="${s.id}">
      <div class="card-top">
        <div class="card-name">${s.name}</div>
        <button class="fav-btn active" data-id="${s.id}"><i class="fas fa-heart"></i></button>
      </div>
      <div class="card-tags"><span class="tag tag-h24">${s.city}</span></div>
      <div class="card-address"><i class="fas fa-map-pin"></i> ${s.address || ""}</div>
      <div class="prices-table">
        <div class="price-row"><span class="price-fuel">Gasolina</span><span class="price-val">R$ ${s.gasolinaComum.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Aditivada</span><span class="price-val">R$ ${s.gasolinaAditivada.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Etanol</span><span class="price-val">R$ ${s.etanol.toFixed(2)}</span></div>
        <div class="price-row"><span class="price-fuel">Diesel</span><span class="price-val">R$ ${(s.dieselS10 || s.diesel).toFixed(2)}</span></div>
      </div>
    </div>`,
    )
    .join("");

  favGrid.querySelectorAll(".fav-btn").forEach((btn) => {
    btn.addEventListener("click", () => toggleFavorite(btn.dataset.id));
  });
}

// ==================== 11. COMPARE ====================
function toggleCompare(id, checked) {
  if (checked) {
    if (compareList.length >= 3) {
      showAlert("Limite máximo de 3 postos na comparação.");
      applyFilters();
      return;
    }
    if (!compareList.includes(id)) compareList.push(id);
  } else {
    compareList = compareList.filter((x) => x !== id);
  }
  updateCompareBar();
}

function updateCompareBar() {
  if (!compareBtn || !cmpCount) return;
  const count = compareList.length;
  cmpCount.textContent = count;
  compareBtn.disabled = count < 2;
  compareBtn.style.display = count > 0 ? "flex" : "none";
  if (clearCmpBtn) clearCmpBtn.style.display = count > 0 ? "inline-flex" : "none";
}

if (clearCmpBtn) {
  clearCmpBtn.addEventListener("click", () => {
    compareList = [];
    updateCompareBar();
    applyFilters();
  });
}

if (compareBtn) {
  compareBtn.addEventListener("click", () => {
    if (compareList.length < 2) {
      showAlert("Selecione ao menos 2 postos para comparar.");
      return;
    }
    renderCompareModal();
  });
}

if (closeCmpModal) {
  closeCmpModal.addEventListener("click", () => {
    if (compareModal) compareModal.style.display = "none";
  });
}

function renderCompareModal() {
  if (!compareModal || !compareContent) return;
  const list = getTodosPostos()
    .map((p) => applyCustomPrices(p))
    .filter((p) => compareList.includes(p.id));

  compareContent.innerHTML = list
    .map(
      (s) => `
    <div class="cmp-col">
      <div class="cmp-header">${s.name}</div>
      <div class="cmp-cell"><b>Cidade:</b> ${s.city}</div>
      <div class="cmp-cell"><b>Gasolina:</b> R$ ${s.gasolinaComum.toFixed(2)}</div>
      <div class="cmp-cell"><b>Aditivada:</b> R$ ${s.gasolinaAditivada.toFixed(2)}</div>
      <div class="cmp-cell"><b>Etanol:</b> R$ ${s.etanol.toFixed(2)}</div>
      <div class="cmp-cell"><b>Diesel:</b> R$ ${(s.dieselS10 || s.diesel).toFixed(2)}</div>
    </div>`,
    )
    .join("");
  compareModal.style.display = "flex";
}

// ==================== 12. REPORT / UPDATE PRICES (driver local) ====================
if (updatePricesBtn) {
  updatePricesBtn.addEventListener("click", () => {
    if (updateModal) updateModal.style.display = "flex";
  });
}

if (closeUpdateModal) {
  closeUpdateModal.addEventListener("click", () => {
    if (updateModal) updateModal.style.display = "none";
  });
}

if (updateStation) {
  updateStation.addEventListener("change", () => {
    const p = getTodosPostos()
      .map((x) => applyCustomPrices(x))
      .find((x) => x.id === updateStation.value);
    if (!p) return;
    if ($("upGas")) $("upGas").value = p.gasolinaComum;
    if ($("upAdit")) $("upAdit").value = p.gasolinaAditivada;
    if ($("upEtanol")) $("upEtanol").value = p.etanol;
    if ($("upDiesel")) $("upDiesel").value = p.dieselS10 || p.diesel;
  });
}

if (saveUpdateBtn) {
  saveUpdateBtn.addEventListener("click", () => {
    const id = updateStation?.value;
    if (!id) return;
    const g = parseFloat($("upGas")?.value);
    const a = parseFloat($("upAdit")?.value);
    const e = parseFloat($("upEtanol")?.value);
    const d = parseFloat($("upDiesel")?.value);
    if ([g, a, e, d].some(isNaN)) {
      showAlert("Preencha os campos validamente.");
      return;
    }
    if (!customPrices[id]) customPrices[id] = {};
    Object.assign(customPrices[id], {
      gasolinaComum: g,
      gasolinaAditivada: a,
      etanol: e,
      dieselS10: d,
      diesel: d,
    });
    localStorage.setItem("gf_custom_prices", JSON.stringify(customPrices));
    if ($("updateSuccess")) $("updateSuccess").style.display = "flex";
    setTimeout(() => {
      if (updateModal) updateModal.style.display = "none";
      if ($("updateSuccess")) $("updateSuccess").style.display = "none";
      if (currentCity) loadCity(currentCity);
    }, 1200);
  });
}

function populateUpdateStation(cidade) {
  if (!updateStation) return;
  updateStation.innerHTML = getPostosPorCidade(cidade)
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join("");
  updateStation.dispatchEvent(new Event("change"));
}

if (reportCity) {
  reportCity.addEventListener("change", () => {
    populateReportStation(reportCity.value);
  });
}

function populateReportCity() {
  if (!reportCity) return;
  const cities = CIDADES_DISPONIVEIS.length
    ? CIDADES_DISPONIVEIS
    : ["Vera Cruz", "Santa Cruz do Sul"];
  reportCity.innerHTML = cities.map((c) => `<option value="${c}">${c}</option>`).join("");
  populateReportStation(reportCity.value);
}

function populateReportStation(cidade) {
  if (!reportStation) return;
  reportStation.innerHTML = getPostosPorCidade(cidade)
    .map((p) => `<option value="${p.id}">${p.name}</option>`)
    .join("");
}

if (reportIsPromo) {
  reportIsPromo.addEventListener("change", () => {
    if (promoValidityField) {
      promoValidityField.style.display = reportIsPromo.checked ? "" : "none";
    }
  });
}

if (reportForm) {
  reportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = reportStation.value;
    const fuel = reportFuel.value;
    const price = parseFloat(reportPrice.value);
    const isPromo = reportIsPromo.checked;
    const validity = isPromo ? reportValidity.value : null;

    if (!id || !fuel || isNaN(price) || price <= 0) {
      showAlert("Preencha todos os campos corretamente.");
      return;
    }

    if (!customPrices[id]) customPrices[id] = {};
    customPrices[id][fuel] = price;
    if (isPromo) {
      Object.assign(customPrices[id], {
        hasPromotion: true,
        promotionFuel: fuel,
        promoPrice: price,
        promoValidity: validity || "--",
      });
    }
    localStorage.setItem("gf_custom_prices", JSON.stringify(customPrices));

    const originalP = getTodosPostos().find((x) => x.id === id);
    notifications.unshift({
      id: "notif-" + Date.now(),
      stationId: id,
      stationName: originalP ? originalP.name : "Posto",
      city: originalP ? originalP.city : "",
      type: isPromo ? "promo" : "price",
      timestamp: new Date().toISOString(),
      read: false,
      changes: {
        direction: "down",
        details: `Preço de ${fuelLabel(fuel)} reportado: R$ ${price.toFixed(2)}`,
      },
    });
    localStorage.setItem("gf_notifications", JSON.stringify(notifications));

    const success = $("reportSuccess");
    if (success) {
      success.style.display = "flex";
      setTimeout(() => {
        success.style.display = "none";
      }, 2500);
    }

    showAlert("Obrigado! Preço reportado.", "success");
    reportForm.reset();
    if (promoValidityField) promoValidityField.style.display = "none";
    updateNotifBadge();
    if (currentCity) loadCity(currentCity);
  });
}

// ==================== 13. CALCULATOR ====================
if (calcBtn) {
  calcBtn.addEventListener("click", () => {
    const p = parseFloat(calcPrice.value);
    const l = parseFloat(calcLiters.value);
    if (isNaN(p) || isNaN(l) || p <= 0 || l <= 0) {
      showAlert("Valores inválidos.");
      return;
    }
    calcResult.style.display = "block";
    calcResult.innerHTML = `Total estimado: <b style="color:var(--accent-dark)">R$ ${(p * l).toFixed(2)}</b>`;
  });
}

// ==================== 14. NOTIFICATIONS ====================
function updateNotifBadge() {
  const badge = $("notifBadge");
  if (!badge) return;
  const unread = notifications.filter((n) => !n.read).length;
  badge.textContent = unread;
  badge.style.display = unread > 0 ? "block" : "none";
}

function renderNotifications() {
  if (!notificationsList) return;

  if (!notifications.length) {
    notificationsList.innerHTML = "";
    if (noNotifications) noNotifications.style.display = "block";
    return;
  }

  if (noNotifications) noNotifications.style.display = "none";
  notificationsList.innerHTML = notifications
    .map(
      (n) => `
    <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
      <div class="notif-icon ${n.type === "promo" ? "promo" : "price-down"}">
        <i class="fas ${n.type === "promo" ? "fa-tag" : "fa-gas-pump"}"></i>
      </div>
      <div class="notif-content">
        <div class="notif-title">${n.stationName}</div>
        <div class="notif-desc">${n.changes ? n.changes.details : "Preços atualizados."}</div>
        <div class="notif-time">${formatarTempo(n.timestamp)}</div>
      </div>
    </div>`,
    )
    .join("");

  notifications.forEach((n) => {
    n.read = true;
  });
  localStorage.setItem("gf_notifications", JSON.stringify(notifications));
  updateNotifBadge();
}

if (clearNotificationsBtn) {
  clearNotificationsBtn.addEventListener("click", () => {
    notifications = [];
    localStorage.setItem("gf_notifications", JSON.stringify(notifications));
    renderNotifications();
    updateNotifBadge();
  });
}

// ==================== 15. STATION OWNER ====================
function togglePromoFields(show) {
  const el = $("mgPromoDetails");
  if (el) el.style.display = show ? "block" : "none";
}

function initManageView() {
  if (!manageStationSection || !claimStationSection) return;

  const postoDoUsuario = getTodosPostos().find(
    (p) => p.dono_id === currentUser?.uid,
  );
  if (postoDoUsuario) {
    managedStationId = postoDoUsuario.id;
    localStorage.setItem("gf_managed_station", managedStationId);
  }

  if (managedStationId) {
    claimStationSection.style.display = "none";
    manageStationSection.style.display = "block";
    loadManagedStationData();

    if (!$("btnCriarPostoEdicaoHtml")) {
      const divEdicao = document.createElement("div");
      divEdicao.id = "btnCriarPostoEdicaoHtml";
      divEdicao.style.cssText =
        "margin-top: 25px; border-top: 1px dashed #ccc; padding-top: 15px; text-align: center;";
      divEdicao.innerHTML = `
        <button id="btnCriarPostoEdicao" type="button" style="width:100%;padding:0.8rem;background:transparent;border:2px dashed #ff9800;color:#ff9800;border-radius:8px;cursor:pointer;font-weight:bold;">
          <i class="fas fa-plus"></i> Cadastrar Outro Posto Novo
        </button>`;
      manageStationSection.appendChild(divEdicao);
      $("btnCriarPostoEdicao").addEventListener("click", (e) => {
        e.preventDefault();
        abrirModalCriarPosto();
      });
    }
  } else {
    manageStationSection.style.display = "none";
    claimStationSection.style.display = "block";
    populateClaimCity();

    if (!$("btnCriarPostoHtml")) {
      const criarBtnDiv = document.createElement("div");
      criarBtnDiv.id = "btnCriarPostoHtml";
      criarBtnDiv.style.marginTop = "20px";
      criarBtnDiv.innerHTML = `
        <p style="font-size:0.9rem;text-align:center;color:var(--text-muted);margin-bottom:8px;">Não encontrou seu posto na lista?</p>
        <button id="btnCriarPosto" type="button" style="width:100%;padding:0.8rem;background:transparent;border:2px dashed var(--accent,#1967d2);color:var(--accent,#1967d2);border-radius:8px;cursor:pointer;font-weight:bold;">
          <i class="fas fa-plus"></i> Cadastrar Novo Posto
        </button>`;
      claimStationSection.appendChild(criarBtnDiv);
      $("btnCriarPosto").addEventListener("click", (e) => {
        e.preventDefault();
        abrirModalCriarPosto();
      });
    }
  }
}

function populateClaimCity() {
  if (!claimCity) return;
  claimCity.innerHTML = `
    <option value="">Selecione a cidade...</option>
    <option value="Vera Cruz">Vera Cruz</option>
    <option value="Santa Cruz do Sul">Santa Cruz do Sul</option>`;
  if (claimStationSelect) {
    claimStationSelect.innerHTML = '<option value="">Selecione o posto...</option>';
  }
}

if (claimCity) {
  claimCity.addEventListener("change", () => {
    const city = claimCity.value;
    if (!city || !claimStationSelect) return;
    const postosSemDono = getPostosPorCidade(city).filter((p) => !p.dono_id);
    claimStationSelect.innerHTML =
      '<option value="">Selecione o posto...</option>' +
      postosSemDono.map((p) => `<option value="${p.id}">${p.name}</option>`).join("");
  });
}

if (claimStationBtn) {
  claimStationBtn.addEventListener("click", async () => {
    const id = claimStationSelect ? claimStationSelect.value : "";
    if (!id) {
      showAlert("Selecione um posto para gerenciar.");
      return;
    }
    const vinculado = await vincularPostoAoDono(id);
    if (vinculado) {
      managedStationId = id;
      localStorage.setItem("gf_managed_station", id);
      await buscarPostosDoBanco();
      initManageView();
      showAlert("Posto vinculado à sua conta com sucesso!", "success");
    }
  });
}

if (changeStationBtn) {
  changeStationBtn.addEventListener("click", async () => {
    if (managedStationId && !isAdminUser()) {
      await clienteSupabase
        .from("postos")
        .update({ dono_id: null })
        .eq("codigo_posto", managedStationId);
    }
    managedStationId = null;
    localStorage.removeItem("gf_managed_station");
    if ($("btnCriarPostoHtml")) $("btnCriarPostoHtml").remove();
    if ($("btnCriarPostoEdicaoHtml")) $("btnCriarPostoEdicaoHtml").remove();
    await buscarPostosDoBanco();
    initManageView();
  });
}

function abrirModalCriarPosto() {
  if ($("modalNovoPosto")) $("modalNovoPosto").remove();

  const modalHtml = `
    <div id="modalNovoPosto" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;justify-content:center;align-items:center;">
      <div style="background:var(--bg,#fff);padding:2rem;border-radius:12px;width:90%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;">
        <h3 style="margin-top:0;margin-bottom:1.5rem;">Cadastrar Novo Posto</h3>
        <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;font-weight:bold;">Cidade do Posto</label>
        <select id="npCidade" style="width:100%;padding:0.8rem;margin-bottom:1rem;border:1px solid #ccc;border-radius:6px;background:var(--bg,#fff);color:var(--text);">
          <option value="">Selecione a cidade...</option>
          <option value="Vera Cruz">Vera Cruz</option>
          <option value="Santa Cruz do Sul">Santa Cruz do Sul</option>
        </select>
        <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;font-weight:bold;">Nome do Posto</label>
        <input type="text" id="npNome" placeholder="Ex: Posto BR Centro" style="width:100%;padding:0.8rem;margin-bottom:1rem;border:1px solid #ccc;border-radius:6px;background:transparent;color:var(--text);">
        <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;font-weight:bold;">Bandeira</label>
        <input type="text" id="npBandeira" placeholder="Ex: Ipiranga, Shell, Branca" style="width:100%;padding:0.8rem;margin-bottom:1rem;border:1px solid #ccc;border-radius:6px;background:transparent;color:var(--text);">
        <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;font-weight:bold;">Endereço Completo</label>
        <input type="text" id="npEndereco" placeholder="Rua principal, 123" style="width:100%;padding:0.8rem;margin-bottom:1rem;border:1px solid #ccc;border-radius:6px;background:transparent;color:var(--text);">
        <label style="display:block;margin-bottom:0.5rem;font-size:0.9rem;font-weight:bold;">Link do Google Maps</label>
        <input type="text" id="npMaps" placeholder="Cole o link do Maps aqui" style="width:100%;padding:0.8rem;margin-bottom:1.5rem;border:1px solid #ccc;border-radius:6px;background:transparent;color:var(--text);">
        <div style="display:flex;gap:10px;">
          <button id="npCancelar" type="button" style="flex:1;padding:0.8rem;background:#e0e0e0;color:#333;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Cancelar</button>
          <button id="npSalvar" type="button" style="flex:1;padding:0.8rem;background:var(--accent,#1967d2);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Criar Posto</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
  if (claimCity?.value) $("npCidade").value = claimCity.value;

  $("npCancelar").addEventListener("click", () => $("modalNovoPosto").remove());
  $("npSalvar").addEventListener("click", async () => {
    const cidadeSelecionada = $("npCidade").value;
    const nome = $("npNome").value.trim();
    const bandeira = $("npBandeira").value.trim();
    const endereco = $("npEndereco").value.trim();
    const linkMaps = $("npMaps").value.trim();

    if (!cidadeSelecionada || !nome) {
      showAlert("Preencha Cidade e Nome do Posto!");
      return;
    }

    $("npSalvar").textContent = "Salvando...";
    $("npSalvar").disabled = true;

    const novoId = await criarNovoPostoNoBanco({
      cidade: cidadeSelecionada,
      nome,
      bandeira,
      endereco,
      linkMaps,
    });

    if (novoId) {
      $("modalNovoPosto").remove();
      if ($("btnCriarPostoHtml")) $("btnCriarPostoHtml").remove();
      if ($("btnCriarPostoEdicaoHtml")) $("btnCriarPostoEdicaoHtml").remove();
      await buscarPostosDoBanco();
      managedStationId = novoId;
      localStorage.setItem("gf_managed_station", novoId);
      initManageView();
      showAlert("Posto criado! Altere os preços.", "success");
    } else {
      $("npSalvar").textContent = "Criar Posto";
      $("npSalvar").disabled = false;
    }
  });
}

function loadManagedStationData() {
  const p = getTodosPostos().find((x) => x.id === managedStationId);
  if (!p) return;
  if (managedStationName) managedStationName.textContent = p.name;
  if ($("mgGas")) $("mgGas").value = p.gasolinaComum || 0;
  if ($("mgAdit")) $("mgAdit").value = p.gasolinaAditivada || 0;
  if ($("mgEtanol")) $("mgEtanol").value = p.etanol || 0;
  if ($("mgDiesel")) $("mgDiesel").value = p.dieselS10 || p.diesel || 0;
  if ($("mgIsPromo")) $("mgIsPromo").checked = !!p.hasPromotion;
  if ($("mgPromoFuel")) $("mgPromoFuel").value = p.promotionFuel || "gasolinaComum";
  if ($("mgPromoPrice")) $("mgPromoPrice").value = p.promoPrice || 0;
  if ($("mgPromoValidity")) {
    $("mgPromoValidity").value =
      p.promoValidity && p.promoValidity !== "--" ? p.promoValidity : "";
  }
  togglePromoFields(!!$("mgIsPromo")?.checked);
}

if ($("mgIsPromo")) {
  $("mgIsPromo").addEventListener("change", () => {
    togglePromoFields($("mgIsPromo").checked);
  });
}

if (saveManageBtn) {
  saveManageBtn.addEventListener("click", async () => {
    if (!managedStationId) {
      showAlert("Nenhum posto selecionado.");
      return;
    }

    const gas = parseFloat($("mgGas").value);
    const adit = parseFloat($("mgAdit").value);
    const etanol = parseFloat($("mgEtanol").value);
    const diesel = parseFloat($("mgDiesel").value);

    if ([gas, adit, etanol, diesel].some((v) => isNaN(v) || v < 0)) {
      showAlert("Preencha os preços com valores válidos.");
      return;
    }

    const novosPrecos = {
      gasolinaComum: gas,
      gasolinaAditivada: adit,
      etanol,
      diesel,
      dieselS10: diesel,
      hasPromotion: $("mgIsPromo").checked,
      promotionFuel: $("mgPromoFuel").value,
      promoPrice: parseFloat($("mgPromoPrice").value) || 0,
      promoValidity: $("mgPromoValidity").value || "--",
    };

    const salvo = await atualizarPrecosNoBanco(managedStationId, novosPrecos);
    if (!salvo) return;
    await buscarPostosDoBanco();

    const isPromo = $("mgIsPromo").checked;
    const nomePosto = managedStationName?.textContent || "Posto";
    notifications.unshift({
      id: "notif-" + Date.now(),
      stationId: managedStationId,
      stationName: nomePosto,
      city: "",
      type: isPromo ? "promo" : "price",
      timestamp: new Date().toISOString(),
      read: false,
      changes: {
        direction: "down",
        details: isPromo ? "Oferta ativa!" : "Preços atualizados pelo dono",
      },
    });
    localStorage.setItem("gf_notifications", JSON.stringify(notifications));
    updateNotifBadge();
    notificarMotoristasLocal(nomePosto, fuelLabel(novosPrecos.promotionFuel || "gasolinaComum"), gas);

    if (manageSuccess) {
      manageSuccess.style.display = "flex";
      setTimeout(() => {
        manageSuccess.style.display = "none";
      }, 2000);
    }
    showAlert("Preços salvos no servidor com sucesso!", "success");
  });
}

// ==================== 16. ADMIN ====================
function carregarPostosAdmin(filtroTexto = "") {
  const lista = $("adminStationList");
  if (!lista) return;

  let postos = getTodosPostos();
  const q = (filtroTexto || "").trim().toLowerCase();
  if (q) {
    postos = postos.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q) ||
        (p.city || "").toLowerCase().includes(q),
    );
  }

  const total = getTodosPostos().length;
  const promos = getTodosPostos().filter((p) => p.hasPromotion).length;
  const semDono = getTodosPostos().filter((p) => !p.dono_id).length;
  if ($("adminStatTotalPostos")) $("adminStatTotalPostos").textContent = total;
  if ($("adminStatPromos")) $("adminStatPromos").textContent = promos;
  if ($("adminStatSemDono")) $("adminStatSemDono").textContent = semDono;

  if (!postos.length) {
    lista.innerHTML = "<li style='padding:1rem;'>Nenhum posto encontrado.</li>";
    return;
  }

  lista.innerHTML = postos
    .map(
      (posto) => `
    <li class="admin-card-posto" data-id="${posto.id}" style="padding:1rem;margin-bottom:0.75rem;background:var(--bg,#fff);border-radius:8px;border:1px solid #e5e5e5;">
      <h4 style="margin:0 0 0.35rem;">${posto.name || "Posto Sem Nome"} — ${posto.brand || "Sem Bandeira"}</h4>
      <p style="margin:0 0 0.75rem;color:var(--text-muted,#666);font-size:0.9rem;">
        ${posto.city || ""} | ${posto.address || ""} ${posto.dono_id ? "" : "· <b>Sem dono</b>"}
      </p>
      <div class="admin-acoes" style="display:flex;gap:0.5rem;flex-wrap:wrap;">
        <button type="button" onclick="editarPostoAdmin('${posto.id}')" class="btn-outline" style="padding:0.4rem 0.8rem;">
          <i class="fas fa-edit"></i> Editar
        </button>
        <button type="button" class="btn-apagar" onclick="apagarPostoAdmin('${posto.id}')" style="padding:0.4rem 0.8rem;background:#dc3545;color:#fff;border:none;border-radius:6px;cursor:pointer;">
          <i class="fas fa-trash"></i> Apagar
        </button>
      </div>
    </li>`,
    )
    .join("");
}

$("adminSearchStationInput")?.addEventListener("input", (e) => {
  carregarPostosAdmin(e.target.value);
});

$("adminAddStationBtn")?.addEventListener("click", async () => {
  const nome = $("adminNewStationName")?.value.trim();
  const endereco = $("adminNewStationAddress")?.value.trim();
  const cidade = $("adminNewStationCity")?.value;
  const bandeira = $("adminNewStationBrand")?.value.trim() || "Branca";

  if (!nome || !endereco || !cidade) {
    showAlert("Preencha Nome, Endereço e Cidade para continuar!", "error");
    return;
  }

  const btn = $("adminAddStationBtn");
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

  const novoId = await criarNovoPostoNoBanco({
    cidade,
    nome,
    bandeira,
    endereco,
    linkMaps: "",
  });

  btn.innerHTML = original;

  if (!novoId) return;

  showAlert("Posto cadastrado com sucesso!", "success");
  $("adminNewStationName").value = "";
  $("adminNewStationAddress").value = "";
  $("adminNewStationBrand").value = "";
  await buscarPostosDoBanco();
  carregarPostosAdmin();
});

// ==================== 17. PROFILE ====================
async function carregarPerfil() {
  if (!currentUser) return;
  try {
    const { data } = await clienteSupabase
      .from("perfis")
      .select("*")
      .eq("id", currentUser.uid)
      .maybeSingle();

    if (!data) return;
    if ($("profileName")) $("profileName").value = data.nome || "";
    if ($("profileFuel")) $("profileFuel").value = data.combustivel_favorito || "";
    if ($("profileVehicle")) $("profileVehicle").value = data.veiculo || "";
    if ($("profilePhone")) $("profilePhone").value = data.telefone || "";
    if ($("profilePlate")) $("profilePlate").value = data.placa || "";
  } catch (err) {
    console.log("Perfil ainda não criado ou erro ao carregar.");
  }
}

$("headerProfileBtn")?.addEventListener("click", () => {
  showView("profileView");
});

$("saveProfileBtn")?.addEventListener("click", async () => {
  if (!currentUser) return;
  const btn = $("saveProfileBtn");
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> A guardar...';

  try {
    const perfilData = {
      id: currentUser.uid,
      nome: $("profileName")?.value || "",
      combustivel_favorito: $("profileFuel")?.value || "",
      veiculo: $("profileVehicle")?.value || "",
      telefone: $("profilePhone")?.value || "",
      placa: $("profilePlate")?.value || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await clienteSupabase.from("perfis").upsert(perfilData);
    if (error) throw error;

    if (perfilData.nome) currentUser.name = perfilData.nome;

    const msg = $("profileSuccessMsg");
    if (msg) {
      msg.style.display = "block";
      setTimeout(() => {
        msg.style.display = "none";
      }, 3000);
    }
    showAlert("Perfil atualizado!", "success");
  } catch (error) {
    console.error("Erro ao guardar perfil:", error);
    showAlert("Erro ao guardar: " + error.message, "error");
  } finally {
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Perfil';
  }
});

$("profileLogoutBtn")?.addEventListener("click", async () => {
  await logout();
});

// ==================== 18. PWA ====================
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function registrarPWA() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");
    if (!("Notification" in window) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    if (VAPID_PUBLIC_KEY !== "SUA_CHAVE_PUBLICA_VAPID_AQUI") {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("[GasFinder] Push subscription:", JSON.stringify(subscription));
    }
  } catch (error) {
    console.error("[GasFinder] Erro ao registrar Service Worker:", error);
  }
}

function notificarMotoristasLocal(nomePostoOuCidade, tipoCombustivel, novoPreco) {
  if (Notification.permission !== "granted" || !navigator.serviceWorker?.controller) {
    return;
  }
  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification("GasFinder RS — Preço atualizado!", {
      body: `${nomePostoOuCidade} atualizou ${tipoCombustivel} para R$ ${Number(novoPreco).toFixed(2)}`,
      icon: "./Logo-Gas-Finder-2.0.png",
      badge: "./Logo-Gas-Finder-2.0.png",
      vibrate: [200, 100, 200],
      tag: "price-update",
    });
  });
}

window.addEventListener("load", registrarPWA);

// ==================== 19. BOOT ====================
buscarPostosDoBanco();
updateCompareBar();
