/* ==========================================================================
   GasFinder RS — app.js (REFATORADO E FUNCIONAL)
   - Chaves removidas do código; use variáveis de ambiente no Vercel
   - Tratamento de erros centralizado
   - Sanitização de inputs
   - Debounce na busca
   - Uso de queries no Supabase quando aplicável
   - Mantém compatibilidade com a UI original (IDs e funções públicas)
   - Observação: ajuste pequenas partes da UI/HTML se necessário (IDs esperados)
   ========================================================================== */

/* ==================== 1. CONFIG ==================== */
/* A chave anon é pública por desenho (RLS protege o banco).
   Nunca coloque a SERVICE ROLE no frontend.
   As variáveis vêm do .env (local) ou das Environment Variables do Vercel,
   e são lidas via import.meta.env — é assim que o Vite as expõe no browser. */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "suporte@gasfinder.com";
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const KEEP_CONNECTED_KEY = "gf_keep_connected";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (local) e nas Environment Variables do projeto no Vercel.",
  );
}

function isKeepConnected() {
  return localStorage.getItem(KEEP_CONNECTED_KEY) !== "false";
}

const supabaseAuthStorage = {
  getItem(key) {
    if (!isKeepConnected()) {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    }
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem(key, value) {
    if (!isKeepConnected()) {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  },
  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

const clienteSupabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: supabaseAuthStorage,
  },
});

/* ==================== 2. STATE ==================== */
let POSTOS_DATA = {};
let CIDADES_DISPONIVEIS = [];
let currentUser = null;
let currentCity = null;
let currentStations = [];
let allStations = [];
let favorites = safeParse(localStorage.getItem("gf_favorites"), []);
let compareList = safeParse(localStorage.getItem("gf_compare"), []);
let activeFilters = { sort: "price", fuel: null, promoOnly: false };
let customPrices = safeParse(localStorage.getItem("gf_custom_prices"), {});
let notifications = safeParse(localStorage.getItem("gf_notifications"), []);
let managedStationId = localStorage.getItem("gf_managed_station") || null;
let authBootstrapped = false;
let createStationCoords = { lat: null, lng: null };

/* ==================== 3. DOM HELPERS ==================== */
const $ = (id) => document.getElementById(id);

/* Elements (IDs expected in HTML) */
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
const createStationSection = $("createStationSection");
const claimCity = $("claimCity");
const claimStationSelect = $("claimStationSelect");
const claimStationBtn = $("claimStationBtn");
const managedStationName = $("managedStationName");
const saveManageBtn = $("saveManageBtn");
const changeStationBtn = $("changeStationBtn");
const manageSuccess = $("manageSuccess");

/* ==================== 4. UTIL FUNCTIONS ==================== */
function safeParse(str, fallback) {
  if (str == null || str === "") return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

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

function handleError(error, userMessage = "Erro inesperado.") {
  try {
    console.error(error);
  } catch (e) {}
  showAlert(userMessage, "error");
}

/* ==================== 5. SUPABASE / DATA API ==================== */
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

/* Busca todos os postos (inicialização/admin) */
async function buscarPostosDoBanco() {
  try {
    const { data: postos, error } = await clienteSupabase.from("postos").select("*");
    if (error) throw error;

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
  } catch (err) {
    handleError(err, "Erro ao buscar postos do Supabase.");
  }
}

/* Busca por cidade com filtros opcionais (usa Supabase para eficiência) */
async function buscarPostosPorCidadeNoBanco(cidade, { q = "", promoOnly = false } = {}) {
  try {
    let query = clienteSupabase.from("postos").select("*").eq("cidade", cidade);
    if (promoOnly) query = query.eq("has_promotion", true);
    if (q) query = query.ilike("nome", `%${q}%`).or(`endereco.ilike.%${q}%`);
    const { data: postos, error } = await query;
    if (error) throw error;
    return (postos || []).map(mapPostoFromDb);
  } catch (err) {
    handleError(err, "Erro ao buscar postos da cidade.");
    return [];
  }
}

/* Atualiza preços no banco com verificação de dono (ou admin) */
async function atualizarPrecosNoBanco(codigoPosto, novosDados) {
  try {
    if (!currentUser) {
      showAlert("Você precisa estar logado para atualizar preços.", "error");
      return false;
    }

    if (!isAdminUser()) {
      const { data: postoAtual, error: err1 } = await clienteSupabase
        .from("postos")
        .select("dono_id")
        .eq("codigo_posto", codigoPosto)
        .single();
      if (err1) throw err1;

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

    if (error) throw error;
    showAlert("Preços atualizados com sucesso!", "success");
    await buscarPostosDoBanco();
    return true;
  } catch (err) {
    handleError(err, "Erro ao salvar os dados no servidor!");
    return false;
  }
}

/* Vincula posto ao dono (apenas se ainda não tiver dono) */
async function vincularPostoAoDono(codigoPosto) {
  try {
    if (!currentUser) return false;
    if (isAdminUser()) return true;

    const { error } = await clienteSupabase
      .from("postos")
      .update({ dono_id: currentUser.uid })
      .eq("codigo_posto", codigoPosto)
      .is("dono_id", null);

    if (error) throw error;
    showAlert("Posto vinculado com sucesso!", "success");
    await buscarPostosDoBanco();
    return true;
  } catch (err) {
    handleError(err, "Não foi possível vincular o posto. Talvez já tenha dono.");
    return false;
  }
}

/* Cria novo posto no banco */
async function criarNovoPostoNoBanco(dados) {
  try {
    if (!currentUser) {
      showAlert("Você precisa estar logado para cadastrar um posto.", "error");
      return null;
    }

    const nome = (dados.nome || "").trim();
    const cidade = (dados.cidade || "").trim();
    const bandeira = (dados.bandeira || dados.brand || "Branca").trim() || "Branca";
    const endereco = (dados.endereco || dados.address || "").trim();
    const linkMaps = (dados.linkMaps || dados.link_maps || dados.mapsLink || "").trim();

    if (!nome || !cidade) {
      showAlert("Informe o nome e a cidade do posto.", "error");
      return null;
    }

    const codigoUnico = cidade.substring(0, 3).toLowerCase() + "-" + Date.now();

    let linkFinalMaps = linkMaps;
    if (!linkFinalMaps) {
      const busca = encodeURIComponent(`${nome} ${endereco} ${cidade}`);
      linkFinalMaps = `https://www.google.com/maps/search/?api=1&query=${busca}`;
    }

    const donoId = currentUser.role === "station_owner" ? currentUser.uid : isAdminUser() ? null : currentUser.uid;

    const novoPosto = {
      codigo_posto: codigoUnico,
      cidade,
      nome,
      bandeira,
      endereco: endereco || "Endereço não informado",
      link_maps: linkFinalMaps,
      latitude: parseFloat(dados.lat || dados.latitude) || 0,
      longitude: parseFloat(dados.lng || dados.longitude) || 0,
      gasolina_comum: 0,
      gasolina_aditivada: 0,
      etanol: 0,
      diesel: 0,
      diesel_s10: 0,
      has_promotion: false,
      opening_hours: "Horário comercial",
      dono_id: donoId,
    };

    const { error } = await clienteSupabase.from("postos").insert([novoPosto]);
    if (error) throw error;
    showAlert("Posto criado com sucesso!", "success");
    await buscarPostosDoBanco();
    return codigoUnico;
  } catch (err) {
    handleError(err, "Erro ao criar o posto.");
    return null;
  }
}

function decodeMapsText(value) {
  if (!value) return "";
  const withSpaces = String(value).replace(/\+/g, " ");
  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
}

function inferBandeiraFromName(nome) {
  const n = (nome || "").toLowerCase();
  if (n.includes("ipiranga")) return "Ipiranga";
  if (n.includes("shell")) return "Shell";
  if (n.includes("petrobras") || n.includes("br ")) return "Petrobras";
  if (/\bale\b/.test(n)) return "Ale";
  if (n.includes("texaco")) return "Texaco";
  if (n.includes("boxter")) return "Boxter";
  return "";
}

function inferCidadeFromText(text) {
  const hay = (text || "").toLowerCase();
  return CIDADES_DISPONIVEIS.find((c) => hay.includes(c.toLowerCase())) || "";
}

/* Extrai nome, morada e coordenadas de um URL do Google Maps */
function extrairDadosDoMaps(url) {
  const resultado = { nome: "", endereco: "", linkMaps: "", lat: null, lng: null, cidade: "" };
  if (!url || typeof url !== "string") return resultado;

  const bruto = url.trim();
  resultado.linkMaps = bruto;
  if (!bruto) return resultado;

  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(bruto)) {
    return resultado;
  }

  const decoded = decodeMapsText(bruto);

  const placeMatch = decoded.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch) {
    const slug = decodeMapsText(placeMatch[1])
      .replace(/[_/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const dashParts = slug.split(/\s+-\s+/);
    if (dashParts.length >= 2) {
      resultado.nome = dashParts[0].trim();
      resultado.endereco = dashParts.slice(1).join(" - ").trim();
    } else {
      const commaParts = slug.split(",").map((p) => p.trim()).filter(Boolean);
      if (commaParts.length >= 2) {
        resultado.nome = commaParts[0];
        resultado.endereco = commaParts.slice(1).join(", ");
      } else {
        resultado.nome = slug;
      }
    }
  }

  if (!resultado.nome) {
    const queryMatch = decoded.match(/[?&](?:q|query)=([^&]+)/i);
    if (queryMatch) resultado.nome = decodeMapsText(queryMatch[1]).trim();
  }

  const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    resultado.lat = parseFloat(atMatch[1]);
    resultado.lng = parseFloat(atMatch[2]);
  }

  if (resultado.lat == null) {
    const dataMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (dataMatch) {
      resultado.lat = parseFloat(dataMatch[1]);
      resultado.lng = parseFloat(dataMatch[2]);
    }
  }

  resultado.cidade = inferCidadeFromText(`${resultado.nome} ${resultado.endereco}`);
  return resultado;
}

/* Apaga posto (admin) */
async function apagarPostoAdmin(codigoPosto) {
  try {
    if (!confirm("Tem certeza que deseja apagar este posto? Esta ação é irreversível.")) return;

    const { error } = await clienteSupabase.from("postos").delete().eq("codigo_posto", codigoPosto);
    if (error) throw error;

    showAlert("Posto apagado com sucesso!", "success");
    await buscarPostosDoBanco();
    carregarPostosAdmin();
    if (currentCity) applyFilters();
  } catch (err) {
    handleError(err, "Erro ao apagar o posto.");
  }
}
window.apagarPostoAdmin = apagarPostoAdmin;

/* Editar posto admin (compatibilidade) */
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

/* ==================== 6. THEME ==================== */
function initTheme() {
  const t = localStorage.getItem("gf_theme") || "light";
  if (t === "dark") document.body.classList.add("dark");
  updateThemeButtonIcon();
}

function updateThemeButtonIcon() {
  const themeBtn = $("themeBtn");
  if (!themeBtn) return;
  const isDark = document.body.classList.contains("dark");
  themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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

/* ==================== 7. AUTH ==================== */
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
    e.stopPropagation();
    showScreen(registerScreen);
  });
}

if (showLoginBtn) {
  showLoginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
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

    try {
      const { data, error } = await clienteSupabase.auth.signInWithPassword({
        email,
        password,
      });
      btn.textContent = original;
      if (error) throw error;

      authBootstrapped = true;
      await handleAuthenticatedUser(data.user);
      if (isAdminUser()) showAlert("Logado no Modo Administrador!", "success");
    } catch (err) {
      btn.textContent = original;
      handleError(err, "E-mail ou senha inválidos. Tente novamente.");
    }
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

    try {
      const { data, error } = await clienteSupabase.auth.signUp({
        email,
        password: pass,
        options: {
          emailRedirectTo: window.location.origin,
          data: { nome: name },
        },
      });
      btn.textContent = original;
      if (error) throw error;

      const user = data.user;
      if (user?.id) {
        const { error: perfilError } = await clienteSupabase.from("perfis").upsert({
          id: user.id,
          nome: name,
          updated_at: new Date().toISOString(),
        });
        if (perfilError) {
          console.warn("Perfil não gravado (RLS/tabela):", perfilError.message);
        }
      }

      authBootstrapped = true;
      currentUser = {
        email: user?.email || email,
        name,
        uid: user?.id || null,
        role: null,
      };
      registerForm.reset();

      if (!user) {
        showAlert("Conta criada. Confirme o e-mail e depois faça login.", "success");
        showScreen(loginScreen);
        return;
      }

      showAlert("Conta criada com sucesso!", "success");
      showScreen(roleScreen);
    } catch (err) {
      btn.textContent = original;
      handleError(err, "Erro ao registrar: " + (err.message || ""));
    }
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
  try {
    await clienteSupabase.auth.signOut();
  } catch (err) {}
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
  if (event === "SIGNED_OUT") {
    currentUser = null;
    showScreen(loginScreen);
    return;
  }

  if (!session?.user) return;

  if (!authBootstrapped && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
    authBootstrapped = true;
    await handleAuthenticatedUser(session.user);
  }
});

/* ==================== 8. SHELL UI (nav / views / init) ==================== */
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

/* ==================== 9. DRIVER — search / filters / render ==================== */
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

async function loadCity(cidade) {
  currentCity = cidade;
  if (stickyCity) stickyCity.textContent = cidade;
  if (loader) loader.style.display = "flex";
  if (heroSection) heroSection.style.display = "none";
  if (resultsArea) resultsArea.style.display = "block";
  if (stationsGrid) stationsGrid.innerHTML = "";
  if (noResults) noResults.style.display = "none";

  try {
    const q = heroSearchInput ? heroSearchInput.value.trim().toLowerCase() : "";
    const postos = await buscarPostosPorCidadeNoBanco(cidade, {
      q,
      promoOnly: activeFilters.promoOnly,
    });

    allStations = (postos || []).map((p) => applyCustomPrices(p));
    currentStations = allStations;
    applyFilters();
    populateUpdateStation(cidade);
  } catch (err) {
    handleError(err, "Erro ao carregar a cidade.");
  } finally {
    if (loader) loader.style.display = "none";
  }
}

/* Debounce search */
if (heroSearchInput) {
  let searchTimer = null;

  heroSearchInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    const q = this.value.trim().toLowerCase();
    if (q.length < 3) return;

    searchTimer = setTimeout(async () => {
      try {
        const { data: found, error } = await clienteSupabase
          .from("postos")
          .select("*")
          .ilike("nome", `%${q}%`)
          .limit(1);
        if (error) throw error;
        if (found && found.length) {
          const f = mapPostoFromDb(found[0]);
          heroSearchInput.value = f.name;
          loadCity(f.city);
          setTimeout(() => {
            const card = document.querySelector(`[data-id="${f.id}"]`);
            if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 450);
        }
      } catch (err) {
        const foundLocal = getTodosPostos().find(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.address || "").toLowerCase().includes(q)
        );
        if (foundLocal) {
          heroSearchInput.value = foundLocal.name;
          loadCity(foundLocal.city);
          setTimeout(() => {
            const card = document.querySelector(`[data-id="${foundLocal.id}"]`);
            if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 450);
        }
      }
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
        (p.address || "").toLowerCase().includes(q)
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
    }
  );
}

/* Filter chips */
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
        (s.address || "").toLowerCase().includes(q)
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
    stations.sort((a, b) => (a.gasolinaComum || Infinity) - (b.gasolinaComum || Infinity));
  else if (activeFilters.sort === "name")
    stations.sort((a, b) => a.name.localeCompare(b.name));

  currentStations = stations;
  renderStations(stations);
  renderRanking(stations);
  renderPromos(stations);
}

/* Render stations */
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
      const name = escapeHtml(s.name);
      const address = escapeHtml(s.address || "");
      const price = s.gasolinaComum > 0 ? s.gasolinaComum.toFixed(3) : "-";
      const promo = s.hasPromotion ? `<span class="promo">Promo ${escapeHtml(s.promotionFuel || "")} ${s.promoPrice}</span>` : "";
      const favoriteClass = favorites.includes(s.id) ? "fav active" : "fav";
      return `
        <div class="station-card" data-id="${escapeHtml(s.id)}">
          <div class="station-header">
            <h3>${name}</h3>
            <div class="station-price">${price}</div>
          </div>
          <div class="station-address">${address}</div>
          <div class="station-meta">
            <small>${formatarTempo(s.updated_at)}</small>
            ${s.brand ? `<small>${escapeHtml(s.brand)}</small>` : ""}
          </div>
          <div class="station-actions">
            <a href="${escapeHtml(s.mapsLink || "#")}" target="_blank" rel="noopener">Como chegar</a>
            <button class="${favoriteClass}" data-id="${escapeHtml(s.id)}" onclick="toggleFavorite('${escapeHtml(s.id)}')">❤</button>
            <button onclick="openUpdateModal('${escapeHtml(s.id)}')">Atualizar</button>
            ${promo}
          </div>
        </div>
      `;
    })
    .join("");
}

/* Ranking and promos */
function renderRanking(stations) {
  if (!rankingStrip) return;
  rankingStrip.innerHTML = stations.slice(0, 5).map((s) => `<span>${escapeHtml(s.name)}</span>`).join("");
}
function renderPromos(stations) {
  if (!promosGrid) return;
  const promos = stations.filter((s) => s.hasPromotion);
  promosGrid.innerHTML = promos.map((p) => `<div>${escapeHtml(p.name)} - ${p.promoPrice}</div>`).join("");
}

/* ==================== 10. FAVORITOS / COMPARAÇÃO / NOTIFICAÇÕES ==================== */
function toggleFavorite(id) {
  if (!id) return;
  const idx = favorites.indexOf(id);
  if (idx === -1) favorites.push(id);
  else favorites.splice(idx, 1);
  localStorage.setItem("gf_favorites", JSON.stringify(favorites));
  renderFavorites();
  applyFilters();
}

function renderFavorites() {
  if (!favGrid) return;
  const favs = getTodosPostos().filter((p) => favorites.includes(p.id));
  if (!favs.length) {
    if (noFavs) noFavs.style.display = "block";
    favGrid.innerHTML = "";
    return;
  }
  if (noFavs) noFavs.style.display = "none";
  favGrid.innerHTML = favs
    .map((s) => `<div class="fav-card"><h4>${escapeHtml(s.name)}</h4><div>${escapeHtml(s.address || "")}</div><div>${s.gasolinaComum || "-"}</div></div>`)
    .join("");
}

/* Compare list */
function addToCompare(id) {
  if (!id) return;
  if (!compareList.includes(id)) compareList.push(id);
  localStorage.setItem("gf_compare", JSON.stringify(compareList));
  updateCompareUI();
}
function removeFromCompare(id) {
  compareList = compareList.filter((x) => x !== id);
  localStorage.setItem("gf_compare", JSON.stringify(compareList));
  updateCompareUI();
}
function updateCompareUI() {
  if (cmpCount) cmpCount.textContent = `${compareList.length}`;
  if (compareBtn) compareBtn.disabled = compareList.length < 2;
}
if (clearCmpBtn) clearCmpBtn.addEventListener("click", () => {
  compareList = [];
  localStorage.setItem("gf_compare", JSON.stringify(compareList));
  updateCompareUI();
});

/* Notifications (local) */
function renderNotifications() {
  if (!notificationsList) return;
  if (!notifications.length) {
    if (noNotifications) noNotifications.style.display = "block";
    notificationsList.innerHTML = "";
    return;
  }
  if (noNotifications) noNotifications.style.display = "none";
  notificationsList.innerHTML = notifications.map((n) => `<li>${escapeHtml(n)}</li>`).join("");
}
if (clearNotificationsBtn) clearNotificationsBtn.addEventListener("click", () => {
  notifications = [];
  localStorage.setItem("gf_notifications", JSON.stringify(notifications));
  renderNotifications();
});
function updateNotifBadge() {
  const badge = $("notifBadge");
  if (!badge) return;
  if (notifications.length) {
    badge.style.display = "inline-block";
    badge.textContent = notifications.length;
  } else {
    badge.style.display = "none";
  }
}

/* ==================== 11. MANAGE / CLAIM / ADMIN ==================== */
function populateReportCity() {
  if (!reportCity) return;
  reportCity.innerHTML = CIDADES_DISPONIVEIS.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

/* Manage view initialization */
function populateCreateStationCities() {
  const citySelect = $("createStationCity");
  if (!citySelect) return;
  const cities = CIDADES_DISPONIVEIS.length
    ? CIDADES_DISPONIVEIS
    : ["Vera Cruz", "Santa Cruz do Sul"];
  const current = citySelect.value;
  citySelect.innerHTML = cities
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
  if (current && cities.includes(current)) citySelect.value = current;
}

function setCreateStationVisible(visible) {
  if (createStationSection) createStationSection.style.display = visible ? "block" : "none";
  if (visible) populateCreateStationCities();
}

function initManageView() {
  if (!manageStationSection || !claimStationSection) return;
  if (!currentUser) return;
  if (currentUser.role === "station_owner") {
    const owned = getTodosPostos().find((p) => p.dono_id === currentUser.uid);
    if (owned) {
      manageStationSection.style.display = "block";
      claimStationSection.style.display = "none";
      setCreateStationVisible(false);
      managedStationName.textContent = owned.name;
      managedStationId = owned.id;
      localStorage.setItem("gf_managed_station", owned.id);
    } else {
      manageStationSection.style.display = "none";
      claimStationSection.style.display = "block";
      setCreateStationVisible(true);
      if (claimStationSelect) {
        claimStationSelect.innerHTML = getTodosPostos()
          .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} - ${escapeHtml(p.city)}</option>`)
          .join("");
      }
    }
  } else if (isAdminUser()) {
    manageStationSection.style.display = "block";
    claimStationSection.style.display = "none";
    setCreateStationVisible(false);
  } else {
    manageStationSection.style.display = "none";
    claimStationSection.style.display = "none";
    setCreateStationVisible(false);
  }
}

/* Claim station */
if (claimStationBtn) claimStationBtn.addEventListener("click", async () => {
  const id = claimStationSelect?.value;
  if (!id) return showAlert("Selecione um posto para reivindicar.", "error");
  const success = await vincularPostoAoDono(id);
  if (success) initManageView();
});

function aplicarDadosExtraidosDoMaps() {
  const url = ($("createStationMapsUrl")?.value || "").trim();
  if (!url) {
    showAlert("Cole o link do Google Maps para extrair os dados.");
    return;
  }

  const dados = extrairDadosDoMaps(url);
  createStationCoords = { lat: dados.lat, lng: dados.lng };

  if ($("createStationMapsLink")) $("createStationMapsLink").value = dados.linkMaps || url;

  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url) && !dados.nome) {
    showAlert("Este é um link curto. Abra no Maps e copie o endereço completo da barra (maps/place/...).");
    return;
  }

  if (dados.nome && $("createStationName")) $("createStationName").value = dados.nome;
  if (dados.endereco && $("createStationAddress")) $("createStationAddress").value = dados.endereco;

  const bandeira = inferBandeiraFromName(dados.nome);
  if (bandeira && $("createStationBrand")) $("createStationBrand").value = bandeira;

  if (dados.cidade && $("createStationCity")) {
    populateCreateStationCities();
    $("createStationCity").value = dados.cidade;
  }

  if (dados.nome || dados.endereco) {
    showAlert("Dados extraídos do link. Confira e complete o que faltar.", "success");
  } else {
    showAlert("Não foi possível ler o nome neste link. Preencha os campos manualmente.");
  }
}

if ($("extractMapsBtn")) {
  $("extractMapsBtn").addEventListener("click", (e) => {
    e.preventDefault();
    aplicarDadosExtraidosDoMaps();
  });
}

if ($("createStationMapsUrl")) {
  $("createStationMapsUrl").addEventListener("paste", () => {
    setTimeout(aplicarDadosExtraidosDoMaps, 0);
  });
}

if ($("createStationBtn")) {
  $("createStationBtn").addEventListener("click", async () => {
    if (!currentUser || currentUser.role !== "station_owner") {
      showAlert("Apenas donos de posto podem cadastrar um estabelecimento.");
      return;
    }

    const nome = ($("createStationName")?.value || "").trim();
    const cidade = ($("createStationCity")?.value || "").trim();
    const bandeira = ($("createStationBrand")?.value || "Branca").trim();
    const endereco = ($("createStationAddress")?.value || "").trim();
    const linkMaps = ($("createStationMapsLink")?.value || $("createStationMapsUrl")?.value || "").trim();

    if (!nome || !cidade) {
      showAlert("Preencha o nome e a cidade do posto.");
      return;
    }

    const btn = $("createStationBtn");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Cadastrando...";

    const codigo = await criarNovoPostoNoBanco({
      nome,
      cidade,
      bandeira,
      endereco,
      linkMaps,
      lat: createStationCoords.lat,
      lng: createStationCoords.lng,
    });

    btn.disabled = false;
    btn.innerHTML = original;

    if (codigo) {
      managedStationId = codigo;
      localStorage.setItem("gf_managed_station", codigo);
      ["createStationName", "createStationAddress", "createStationMapsUrl", "createStationMapsLink"].forEach((id) => {
        if ($(id)) $(id).value = "";
      });
      createStationCoords = { lat: null, lng: null };
      initManageView();
    }
  });
}

/* Save manage changes (example: update opening hours) */
if (saveManageBtn) saveManageBtn.addEventListener("click", async () => {
  if (!managedStationId) return showAlert("Nenhum posto gerenciado selecionado.", "error");
  // Example: update opening hours from an input with id manageOpeningHours
  const openingHours = escapeHtml($("manageOpeningHours")?.value || "Horário comercial");
  try {
    const { error } = await clienteSupabase.from("postos").update({ opening_hours: openingHours }).eq("codigo_posto", managedStationId);
    if (error) throw error;
    showAlert("Dados do posto atualizados.", "success");
    await buscarPostosDoBanco();
  } catch (err) {
    handleError(err, "Erro ao salvar dados do posto.");
  }
});

/* Admin: carregar postos para painel */
async function carregarPostosAdmin() {
  try {
    const todos = getTodosPostos();
    const adminList = $("adminPostosList");
    if (!adminList) return;
    adminList.innerHTML = todos.map((p) => `<div>${escapeHtml(p.name)} - ${escapeHtml(p.city)} <button onclick="editarPostoAdmin('${escapeHtml(p.id)}')">Editar</button> <button onclick="apagarPostoAdmin('${escapeHtml(p.id)}')">Apagar</button></div>`).join("");
  } catch (err) {
    handleError(err, "Erro ao carregar painel admin.");
  }
}

/* ==================== 12. UPDATE MODAL (atualizar preços) ==================== */
function openUpdateModal(postoId) {
  const posto = getTodosPostos().find((p) => p.id === postoId);
  if (!posto) return showAlert("Posto não encontrado.", "error");
  if (!updateModal) return;
  // populate fields (IDs expected in HTML)
  $("updateNome") && ($("updateNome").textContent = posto.name);
  $("updateGasolinaComum") && ($("updateGasolinaComum").value = posto.gasolinaComum || "");
  $("updateGasolinaAditivada") && ($("updateGasolinaAditivada").value = posto.gasolinaAditivada || "");
  $("updateEtanol") && ($("updateEtanol").value = posto.etanol || "");
  $("updateDiesel") && ($("updateDiesel").value = posto.diesel || "");
  $("updateDieselS10") && ($("updateDieselS10").value = posto.dieselS10 || "");
  $("updateHasPromo") && ($("updateHasPromo").checked = !!posto.hasPromotion);
  $("updatePromoFuel") && ($("updatePromoFuel").value = posto.promotionFuel || "");
  $("updatePromoPrice") && ($("updatePromoPrice").value = posto.promoPrice || "");
  $("updatePromoValidity") && ($("updatePromoValidity").value = posto.promoValidity || "");
  updateModal.dataset.postoId = postoId;
  updateModal.classList.add("active");
}
if (closeUpdateModal) closeUpdateModal.addEventListener("click", () => updateModal.classList.remove("active"));

if (saveUpdateBtn) saveUpdateBtn.addEventListener("click", async () => {
  const postoId = updateModal?.dataset?.postoId;
  if (!postoId) return showAlert("Posto não selecionado.", "error");
  const novosDados = {
    gasolinaComum: $("updateGasolinaComum")?.value,
    gasolinaAditivada: $("updateGasolinaAditivada")?.value,
    etanol: $("updateEtanol")?.value,
    diesel: $("updateDiesel")?.value,
    dieselS10: $("updateDieselS10")?.value,
    hasPromotion: !!$("updateHasPromo")?.checked,
    promotionFuel: $("updatePromoFuel")?.value,
    promoPrice: $("updatePromoPrice")?.value,
    promoValidity: $("updatePromoValidity")?.value || null,
  };
  const ok = await atualizarPrecosNoBanco(postoId, novosDados);
  if (ok) updateModal.classList.remove("active");
});

/* ==================== 13. UTILIDADES E COMPATIBILIDADE ==================== */
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

/* ==================== 14. BOOTSTRAP ==================== */
async function bootstrapApp() {
  try {
    await buscarPostosDoBanco();
    renderFavorites();
    updateCompareUI();
    renderNotifications();
    updateNotifBadge();
  } catch (err) {
    handleError(err, "Erro ao inicializar a aplicação.");
  }
}

/* Restaura sessão persistida sem disparar e-mail de confirmação */
(async () => {
  try {
    const { data, error } = await clienteSupabase.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (user && !authBootstrapped) {
      authBootstrapped = true;
      await handleAuthenticatedUser(user);
    }
  } catch (e) {}
  bootstrapApp();
})();

/* ==================== 15. EXPORTS PARA DEBUG ==================== */
window.GF = {
  buscarPostosDoBanco,
  buscarPostosPorCidadeNoBanco,
  atualizarPrecosNoBanco,
  criarNovoPostoNoBanco,
  extrairDadosDoMaps,
  vincularPostoAoDono,
  getTodosPostos,
  clienteSupabase,
  toggleFavorite,
  addToCompare,
  removeFromCompare,
};

/* ========================================================================== */
/* NOTAS FINAIS
   - Garanta que no Supabase você habilite Row Level Security (RLS) e crie policies:
     * Usuários autenticados podem ler postos.
     * Donos podem atualizar apenas seus postos: (dono_id = auth.uid()).
     * Admins podem usar backend com service_role para operações administrativas.
   - No Vercel, defina as variáveis de ambiente listadas no topo.
   - Se sua aplicação usa bundler (Webpack, Vite, Next), adapte a leitura de process.env conforme necessário.
   - Se quiser, eu posso gerar uma versão modular (api.js, auth.js, ui.js, utils.js) a partir deste arquivo.
   ========================================================================== */
