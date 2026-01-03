import { ref } from "vue";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebase";

const user = ref(null);
const loading = ref(true);
const error = ref(null);

// Инициализация состояния авторизации при первом использовании
let unsubscribe = null;

function initAuth() {
  if (unsubscribe) return; // Уже инициализировано
  
  unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    user.value = firebaseUser;
    loading.value = false;
    error.value = null;
  });
}

// Инициализируем сразу при импорте модуля
initAuth();

// Регистрация с email и паролем
async function register(email, password) {
  try {
    error.value = null;
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (err) {
    error.value = err.message;
    throw err;
  }
}

// Вход с email и паролем
async function login(email, password) {
  try {
    error.value = null;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (err) {
    error.value = err.message;
    throw err;
  }
}

// Вход через Google
async function loginWithGoogle() {
  try {
    error.value = null;
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return userCredential.user;
  } catch (err) {
    error.value = err.message;
    throw err;
  }
}

// Выход
async function logout() {
  try {
    error.value = null;
    await signOut(auth);
  } catch (err) {
    error.value = err.message;
    throw err;
  }
}

// Сброс ошибки
function clearError() {
  error.value = null;
}

export function useAuth() {
  return {
    user,
    loading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    clearError
  };
}
