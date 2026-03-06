import { useEffect } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Loader2, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
import { setUser } from '@/core/store/authSlice';
import { setTheme } from '@/core/store/uiSlice';
import type { RootState } from '@/core/store';
import type { User, UserSettings, ApiResponse } from '@/core/types';
import { profileSchema, preferencesSchema, changePasswordSchema } from './validations';
import type { ProfileFormData, PreferencesFormData, ChangePasswordFormData } from './validations';

interface WaAccount { id: string; display_phone: string; verified_name: string; status: string; quality_rating: string | null }

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
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

// --- Profile Tab ---
function ProfileTab() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { first_name: user?.first_name ?? '', last_name: user?.last_name ?? '', phone: user?.phone ?? '' },
  });

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
    } catch { toast.error('Failed to update profile'); }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Profile Information</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register('first_name')} />
              {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register('last_name')} />
              {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
            </div>
          </div>
          <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ''} disabled /></div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register('phone')} placeholder="+91..." />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Changes</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Preferences Tab ---
function PreferencesTab() {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const qc = useQueryClient();

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await apiClient.get<ApiResponse<UserSettings>>(ENDPOINTS.USERS.SETTINGS); return data.data; },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: { language: 'en', timezone: 'Asia/Kolkata' },
  });

  useEffect(() => {
    if (settings) reset({ language: settings.language, timezone: settings.timezone });
  }, [settings, reset]);

  const save = useMutation({
    mutationFn: async (data: PreferencesFormData) => { await apiClient.put(ENDPOINTS.USERS.SETTINGS, { language: data.language, timezone: data.timezone, theme }); },
    onSuccess: () => { toast.success('Preferences saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Preferences</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((data) => save.mutate(data))} className="space-y-4">
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select value={theme} onValueChange={(v) => dispatch(setTheme(v as 'light' | 'dark' | 'system'))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Language</Label>
            <Input {...register('language')} placeholder="en" />
            {errors.language && <p className="text-xs text-destructive">{errors.language.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Input {...register('timezone')} placeholder="Asia/Kolkata" />
            {errors.timezone && <p className="text-xs text-destructive">{errors.timezone.message}</p>}
          </div>
          <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// --- Notifications Tab ---
function NotificationsTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => { const { data } = await apiClient.get<ApiResponse<UserSettings>>(ENDPOINTS.USERS.SETTINGS); return data.data; },
  });

  const update = useMutation({
    mutationFn: async (field: keyof Pick<UserSettings, 'notification_email' | 'notification_push' | 'notification_in_app'>) => {
      const val = !settings?.[field];
      await apiClient.put(ENDPOINTS.USERS.SETTINGS, { [field]: val });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Updated'); },
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
            <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
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

// --- Password Tab ---
function PasswordTab() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    try {
      await apiClient.put(ENDPOINTS.USERS.PASSWORD, { current_password: data.current_password, new_password: data.new_password });
      toast.success('Password changed');
      reset();
    } catch (err) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed');
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Change Password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input type="password" {...register('current_password')} />
            {errors.current_password && <p className="text-xs text-destructive">{errors.current_password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" {...register('new_password')} />
            {errors.new_password && <p className="text-xs text-destructive">{errors.new_password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" {...register('confirm_password')} />
            {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Change Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

// --- WhatsApp Tab ---
function WhatsAppTab() {
  const { data: accounts, isLoading } = useQuery<WaAccount[]>({
    queryKey: ['wa-accounts'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<{ accounts: WaAccount[] }>>(ENDPOINTS.WHATSAPP.ACCOUNTS);
      return data.data.accounts;
    },
  });
  const qc = useQueryClient();

  const disconnect = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`${ENDPOINTS.WHATSAPP.ACCOUNTS}/${id}`); },
    onSuccess: () => { toast.success('Account disconnected'); qc.invalidateQueries({ queryKey: ['wa-accounts'] }); },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle className="text-lg">Connected WhatsApp Accounts</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {accounts && accounts.length === 0 && <p className="text-sm text-muted-foreground">No accounts connected. Use the Embedded Signup to connect.</p>}
        {accounts?.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded border p-3">
            <div>
              <p className="text-sm font-medium">{a.verified_name || a.display_phone}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">{a.display_phone}</span>
                <Badge variant="secondary" className="text-[10px] capitalize">{a.status}</Badge>
                {a.quality_rating && <Badge variant="outline" className="text-[10px]">{a.quality_rating}</Badge>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => disconnect.mutate(a.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Separator />
        <p className="text-xs text-muted-foreground">To connect a new account, use Meta's Embedded Signup flow from the dashboard.</p>
      </CardContent>
    </Card>
  );
}
