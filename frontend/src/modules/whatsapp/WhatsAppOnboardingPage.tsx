import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  EmbeddedSignupCompleteResult,
  EmbeddedSignupPreviewAccount,
  EmbeddedSignupPreviewResult,
  WaAccount,
} from '@/core/types';
import {
  getActiveWhatsAppAccounts,
  getWhatsAppAccountConnectionLabel,
  getWhatsAppAccountConnectionVariant,
} from './accountOptions';
import {
  useDisconnectWhatsAppAccount,
  useEmbeddedSignupComplete,
  useEmbeddedSignupPreview,
  useRefreshWhatsAppAccountHealth,
  useWhatsAppAccounts,
} from './useWhatsAppAccounts';
import { loadFacebookSdk, type FacebookSDK } from './loadFacebookSdk';

type FacebookWindow = Window & {
  FB?: FacebookSDK;
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

function getRemainingSlotsLabel(remainingSlots: number | null) {
  return remainingSlots === null ? 'Unlimited by plan' : `${remainingSlots} slot(s) left`;
}

function getMessagingLimitLabel(account: Pick<WaAccount, 'messaging_limit'>) {
  return account.messaging_limit || 'N/A';
}

function getAccountRefreshMessage(account: WaAccount) {
  if (account.last_onboarding_error) {
    return account.last_onboarding_error;
  }

  if (account.app_subscription_status === 'not_subscribed') {
    return 'Connected, but inbound sync should be checked.';
  }

  return 'Connection details refreshed.';
}

function getMetaEmbeddedSignupOriginError() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.location.protocol === 'https:') {
    return null;
  }

  return `Meta embedded signup requires HTTPS. Restart the frontend and open https://${window.location.host}${window.location.pathname}.`;
}

function preselectPhoneNumbers(preview: EmbeddedSignupPreviewResult) {
  const eligibleAccounts = preview.accounts.filter(
    (account) => account.eligible && !account.already_connected
  );

  if (preview.remaining_slots === null) {
    return eligibleAccounts.map((account) => account.phone_number_id);
  }

  return eligibleAccounts
    .slice(0, Math.max(0, preview.remaining_slots))
    .map((account) => account.phone_number_id);
}

export function WhatsAppOnboardingPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useWhatsAppAccounts();
  const previewSignup = useEmbeddedSignupPreview();
  const completeSignup = useEmbeddedSignupComplete();
  const disconnectMutation = useDisconnectWhatsAppAccount();
  const refreshHealthMutation = useRefreshWhatsAppAccountHealth();
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmbeddedSignupPreviewResult | null>(null);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);
  const [completionResult, setCompletionResult] = useState<EmbeddedSignupCompleteResult | null>(null);

  const configReady = Boolean(META_APP_ID && META_EMBEDDED_SIGNUP_CONFIG_ID);
  const originError = getMetaEmbeddedSignupOriginError();
  const configError = configReady
    ? null
    : 'Set VITE_META_APP_ID and VITE_META_EMBEDDED_SIGNUP_CONFIG_ID to use embedded signup.';

  useEffect(() => {
    if (!configReady || originError) {
      setSdkReady(false);
      return;
    }

    let active = true;
    setSdkError(null);
    setSdkReady(false);

    void loadFacebookSdk(META_APP_ID)
      .then(() => {
        if (active) {
          setSdkReady(true);
        }
      })
      .catch((error) => {
        if (active) {
          setSdkError(error instanceof Error ? error.message : 'Failed to load the Facebook SDK.');
        }
      });

    return () => {
      active = false;
    };
  }, [configReady, originError]);

  const allAccounts = useMemo(() => accounts ?? [], [accounts]);
  const activeAccounts = useMemo(() => getActiveWhatsAppAccounts(accounts), [accounts]);
  const effectiveSdkError = configError || originError || sdkError;
  const accountSummary = useMemo(() => {
    const wabas = new Set(activeAccounts.map((account) => account.waba_id));
    return {
      activeAccounts: activeAccounts.length,
      totalAccounts: allAccounts.length,
      wabas: wabas.size,
    };
  }, [activeAccounts, allAccounts]);

  const maxSelectable = preview?.remaining_slots ?? Number.POSITIVE_INFINITY;
  const selectedCount = selectedPhoneIds.length;
  const hasEligiblePreviewAccounts = Boolean(
    preview?.accounts.some((account) => account.eligible && !account.already_connected)
  );

  const closePreviewDialog = () => {
    setPreview(null);
    setSelectedPhoneIds([]);
    setCompletionResult(null);
  };

  const openPreviewDialog = (result: EmbeddedSignupPreviewResult) => {
    setPreview(result);
    setSelectedPhoneIds(preselectPhoneNumbers(result));
    setCompletionResult(null);
  };

  const handleEmbeddedSignupResponse = (response: { authResponse?: { code?: string }; status?: string }) => {
    const code = response.authResponse?.code;

    if (!code) {
      toast.error('Meta did not return an authorization code.');
      return;
    }

    void (async () => {
      try {
        const result = await previewSignup.mutateAsync(code);
        openPreviewDialog(result);
      } catch (error) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to start embedded signup.';
        toast.error(message);
      }
    })();
  };

  const handleConnect = () => {
    const fbWindow = window as FacebookWindow;

    if (!configReady) {
      toast.error('Embedded signup is not configured yet.');
      return;
    }

    if (originError) {
      toast.error(originError);
      return;
    }

    if (!fbWindow.FB) {
      toast.error('Facebook SDK is still loading.');
      return;
    }

    try {
      fbWindow.FB.login(handleEmbeddedSignupResponse, {
        config_id: META_EMBEDDED_SIGNUP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          featureType: 'whatsapp_embedded_signup',
          sessionInfoVersion: '3',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open Meta embedded signup.';
      toast.error(message);
    }
  };

  const togglePhoneSelection = (account: EmbeddedSignupPreviewAccount, checked: boolean) => {
    const phoneNumberId = account.phone_number_id;
    const isSelected = selectedPhoneIds.includes(phoneNumberId);
    const remainingSlots = preview?.remaining_slots ?? null;
    const limitReached =
      remainingSlots !== null
      && selectedPhoneIds.length >= remainingSlots
      && !isSelected;

    if (!checked) {
      setSelectedPhoneIds((current) =>
        current.filter((value) => value !== phoneNumberId)
      );
      return;
    }

    if (limitReached) {
      toast.error(`Your current plan allows selecting up to ${remainingSlots ?? 0} new number(s) in this session.`);
      return;
    }

    setSelectedPhoneIds((current) => [...new Set([...current, phoneNumberId])]);
  };

  const handleCompleteSignup = async () => {
    if (!preview) {
      return;
    }

    if (!selectedPhoneIds.length) {
      toast.error('Select at least one phone number to connect.');
      return;
    }

    try {
      const result = await completeSignup.mutateAsync({
        signup_session_id: preview.signup_session_id,
        phone_number_ids: selectedPhoneIds,
      });

      const skippedText = result.skipped.length
        ? ` ${result.skipped.length} already connected number(s) were skipped.`
        : '';

      toast.success(`Connected ${result.connected_count} WhatsApp number(s).${skippedText}`);
      setCompletionResult(result);
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to complete embedded signup.';
      toast.error(message);
    }
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

  const handleRefreshHealth = async (id: string) => {
    try {
      const result = await refreshHealthMutation.mutateAsync(id);
      toast.success(getAccountRefreshMessage(result.account));
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to refresh account details.';
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
            Launch Meta embedded signup, choose which discovered phone numbers to activate, and let Nyife complete the registration flow automatically for the authenticated tenant.
          </p>
        </div>
        <Button
          onClick={handleConnect}
          disabled={!sdkReady || previewSignup.isPending || completeSignup.isPending}
        >
          {previewSignup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active numbers</p>
                <p className="mt-2 text-2xl font-semibold">{accountSummary.activeAccounts}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Stored accounts</p>
                <p className="mt-2 text-2xl font-semibold">{accountSummary.totalAccounts}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Connected WABAs</p>
                <p className="mt-2 text-2xl font-semibold">{accountSummary.wabas}</p>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="font-medium">What this flow configures</p>
                  <p className="text-muted-foreground">
                    Connect with Meta, choose the phone numbers you want in Nyife, and start using those connected accounts across templates, chat, campaigns, flows, and automations.
                  </p>
                </div>
              </div>
            </div>

            {effectiveSdkError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {effectiveSdkError}
              </div>
            ) : null}

            {!effectiveSdkError && !sdkReady ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Loading the Facebook SDK so Meta can open the onboarding popup.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <p className="font-medium">Templates use WABA</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create and sync templates with the connected WABA you select. You do not need to manage raw Meta tokens or setup details here.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <p className="font-medium">Chat and campaigns use numbers</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Chat, sends, and campaigns stay tied to the connected number you pick, so each workflow uses the right business phone automatically.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Stored Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : null}

            {!isLoading && allAccounts.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No WhatsApp numbers are connected yet.
              </div>
            ) : null}

            {allAccounts.map((account) => (
              <div key={account.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{getAccountLabel(account)}</p>
                      <Badge variant={getWhatsAppAccountConnectionVariant(account)}>
                        {getWhatsAppAccountConnectionLabel(account)}
                      </Badge>
                      {account.quality_rating ? (
                        <Badge variant="outline">{account.quality_rating}</Badge>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>Connected number: {account.display_phone || 'Unknown'}</p>
                      <p>WABA ID: {account.waba_id}</p>
                      <p>Message limits: {getMessagingLimitLabel(account)}</p>
                      <p>Number status: {account.number_status || account.status}</p>
                      {account.code_verification_status ? (
                        <p>Phone verification: {account.code_verification_status}</p>
                      ) : null}
                      {account.account_review_status ? (
                        <p>Account review: {account.account_review_status}</p>
                      ) : null}
                      {account.last_onboarding_error ? (
                        <p className="text-destructive sm:col-span-2">Last update: {account.last_onboarding_error}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleRefreshHealth(account.id)}
                      disabled={refreshHealthMutation.isPending}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    {account.status === 'active' ? (
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
                    ) : null}
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/settings')}>
              Open WhatsApp settings
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) closePreviewDialog(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review discovered WhatsApp numbers</DialogTitle>
            <DialogDescription>
              Select the phone numbers you want to connect in Nyife. {preview ? getRemainingSlotsLabel(preview.remaining_slots) : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {preview ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Discovered</p>
                  <p className="mt-1 text-xl font-semibold">{preview.accounts.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
                  <p className="mt-1 text-xl font-semibold">
                    {selectedCount}
                    {Number.isFinite(maxSelectable) ? ` / ${maxSelectable}` : ''}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan capacity</p>
                  <p className="mt-1 text-sm font-medium">{getRemainingSlotsLabel(preview.remaining_slots)}</p>
                </div>
              </div>
            ) : null}

            {preview?.wabas.length ? (
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Shared WABAs</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {preview.wabas.map((waba) => (
                    <Badge key={waba.waba_id} variant="outline">
                      {waba.name || waba.waba_id} · {waba.phone_count}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {!hasEligiblePreviewAccounts ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Meta returned phone numbers, but none of them can be newly connected right now. They may already be active in this tenant or your plan has no remaining slots.
              </div>
            ) : null}

            <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
              {preview?.accounts.map((account) => {
                const isSelected = selectedPhoneIds.includes(account.phone_number_id);
                const limitReached =
                  preview.remaining_slots !== null
                  && selectedPhoneIds.length >= preview.remaining_slots
                  && !isSelected;
                const disabled =
                  account.already_connected
                  || !account.eligible
                  || limitReached
                  || (preview.remaining_slots === 0);

                return (
                  <label
                    key={`${account.waba_id}:${account.phone_number_id}`}
                    className="flex items-start gap-3 rounded-lg border p-4"
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={disabled}
                      onCheckedChange={(checked) =>
                        togglePhoneSelection(account, checked === true)
                      }
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {account.verified_name || account.display_phone || account.waba_id}
                        </p>
                        <Badge variant="outline">{account.waba_id}</Badge>
                        {account.already_connected ? (
                          <Badge variant="secondary">Already connected</Badge>
                        ) : null}
                        {account.quality_rating ? (
                          <Badge variant="outline">{account.quality_rating}</Badge>
                        ) : null}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Display phone: {account.display_phone || 'Unknown'}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Nyife will handle the Meta registration step for each selected phone number during connect.
            </div>

            {completionResult ? (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="font-medium">Latest onboarding result</p>
                {completionResult.warnings.length ? (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-900">
                    {completionResult.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                ) : null}
                {completionResult.results.map((result) => (
                  <div key={`${result.waba_id}:${result.phone_number_id}`} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{result.account?.verified_name || result.account?.display_phone || result.phone_number_id}</p>
                      <Badge variant="secondary" className="capitalize">{result.status.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline">{result.waba_id}</Badge>
                    </div>
                    {result.error ? (
                      <p className="mt-2 text-xs text-destructive">{result.error}</p>
                    ) : null}
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>Connected number: {result.account?.display_phone || 'Unknown'}</p>
                      <p>WABA ID: {result.waba_id}</p>
                      {result.account?.quality_rating ? (
                        <p>Quality rating: {result.account.quality_rating}</p>
                      ) : null}
                      {result.warnings[0] ? (
                        <p>{result.warnings[0]}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePreviewDialog}>
              {completionResult ? 'Done' : 'Cancel'}
            </Button>
            {!completionResult ? (
              <Button
                onClick={handleCompleteSignup}
                disabled={!preview || completeSignup.isPending || !selectedPhoneIds.length}
              >
                {completeSignup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Connect selected numbers
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
