<template>
  <main class="ax8-auth">
    <aside class="ax8-auth-brand">
      <div class="ax8-brand-orb ax8-brand-orb-one"></div>
      <div class="ax8-brand-orb ax8-brand-orb-two"></div>

      <div class="ax8-brand-top">
        <div class="ax8-brand-lockup">
          <span class="ax8-brand-mark">
            <img :src="arthivoxSymbol" alt="" />
          </span>
          <span class="ax8-brand-name">Arthivo<span>X</span></span>
        </div>
        <span class="ax8-cloud-chip">CLOUD</span>
      </div>

      <div class="ax8-brand-copy">
        <p class="ax8-brand-kicker">BUSINESS ACCOUNTING, CONNECTED</p>
        <h1>One secure account for every company you manage.</h1>
        <p>
          Keep your accounting workspace local and fast while ArthivoX connects your
          identity and company access securely to the cloud.
        </p>

        <div class="ax8-brand-points">
          <div class="ax8-brand-point">
            <span><feather-icon name="hard-drive" class="w-4 h-4" /></span>
            <div>
              <strong>Local-first</strong>
              <small>Your working database stays on this computer.</small>
            </div>
          </div>
          <div class="ax8-brand-point">
            <span><feather-icon name="shield" class="w-4 h-4" /></span>
            <div>
              <strong>Verified access</strong>
              <small>Your email protects access to your cloud companies.</small>
            </div>
          </div>
          <div class="ax8-brand-point">
            <span><feather-icon name="cloud" class="w-4 h-4" /></span>
            <div>
              <strong>Cloud-ready</strong>
              <small>Company backup and record sync will build on this account.</small>
            </div>
          </div>
        </div>
      </div>

      <div class="ax8-brand-footer">
        <span class="ax8-status-dot"></span>
        <span>ArthivoX secure workspace</span>
      </div>
    </aside>

    <section class="ax8-auth-stage">
      <div class="ax8-mobile-brand">
        <span class="ax8-brand-mark">
          <img :src="arthivoxSymbol" alt="" />
        </span>
        <span class="ax8-brand-name">Arthivo<span>X</span></span>
      </div>

      <div class="ax8-auth-box">
        <!-- Sign in / Sign up -->
        <template v-if="mode === 'signin' || mode === 'signup'">
          <header class="ax8-auth-heading">
            <span class="ax8-section-tag">{{ mode === 'signin' ? 'WELCOME BACK' : 'NEW ACCOUNT' }}</span>
            <h2>{{ mode === 'signin' ? 'Sign in to ArthivoX' : 'Create your ArthivoX account' }}</h2>
            <p>
              {{
                mode === 'signin'
                  ? 'Use the email and password linked to your ArthivoX account.'
                  : 'Only your email and a password are needed. We will verify the email next.'
              }}
            </p>
          </header>

          <form class="ax8-form" @submit.prevent="submitCredentials">
            <label class="ax8-field">
              <span>Email address</span>
              <div class="ax8-input-wrap">
                <feather-icon name="mail" class="w-4 h-4 ax8-input-icon" />
                <input
                  v-model.trim="email"
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  placeholder="you@example.com"
                  :disabled="busy"
                  required
                />
              </div>
            </label>

            <div class="ax8-field">
              <div class="ax8-label-row">
                <span>Password</span>
                <small v-if="mode !== 'signin'">6+ characters</small>
              </div>
              <div class="ax8-input-wrap">
                <feather-icon name="lock" class="w-4 h-4 ax8-input-icon" />
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
                  placeholder="Enter your password"
                  minlength="6"
                  :disabled="busy"
                  required
                />
                <button
                  class="ax8-password-toggle"
                  type="button"
                  :title="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <feather-icon :name="showPassword ? 'eye-off' : 'eye'" class="w-4 h-4" />
                </button>
              </div>
              <button
                v-if="mode === 'signin'"
                class="ax121-forgot-below"
                type="button"
                :disabled="busy"
                @click="openForgotPassword"
              >
                Forgot password?
              </button>
            </div>

            <div v-if="errorMessage" class="ax8-message ax8-message-error">
              <feather-icon name="alert-circle" class="w-4 h-4" />
              <span>{{ errorMessage }}</span>
            </div>

            <button class="ax8-primary" type="submit" :disabled="busy">
              <span v-if="busy" class="ax8-spinner" />
              <span>
                {{
                  busy
                    ? mode === 'signin'
                      ? 'Signing in…'
                      : 'Creating account…'
                    : mode === 'signin'
                      ? 'Sign in'
                      : 'Continue'
                }}
              </span>
              <feather-icon v-if="!busy" name="arrow-right" class="w-4 h-4" />
            </button>
          </form>

          <div class="ax8-auth-switch">
            <span>{{ mode === 'signin' ? 'New to ArthivoX?' : 'Already have an account?' }}</span>
            <button type="button" :disabled="busy" @click="switchMode">
              {{ mode === 'signin' ? 'Create account' : 'Sign in instead' }}
            </button>
          </div>
        </template>

        <!-- Forgot password: email -->
        <template v-else-if="mode === 'forgot'">
          <button class="ax8-back" type="button" :disabled="busy" @click="returnToSignin">
            <feather-icon name="arrow-left" class="w-4 h-4" />
            <span>Back to sign in</span>
          </button>

          <header class="ax8-auth-heading ax8-otp-heading">
            <div class="ax8-otp-symbol">
              <feather-icon name="key" class="w-5 h-5" />
            </div>
            <span class="ax8-section-tag">PASSWORD RECOVERY</span>
            <h2>Reset your password</h2>
            <p>
              Enter the email linked to your ArthivoX account. We will send a
              verification code to that address.
            </p>
          </header>

          <form class="ax8-form" @submit.prevent="sendRecoveryCode">
            <label class="ax8-field">
              <span>Email address</span>
              <div class="ax8-input-wrap">
                <feather-icon name="mail" class="w-4 h-4 ax8-input-icon" />
                <input
                  v-model.trim="email"
                  type="email"
                  autocomplete="email"
                  inputmode="email"
                  placeholder="you@example.com"
                  :disabled="busy"
                  required
                />
              </div>
            </label>

            <div v-if="errorMessage" class="ax8-message ax8-message-error">
              <feather-icon name="alert-circle" class="w-4 h-4" />
              <span>{{ errorMessage }}</span>
            </div>

            <button class="ax8-primary" type="submit" :disabled="busy">
              <span v-if="busy" class="ax8-spinner" />
              <span>{{ busy ? 'Sending code…' : 'Send reset code' }}</span>
              <feather-icon v-if="!busy" name="arrow-right" class="w-4 h-4" />
            </button>
          </form>
        </template>

        <!-- Signup OTP / Recovery OTP -->
        <template v-else-if="mode === 'signupOtp' || mode === 'recoveryOtp'">
          <button class="ax8-back" type="button" :disabled="busy" @click="backFromOtp">
            <feather-icon name="arrow-left" class="w-4 h-4" />
            <span>{{ mode === 'signupOtp' ? 'Use another email' : 'Change email' }}</span>
          </button>

          <header class="ax8-auth-heading ax8-otp-heading">
            <div class="ax8-otp-symbol">
              <feather-icon :name="mode === 'signupOtp' ? 'mail' : 'shield'" class="w-5 h-5" />
            </div>
            <span class="ax8-section-tag">
              {{ mode === 'signupOtp' ? 'VERIFY EMAIL' : 'VERIFY RESET' }}
            </span>
            <h2>
              {{ mode === 'signupOtp' ? 'Enter your verification code' : 'Enter your reset code' }}
            </h2>
            <p>
              We sent a verification code to <strong>{{ maskedEmail }}</strong>.
              Enter the complete code exactly as it appears in the email.
            </p>
          </header>

          <form class="ax8-form" @submit.prevent="submitOtp">
            <label class="ax8-field ax8-otp-field">
              <span>Verification code</span>
              <input
                ref="otpInput"
                v-model="otp"
                class="ax8-otp-input ax9-otp-flex"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="10"
                pattern="[0-9]{6,10}"
                placeholder="Enter code"
                :disabled="busy"
                required
                @input="sanitizeOtp"
              />
              <small class="ax9-field-help">Accepts the full code sent by ArthivoX Cloud.</small>
            </label>

            <div v-if="errorMessage" class="ax8-message ax8-message-error">
              <feather-icon name="alert-circle" class="w-4 h-4" />
              <span>{{ errorMessage }}</span>
            </div>
            <div v-if="infoMessage" class="ax8-message ax8-message-info">
              <feather-icon name="check-circle" class="w-4 h-4" />
              <span>{{ infoMessage }}</span>
            </div>

            <button class="ax8-primary" type="submit" :disabled="busy || !isOtpReady">
              <span v-if="busy" class="ax8-spinner" />
              <span>
                {{ busy ? 'Verifying…' : mode === 'signupOtp' ? 'Verify email' : 'Verify reset code' }}
              </span>
              <feather-icon v-if="!busy" name="check" class="w-4 h-4" />
            </button>
          </form>

          <div class="ax8-auth-switch">
            <span>Didn't receive the email?</span>
            <button type="button" :disabled="busy || resendCooldown > 0" @click="resendCurrentOtp">
              {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code' }}
            </button>
          </div>
        </template>

        <!-- Set new password -->
        <template v-else-if="mode === 'resetPassword'">
          <header class="ax8-auth-heading ax8-otp-heading">
            <div class="ax8-otp-symbol">
              <feather-icon name="lock" class="w-5 h-5" />
            </div>
            <span class="ax8-section-tag">NEW PASSWORD</span>
            <h2>Choose a new password</h2>
            <p>Your email is verified. Set the new password you will use to sign in.</p>
          </header>

          <form class="ax8-form" @submit.prevent="finishPasswordReset">
            <label class="ax8-field">
              <div class="ax8-label-row">
                <span>New password</span>
                <small>6+ characters</small>
              </div>
              <div class="ax8-input-wrap">
                <feather-icon name="lock" class="w-4 h-4 ax8-input-icon" />
                <input
                  ref="newPasswordInput"
                  v-model="newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Enter a new password"
                  minlength="6"
                  :disabled="busy"
                  required
                />
                <button
                  class="ax8-password-toggle"
                  type="button"
                  :title="showNewPassword ? 'Hide password' : 'Show password'"
                  @click="showNewPassword = !showNewPassword"
                >
                  <feather-icon :name="showNewPassword ? 'eye-off' : 'eye'" class="w-4 h-4" />
                </button>
              </div>
            </label>

            <label class="ax8-field">
              <span>Confirm new password</span>
              <div class="ax8-input-wrap">
                <feather-icon name="check-circle" class="w-4 h-4 ax8-input-icon" />
                <input
                  v-model="confirmPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  placeholder="Re-enter your new password"
                  minlength="6"
                  :disabled="busy"
                  required
                />
              </div>
            </label>

            <div v-if="errorMessage" class="ax8-message ax8-message-error">
              <feather-icon name="alert-circle" class="w-4 h-4" />
              <span>{{ errorMessage }}</span>
            </div>

            <button class="ax8-primary" type="submit" :disabled="busy">
              <span v-if="busy" class="ax8-spinner" />
              <span>{{ busy ? 'Updating password…' : 'Update password' }}</span>
              <feather-icon v-if="!busy" name="check" class="w-4 h-4" />
            </button>
          </form>
        </template>

        <!-- Reset success -->
        <template v-else-if="mode === 'resetDone'">
          <header class="ax8-auth-heading ax8-otp-heading">
            <div class="ax8-otp-symbol ax9-success-symbol">
              <feather-icon name="check" class="w-5 h-5" />
            </div>
            <span class="ax8-section-tag">PASSWORD UPDATED</span>
            <h2>Your password has been reset</h2>
            <p>You can now sign in to ArthivoX using your new password.</p>
          </header>

          <button class="ax8-primary ax9-success-button" type="button" @click="returnToSignin">
            <span>Return to sign in</span>
            <feather-icon name="arrow-right" class="w-4 h-4" />
          </button>
        </template>
      </div>

      <p class="ax8-auth-legal">
        By continuing, you are accessing a secured ArthivoX workspace.
      </p>
    </section>
  </main>
</template>

<script lang="ts">
import { ARTHIVOX_SYMBOL_DATA_URL } from 'src/assets/brand/embeddedBrand';
import { defineComponent, nextTick } from 'vue';
import type { ArthivoXCloudSession } from '../../cloud/supabase';
import {
  getStoredSession,
  requestPasswordRecoveryOtp,
  resendSignupOtp,
  signInWithPassword,
  signUpWithPassword,
  updatePasswordWithRecoverySession,
  verifyRecoveryOtp,
  verifySignupOtp,
} from '../../cloud/supabase';

type AuthMode =
  | 'signin'
  | 'signup'
  | 'signupOtp'
  | 'forgot'
  | 'recoveryOtp'
  | 'resetPassword'
  | 'resetDone';

export default defineComponent({
  name: 'AuthScreen',
  emits: ['authenticated'],
  data() {
    return {
      arthivoxSymbol: ARTHIVOX_SYMBOL_DATA_URL,
      mode: 'signin' as AuthMode,
      email: '',
      password: '',
      otp: '',
      newPassword: '',
      confirmPassword: '',
      recoverySession: null as ArthivoXCloudSession | null,
      busy: false,
      showPassword: false,
      showNewPassword: false,
      errorMessage: '',
      infoMessage: '',
      resendCooldown: 0,
      resendTimer: null as number | null,
    };
  },
  computed: {
    maskedEmail(): string {
      const [name, domain] = this.email.split('@');
      if (!name || !domain) {
        return this.email;
      }
      const visible = name.slice(0, Math.min(2, name.length));
      return `${visible}${'*'.repeat(Math.max(2, name.length - visible.length))}@${domain}`;
    },
    isOtpReady(): boolean {
      return /^\d{6,10}$/.test(this.otp);
    },
  },
  beforeUnmount() {
    this.clearResendTimer();
  },
  methods: {
    clearMessages() {
      this.errorMessage = '';
      this.infoMessage = '';
    },
    clearResendTimer() {
      if (this.resendTimer !== null) {
        window.clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
      this.resendCooldown = 0;
    },
    normalizeEmail(): string {
      return this.email.trim().toLowerCase();
    },
    switchMode() {
      this.clearMessages();
      this.password = '';
      this.showPassword = false;
      this.mode = this.mode === 'signin' ? 'signup' : 'signin';
    },
    openForgotPassword() {
      this.clearMessages();
      this.password = '';
      this.otp = '';
      this.recoverySession = null;
      this.mode = 'forgot';
    },
    returnToSignin() {
      this.clearMessages();
      this.clearResendTimer();
      this.password = '';
      this.otp = '';
      this.newPassword = '';
      this.confirmPassword = '';
      this.recoverySession = null;
      this.showPassword = false;
      this.showNewPassword = false;
      this.mode = 'signin';
    },
    async submitCredentials() {
      this.clearMessages();
      const email = this.normalizeEmail();
      if (!email) {
        this.errorMessage = 'Enter your email address.';
        return;
      }
      if (this.password.length < 6) {
        this.errorMessage = 'Password must contain at least 6 characters.';
        return;
      }

      this.busy = true;
      try {
        if (this.mode === 'signin') {
          const session = await signInWithPassword(email, this.password);
          this.$emit('authenticated', session);
          return;
        }

        await signUpWithPassword(email, this.password);
        const immediateSession = getStoredSession();
        if (immediateSession) {
          this.$emit('authenticated', immediateSession);
          return;
        }

        this.email = email;
        this.password = '';
        this.otp = '';
        this.mode = 'signupOtp';
        this.startResendCooldown();
        await nextTick();
        (this.$refs.otpInput as HTMLInputElement | undefined)?.focus();
      } catch (error) {
        this.errorMessage = this.getErrorMessage(error);
      } finally {
        this.busy = false;
      }
    },
    async sendRecoveryCode() {
      this.clearMessages();
      const email = this.normalizeEmail();
      if (!email) {
        this.errorMessage = 'Enter your email address.';
        return;
      }

      this.busy = true;
      try {
        await requestPasswordRecoveryOtp(email);
        this.email = email;
        this.otp = '';
        this.mode = 'recoveryOtp';
        this.infoMessage = 'If this email is registered, a reset code has been sent.';
        this.startResendCooldown();
        await nextTick();
        (this.$refs.otpInput as HTMLInputElement | undefined)?.focus();
      } catch (error) {
        this.errorMessage = this.getErrorMessage(error);
      } finally {
        this.busy = false;
      }
    },
    sanitizeOtp(event: Event) {
      const target = event.target as HTMLInputElement;
      this.otp = target.value.replace(/\D/g, '').slice(0, 10);
      target.value = this.otp;
    },
    async submitOtp() {
      if (!/^\d{6,10}$/.test(this.otp)) {
        this.errorMessage = 'Enter the complete verification code from your email.';
        return;
      }

      this.busy = true;
      this.clearMessages();
      try {
        if (this.mode === 'signupOtp') {
          const session = await verifySignupOtp(this.email, this.otp);
          this.$emit('authenticated', session);
          return;
        }

        this.recoverySession = await verifyRecoveryOtp(this.email, this.otp);
        this.otp = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.mode = 'resetPassword';
        this.clearResendTimer();
        await nextTick();
        (this.$refs.newPasswordInput as HTMLInputElement | undefined)?.focus();
      } catch (error) {
        this.errorMessage = this.getErrorMessage(error);
      } finally {
        this.busy = false;
      }
    },
    async resendCurrentOtp() {
      this.busy = true;
      this.clearMessages();
      try {
        if (this.mode === 'signupOtp') {
          await resendSignupOtp(this.email);
        } else {
          await requestPasswordRecoveryOtp(this.email);
        }
        this.infoMessage = 'A new verification code has been sent.';
        this.startResendCooldown();
      } catch (error) {
        this.errorMessage = this.getErrorMessage(error);
      } finally {
        this.busy = false;
      }
    },
    backFromOtp() {
      const targetMode: AuthMode = this.mode === 'signupOtp' ? 'signup' : 'forgot';
      this.clearMessages();
      this.clearResendTimer();
      this.otp = '';
      this.mode = targetMode;
    },
    async finishPasswordReset() {
      this.clearMessages();
      if (!this.recoverySession) {
        this.errorMessage = 'Your reset session has expired. Request a new reset code.';
        this.mode = 'forgot';
        return;
      }
      if (this.newPassword.length < 6) {
        this.errorMessage = 'Password must contain at least 6 characters.';
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.errorMessage = 'The two passwords do not match.';
        return;
      }

      this.busy = true;
      try {
        await updatePasswordWithRecoverySession(this.recoverySession, this.newPassword);
        this.recoverySession = null;
        this.newPassword = '';
        this.confirmPassword = '';
        this.mode = 'resetDone';
      } catch (error) {
        this.errorMessage = this.getErrorMessage(error);
      } finally {
        this.busy = false;
      }
    },
    startResendCooldown() {
      this.clearResendTimer();
      this.resendCooldown = 45;
      this.resendTimer = window.setInterval(() => {
        this.resendCooldown -= 1;
        if (this.resendCooldown <= 0) {
          this.clearResendTimer();
        }
      }, 1000);
    },
    getErrorMessage(error: unknown): string {
      const message = error instanceof Error ? error.message : String(error);
      if (/invalid login credentials/i.test(message)) {
        return 'Incorrect email or password.';
      }
      if (/email not confirmed/i.test(message)) {
        return 'Verify your email before signing in.';
      }
      if (/token.*expired|otp.*expired|expired.*token/i.test(message)) {
        return 'That verification code has expired. Request a new one.';
      }
      if (/invalid.*token|invalid.*otp|token.*invalid/i.test(message)) {
        return 'That verification code is not valid.';
      }
      if (/rate limit|too many requests|over_email_send_rate_limit/i.test(message)) {
        return 'Too many requests. Wait a moment before requesting another code.';
      }
      if (/weak password|password.*short/i.test(message)) {
        return 'Choose a stronger password with at least 6 characters.';
      }
      return message;
    },
  },
});
</script>

<style scoped>
.ax8-auth {
  --ax-bg: #f6f8fb;
  --ax-surface: #ffffff;
  --ax-surface-2: #f9fbfd;
  --ax-border: #e2e8f0;
  --ax-text: #132033;
  --ax-muted: #65748a;
  --ax-muted-2: #8a99ad;
  --ax-field: #fbfcfe;
  --ax-brand-a: #071a36;
  --ax-brand-b: #0a2b50;
  --ax-teal: #14b8a6;
  --ax-teal-dark: #0f8f82;

  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(350px, 0.92fr) minmax(430px, 1.08fr);
  overflow: hidden;
  background: var(--ax-bg);
  color: var(--ax-text);
}

:global(html.dark) .ax8-auth {
  --ax-bg: #07111f;
  --ax-surface: #0d1b2e;
  --ax-surface-2: #0a1728;
  --ax-border: #223750;
  --ax-text: #f3f7fb;
  --ax-muted: #9aa9bc;
  --ax-muted-2: #74859a;
  --ax-field: #091827;
  --ax-brand-a: #061326;
  --ax-brand-b: #0a2746;
}

.ax8-auth,
.ax8-auth * {
  box-sizing: border-box;
}

.ax8-auth button,
.ax8-auth input {
  font: inherit;
}

.ax8-auth button {
  border: 0;
  cursor: pointer;
}

.ax8-auth button:disabled,
.ax8-auth input:disabled {
  cursor: default;
}

.ax8-auth-brand {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: clamp(32px, 5vh, 58px) clamp(34px, 4vw, 66px) 34px;
  color: #eef7ff;
  background:
    linear-gradient(145deg, rgba(20, 184, 166, 0.08), transparent 45%),
    linear-gradient(150deg, var(--ax-brand-a), var(--ax-brand-b));
}

.ax8-auth-brand::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  opacity: 0.18;
  background-image:
    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 42px 42px;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent 86%);
}

.ax8-brand-orb {
  position: absolute;
  z-index: -1;
  border-radius: 999px;
  filter: blur(1px);
  pointer-events: none;
}

.ax8-brand-orb-one {
  width: 300px;
  height: 300px;
  top: -120px;
  right: -110px;
  background: radial-gradient(circle, rgba(20,184,166,0.26), rgba(20,184,166,0));
}

.ax8-brand-orb-two {
  width: 420px;
  height: 420px;
  bottom: -245px;
  left: -190px;
  background: radial-gradient(circle, rgba(57,117,200,0.20), rgba(57,117,200,0));
}

.ax8-brand-top,
.ax8-brand-footer,
.ax8-brand-lockup,
.ax8-mobile-brand {
  display: flex;
  align-items: center;
}

.ax8-brand-top {
  justify-content: space-between;
  gap: 18px;
}

.ax8-brand-lockup,
.ax8-mobile-brand {
  gap: 12px;
  min-width: 0;
}

.ax8-brand-mark {
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 13px;
  background: #ffffff;
  box-shadow: 0 10px 25px rgba(0,0,0,0.14);
}

.ax8-brand-mark img {
  display: block;
  width: 34px;
  height: 34px;
  object-fit: contain;
}

.ax8-brand-name {
  white-space: nowrap;
  font-size: 21px;
  line-height: 1;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: #f7fbff;
}

.ax8-brand-name span {
  color: #31d3c0;
}

.ax8-cloud-chip {
  flex: 0 0 auto;
  padding: 6px 9px;
  border: 1px solid rgba(94,234,212,0.24);
  border-radius: 999px;
  color: #7ef4e3;
  background: rgba(20,184,166,0.08);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
}

.ax8-brand-copy {
  width: min(100%, 520px);
  margin: auto 0;
  padding: 58px 0 44px;
}

.ax8-brand-kicker,
.ax8-section-tag {
  margin: 0;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.ax8-brand-kicker {
  color: #56e1d1;
}

.ax8-brand-copy h1 {
  margin: 13px 0 0;
  max-width: 510px;
  font-size: clamp(30px, 3vw, 46px);
  line-height: 1.08;
  font-weight: 740;
  letter-spacing: -0.035em;
  color: #f8fbff;
  overflow-wrap: anywhere;
}

.ax8-brand-copy > p:not(.ax8-brand-kicker) {
  margin: 17px 0 0;
  max-width: 480px;
  font-size: 14px;
  line-height: 1.7;
  color: #b6c5d9;
  overflow-wrap: anywhere;
}

.ax8-brand-points {
  display: grid;
  gap: 15px;
  margin-top: 34px;
}

.ax8-brand-point {
  display: grid;
  grid-template-columns: 38px minmax(0,1fr);
  align-items: start;
  gap: 12px;
  min-width: 0;
}

.ax8-brand-point > span {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: #66eadb;
  background: rgba(20,184,166,0.11);
  border: 1px solid rgba(94,234,212,0.12);
}

.ax8-brand-point strong,
.ax8-brand-point small {
  display: block;
  overflow-wrap: anywhere;
}

.ax8-brand-point strong {
  color: #eef6ff;
  font-size: 13px;
  font-weight: 680;
}

.ax8-brand-point small {
  margin-top: 3px;
  color: #95a8bf;
  font-size: 11px;
  line-height: 1.45;
}

.ax8-brand-footer {
  gap: 8px;
  color: #8196af;
  font-size: 10px;
}

.ax8-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #32d3bc;
  box-shadow: 0 0 0 4px rgba(50,211,188,0.09);
}

.ax8-auth-stage {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px clamp(30px, 5vw, 82px);
  background:
    radial-gradient(circle at 100% 0%, rgba(20,184,166,0.075), transparent 320px),
    var(--ax-bg);
}

.ax8-mobile-brand {
  display: none;
  align-self: flex-start;
  margin-bottom: 36px;
}

.ax8-mobile-brand .ax8-brand-name {
  color: var(--ax-text);
}

.ax8-auth-box {
  width: min(100%, 430px);
  min-width: 0;
}

.ax8-auth-heading {
  min-width: 0;
}

.ax8-section-tag {
  display: inline-flex;
  color: var(--ax-teal-dark);
}

:global(html.dark) .ax8-section-tag {
  color: #55dfcf;
}

.ax8-auth-heading h2 {
  margin: 10px 0 0;
  color: var(--ax-text);
  font-size: clamp(27px, 3vw, 36px);
  line-height: 1.13;
  font-weight: 740;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.ax8-auth-heading p {
  margin: 12px 0 0;
  color: var(--ax-muted);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.ax8-auth-heading strong {
  color: var(--ax-text);
  font-weight: 650;
}

.ax8-form {
  min-width: 0;
  display: grid;
  gap: 17px;
  margin-top: 29px;
}

.ax8-field {
  min-width: 0;
  display: grid;
  gap: 7px;
}

.ax8-field > span,
.ax8-label-row > span {
  color: var(--ax-text);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 650;
}

.ax8-label-row {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ax8-label-row small {
  color: var(--ax-muted-2);
  font-size: 10px;
}

.ax8-input-wrap {
  position: relative;
  min-width: 0;
}

.ax8-input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  z-index: 1;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--ax-muted-2);
}

.ax8-input-wrap input,
.ax8-otp-input {
  display: block;
  width: 100%;
  min-width: 0;
  height: 48px;
  margin: 0;
  border: 1px solid var(--ax-border);
  border-radius: 11px;
  outline: none;
  background: var(--ax-field);
  color: var(--ax-text);
  font-size: 13px;
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.ax8-input-wrap input {
  padding: 0 44px 0 42px;
}

.ax8-input-wrap input::placeholder,
.ax8-otp-input::placeholder {
  color: var(--ax-muted-2);
  opacity: 0.78;
}

.ax8-input-wrap input:focus,
.ax8-otp-input:focus {
  border-color: #1ab8a8;
  background: var(--ax-surface);
  box-shadow: 0 0 0 3px rgba(20,184,166,0.12);
}

.ax8-password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ax-muted);
  background: transparent;
}

.ax8-password-toggle:hover {
  color: var(--ax-teal-dark);
  background: rgba(20,184,166,0.08);
}

.ax8-primary {
  width: 100%;
  min-width: 0;
  height: 48px;
  margin-top: 3px;
  padding: 0 17px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 11px;
  color: #ffffff;
  background: linear-gradient(135deg, #0e8d82, #14b8a6);
  box-shadow: 0 10px 26px rgba(20,184,166,0.20);
  font-size: 13px;
  font-weight: 700;
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
}

.ax8-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 13px 30px rgba(20,184,166,0.26);
}

.ax8-primary:disabled {
  opacity: 0.55;
}

.ax8-spinner {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  border-radius: 999px;
  border: 2px solid rgba(255,255,255,0.35);
  border-top-color: #ffffff;
  animation: ax8-spin 720ms linear infinite;
}

@keyframes ax8-spin {
  to { transform: rotate(360deg); }
}

.ax8-message {
  min-width: 0;
  display: grid;
  grid-template-columns: 18px minmax(0,1fr);
  align-items: start;
  gap: 8px;
  padding: 10px 11px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.5;
}

.ax8-message span {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.ax8-message-error {
  color: #b42318;
  background: #fff2f0;
  border: 1px solid #ffd8d3;
}

:global(html.dark) .ax8-message-error {
  color: #fecaca;
  background: rgba(127,29,29,0.20);
  border-color: rgba(248,113,113,0.22);
}

.ax8-message-info {
  color: #0f766e;
  background: #ecfdf9;
  border: 1px solid #c8f5ec;
}

:global(html.dark) .ax8-message-info {
  color: #99f6e4;
  background: rgba(13,148,136,0.13);
  border-color: rgba(45,212,191,0.18);
}

.ax8-auth-switch {
  min-width: 0;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--ax-border);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: var(--ax-muted);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.ax8-auth-switch button,
.ax8-back {
  color: var(--ax-teal-dark);
  background: transparent;
  font-weight: 700;
}

:global(html.dark) .ax8-auth-switch button,
:global(html.dark) .ax8-back {
  color: #5eead4;
}

.ax8-auth-switch button:disabled,
.ax8-back:disabled {
  opacity: 0.48;
}

.ax8-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 24px;
  padding: 0;
  font-size: 11px;
}

.ax8-otp-heading {
  text-align: left;
}

.ax8-otp-symbol {
  width: 45px;
  height: 45px;
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 13px;
  color: #0f8f82;
  background: rgba(20,184,166,0.10);
  border: 1px solid rgba(20,184,166,0.14);
}

:global(html.dark) .ax8-otp-symbol {
  color: #62e7d7;
}

.ax8-otp-field {
  margin-top: 2px;
}

.ax8-otp-input {
  height: 62px;
  padding: 0 18px;
  text-align: center;
  font-size: 25px;
  font-weight: 760;
  letter-spacing: 0.36em;
  font-variant-numeric: tabular-nums;
}

.ax8-auth-legal {
  width: min(100%, 430px);
  margin: 22px 0 0;
  color: var(--ax-muted-2);
  font-size: 9px;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}

@media (max-width: 920px) {
  .ax8-auth {
    display: block;
    overflow-y: auto;
  }

  .ax8-auth-brand {
    display: none;
  }

  .ax8-auth-stage {
    min-height: 100%;
    justify-content: center;
    padding: 34px clamp(24px, 8vw, 60px);
  }

  .ax8-mobile-brand {
    display: flex;
  }
}

@media (max-width: 520px) {
  .ax8-auth-stage {
    justify-content: flex-start;
    padding: 26px 20px 32px;
  }

  .ax8-mobile-brand {
    margin-bottom: 42px;
  }

  .ax8-auth-heading h2 {
    font-size: 28px;
  }
}



/* ArthivoX v12.1: login action placement */
.ax121-forgot-below {
  justify-self: end;
  margin-top: -1px;
  padding: 1px 0 0;
  color: var(--ax-teal-dark);
  background: transparent;
  font-size: 9px;
  line-height: 1.35;
  font-weight: 650;
}

.ax121-forgot-below:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

:global(html.dark) .ax121-forgot-below {
  color: #5eead4;
}

.ax121-forgot-below:disabled {
  opacity: 0.48;
}

/* ArthivoX v9: flexible OTP + password recovery */
.ax9-inline-action {
  flex: 0 0 auto;
  padding: 0;
  color: var(--ax-teal-dark);
  background: transparent;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 700;
}

.ax9-inline-action:hover:not(:disabled) {
  text-decoration: underline;
  text-underline-offset: 2px;
}

:global(html.dark) .ax9-inline-action {
  color: #5eead4;
}

.ax9-inline-action:disabled {
  opacity: 0.48;
}

.ax9-field-help {
  display: block;
  margin-top: 1px;
  color: var(--ax-muted-2);
  font-size: 10px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.ax9-otp-flex {
  letter-spacing: 0.18em;
  font-size: 18px;
}

.ax9-success-symbol {
  color: #0f8f82;
  background: rgba(20, 184, 166, 0.12);
}

.ax9-success-button {
  margin-top: 29px;
}

</style>
