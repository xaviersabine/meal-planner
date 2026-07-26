// ============ SUPABASE SETUP ============
const SUPABASE_URL = "https://pxgixzbwnwwfcvsyfykg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4Z2l4emJ3bnd3ZmN2c3lmeWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTMyMDcsImV4cCI6MjEwMDU4OTIwN30.FTjwN7JRYkMeVtFCuGeLskeUNxMPc6PNnW90YxkAmEk";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ STATE ============
let currentUser = null;
let goals = { calories: 2000, protein: 150, sugar: 50 };

// ============ ELEMENTS ============
const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginMsg = document.getElementById("login-msg");
const signupMsg = document.getElementById("signup-msg");

const tabBtns = document.querySelectorAll(".tab-btn");

const logoutBtn = document.getElementById("logout-btn");
const todayDateEl = document.getElementById("today-date");

const foodForm = document.getElementById("food-form");
const foodMsg = document.getElementById("food-msg");
const logList = document.getElementById("log-list");

const goalsToggle = document.getElementById("goals-toggle");
const goalsForm = document.getElementById("goals-form");

// ============ TAB SWITCHING (login / signup) ============
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    if (btn.dataset.tab === "login") {
      loginForm.hidden = false;
      signupForm.hidden = true;
    } else {
      loginForm.hidden = true;
      signupForm.hidden = false;
    }
  });
});

// ============ AUTH ACTIONS ============
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMsg.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginMsg.textContent = error.message;
    loginMsg.className = "form-msg error";
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupMsg.textContent = "";
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    signupMsg.textContent = error.message;
    signupMsg.className = "form-msg error";
  } else {
    signupMsg.textContent = "Account created! Check your email to confirm, then log in.";
    signupMsg.className = "form-msg success";
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  renderAuthState();
});

function renderAuthState() {
  if (currentUser) {
    authView.hidden = true;
    appView.hidden = false;
    todayDateEl.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
    loadGoals();
    loadTodayLog();
  } else {
    authView.hidden = false;
    appView.hidden = true;
  }
}

// ============ GOALS (stored locally per browser for now) ============
function loadGoals() {
  const saved = localStorage.getItem("harvest_goals");
  if (saved) goals = JSON.parse(saved);
  document.getElementById("goal-cal").value = goals.calories;
  document.getElementById("goal-protein").value = goals.protein;
  document.getElementById("goal-sugar").value = goals.sugar;
  document.getElementById("ring-cal-goal").textContent = goals.calories;
  document.getElementById("ring-protein-goal").textContent = goals.protein;
  document.getElementById("ring-sugar-goal").textContent = goals.sugar;
}

goalsToggle.addEventListener("click", () => {
  goalsForm.hidden = !goalsForm.hidden;
});

goalsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  goals = {
    calories: Number(document.getElementById("goal-cal").value) || 2000,
    protein: Number(document.getElementById("goal-protein").value) || 150,
    sugar: Number(document.getElementById("goal-sugar").value) || 50,
  };
  localStorage.setItem("harvest_goals", JSON.stringify(goals));
  document.getElementById("ring-cal-goal").textContent = goals.calories;
  document.getElementById("ring-protein-goal").textContent = goals.protein;
  document.getElementById("ring-sugar-goal").textContent = goals.sugar;
  goalsForm.hidden = true;
  loadTodayLog();
});

// ============ FOOD LOGGING ============
function todayStr() {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

foodForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  foodMsg.textContent = "";

  const entry = {
    user_id: currentUser.id,
    name: document.getElementById("food-name").value.trim(),
    meal_type: document.getElementById("food-meal").value,
    calories: Number(document.getElementById("food-cal").value),
    protein_g: Number(document.getElementById("food-protein").value),
    sugar_g: Number(document.getElementById("food-sugar").value),
    logged_at: todayStr(),
  };

  const { error } = await supabase.from("food_logs").insert(entry);
  if (error) {
    foodMsg.textContent = error.message;
    foodMsg.className = "form-msg error";
    return;
  }

  foodForm.reset();
  foodMsg.textContent = "Added.";
  foodMsg.className = "form-msg success";
  loadTodayLog();
});

async function loadTodayLog() {
  const { data, error } = await supabase
    .from("food_logs")
    .select("*")
    .eq("logged_at", todayStr())
    .order("created_at", { ascending: true });

  if (error) {
    logList.innerHTML = `<p class="empty-state">Couldn't load your log: ${error.message}</p>`;
    return;
  }

  renderLog(data);
  renderTotals(data);
}

function renderLog(entries) {
  if (!entries.length) {
    logList.innerHTML = `<p class="empty-state">Nothing logged yet today — add your first meal above.</p>`;
    return;
  }

  logList.innerHTML = entries.map(e => `
    <div class="log-item" data-id="${e.id}">
      <div class="log-item-main">
        <span class="log-item-name">${escapeHtml(e.name)}</span>
        <span class="log-item-meta">${e.meal_type}</span>
      </div>
      <div class="log-item-macros">${e.calories} cal · ${e.protein_g}g protein · ${e.sugar_g}g sugar</div>
      <button class="delete-btn" aria-label="Delete entry" data-id="${e.id}">×</button>
    </div>
  `).join("");

  logList.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      await supabase.from("food_logs").delete().eq("id", id);
      loadTodayLog();
    });
  });
}

function renderTotals(entries) {
  const totals = entries.reduce((acc, e) => {
    acc.calories += Number(e.calories) || 0;
    acc.protein += Number(e.protein_g) || 0;
    acc.sugar += Number(e.sugar_g) || 0;
    return acc;
  }, { calories: 0, protein: 0, sugar: 0 });

  setRing("ring-cal", totals.calories, goals.calories);
  setRing("ring-protein", totals.protein, goals.protein);
  setRing("ring-sugar", totals.sugar, goals.sugar);
}

function setRing(id, value, goal) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  document.getElementById(id).style.setProperty("--pct", pct);
  document.getElementById(`${id}-val`).textContent = Math.round(value);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
