——··×…—··—··×—··×// ============ SUPABASE SETUP ============
// These two values connect the app to your Supabase project.
const SUPABASE_URL = "https://pxgixzbwnwwfcvsyfykg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4Z2l4emJ3bnd3ZmN2c3lmeWtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTMyMDcsImV4cCI6MjEwMDU4OTIwN30.FTjwN7JRYkMeVtFCuGeLskeUNxMPc6PNnW90YxkAmEk";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
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

  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    signupMsg.textContent = error.message;
    signupMsg.className = "form-msg error";
  } else {
    signupMsg.textContent = "Account created! Check your email to confirm, then log in.";
    signupMsg.className = "form-msg success";
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});

// React to login/logout automatically
supabaseClient.auth.onAuthStateChange((_event, session) => {
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

// USDA FoodData Central — used to look up real nutrition per ingredient
const USDA_API_KEY = "YnOBdMvMKdvL4t0eKREQtfrERtcbFePw03s9H5XH";

// Also load saved meals whenever the user logs in
supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) loadSavedMeals();
});

// ============ MEAL BUILDER ============
let mealIngredients = []; // { name, per100: {cal, protein, sugar}, grams }

const ingredientSearchInput = document.getElementById("ingredient-search-input");
const ingredientSearchBtn = document.getElementById("ingredient-search-btn");
const ingredientResults = document.getElementById("ingredient-results");
const mealIngredientsList = document.getElementById("meal-ingredients-list");
const saveMealBtn = document.getElementById("save-meal-btn");
const mealMsg = document.getElementById("meal-msg");
const savedMealsList = document.getElementById("saved-meals-list");

ingredientSearchBtn.addEventListener("click", async () => {
    const query = ingredientSearchInput.value.trim();
    if (!query) return;

    ingredientResults.innerHTML = `<p class="empty-state">Searching…</p>`;

    try {
          const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_API_KEY}&query=${encodeURIComponent(query)}&pageSize=6&dataType=Foundation,SR%20Legacy`;
          const res = await fetch(url);
          const data = await res.json();

          if (!data.foods || !data.foods.length) {
                  ingredientResults.innerHTML = `<p class="empty-state">No results — try a simpler search term (e.g. "chicken" instead of "grilled chicken breast").</p>`;
                  return;
          }

          ingredientResults.innerHTML = data.foods.map((food, i) => {
                  const per100 = extractNutrients(food.foodNutrients);
                  return `
                          <div class="result-row">
                                    <span class="result-row-name">${escapeHtml(food.description)}</span>
                                              <span class="result-row-macros">${per100.cal} cal · ${per100.protein}g protein · ${per100.sugar}g sugar (per 100g)</span>
                                                        <button class="btn-small" data-index="${i}">Add</button>
                                                                </div>
                                                                      `;
          }).join("");

          ingredientResults.querySelectorAll("button[data-index]").forEach(btn => {
                  btn.addEventListener("click", () => {
                            const food = data.foods[Number(btn.dataset.index)];
                            const per100 = extractNutrients(food.foodNutrients);
                            mealIngredients.push({ name: food.description, per100, grams: 100 });
                            renderMealIngredients();
                            ingredientResults.innerHTML = "";
                            ingredientSearchInput.value = "";
                  });
          });
    } catch (err) {
          ingredientResults.innerHTML = `<p class="empty-state">Couldn't reach the nutrition database. Try again in a moment.</p>`;
    }
});

function extractNutrients(foodNutrients) {
    const find = (num) => {
          const match = foodNutrients.find(n => String(n.nutrientNumber) === num);
          return match ? Number(match.value) : 0;
    };
    return {
          cal: Math.round(find("208")),
          protein: Math.round(find("203") * 10) / 10,
          sugar: Math.round(find("269") * 10) / 10,
    };
}

function renderMealIngredients() {
    if (!mealIngredients.length) {
          mealIngredientsList.innerHTML = `<p class="empty-state">No ingredients added yet — search above and add some.</p>`;
          updateMealTotals();
          return;
    }

    mealIngredientsList.innerHTML = mealIngredients.map((ing, i) => {
          const scaled = scaleNutrients(ing);
          return `
                <div class="ingredient-row">
                        <span class="ingredient-row-name">${escapeHtml(ing.name)}</span>
                                <input type="number" class="ingredient-row-grams" data-index="${i}" value="${ing.grams}" min="1"> g
                                        <span class="ingredient-row-macros">${scaled.cal} cal · ${scaled.protein}g protein · ${scaled.sugar}g sugar</span>
                                                <button class="delete-btn" data-remove="${i}" aria-label="Remove ingredient">×</button>
                                                      </div>
                                                          `;
    }).join("");

    mealIngredientsList.querySelectorAll("input[data-index]").forEach(input => {
          input.addEventListener("input", () => {
                  const i = Number(input.dataset.index);
                  mealIngredients[i].grams = Number(input.value) || 0;
                  renderMealIngredients();
          });
    });

    mealIngredientsList.querySelectorAll("button[data-remove]").forEach(btn => {
          btn.addEventListener("click", () => {
                  mealIngredients.splice(Number(btn.dataset.remove), 1);
                  renderMealIngredients();
          });
    });

    updateMealTotals();
}

function scaleNutrients(ing) {
    const factor = ing.grams / 100;
    return {
          cal: Math.round(ing.per100.cal * factor),
          protein: Math.round(ing.per100.protein * factor * 10) / 10,
          sugar: Math.round(ing.per100.sugar * factor * 10) / 10,
    };
}

function updateMealTotals() {
    const totals = mealIngredients.reduce((acc, ing) => {
          const scaled = scaleNutrients(ing);
          acc.cal += scaled.cal;
          acc.protein += scaled.protein;
          acc.sugar += scaled.sugar;
          return acc;
    }, { cal: 0, protein: 0, sugar: 0 });

    document.getElementById("meal-total-cal").textContent = Math.round(totals.cal);
    document.getElementById("meal-total-protein").textContent = Math.round(totals.protein * 10) / 10;
    document.getElementById("meal-total-sugar").textContent = Math.round(totals.sugar * 10) / 10;
    return totals;
}

saveMealBtn.addEventListener("click", async () => {
    mealMsg.textContent = "";
    const name = document.getElementById("meal-name").value.trim();

    if (!name) {
          mealMsg.textContent = "Give your meal a name first.";
          mealMsg.className = "form-msg error";
          return;
    }
    if (!mealIngredients.length) {
          mealMsg.textContent = "Add at least one ingredient first.";
          mealMsg.className = "form-msg error";
          return;
    }

    const totals = updateMealTotals();

    const { error } = await supabaseClient.from("meals").insert({
          user_id: currentUser.id,
          name,
          ingredients: mealIngredients,
          total_calories: Math.round(totals.cal),
          total_protein_g: Math.round(totals.protein * 10) / 10,
          total_sugar_g: Math.round(totals.sugar * 10) / 10,
    });

    if (error) {
          mealMsg.textContent = error.message;
          mealMsg.className = "form-msg error";
          return;
    }

    mealMsg.textContent = "Meal saved!";
    mealMsg.className = "form-msg success";
    mealIngredients = [];
    document.getElementById("meal-name").value = "";
    renderMealIngredients();
    loadSavedMeals();
});

async function loadSavedMeals() {
    const { data, error } = await supabaseClient
      .from("meals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
          savedMealsList.innerHTML = `<p class="empty-state">Couldn't load your meals: ${error.message}</p>`;
          return;
    }

    if (!data.length) {
          savedMealsList.innerHTML = `<p class="empty-state">No saved meals yet — build one above.</p>`;
          return;
    }

    savedMealsList.innerHTML = data.map(meal => `
        <div class="saved-meal-item" data-id="${meal.id}">
              <div class="saved-meal-main">
                      <span class="saved-meal-name">${escapeHtml(meal.name)}</span>
                              <span class="saved-meal-macros">${meal.total_calories} cal · ${meal.total_protein_g}g protein · ${meal.total_sugar_g}g sugar</span>
                                    </div>
                                          <div class="saved-meal-actions">
                                                  <select data-meal-type="${meal.id}">
                                                            <option value="breakfast">Breakfast</option>
                                                                      <option value="lunch">Lunch</option>
                                                                                <option value="dinner">Dinner</option>
                                                                                          <option value="snack">Snack</option>
                                                                                                  </select>
                                                                                                          <button class="btn-small" data-log="${meal.id}">Log today</button>
                                                                                                                  <button class="delete-btn" data-delete-meal="${meal.id}" aria-label="Delete meal">×</button>
                                                                                                                        </div>
                                                                                                                            </div>
                                                                                                                              `).join("");

    savedMealsList.querySelectorAll("button[data-log]").forEach(btn => {
          btn.addEventListener("click", async () => {
                  const id = btn.dataset.log;
                  const meal = data.find(m => m.id === id);
                  const mealType = savedMealsList.querySelector(`select[data-meal-type="${id}"]`).value;

                  await supabaseClient.from("food_logs").insert({
                            user_id: currentUser.id,
                            name: meal.name,
                            meal_type: mealType,
                            calories: meal.total_calories,
                            protein_g: meal.total_protein_g,
                            sugar_g: meal.total_sugar_g,
                            logged_at: todayStr(),
                  });

                  loadTodayLog();
          });
    });

    savedMealsList.querySelectorAll("button[data-delete-meal]").forEach(btn => {
          btn.addEventListener("click", async () => {
                  await supabaseClient.from("meals").delete().eq("id", btn.dataset.deleteMeal);
                  loadSavedMeals();
          });
    });
}


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
  return d.toISOString().split("T")[0]; // YYYY-MM-DD
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

  const { error } = await supabaseClient.from("food_logs").insert(entry);
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
  const { data, error } = await supabaseClient
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
      await supabaseClient.from("food_logs").delete().eq("id", id);
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
