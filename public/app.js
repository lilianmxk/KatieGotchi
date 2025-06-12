import { initializeApp }  from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// 1️⃣ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDFaRV2987BNQzl52JYEp0kHDcD04u8G38",
  authDomain: "katiegotchi.web.app",
  projectId: "katiegotchi",
  storageBucket: "katiegotchi.firebasestorage.app",
  messagingSenderId: "721820024591",
  appId: "1:721820024591:web:c89313c1b685ad8fb8887a"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
  });

// helper
const $ = id => document.getElementById(id);

// UI refs
const authForm      = $('auth-form');
const signupBtn     = $('signup-btn');
const authMsg       = $('auth-message');
const authContainer = $('auth-container');
const gameContainer = $('game-container');

const typeMenu      = $('type-menu');
const hatchBtn      = $('hatch-btn');
const feedBtn       = $('feed-btn');
const playBtn       = $('play-btn');
const sleepBtn      = $('sleep-btn');
const treatBtn      = $('treat-btn');
const disciplineBtn = $('discipline-btn');
const feedMenu      = $('feed-menu');
const playMenu      = $('play-menu');
const dirModal      = $('game-modal-direction');
const mathModal     = $('game-modal-math');
const catchModal    = $('game-modal-catch');
const resetPetBtn   = $('reset-pet-btn');
const logoutBtn     = $('logout-btn');
const petSprite     = $('pet-sprite');

let currentPet = null, uid = null;
let correctDir, mathAnswer, bugCaught;
let planetClockTimer;

// — Sign Up —
signupBtn.onclick = async () => {
  const email = authForm.email.value, pw = authForm.password.value;
  try {
    const { user } = await createUserWithEmailAndPassword(auth,email,pw);
    authMsg.textContent = '✅ Signed up!';
    await setDoc(doc(db,'pets',user.uid), {
      age:0, weight:1, hunger:0, health:100, discipline:0,
      happiness:5, type:null,
      isSick:false, isNaughty:false,
      lastFedAt:Date.now(), lastPlayedAt:Date.now(),
      lastAgedAt:Date.now(), lastUpdated:Date.now()
    });
  } catch(e){ authMsg.textContent = e.message; }
};

// — Log In —
authForm.onsubmit = async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, authForm.email.value, authForm.password.value);
    authMsg.textContent = '✅ Logged in!';
  } catch(e){ authMsg.textContent = e.message; }
};

// — Log Out —
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    await signOut(auth);
  };
}

// — Reset Pet —
if (resetPetBtn) {
  resetPetBtn.onclick = async () => {
    if (!uid) return;
    await deleteDoc(doc(db, 'pets', uid));
    await setDoc(doc(db, 'pets', uid), {
      age:0, weight:1, hunger:0, health:100, discipline:0,
      happiness:5, type:null,
      isSick:false, isNaughty:false,
      lastFedAt:Date.now(), lastPlayedAt:Date.now(),
      lastAgedAt:Date.now(), lastUpdated:Date.now()
    });
    // Reload local state/UI
    const snap = await getDoc(doc(db,'pets',uid));
    currentPet = snap.exists() ? snap.data() : null;
    updateStatsUI(currentPet);
  };
}

// — Update UI —
function updateStatsUI(p) {
  // Fix: always show a number for happiness
  const happiness = typeof p.happiness === 'number' && !isNaN(p.happiness) ? p.happiness : 5;
  $('stat-age').textContent        = p.age;
  $('stat-weight').textContent     = p.weight;
  $('stat-hunger').textContent     = p.hunger;
  $('stat-health').textContent     = p.health;
  $('stat-discipline').textContent = p.discipline;
  $('stat-happiness').textContent  = happiness;

  // Animate pet: add CSS class for movement
  if (petSprite) {
    petSprite.classList.remove('walk-right', 'walk-left');
    // Idle movement always running: CSS does the animation (see style.css)
  }

  // icons
  $('icon-sick')?.classList.toggle('hidden', !p.isSick);
  $('icon-naughty')?.classList.toggle('hidden', !p.isNaughty);

  // controls
  hatchBtn?.classList.toggle('hidden', p.age >= 1);
  typeMenu?.classList.toggle('hidden', !!p.type);
}

// — Persist changes —
async function applyAction(updates) {
  const ref = doc(db,'pets',uid);
  const np  = { ...currentPet, ...updates, lastUpdated:Date.now() };
  await setDoc(ref, np);
  currentPet = np;
  updateStatsUI(np);
}

// — Controls wiring —
function setupControls() {
  // Select type (if you support multiple pet types)
  typeMenu?.querySelectorAll('[data-type]').forEach(b => {
    b.onclick = () => applyAction({ type: b.dataset.type });
  });

  // Hatch egg (for new pets)
  hatchBtn?.onclick = () => applyAction({ age: 1, lastAgedAt: Date.now() });

  // Feed logic
  feedBtn?.onclick = () => {
    if (currentPet.hunger === 0) {
      authMsg.textContent = "😋 Too full!";
      return;
    }
    feedMenu.classList.remove('hidden');
  };
  $('feed-cancel')?.onclick = () => feedMenu.classList.add('hidden');
  feedMenu?.querySelectorAll('[data-food]').forEach(b => {
    b.onclick = async () => {
      petSprite?.classList.add('walk-right');
      await new Promise(r => setTimeout(r, 800));
      petSprite?.classList.remove('walk-right');
      feedMenu.classList.add('hidden');
      const t = b.dataset.food;
      applyAction({
        hunger: Math.max(currentPet.hunger - (t === 'meal' ? 3 : 1), 0),
        weight: +(currentPet.weight + (t === 'meal' ? 1 : 0.2)).toFixed(1),
        lastFedAt: Date.now()
      });
    };
  });

  // Play game selection
  playBtn?.onclick = () => playMenu.classList.remove('hidden');
  $('play-cancel')?.onclick = () => playMenu.classList.add('hidden');
  playMenu?.querySelectorAll('[data-game]').forEach(b => {
    b.onclick = () => {
      playMenu.classList.add('hidden');
      if (b.dataset.game === 'direction') startDirectionGame();
      if (b.dataset.game === 'math') startMathGame();
      if (b.dataset.game === 'catch') startCatchGame();
    };
  });

  // Sleep logic
  sleepBtn?.onclick = () => applyAction({
    hunger: Math.min(currentPet.hunger + 1, 10),
    health: Math.min(currentPet.health + 10, 100)
  });

  // Treat logic
  treatBtn?.onclick = () => applyAction({ health: 100, isSick: false });

  // Discipline logic
  disciplineBtn?.onclick = () => applyAction({ discipline: 0, isNaughty: false });

  // Direction mini-game logic
  function startDirectionGame() {
    dirModal.classList.remove('hidden');
    correctDir = Math.random() < 0.5 ? '←' : '→';
  }
  dirModal?.querySelectorAll('[data-dir]').forEach(b => {
    b.onclick = async () => {
      const guess = b.dataset.dir;
      petSprite?.classList.add(guess === correctDir ? 'walk-right' : 'walk-left');
      petSprite?.addEventListener('animationend', () => petSprite.classList.remove('walk-right', 'walk-left'), { once: true });
      await applyAction({
        happiness: guess === correctDir ? Math.min(currentPet.happiness + 1, 10) : Math.max(currentPet.happiness - 1, 0),
        lastPlayedAt: Date.now()
      });
      dirModal.classList.add('hidden');
    };
  });
  $('direction-cancel')?.onclick = () => dirModal.classList.add('hidden');

  // Math mini-game logic
  function startMathGame() {
    mathModal.classList.remove('hidden');
    const a = Math.floor(Math.random() * 20) + 1, b = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '*'], op = ops[Math.floor(Math.random() * 3)];
    mathAnswer = eval(`${a}${op}${b}`);
    $('math-prompt').textContent = `${a} ${op} ${b} = ?`;
  }
  $('math-submit')?.onclick = async () => {
    const val = parseInt($('math-answer').value);
    await applyAction({
      happiness: val === mathAnswer ? Math.min(currentPet.happiness + 1, 10) : Math.max(currentPet.happiness - 1, 0),
      lastPlayedAt: Date.now()
    });
    mathModal.classList.add('hidden');
    $('math-answer').value = '';
  };
  $('math-cancel')?.onclick = () => mathModal.classList.add('hidden');

  // Catch the bug mini-game logic
  function startCatchGame() {
    catchModal.classList.remove('hidden');
    bugCaught = false;
    const bug = $('bug-area');
    bug.onclick = async () => {
      bugCaught = true;
      await applyAction({ happiness: Math.min(currentPet.happiness + 2, 10), lastPlayedAt: Date.now() });
      catchModal.classList.add('hidden');
    };
    setTimeout(async () => {
      if (!bugCaught) {
        await applyAction({ happiness: Math.max(currentPet.happiness - 1, 0), lastPlayedAt: Date.now() });
      }
      catchModal.classList.add('hidden');
    }, 5000);
  }
  $('catch-cancel')?.onclick = () => catchModal.classList.add('hidden');
}

// — Planet clock —
function startPlanetClock() {
  // Prevent multiple intervals!
  if (planetClockTimer) clearInterval(planetClockTimer);
  planetClockTimer = setInterval(async () => {
    const now = Date.now(), up = {};
    if ((now - currentPet.lastFedAt)/60000 >=5) {
      up.hunger = Math.min(currentPet.hunger+1,10);
      up.lastFedAt = now;
    }
    if ((now - currentPet.lastPlayedAt)/60000 >=7) {
      up.isNaughty = true;
      up.lastPlayedAt = now;
    }
    if ((now - currentPet.lastAgedAt)/60000 >=15) {
      up.age = currentPet.age+1;
      up.lastAgedAt = now;
    }
    if (!currentPet.isSick && currentPet.health <=50) {
      up.isSick = true;
    }
    if (Object.keys(up).length) {
      await applyAction(up);
    }
  }, 60000);
}

// — Auth listener & init —
onAuthStateChanged(auth, async user => {
  if (user) {
    uid = user.uid;
    authContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    const snap = await getDoc(doc(db,'pets',uid));
    currentPet = snap.exists() ? snap.data() : null;
    if (typeof currentPet.happiness !== 'number' || isNaN(currentPet.happiness)) {
      currentPet.happiness = 5;
    }
    updateStatsUI(currentPet);
    setupControls();
    startPlanetClock();
  } else {
    gameContainer.classList.add('hidden');
    authContainer.classList.remove('hidden');
    if (planetClockTimer) clearInterval(planetClockTimer);
  }
});
