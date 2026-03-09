import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquare,
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
  EmbeddedSignupPreviewAccount,
  EmbeddedSignupPreviewResult,
} from '@/core/types';
import { buildActiveWhatsAppAccountOptions, getActiveWhatsAppAccounts } from './accountOptions';
import {
  useDisconnectWhatsAppAccount,
  useEmbeddedSignupComplete,
  useEmbeddedSignupPreview,
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
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [preview, setPreview] = useState<EmbeddedSignupPreviewResult | null>(null);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState<string[]>([]);

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
  const activeAccountOptions = useMemo(
    () => buildActiveWhatsAppAccountOptions(accounts),
    [accounts]
  );
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
  };

  const openPreviewDialog = (result: EmbeddedSignupPreviewResult) => {
    setPreview(result);
    setSelectedPhoneIds(preselectPhoneNumbers(result));
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
      closePreviewDialog();
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
                    Nyife exchanges the Meta code server-side, stores the signup session in Redis for 10 minutes, lets you choose which phone numbers to activate, registers each selection automatically, subscribes the WABA to webhooks, and enforces your plan’s WhatsApp-number limit.
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
                  <p className="font-medium">Account-driven template routing</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Template create, publish, and sync flows now resolve the WABA from the active account you pick instead of asking for a raw WABA ID.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <p className="font-medium">Campaign and chat account pinning</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Campaigns and conversations stay bound to one connected account, while inactive accounts remain visible for history but cannot be used for new sends.
                </p>
              </div>
            </div>

            {activeAccountOptions.length > 0 ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Active account labels are reused across template, campaign, and chat selectors so the same connected number is shown consistently everywhere.
              </div>
            ) : null}
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
                      <Badge variant="secondary" className="capitalize">
                        {account.status}
                      </Badge>
                      {account.quality_rating ? (
                        <Badge variant="outline">{account.quality_rating}</Badge>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>Display phone: {account.display_phone || 'Unknown'}</p>
                      <p>WABA ID: {account.waba_id}</p>
                      <p>Phone number ID: {account.phone_number_id}</p>
                    </div>
                  </div>
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
              Select the phone numbers to activate for this tenant. Nyife will complete registration automatically after you confirm. {preview ? getRemainingSlotsLabel(preview.remaining_slots) : ''}
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
                          {account.verified_name || account.display_phone || account.phone_number_id}
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
                        <p>Phone number ID: {account.phone_number_id}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              Nyife will handle the Meta registration step for each selected phone number during connect.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closePreviewDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleCompleteSignup}
              disabled={!preview || completeSignup.isPending || !selectedPhoneIds.length}
            >
              {completeSignup.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect selected numbers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
