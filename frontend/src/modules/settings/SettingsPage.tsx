import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Activity, ArrowUpRight, Loader2, Trash2 } from 'lucide-react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/core/api/client';
import { ENDPOINTS } from '@/core/api/endpoints';
import { getApiErrorMessage } from '@/core/errors/apiError';
import { setUser } from '@/core/store/authSlice';
import { setTheme } from '@/core/store/uiSlice';
import type { RootState } from '@/core/store';
import type { User, UserSettings, ApiResponse } from '@/core/types';
import { profileSchema, preferencesSchema, changePasswordSchema } from './validations';
import type { ProfileFormData, PreferencesFormData, ChangePasswordFormData } from './validations';
import {
  useWhatsAppAccounts,
  useDisconnectWhatsAppAccount,
  useRefreshWhatsAppAccountHealth,
} from '@/modules/whatsapp/useWhatsAppAccounts';
import {
  getWhatsAppAccountConnectionLabel,
  getWhatsAppAccountConnectionVariant,
} from '@/modules/whatsapp/accountOptions';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import { PasswordStrengthMeter } from '@/shared/components/PasswordStrengthMeter';
import { useRequiredFieldsFilled } from '@/shared/hooks/useRequiredFieldsFilled';

export function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <Button variant="outline" onClick={() => navigate('/subscription')}>
          Manage Subscription
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">{t('settings.profile')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('settings.preferences')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.notifications')}</TabsTrigger>
          <TabsTrigger value="password">{t('settings.password')}</TabsTrigger>
          <TabsTrigger value="whatsapp">{t('settings.whatsapp')}</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="preferences"><PreferencesTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="password"><PasswordTab /></TabsContent>
        <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' },
    mode: 'onChange',
  });
  const requiredFieldsFilled = useRequiredFieldsFilled(control, ['first_name', 'last_name']);
  const isSubmitDisabled =
    isSubmitting || !requiredFieldsFilled || Object.keys(errors).length > 0;

  useEffect(() => {
    if (user) reset({ first_name: user.first_name, last_name: user.last_name, phone: user.phone ?? '' });
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      const { data: res } = await apiClient.put<ApiResponse<User>>(ENDPOINTS.USERS.PROFILE, {
        first_name: data.first_name, last_name: data.last_name, phone: data.phone || undefined,
      });
      dispatch(setUser(res.data));
      toast.success('Profile updated');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to update your profile.'));
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Profile Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>First Name</Label>
              <Input {...register('first_name')} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label required>Last Name</Label>
              <Input {...register('last_name')} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ''} disabled /></div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <PhoneNumberInput
                  autoComplete="tel"
                  value={field.value || ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.phone)}
                />
              )}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitDisabled}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PreferencesTab() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const qc = useQueryClient();

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UserSettings>>(ENDPOINTS.USERS.SETTINGS);
      return data.data;
    },
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { language: 'en', timezone: 'Asia/Kolkata' },
    mode: 'onChange',
  });
  const requiredFieldsFilled = useRequiredFieldsFilled(control, ['language', 'timezone']);

  useEffect(() => {
    if (settings) reset({ language: settings.language, timezone: settings.timezone });
  }, [settings, reset]);

  const save = useMutation({
    mutationFn: async (data: PreferencesFormData) => {
      await apiClient.put(ENDPOINTS.USERS.SETTINGS, { language: data.language, timezone: data.timezone, theme });
    },
    onSuccess: () => {
      toast.success('Preferences saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const isSubmitDisabled =
    save.isPending || !requiredFieldsFilled || Object.keys(errors).length > 0;

  return (
    <Card className="max-w-3xl">
      <CardHeader><CardTitle className="text-lg">Preferences</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => save.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={(value) => dispatch(setTheme(value as 'light' | 'dark' | 'system'))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label required>Language</Label>
            <Input {...register('language')} placeholder="en" />
            {errors.language && <p className="text-xs text-destructive">{errors.language.message}</p>}
          </div>
          <div className="space-y-2">
            <Label required>Timezone</Label>
            <Input {...register('timezone')} placeholder="Asia/Kolkata" />
            {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitDisabled}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<UserSettings>>(ENDPOINTS.USERS.SETTINGS);
      return data.data;
    },
  });

  const update = useMutation({
    mutationFn: async (field: keyof Pick<UserSettings, 'notification_email' | 'notification_push' | 'notification_in_app'>) => {
      const value = !settings?.[field];
      await apiClient.put(ENDPOINTS.USERS.SETTINGS, { [field]: value });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Updated');
    },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Notification Preferences</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {([
          { key: 'notification_email' as const, label: 'Email Notifications', desc: 'Receive notifications via email' },
          { key: 'notification_push' as const, label: 'Push Notifications', desc: 'Browser push notifications' },
          { key: 'notification_in_app' as const, label: 'In-App Notifications', desc: 'Show notifications in the app' },
        ]).map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <Switch
              checked={settings?.[item.key] ?? true}
              onCheckedChange={() => update.mutate(item.key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
    mode: 'onChange',
  });
  const newPasswordValue = useWatch({ control, name: 'new_password' }) || '';
  const requiredFieldsFilled = useRequiredFieldsFilled(control, [
    'current_password',
    'new_password',
    'confirm_password',
  ]);
  const isSubmitDisabled =
    isSubmitting || !requiredFieldsFilled || Object.keys(errors).length > 0;

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      await apiClient.put(ENDPOINTS.USERS.PASSWORD, { current_password: data.current_password, new_password: data.new_password });
      toast.success('Password changed');
      reset();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to change your password.'));
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Change Password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label required>Current Password</Label>
            <Input type="password" {...register('current_password')} />
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label required>New Password</Label>
            <Input type="password" {...register('new_password')} />
            <PasswordStrengthMeter password={newPasswordValue} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label required>Confirm New Password</Label>
            <Input type="password" {...register('confirm_password')} />
            {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitDisabled}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WhatsAppTab() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useWhatsAppAccounts();
  const disconnect = useDisconnectWhatsAppAccount();
  const refreshHealth = useRefreshWhatsAppAccountHealth();

  const handleDisconnect = async (id: string) => {
    try {
      await disconnect.mutateAsync(id);
      toast.success('WhatsApp number disconnected.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to disconnect the WhatsApp account.'));
    }
  };

  const handleRefreshHealth = async (id: string) => {
    try {
      const result = await refreshHealth.mutateAsync(id);
      const warning = result.health.warnings[0];
      toast.success(warning || 'WhatsApp details refreshed.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to refresh WhatsApp account details.'));
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Connected WhatsApp Accounts</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {accounts && accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected. Use the Embedded Signup to connect.</p>}
        {accounts?.map((account) => (
          <div key={account.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{account.verified_name || account.display_phone || 'Connected phone'}</p>
                  <Badge variant={getWhatsAppAccountConnectionVariant(account)} className="text-[10px]">
                    {getWhatsAppAccountConnectionLabel(account)}
                  </Badge>
                  {account.quality_rating && <Badge variant="outline" className="text-[10px]">{account.quality_rating}</Badge>}
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>Connected number: {account.display_phone || 'Unknown'}</p>
                  <p>Message limits: {account.messaging_limit || 'N/A'}</p>
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
                <Button variant="outline" size="sm" onClick={() => void handleRefreshHealth(account.id)} disabled={refreshHealth.isPending}>
                  <Activity className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
                {account.status === 'active' ? (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleDisconnect(account.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        <Separator />
        <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/whatsapp/connect')}>
          Open Embedded Signup
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground">Connected numbers can be reused across templates, chat, campaigns, flows, automations, and team workflows.</p>
      </CardContent>
    </Card>
  );
}
