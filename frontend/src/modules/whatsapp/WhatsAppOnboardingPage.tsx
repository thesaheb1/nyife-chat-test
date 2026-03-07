import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Loader2, MessageSquare, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDisconnectWhatsAppAccount, useEmbeddedSignup, useWhatsAppAccounts } from './useWhatsAppAccounts';

type FacebookAuthResponse = {
  authResponse?: {
    code?: string;
  };
  status?: string;
};

type FacebookSDK = {
  init: (config: Record<string, unknown>) => void;
  login: (
    callback: (response: FacebookAuthResponse) => void,
    options?: Record<string, unknown>
  ) => void;
};

type FacebookWindow = Window & {
  FB?: FacebookSDK;
  fbAsyncInit?: () => void;
};

const META_APP_ID = import.meta.env.VITE_META_APP_ID;
const META_EMBEDDED_SIGNUP_CONFIG_ID = import.meta.env.VITE_META_EMBEDDED_SIGNUP_CONFIG_ID;

function getAccountLabel(account: {
  verified_name: string | null;
  display_phone: string | null;
  waba_id: string;
}) {
  return account.verified_name || account.display_phone || account.waba_id;
}

export function WhatsAppOnboardingPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useWhatsAppAccounts();
  const signupMutation = useEmbeddedSignup();
  const disconnectMutation = useDisconnectWhatsAppAccount();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const configReady = Boolean(META_APP_ID && META_EMBEDDED_SIGNUP_CONFIG_ID);
  const configError = configReady
    ? null
    : 'Set VITE_META_APP_ID and VITE_META_EMBEDDED_SIGNUP_CONFIG_ID to use embedded signup.';

  useEffect(() => {
    if (!configReady) {
      return;
    }

    const fbWindow = window as FacebookWindow;

    if (fbWindow.FB) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSdkReady(true);
      return;
    }

    fbWindow.fbAsyncInit = () => {
      if (!fbWindow.FB) {
        setSdkError('Facebook SDK loaded without the expected global object.');
        return;
      }

      fbWindow.FB.init({
        appId: META_APP_ID,
        autoLogAppEvents: true,
        xfbml: false,
        version: 'v20.0',
      });

      setSdkReady(true);
    };

    const existingScript = document.getElementById('facebook-jssdk');
    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.async = true;
    script.defer = true;
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.onerror = () => {
      setSdkError('Failed to load the Facebook SDK. Check network access and Meta app configuration.');
    };
    document.body.appendChild(script);

    return () => {
      delete fbWindow.fbAsyncInit;
    };
  }, [configReady]);

  const activeAccounts = useMemo(
    () => accounts?.filter((account) => account.status === 'active') ?? [],
    [accounts]
  );
  const effectiveSdkError = configError || sdkError;
  const accountSummary = useMemo(() => {
    const wabas = new Set(activeAccounts.map((account) => account.waba_id));
    return {
      accounts: activeAccounts.length,
      wabas: wabas.size,
    };
  }, [activeAccounts]);

  const handleConnect = () => {
    const fbWindow = window as FacebookWindow;

    if (!configReady) {
      toast.error('Embedded signup is not configured yet.');
      return;
    }

    if (!fbWindow.FB) {
      toast.error('Facebook SDK is still loading.');
      return;
    }

    fbWindow.FB.login(
      async (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          toast.error('Meta did not return an authorization code.');
          return;
        }

        try {
          await signupMutation.mutateAsync(code);
          toast.success('WhatsApp account connected successfully.');
        } catch (error) {
          const message =
            (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to complete embedded signup.';
          toast.error(message);
        }
      },
      {
        config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_embedded_signup',
          sessionInfoVersion: '3',
        },
      }
    );
  };

  const handleDisconnect = async (id: string) => {
    try {
      await disconnectMutation.mutateAsync(id);
      toast.success('WhatsApp number disconnected.');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to disconnect account.';
      toast.error(message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Connect WhatsApp Business</h1>
          <p className="text-sm text-muted-foreground">
            Launch Meta embedded signup, connect numbers to your tenant, and sync the WABAs you can publish templates against.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={!sdkReady || signupMutation.isPending}>
          {signupMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Connect with Meta
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Embedded Signup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Connected numbers</p>
                <p className="mt-2 text-2xl font-semibold">{accountSummary.accounts}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Connected WABAs</p>
                <p className="mt-2 text-2xl font-semibold">{accountSummary.wabas}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tenant scope</p>
                <p className="mt-2 text-sm font-medium">Per authenticated workspace</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">What this flow configures</p>
                  <p className="text-muted-foreground">
                    Nyife exchanges the Meta code server-side, subscribes the selected WABA to webhooks, stores encrypted access tokens, and enforces your tenant-level WhatsApp number quota.
                  </p>
                </div>
              </div>
            </div>

            {effectiveSdkError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {effectiveSdkError}
              </div>
            )}

            {!effectiveSdkError && !sdkReady && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Loading the Facebook SDK so Meta can open the onboarding popup.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="font-medium">Publish templates against connected WABAs</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Template publish and sync now resolve access tokens from the active account you connect here.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="font-medium">Drive campaigns, chat, and automations</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Inbound webhooks, status updates, automation matching, and chat sync all map to the tenant account selected during signup.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}

            {!isLoading && activeAccounts.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active WhatsApp numbers are connected yet.
              </div>
            )}

            {activeAccounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{getAccountLabel(account)}</p>
                      <Badge variant="secondary" className="capitalize">
                        {account.status}
                      </Badge>
                      {account.quality_rating && <Badge variant="outline">{account.quality_rating}</Badge>}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Display phone: {account.display_phone || 'Unknown'}</p>
                      <p>WABA ID: {account.waba_id}</p>
                      <p>Phone number ID: {account.phone_number_id}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={disconnectMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/settings')}>
              Open WhatsApp settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
