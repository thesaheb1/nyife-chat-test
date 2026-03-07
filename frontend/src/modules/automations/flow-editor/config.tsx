import type { LucideIcon } from 'lucide-react';
import {
  BotMessageSquare,
  Clock3,
  GitBranch,
  Images,
  LayoutTemplate,
  MessageCircleMore,
  Play,
  Tag,
  Webhook,
  Workflow,
} from 'lucide-react';
import type { FlowStepType } from '../builder';

export interface FlowNodePaletteItem {
  type: FlowStepType;
  label: string;
  description: string;
  category: 'Contents' | 'Logic' | 'CRM' | 'Integrations';
  icon: LucideIcon;
  accent: string;
  badge: string;
  surface: string;
}

export const FLOW_ENTRY_META = {
  label: 'Flow Start',
  description: 'Every WhatsApp journey begins here.',
  icon: Play,
  accent: 'from-emerald-700 via-emerald-600 to-emerald-500 text-white',
  badge: 'border-white/15 bg-white/15 text-white',
};

export const FLOW_NODE_META: Record<FlowStepType, FlowNodePaletteItem> = {
  send_message: {
    type: 'send_message',
    label: 'Message',
    description: 'Text, image, video, or document reply.',
    category: 'Contents',
    icon: BotMessageSquare,
    accent: 'text-emerald-700',
    badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    surface: 'from-emerald-500/12 via-emerald-500/4 to-transparent',
  },
  send_interactive: {
    type: 'send_interactive',
    label: 'Media + Buttons',
    description: 'Send a WhatsApp interactive card and branch on replies.',
    category: 'Contents',
    icon: Images,
    accent: 'text-cyan-700',
    badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700',
    surface: 'from-cyan-500/14 via-cyan-500/4 to-transparent',
  },
  send_template: {
    type: 'send_template',
    label: 'Template',
    description: 'Use an approved WhatsApp template.',
    category: 'Contents',
    icon: LayoutTemplate,
    accent: 'text-sky-700',
    badge: 'border-sky-500/20 bg-sky-500/10 text-sky-700',
    surface: 'from-sky-500/14 via-sky-500/4 to-transparent',
  },
  send_flow: {
    type: 'send_flow',
    label: 'WhatsApp Flow',
    description: 'Launch a WhatsApp Flow form and continue after it sends.',
    category: 'Contents',
    icon: Workflow,
    accent: 'text-teal-700',
    badge: 'border-teal-500/20 bg-teal-500/10 text-teal-700',
    surface: 'from-teal-500/14 via-teal-500/4 to-transparent',
  },
  wait_for_reply: {
    type: 'wait_for_reply',
    label: 'Wait',
    description: 'Pause until the contact sends the next message.',
    category: 'Logic',
    icon: MessageCircleMore,
    accent: 'text-amber-700',
    badge: 'border-amber-500/20 bg-amber-500/10 text-amber-700',
    surface: 'from-amber-500/14 via-amber-500/4 to-transparent',
  },
  condition: {
    type: 'condition',
    label: 'Condition',
    description: 'Route the journey based on the inbound reply.',
    category: 'Logic',
    icon: GitBranch,
    accent: 'text-violet-700',
    badge: 'border-violet-500/20 bg-violet-500/10 text-violet-700',
    surface: 'from-violet-500/14 via-violet-500/4 to-transparent',
  },
  add_tag: {
    type: 'add_tag',
    label: 'Add Tag',
    description: 'Update the tenant-scoped contact profile.',
    category: 'CRM',
    icon: Tag,
    accent: 'text-pink-700',
    badge: 'border-pink-500/20 bg-pink-500/10 text-pink-700',
    surface: 'from-pink-500/14 via-pink-500/4 to-transparent',
  },
  call_webhook: {
    type: 'call_webhook',
    label: 'Webhook',
    description: 'Call your app, CRM, or middleware.',
    category: 'Integrations',
    icon: Webhook,
    accent: 'text-indigo-700',
    badge: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-700',
    surface: 'from-indigo-500/14 via-indigo-500/4 to-transparent',
  },
  delay: {
    type: 'delay',
    label: 'Delay',
    description: 'Wait for a short, synchronous hold before continuing.',
    category: 'Logic',
    icon: Clock3,
    accent: 'text-orange-700',
    badge: 'border-orange-500/20 bg-orange-500/10 text-orange-700',
    surface: 'from-orange-500/14 via-orange-500/4 to-transparent',
  },
};

export const FLOW_NODE_GROUPS = [
  {
    title: 'Contents',
    description: 'Customer-facing WhatsApp blocks for replies, media, and templates.',
    items: ['send_message', 'send_interactive', 'send_template', 'send_flow'] as FlowStepType[],
  },
  {
    title: 'Logic',
    description: 'Branching and timing controls for the journey.',
    items: ['wait_for_reply', 'condition', 'delay'] as FlowStepType[],
  },
  {
    title: 'CRM',
    description: 'Tenant-safe profile updates while the flow runs.',
    items: ['add_tag'] as FlowStepType[],
  },
  {
    title: 'Integrations',
    description: 'Post signed data to backend systems or agent tools.',
    items: ['call_webhook'] as FlowStepType[],
  },
];
