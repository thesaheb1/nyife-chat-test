import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AuthLayout } from '@/shared/layouts/AuthLayout';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse, User } from '@/core/types';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import { registerSchema } from './validations';
import type { RegisterFormData } from './validations';

type RegistrationSuccessState = {
  userId: string;
  email: string;
  firstName: string;
};

export function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<RegistrationSuccessState | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false as unknown as true },
  });

  const termsValue = useWatch({ control, name: 'terms' });
  const passwordValue = useWatch({ control, name: 'password' }) || '';

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post<ApiResponse<{ user: User }>>(ENDPOINTS.AUTH.REGISTER, {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        password: data.password,
        phone: data.phone || undefined,
      });
      const user = response.data.data.user;
      setPendingVerification({
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
      });
      toast.success('Registration successful. Verification email sent.');
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registration failed';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerification) {
      return;
    }

    setIsResending(true);
    try {
      await apiClient.post(ENDPOINTS.AUTH.RESEND_VERIFICATION, {
        user_id: pendingVerification.userId,
      });
      toast.success(`Verification email sent again to ${pendingVerification.email}.`);
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to resend verification email.';
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>{pendingVerification ? 'Verify Your Email' : 'Create Account'}</CardTitle>
          <CardDescription>
            {pendingVerification
              ? `We sent a verification email to ${pendingVerification.email}.`
              : 'Fill in your details to get started'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingVerification ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your account has been created, but you need to verify your email before logging in.
                If the message does not arrive, you can send it again from here.
              </p>
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Email address</p>
                <p className="text-muted-foreground">{pendingVerification.email}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button className="flex-1" onClick={handleResendVerification} disabled={isResending}>
                  {isResending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send Email Again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    reset();
                    setPendingVerification(null);
                  }}
                >
                  Use Different Email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input id="first_name" placeholder="John" {...register('first_name')} />
                  {errors.first_name && (
                    <p className="text-sm text-destructive">{errors.first_name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input id="last_name" placeholder="Doe" {...register('last_name')} />
                  {errors.last_name && (
                    <p className="text-sm text-destructive">{errors.last_name.message}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneNumberInput
                      id="phone"
                      autoComplete="tel"
                      placeholder="Enter phone number"
                      value={field.value || ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={Boolean(errors.phone)}
                    />
                  )}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Use uppercase, lowercase, number, and symbol"
                  autoComplete="new-password"
                  {...register('password')}
                />
                <PasswordStrengthMeter password={passwordValue} />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  {...register('confirm_password')}
                />
                {errors.confirm_password && (
                  <p className="text-sm text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsValue}
                  onCheckedChange={(checked) => setValue('terms', checked === true ? true : false as unknown as true)}
                />
                <Label htmlFor="terms" className="text-sm font-normal">
                  I agree to the Terms of Service and Privacy Policy
                </Label>
              </div>
              {errors.terms && <p className="text-sm text-destructive">{errors.terms.message}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
