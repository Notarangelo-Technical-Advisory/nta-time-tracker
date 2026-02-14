import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { createUserWithEmailAndPassword, Auth } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { InviteService } from '../../services/invite.service';
import { Invite } from '../../models/invite.model';
import { UserProfile } from '../../models/user.model';
import { USER_PROFILES } from '../../services/firestore-collections.const';

@Component({
  selector: 'app-invite-signup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <img src="assets/nta-logo.jpg" alt="NTA logo" class="auth-logo">
        <h1>Notarangelo Technical Advisory</h1>
        <p class="subtitle">Time & Invoicing</p>

        <div class="loading-state" *ngIf="loading">
          <div class="loading-spinner"></div>
          <p>Validating invite...</p>
        </div>

        <div *ngIf="!loading && !invite" class="error-state">
          <h2>Invalid Invite</h2>
          <p>This invitation link is invalid, expired, or has already been used.</p>
          <a href="/auth" class="btn-primary">Go to Sign In</a>
        </div>

        <div *ngIf="!loading && invite">
          <div class="invite-info">
            <p>You've been invited to join as a customer of <strong>{{ invite.customerName }}</strong>.</p>
          </div>

          <form (ngSubmit)="onSubmit()" class="auth-form">
            <div class="form-group">
              <label class="form-label" for="email">Email</label>
              <input class="form-control disabled-input" id="email" type="email"
                     [value]="invite.email" disabled>
            </div>

            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <input class="form-control" id="password" type="password"
                     [(ngModel)]="password" name="password" required minlength="6">
            </div>

            <div class="form-group">
              <label class="form-label" for="confirmPassword">Confirm Password</label>
              <input class="form-control" id="confirmPassword" type="password"
                     [(ngModel)]="confirmPassword" name="confirmPassword" required>
            </div>

            <div class="error-message" *ngIf="error">
              <p>{{ error }}</p>
            </div>

            <button type="submit" class="btn-primary w-100" [disabled]="submitting">
              <span class="spinner-border-sm" *ngIf="submitting"></span>
              Create Account
            </button>
          </form>

          <div class="auth-links">
            <p>Already have an account? <a href="/auth">Sign in</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
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

    .invite-info {
      background: $color-primary-light;
      border-radius: $border-radius-base;
      padding: $spacing-base;
      margin-bottom: $spacing-xl;
      text-align: center;

      p {
        margin: 0;
        color: $color-primary;
        font-size: $font-size-sm;
      }
    }

    .auth-form {
      .form-group { @include form-group; }
      .form-label { @include form-label; }
      .form-control { @include form-control; }
    }

    .disabled-input {
      background: $color-gray-100 !important;
      color: $color-text-muted !important;
      cursor: not-allowed;
    }

    .btn-primary { @include button-primary; text-decoration: none; }
    .w-100 { width: 100%; }

    .error-state {
      text-align: center;

      h2 {
        color: $color-danger;
        font-size: $font-size-xl;
        margin-bottom: $spacing-base;
      }

      p {
        color: $color-text-secondary;
        margin-bottom: $spacing-xl;
      }
    }

    .auth-links {
      text-align: center;
      margin-top: $spacing-base;

      p {
        color: $color-text-muted;
        font-size: $font-size-sm;
        margin: 0;
      }

      a {
        color: $color-primary;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }

    .error-message { @include message-error; margin-bottom: $spacing-base; }
    .spinner-border-sm { @include spinner-sm; margin-right: $spacing-sm; }

    .loading-state {
      text-align: center;
      padding: $spacing-xl;

      .loading-spinner { @include spinner-base; margin: 0 auto $spacing-base; }
      p { color: $color-text-muted; }
    }
  `]
})
export class InviteSignupComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private inviteService = inject(InviteService);

  invite: Invite | null = null;
  loading = true;
  submitting = false;
  password = '';
  confirmPassword = '';
  error = '';

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading = false;
      return;
    }

    this.invite = await this.inviteService.getInviteByToken(token);
    this.loading = false;
  }

  async onSubmit(): Promise<void> {
    if (!this.invite) return;

    this.error = '';

    if (this.password.length < 6) {
      this.error = 'Password must be at least 6 characters.';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }

    this.submitting = true;

    try {
      const credential = await createUserWithEmailAndPassword(
        this.auth, this.invite.email, this.password
      );

      const profile: UserProfile = {
        uid: credential.user.uid,
        email: this.invite.email,
        role: 'customer',
        isAdmin: false,
        customerId: this.invite.customerId,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      await setDoc(doc(this.firestore, USER_PROFILES, credential.user.uid), profile);
      await this.inviteService.acceptInvite(this.invite.id);

      this.router.navigate(['/portal']);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        this.error = 'This email already has an account. Please sign in instead.';
      } else {
        this.error = err.message || 'An error occurred creating your account.';
      }
    } finally {
      this.submitting = false;
    }
  }
}
