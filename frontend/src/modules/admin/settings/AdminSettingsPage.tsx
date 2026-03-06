import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminSettings, useUpdateAdminSettings } from './useAdminSettings';
import type { AdminSetting } from '../types';
import { toast } from 'sonner';

const SETTING_GROUPS = [
  { key: 'general', label: 'General' },
  { key: 'seo', label: 'SEO' },
  { key: 'payment', label: 'Payment' },
  { key: 'smtp', label: 'SMTP' },
  { key: 'sso', label: 'SSO' },
  { key: 'billing', label: 'Billing' },
  { key: 'tax', label: 'Tax' },
] as const;

const BOOLEAN_KEYS = [
  'google_oauth_enabled', 'facebook_oauth_enabled', 'razorpay_enabled',
  'smtp_secure', 'tax_enabled', 'auto_renew_default',
];

export function AdminSettingsPage() {
  const { t } = useTranslation();
  const { data: allSettings = [], isLoading } = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (allSettings.length) {
      const map: Record<string, string> = {};
      allSettings.forEach((s) => { map[s.key] = s.value; });
      setValues(map);
    }
  }, [allSettings]);

  const groupedSettings = SETTING_GROUPS.map((g) => ({
    ...g,
    settings: allSettings.filter((s) => s.group === g.key),
  }));

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const currentGroup = groupedSettings.find((g) => g.key === activeTab);
    if (!currentGroup) return;

    const settingsToSave = currentGroup.settings.map((s) => ({
      key: s.key,
      value: values[s.key] ?? s.value,
    }));

    try {
      await updateSettings.mutateAsync({ settings: settingsToSave });
      toast.success(t('admin.settings.saved'));
    } catch {
      toast.error('Failed to save settings');
    }
  };

  const renderField = (setting: AdminSetting) => {
    const isBool = BOOLEAN_KEYS.includes(setting.key);
    const label = setting.key
      .replace(/^(app_|smtp_|razorpay_|google_|facebook_|tax_|seo_)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    if (isBool) {
      return (
        <div key={setting.key} className="flex items-center justify-between py-2">
          <Label>{label}</Label>
          <Switch
            checked={values[setting.key] === 'true'}
            onCheckedChange={(v) => handleChange(setting.key, String(v))}
          />
        </div>
      );
    }

    const isLong = (values[setting.key] ?? '').length > 100 ||
      setting.key.includes('description') || setting.key.includes('content');

    return (
      <div key={setting.key} className="space-y-2">
        <Label>{label}</Label>
        {isLong ? (
          <Textarea
            value={values[setting.key] ?? ''}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            rows={3}
          />
        ) : (
          <Input
            type={setting.key.includes('password') || setting.key.includes('secret') ? 'password' : 'text'}
            value={values[setting.key] ?? ''}
            onChange={(e) => handleChange(setting.key, e.target.value)}
          />
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('admin.settings.title')}</h1>
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateSettings.isPending ? 'Saving...' : t('common.saveChanges')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          {SETTING_GROUPS.map((g) => (
            <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>
          ))}
        </TabsList>

        {groupedSettings.map((group) => (
          <TabsContent key={group.key} value={group.key} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{group.label} Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!group.settings.length ? (
                  <p className="text-muted-foreground text-sm">
                    No settings configured for this group yet.
                  </p>
                ) : (
                  group.settings.map(renderField)
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
