'use client';

import { useState } from 'react';
import { Shield, Key, Smartphone, History, AlertTriangle, Lock, AlertCircle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { usePostHog } from '@/hooks/use-posthog';

export default function SecurityPage() {
  const { capture } = usePostHog();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const sessions = [
    { device: 'Chrome on MacOS', location: 'New York, US', lastActive: 'Now', current: true },
    { device: 'Safari on iPhone', location: 'New York, US', lastActive: '2 hours ago', current: false },
    { device: 'Firefox on Windows', location: 'Chicago, US', lastActive: '3 days ago', current: false },
  ];

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      setIsChangingPassword(false);
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      setIsChangingPassword(false);
      return;
    }

    const supabase = createClient();

    try {
      // First verify current password by attempting to sign in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        setPasswordError('Unable to verify your identity. Please try again.');
        setIsChangingPassword(false);
        return;
      }

      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        capture('password_change_failed', {
          error: 'Invalid current password',
        });
        setPasswordError('Current password is incorrect');
        setIsChangingPassword(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        capture('password_change_failed', {
          error: updateError.message,
        });
        setPasswordError(updateError.message);
        setIsChangingPassword(false);
        return;
      }

      capture('password_changed');
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);

      // Close modal after 2 seconds
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError('An unexpected error occurred. Please try again.');
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Security Settings</h1>
        <p className="text-foreground-muted">Manage your account security and authentication</p>
      </div>

      {/* Password Section */}
      <div className="rounded-xl border border-border bg-background-elevated/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-pink-500/20 text-accent">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Password</h2>
            <p className="text-sm text-foreground-muted">Update your account password</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowChangePassword(true)}
        >
          Change Password
        </Button>
      </div>

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background-secondary rounded-2xl border border-border max-w-md w-full">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Change Password</h2>
              <button
                onClick={() => {
                  setShowChangePassword(false);
                  setPasswordError(null);
                  setPasswordSuccess(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-foreground-muted hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-4 rounded-lg bg-error/10 border border-error/20 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-error flex-shrink-0" />
                  <p className="text-sm text-error">{passwordError}</p>
                </div>
              )}
              {passwordSuccess && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                  <p className="text-sm text-emerald-500">Password changed successfully!</p>
                </div>
              )}
              <Input
                label="Current Password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
                disabled={isChangingPassword}
              />
              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
                minLength={8}
                disabled={isChangingPassword}
              />
              <Input
                label="Confirm New Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                required
                minLength={8}
                disabled={isChangingPassword}
              />
              <p className="text-xs text-foreground-muted">
                Password must be at least 8 characters long
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordError(null);
                    setPasswordSuccess(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={isChangingPassword}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  isLoading={isChangingPassword}
                  disabled={passwordSuccess}
                >
                  Change Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Two-Factor Auth */}
      <div className="rounded-xl border border-border bg-background-elevated/50 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-pink-500/20 text-accent">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Two-Factor Authentication</h2>
              <p className="text-sm text-foreground-muted">Add an extra layer of security to your account</p>
            </div>
          </div>
          <button
            onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              twoFactorEnabled ? 'bg-accent' : 'bg-background-elevated border border-border'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
              twoFactorEnabled ? 'translate-x-6' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
        {twoFactorEnabled && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm text-emerald-500">
              ✓ Two-factor authentication is enabled. Your account is more secure.
            </p>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="rounded-xl border border-border bg-background-elevated/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-pink-500/20 text-accent">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Active Sessions</h2>
            <p className="text-sm text-foreground-muted">Devices currently logged into your account</p>
          </div>
        </div>
        <div className="space-y-4">
          {sessions.map((session, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  {session.device}
                  {session.current && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-xs">
                      Current
                    </span>
                  )}
                </p>
                <p className="text-sm text-foreground-muted">{session.location} • {session.lastActive}</p>
              </div>
              {!session.current && (
                <button className="text-sm text-error hover:text-error/80 transition-colors">
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-error/30 bg-error/5 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-error/20 text-error">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Danger Zone</h2>
            <p className="text-sm text-foreground-muted">Irreversible and destructive actions</p>
          </div>
        </div>
        <Button variant="danger" size="sm">
          Delete Account
        </Button>
      </div>
    </div>
  );
}
