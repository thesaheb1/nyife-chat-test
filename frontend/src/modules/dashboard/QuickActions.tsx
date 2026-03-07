import { useNavigate } from 'react-router-dom';
import { Users, FileText, Megaphone, MessageSquare, PlugZap, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    { label: 'New Campaign', icon: Megaphone, path: '/campaigns/create' },
    { label: 'Add Contact', icon: Users, path: '/contacts?action=create' },
    { label: 'New Template', icon: FileText, path: '/templates/create' },
    { label: 'View Chat', icon: MessageSquare, path: '/chat' },
    { label: 'Connect WhatsApp', icon: PlugZap, path: '/whatsapp/connect' },
    { label: 'Webhooks', icon: Webhook, path: '/automations/webhooks' },
  ];

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
