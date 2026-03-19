import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { apiClient, refreshSession } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { useAuth } from '@/core/hooks/useAuth';
import { forceChangePasswordSchema, type ForceChangePasswordFormData } from './validations';
import { useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';

export function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ForceChangePasswordFormData>({
    resolver: zodResolver(forceChangePasswordSchema),
    mode: 'onChange',
  });
  const newPasswordValue = useWatch({ control, name: 'new_password' }) || '';
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'new_password',
    'confirm_password',
  ]);
  const isSubmitDisabled =
    submitting || !requiredFieldsFilled || Object.keys(errors).length > 0;

  const onSubmit = async (values: ForceChangePasswordFormData) => {
    setSubmitting(true);
    try {
      await apiClient.post(ENDPOINTS.USERS.FORCE_CHANGE_PASSWORD, {
        new_password: values.new_password,
      });
      await refreshSession();
      toast.success('Password updated. You can now access your organization.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to update your password right now.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Change Your Temporary Password</CardTitle>
          <CardDescription>
            Your account was created by an organization owner. Set a new password before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="new_password" required>New Password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                placeholder="Use uppercase, lowercase, number, and symbol"
                {...register('new_password')}
              />
              <PasswordStrengthMeter password={newPasswordValue} />
              {errors.new_password ? (
                <p className="text-sm text-destructive">{errors.new_password.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm_password" required>Confirm Password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter your password"
                {...register('confirm_password')}
              />
              {errors.confirm_password ? (
                <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
              ) : null}
            </div>
            <Button className="w-full" disabled={isSubmitDisabled} type="submit">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update Password
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
