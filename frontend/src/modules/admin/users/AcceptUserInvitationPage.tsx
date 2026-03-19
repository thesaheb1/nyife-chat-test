import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { PASSWORD_POLICY_MESSAGE, isStrongPassword } from '@/shared/utils/password';
import { apiClient } from '@/core/api/client';
import { ADMIN_ENDPOINTS } from '../api';
import type { ApiResponse } from '@/core/types';
import { getApiErrorMessage } from '@/core/errors/apiError';

type UserInvitationValidationResult = {
  invitation: {
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    expires_at: string;
    status: string;
  };
};

export function AcceptUserInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validationQuery = useQuery<UserInvitationValidationResult>({
    queryKey: ['admin', 'user-invitation', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UserInvitationValidationResult>>(
        `${ADMIN_ENDPOINTS.USERS.INVITATIONS.VALIDATE}?token=${encodeURIComponent(token)}`
      );

      return data.data;
    },
  });

  const handleSubmit = async () => {
    if (!token) {
      return;
    }

    if (!isStrongPassword(password)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<ApiResponse<{ invitation: { email: string } }>>(
        ADMIN_ENDPOINTS.USERS.INVITATIONS.ACCEPT,
        {
          token,
          password,
        }
      );

      toast.success('Your account is ready. Sign in to continue.');
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
          <CardTitle>Join Nyife</CardTitle>
          <CardDescription>Set your password to activate your invited user account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-destructive">
              This invitation link is missing its token. Ask the admin to send a fresh invitation.
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
              {invitation.phone ? <p className="text-muted-foreground">{invitation.phone}</p> : null}
            </div>
          ) : null}

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

          <Button
            className="w-full"
            disabled={!token || validationQuery.isLoading || validationQuery.isError || !isStrongPassword(password) || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Accept Invitation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
