<script setup>
import { ref, computed } from "vue";
import { useAuth } from "../composables/useAuth";

const { register, login, loginWithGoogle, error: authError, clearError } = useAuth();

const email = ref("");
const password = ref("");
const isLogin = ref(true); // true = login, false = register
const isLoading = ref(false);

const errorMessage = computed(() => authError.value || "");

async function handleEmailAuth() {
  if (!email.value.trim() || !password.value.trim()) {
    return;
  }

  isLoading.value = true;
  try {
    if (isLogin.value) {
      await login(email.value, password.value);
    } else {
      await register(email.value, password.value);
    }
  } catch (err) {
    // Ошибка уже установлена в useAuth
    console.error("Auth error:", err);
  } finally {
    isLoading.value = false;
  }
}

async function handleGoogleAuth() {
  isLoading.value = true;
  try {
    await loginWithGoogle();
  } catch (err) {
    console.error("Google auth error:", err);
  } finally {
    isLoading.value = false;
  }
}

function toggleMode() {
  isLogin.value = !isLogin.value;
  email.value = "";
  password.value = "";
  clearError();
}
</script>

<template>
  <div
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      font-family: system-ui;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    "
  >
    <div
      style="
        max-width: 400px;
        width: 100%;
        padding: 40px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      "
    >
      <h1 style="margin-top: 0; margin-bottom: 8px; text-align: center; color: #333;">
        DnD Online
      </h1>
      <p
        style="
          margin-top: 0;
          margin-bottom: 32px;
          text-align: center;
          color: #666;
          font-size: 14px;
        "
      >
        {{ isLogin ? "Sign in to continue" : "Create an account" }}
      </p>

      <div style="display: flex; flex-direction: column; gap: 20px">
        <!-- Email/Password форма -->
        <div style="display: flex; flex-direction: column; gap: 16px">
          <label style="display: flex; flex-direction: column; gap: 8px">
            <span style="font-weight: 500; font-size: 14px">Email</span>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              @keyup.enter="handleEmailAuth"
              :disabled="isLoading"
              style="
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 8px;
                font-size: 16px;
              "
            />
          </label>

          <label style="display: flex; flex-direction: column; gap: 8px">
            <span style="font-weight: 500; font-size: 14px">Password</span>
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              @keyup.enter="handleEmailAuth"
              :disabled="isLoading"
              style="
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 8px;
                font-size: 16px;
              "
            />
          </label>

          <!-- Сообщение об ошибке -->
          <div
            v-if="errorMessage"
            style="
              padding: 12px;
              background: #fee;
              border: 1px solid #fcc;
              border-radius: 8px;
              color: #c33;
              font-size: 14px;
            "
          >
            {{ errorMessage }}
          </div>

          <button
            @click="handleEmailAuth"
            :disabled="!email.trim() || !password.trim() || isLoading"
            style="
              padding: 12px;
              border-radius: 8px;
              border: none;
              background: #007bff;
              color: white;
              font-size: 16px;
              cursor: pointer;
              font-weight: 500;
            "
          >
            {{ isLoading ? "Loading..." : isLogin ? "Sign In" : "Sign Up" }}
          </button>
        </div>

        <!-- Разделитель -->
        <div
          style="
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 8px 0;
          "
        >
          <div style="flex: 1; height: 1px; background: #ddd"></div>
          <span style="color: #999; font-size: 14px">OR</span>
          <div style="flex: 1; height: 1px; background: #ddd"></div>
        </div>

        <!-- Google авторизация -->
        <button
          @click="handleGoogleAuth"
          :disabled="isLoading"
          style="
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #ddd;
            background: white;
            color: #333;
            font-size: 16px;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          "
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            style="flex-shrink: 0"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        <!-- Переключение между login и register -->
        <div style="text-align: center; margin-top: 8px">
          <button
            @click="toggleMode"
            style="
              background: none;
              border: none;
              color: #007bff;
              cursor: pointer;
              font-size: 14px;
              text-decoration: underline;
            "
          >
            {{ isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  opacity: 0.9;
}
</style>
