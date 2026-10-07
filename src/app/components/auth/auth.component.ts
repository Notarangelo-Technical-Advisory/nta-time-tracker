import { Component, inject, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-auth',
    imports: [FormsModule],
    template: `
    <div class="auth-container">
      <div class="auth-card">
        <img src="assets/nta-logo.jpg" alt="NTA logo" class="auth-logo">
        <h1>Notarangelo Technical Advisory</h1>
        <p class="subtitle">Time & Invoicing</p>
    
        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label class="form-label" for="email">Email</label>
            <input class="form-control" id="email" type="email" [(ngModel)]="email" name="email" required>
          </div>
    
          @if (mode !== 'reset') {
            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <input class="form-control" id="password" type="password" [(ngModel)]="password" name="password" required>
            </div>
          }
    
          @if (error) {
            <div class="error-message">
              <p>{{ error }}</p>
            </div>
          }
    
          @if (successMessage) {
            <div class="success-message">
              <p>{{ successMessage }}</p>
            </div>
          }
    
          <button type="submit" class="btn-primary w-100" [disabled]="loading">
            @if (loading) {
              <span class="spinner-border-sm"></span>
            }
            {{ mode === 'login' ? 'Sign In' : 'Reset Password' }}
          </button>
        </form>
    
        <div class="auth-links">
          @if (mode !== 'reset') {
            <button class="link-btn" (click)="mode = 'reset'">Forgot password?</button>
          }
          @if (mode === 'reset') {
            <button class="link-btn" (click)="mode = 'login'">Back to sign in</button>
          }
        </div>
      </div>
    </div>
    `,
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: [`
    @import '../../../styles/tokens';
    @import '../../../styles/mixins';

    .auth-container {
      @include flex-center;
      min-height: 100vh;
      background: linear-gradient(135deg, $color-primary 0%, $color-primary-dark 100%);
    }

    .auth-card {
      background: $color-white;
      border-radius: $card-border-radius;
      padding: $spacing-3xl;
      width: 100%;
      max-width: 420px;
      box-shadow: $shadow-xl;

      .auth-logo {
        display: block;
        width: 96px;
        height: 96px;
        object-fit: contain;
        border-radius: 14px;
        margin: 0 auto $spacing-base;
      }

      h1 {
        text-align: center;
        color: $color-primary;
        margin-bottom: $spacing-xs;
        font-size: $font-size-lg;
        font-weight: $font-weight-semibold;
        letter-spacing: 0.03em;
      }

      .subtitle {
        text-align: center;
        color: $color-text-muted;
        font-size: $font-size-sm;
        letter-spacing: 0.05em;
        margin-bottom: $spacing-xl;
      }
    }

    .auth-form {
      .form-group { @include form-group; }
      .form-label { @include form-label; }
      .form-control { @include form-control; }
    }

    .btn-primary { @include button-primary; }
    .w-100 { width: 100%; }

    .auth-links {
      text-align: center;
      margin-top: $spacing-base;
    }

    .link-btn {
      background: none;
      border: none;
      color: $color-primary;
      cursor: pointer;
      font-size: $font-size-sm;

      &:hover { text-decoration: underline; }
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }
    .success-message { @include message-success; margin-bottom: $spacing-base; }
    .spinner-border-sm { @include spinner-sm; margin-right: $spacing-sm; }
  `]
})
export class AuthComponent {
  private authService = inject(AuthService);

  // There is no self sign-up: customers join through an invite link, and
  // admins are made by another admin on the Users page.
  mode: 'login' | 'reset' = 'login';
  email = '';
  password = '';
  error = '';
  successMessage = '';
  loading = false;

  async onSubmit(): Promise<void> {
    this.error = '';
    this.successMessage = '';
    this.loading = true;

    try {
      if (this.mode === 'login') {
        await this.authService.signIn(this.email, this.password);
      } else {
        await this.authService.resetPassword(this.email);
        this.successMessage = 'Password reset email sent. Check your inbox.';
      }
    } catch (err: any) {
      this.error = err.message || 'An error occurred';
    } finally {
      this.loading = false;
    }
  }
}
