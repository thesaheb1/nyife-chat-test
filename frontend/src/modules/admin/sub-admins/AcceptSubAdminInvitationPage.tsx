import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { RootState } from '@/core/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { PASSWORD_POLICY_MESSAGE, isStrongPassword } from '@/shared/utils/password';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import type { ApiResponse } from '@/core/types';
import { getApiErrorMessage } from '@/core/errors/apiError';

type InvitationValidationResult = {
  invitation: {
    email: string;
    first_name: string;
    last_name: string;
    role_title: string;
    expires_at: string;
  };
};

export function AcceptSubAdminInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = Boolean(user);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validationQuery = useQuery<InvitationValidationResult>({
    queryKey: ['admin', 'invitation', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<InvitationValidationResult>>(
        `${ENDPOINTS.ADMIN.INVITATION_VALIDATE}?token=${encodeURIComponent(token)}`
      );
      return data.data;
    },
  });

  const isInlineRegistration = !isAuthenticated;
  const canSubmit = useMemo(() => {
    if (!token || validationQuery.isLoading || validationQuery.isError) {
      return false;
    }

    if (!isInlineRegistration) {
      return true;
    }

    return isStrongPassword(password);
  }, [isInlineRegistration, password, token, validationQuery.isError, validationQuery.isLoading]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (isInlineRegistration && !isStrongPassword(password)) {
        toast.error(PASSWORD_POLICY_MESSAGE);
      }
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<ApiResponse<{ invitation: { email: string } }>>(
        ENDPOINTS.ADMIN.INVITATION_ACCEPT,
        {
          token,
          ...(isInlineRegistration ? { password } : {}),
        }
      );

      toast.success('Your admin account is ready. Sign in to continue.');
      navigate(`/login?email=${encodeURIComponent(data.data.invitation.email)}`, { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to accept the invitation.'));
    } finally {
      setSubmitting(false);
    }
  };

  const invitation = validationQuery.data?.invitation;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Admin Console</CardTitle>
          <CardDescription>
            {isInlineRegistration
              ? 'Create your sub-admin account to accept this invitation.'
              : 'Accept this invitation with your current admin account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-destructive">
              This invitation link is missing its token. Ask the super admin to send a fresh invitation.
            </p>
          ) : null}

          {validationQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : validationQuery.isError ? (
            <p className="text-sm text-destructive">
              {getApiErrorMessage(validationQuery.error, 'This invitation is invalid or has expired.')}
            </p>
          ) : invitation ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {invitation.first_name} {invitation.last_name}
              </p>
              <p className="text-muted-foreground">{invitation.email}</p>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                Role: {invitation.role_title}
              </p>
            </div>
          ) : null}

          {isInlineRegistration ? (
            <>
              <p className="text-sm text-muted-foreground">
                Set a password to finish creating your sub-admin account.
              </p>
              <div className="space-y-2">
                <Label htmlFor="password" required>Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Use uppercase, lowercase, number, and symbol"
                />
                <PasswordStrengthMeter password={password} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You are signed in as <span className="font-medium">{user?.email}</span>. If the invitation belongs to a different email address, sign out first and open the link again.
            </p>
          )}

          <Button className="w-full" disabled={!canSubmit || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Accept Invitation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
