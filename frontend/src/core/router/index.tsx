import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { AuthGuard } from './AuthGuard';
import { GuestGuard } from './GuestGuard';
import { AppLayout } from '@/shared/layouts/AppLayout';

// Auth pages — eager (small, always needed first)
import { LoginPage } from '@/modules/auth/LoginPage';
import { RegisterPage } from '@/modules/auth/RegisterPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/modules/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/modules/auth/VerifyEmailPage';

// Lazy-loaded pages (code splitting)
const DashboardPage = lazy(() => import('@/modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ContactListPage = lazy(() => import('@/modules/contacts/ContactListPage').then(m => ({ default: m.ContactListPage })));
const ContactDetailPage = lazy(() => import('@/modules/contacts/ContactDetailPage').then(m => ({ default: m.ContactDetailPage })));
const ImportCSVPage = lazy(() => import('@/modules/contacts/ImportCSVPage').then(m => ({ default: m.ImportCSVPage })));
const TagsPage = lazy(() => import('@/modules/contacts/TagsPage').then(m => ({ default: m.TagsPage })));
const GroupsPage = lazy(() => import('@/modules/contacts/GroupsPage').then(m => ({ default: m.GroupsPage })));
const GroupDetailPage = lazy(() => import('@/modules/contacts/GroupDetailPage').then(m => ({ default: m.GroupDetailPage })));
const TemplateListPage = lazy(() => import('@/modules/templates/TemplateListPage').then(m => ({ default: m.TemplateListPage })));
const CreateTemplatePage = lazy(() => import('@/modules/templates/CreateTemplatePage').then(m => ({ default: m.CreateTemplatePage })));
const TemplateDetailPage = lazy(() => import('@/modules/templates/TemplateDetailPage').then(m => ({ default: m.TemplateDetailPage })));
const FlowListPage = lazy(() => import('@/modules/flows/FlowListPage').then(m => ({ default: m.FlowListPage })));
const FlowBuilderPage = lazy(() => import('@/modules/flows/FlowBuilderPage').then(m => ({ default: m.FlowBuilderPage })));
const FlowDetailPage = lazy(() => import('@/modules/flows/FlowDetailPage').then(m => ({ default: m.FlowDetailPage })));
const CampaignListPage = lazy(() => import('@/modules/campaigns/CampaignListPage').then(m => ({ default: m.CampaignListPage })));
const CreateCampaignPage = lazy(() => import('@/modules/campaigns/CreateCampaignPage').then(m => ({ default: m.CreateCampaignPage })));
const CampaignDetailPage = lazy(() => import('@/modules/campaigns/CampaignDetailPage').then(m => ({ default: m.CampaignDetailPage })));
const ChatPage = lazy(() => import('@/modules/chat/ChatPage').then(m => ({ default: m.ChatPage })));
const AutomationsPage = lazy(() => import('@/modules/automations/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const CreateAutomationPage = lazy(() => import('@/modules/automations/CreateAutomationPage').then(m => ({ default: m.CreateAutomationPage })));
const AutomationDetailPage = lazy(() => import('@/modules/automations/AutomationDetailPage').then(m => ({ default: m.AutomationDetailPage })));
const WebhookManagementPage = lazy(() => import('@/modules/automations/WebhookManagementPage').then(m => ({ default: m.WebhookManagementPage })));
const OrganizationsPage = lazy(() => import('@/modules/organizations/OrganizationsPage').then(m => ({ default: m.OrganizationsPage })));
const OrgDetailPage = lazy(() => import('@/modules/organizations/OrgDetailPage').then(m => ({ default: m.OrgDetailPage })));
const SupportPage = lazy(() => import('@/modules/support/SupportPage').then(m => ({ default: m.SupportPage })));
const TicketDetailPage = lazy(() => import('@/modules/support/TicketDetailPage').then(m => ({ default: m.TicketDetailPage })));
const WalletPage = lazy(() => import('@/modules/wallet/WalletPage').then(m => ({ default: m.WalletPage })));
const SettingsPage = lazy(() => import('@/modules/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const DeveloperPage = lazy(() => import('@/modules/developer/DeveloperPage').then(m => ({ default: m.DeveloperPage })));
const SubscriptionPage = lazy(() => import('@/modules/subscription/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const WhatsAppOnboardingPage = lazy(() => import('@/modules/whatsapp/WhatsAppOnboardingPage').then(m => ({ default: m.WhatsAppOnboardingPage })));

// Admin pages — lazy loaded
const AdminGuard = lazy(() => import('@/modules/admin/layout/AdminGuard').then(m => ({ default: m.AdminGuard })));
const AdminLayout = lazy(() => import('@/modules/admin/layout/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboardPage = lazy(() => import('@/modules/admin/dashboard/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUserListPage = lazy(() => import('@/modules/admin/users/UserListPage').then(m => ({ default: m.UserListPage })));
const CreateUserPage = lazy(() => import('@/modules/admin/users/CreateUserPage').then(m => ({ default: m.CreateUserPage })));
const AdminUserDetailPage = lazy(() => import('@/modules/admin/users/UserDetailPage').then(m => ({ default: m.UserDetailPage })));
const PlanListPage = lazy(() => import('@/modules/admin/plans/PlanListPage').then(m => ({ default: m.PlanListPage })));
const CouponsPage = lazy(() => import('@/modules/admin/plans/CouponsPage').then(m => ({ default: m.CouponsPage })));
const AdminTicketListPage = lazy(() => import('@/modules/admin/support/AdminTicketListPage').then(m => ({ default: m.AdminTicketListPage })));
const AdminTicketDetailPage = lazy(() => import('@/modules/admin/support/AdminTicketDetailPage').then(m => ({ default: m.AdminTicketDetailPage })));
const SubAdminListPage = lazy(() => import('@/modules/admin/sub-admins/SubAdminListPage').then(m => ({ default: m.SubAdminListPage })));
const RoleManagementPage = lazy(() => import('@/modules/admin/sub-admins/RoleManagementPage').then(m => ({ default: m.RoleManagementPage })));
const AdminNotificationsPage = lazy(() => import('@/modules/admin/notifications/AdminNotificationsPage').then(m => ({ default: m.AdminNotificationsPage })));
const EmailManagementPage = lazy(() => import('@/modules/admin/email/EmailManagementPage').then(m => ({ default: m.EmailManagementPage })));
const AdminSettingsPage = lazy(() => import('@/modules/admin/settings/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex h-full min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

function lazyElement(Component: React.LazyExoticComponent<React.ComponentType>) {
  return <LazyPage><Component /></LazyPage>;
}

function RoleRedirect() {
  const { user } = useSelector((state: RootState) => state.auth);
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
}

export const router = createBrowserRouter([
  // Public routes (guest only)
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  // Protected routes (with app layout)
  {
    element: <AuthGuard />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: lazyElement(DashboardPage) },
          { path: '/contacts', element: lazyElement(ContactListPage) },
          { path: '/contacts/import', element: lazyElement(ImportCSVPage) },
          { path: '/contacts/tags', element: lazyElement(TagsPage) },
          { path: '/contacts/groups', element: lazyElement(GroupsPage) },
          { path: '/contacts/groups/:id', element: lazyElement(GroupDetailPage) },
          { path: '/contacts/:id', element: lazyElement(ContactDetailPage) },
          { path: '/templates', element: lazyElement(TemplateListPage) },
          { path: '/templates/create', element: lazyElement(CreateTemplatePage) },
          { path: '/templates/:id/edit', element: lazyElement(CreateTemplatePage) },
          { path: '/templates/:id', element: lazyElement(TemplateDetailPage) },
          { path: '/flows', element: lazyElement(FlowListPage) },
          { path: '/flows/create', element: lazyElement(FlowBuilderPage) },
          { path: '/flows/:id/edit', element: lazyElement(FlowBuilderPage) },
          { path: '/flows/:id', element: lazyElement(FlowDetailPage) },
          { path: '/campaigns', element: lazyElement(CampaignListPage) },
          { path: '/campaigns/create', element: lazyElement(CreateCampaignPage) },
          { path: '/campaigns/:id', element: lazyElement(CampaignDetailPage) },
          { path: '/chat', element: lazyElement(ChatPage) },
          { path: '/automations', element: lazyElement(AutomationsPage) },
          { path: '/automations/create', element: lazyElement(CreateAutomationPage) },
          { path: '/automations/webhooks', element: lazyElement(WebhookManagementPage) },
          { path: '/automations/:id/edit', element: lazyElement(CreateAutomationPage) },
          { path: '/automations/:id', element: lazyElement(AutomationDetailPage) },
          { path: '/organizations', element: lazyElement(OrganizationsPage) },
          { path: '/organizations/:id', element: lazyElement(OrgDetailPage) },
          { path: '/support', element: lazyElement(SupportPage) },
          { path: '/support/:id', element: lazyElement(TicketDetailPage) },
          { path: '/subscription', element: lazyElement(SubscriptionPage) },
          { path: '/wallet', element: lazyElement(WalletPage) },
          { path: '/whatsapp/connect', element: lazyElement(WhatsAppOnboardingPage) },
          { path: '/settings', element: lazyElement(SettingsPage) },
          { path: '/developer', element: lazyElement(DeveloperPage) },
        ],
      },
    ],
  },
  // Admin routes
  {
    element: <LazyPage><AdminGuard /></LazyPage>,
    children: [
      {
        element: <LazyPage><AdminLayout /></LazyPage>,
        children: [
          { path: '/admin', element: <Navigate to="/admin/dashboard" replace /> },
          { path: '/admin/dashboard', element: lazyElement(AdminDashboardPage) },
          { path: '/admin/users', element: lazyElement(AdminUserListPage) },
          { path: '/admin/users/create', element: lazyElement(CreateUserPage) },
          { path: '/admin/users/:id', element: lazyElement(AdminUserDetailPage) },
          { path: '/admin/plans', element: lazyElement(PlanListPage) },
          { path: '/admin/plans/coupons', element: lazyElement(CouponsPage) },
          { path: '/admin/support', element: lazyElement(AdminTicketListPage) },
          { path: '/admin/support/:id', element: lazyElement(AdminTicketDetailPage) },
          { path: '/admin/sub-admins', element: lazyElement(SubAdminListPage) },
          { path: '/admin/sub-admins/roles', element: lazyElement(RoleManagementPage) },
          { path: '/admin/notifications', element: lazyElement(AdminNotificationsPage) },
          { path: '/admin/email', element: lazyElement(EmailManagementPage) },
          { path: '/admin/settings', element: lazyElement(AdminSettingsPage) },
        ],
      },
    ],
  },
  // Redirect root based on user role
  { path: '/', element: <RoleRedirect /> },
  // 404
  { path: '*', element: <div className="flex h-full min-h-[60vh] items-center justify-center"><h1 className="text-2xl font-semibold text-muted-foreground">404 — Page Not Found</h1></div> },
]);
