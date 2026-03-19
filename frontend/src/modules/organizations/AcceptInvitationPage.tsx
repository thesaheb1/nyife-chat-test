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
import type { ApiResponse, Organization } from '@/core/types';
import { getApiErrorMessage } from '@/core/errors/apiError';
import {
  getStoredOrganizationRegistry,
  setStoredActiveOrganization,
  syncStoredOrganizationRegistry,
} from './context';

interface AcceptInvitationResponse {
  invitation: {
    email: string;
  };
  organization: Organization;
  member_user_id: string;
}

export function AcceptInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const user = useSelector((state: RootState) => state.auth.user);
  const isAuthenticated = Boolean(user);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isInlineRegistration = !isAuthenticated;
  const canSubmit = useMemo(() => {
    if (!token) {
      return false;
    }

    if (!isInlineRegistration) {
      return true;
    }

    return isStrongPassword(password);
  }, [isInlineRegistration, password, token]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (isInlineRegistration && !isStrongPassword(password)) {
        toast.error(PASSWORD_POLICY_MESSAGE);
      }
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post<ApiResponse<AcceptInvitationResponse>>(
        ENDPOINTS.ORGANIZATIONS.ACCEPT_INVITATION,
        {
          token,
          ...(isInlineRegistration ? { password } : {}),
        }
      );

      const payload = data.data;
      if (user?.id) {
        const existingOrganizations = getStoredOrganizationRegistry(user.id);
        const nextOrganizations = existingOrganizations.some((organization) => organization.id === payload.organization.id)
          ? existingOrganizations.map((organization) =>
              organization.id === payload.organization.id ? payload.organization : organization
            )
          : [...existingOrganizations, payload.organization];

        syncStoredOrganizationRegistry(user.id, nextOrganizations as Organization[]);
        setStoredActiveOrganization(user.id, payload.organization);
      }

      if (isAuthenticated) {
        toast.success(`You now have access to ${payload.organization.name}.`);
        navigate(`/org/${payload.organization.slug}/dashboard`, { replace: true });
        return;
      }

      toast.success('Your team account is ready. Sign in to start working.');
      navigate(`/login?email=${encodeURIComponent(payload.invitation.email)}`, { replace: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to accept the invitation.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join Organization</CardTitle>
          <CardDescription>
            {isAuthenticated
              ? 'Accept this team invitation with your current Nyife account.'
              : 'Create your team account to accept this organization invitation.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-destructive">
              This invitation link is missing its token. Ask the organization owner to send a fresh invitation.
            </p>
          ) : null}

          {isInlineRegistration ? (
            <>
              <p className="text-sm text-muted-foreground">
                Set a password to finish creating your team account for this organization invitation.
              </p>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
