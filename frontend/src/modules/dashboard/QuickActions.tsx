import { useNavigate } from 'react-router-dom';
import { Users, FileText, Megaphone, MessageSquare, PlugZap, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermissions } from '@/core/hooks/usePermissions';

export function QuickActions() {
  const navigate = useNavigate();
  const { canOrganization } = usePermissions();

  const actions = [
    { label: 'New Campaign', icon: Megaphone, path: '/campaigns/create', resource: 'campaigns', action: 'create' as const },
    { label: 'Add Contact', icon: Users, path: '/contacts?action=create', resource: 'contacts', action: 'create' as const },
    { label: 'New Template', icon: FileText, path: '/templates/create', resource: 'templates', action: 'create' as const },
    { label: 'View Chat', icon: MessageSquare, path: '/chat', resource: 'chat', action: 'read' as const },
    { label: 'Connect WhatsApp', icon: PlugZap, path: '/whatsapp/connect', resource: 'whatsapp', action: 'create' as const },
    { label: 'Webhooks', icon: Webhook, path: '/automations/webhooks', resource: 'automations', action: 'read' as const },
  ].filter((action) => canOrganization(action.resource, action.action));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
              onClick={() => navigate(action.path)}
            >
              <action.icon className="h-4 w-4" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
