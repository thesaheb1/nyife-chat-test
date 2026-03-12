import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/core/store';
import { AuthGuard } from './AuthGuard';
import { GuestGuard } from './GuestGuard';
import { AppLayout } from '@/shared/layouts/AppLayout';
import { OrganizationPathRedirect } from '@/modules/organizations/OrganizationPathRedirect';
import { OrganizationScopeGuard } from '@/modules/organizations/OrganizationScopeGuard';
import { PermissionGuard } from './PermissionGuard';

// Auth pages — eager (small, always needed first)
import { LoginPage } from '@/modules/auth/LoginPage';
import { RegisterPage } from '@/modules/auth/RegisterPage';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/modules/auth/ResetPasswordPage';
import { VerifyEmailPage } from '@/modules/auth/VerifyEmailPage';
import { ForceChangePasswordPage } from '@/modules/auth/ForceChangePasswordPage';

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
const TeamMembersPage = lazy(() => import('@/modules/team/TeamMembersPage').then(m => ({ default: m.TeamMembersPage })));
const AutomationsPage = lazy(() => import('@/modules/automations/AutomationsPage').then(m => ({ default: m.AutomationsPage })));
const CreateAutomationPage = lazy(() => import('@/modules/automations/CreateAutomationPage').then(m => ({ default: m.CreateAutomationPage })));
const AutomationDetailPage = lazy(() => import('@/modules/automations/AutomationDetailPage').then(m => ({ default: m.AutomationDetailPage })));
const WebhookManagementPage = lazy(() => import('@/modules/automations/WebhookManagementPage').then(m => ({ default: m.WebhookManagementPage })));
const OrganizationsPage = lazy(() => import('@/modules/organizations/OrganizationsPage').then(m => ({ default: m.OrganizationsPage })));
const OrgDetailPage = lazy(() => import('@/modules/organizations/OrgDetailPage').then(m => ({ default: m.OrgDetailPage })));
const AcceptInvitationPage = lazy(() => import('@/modules/organizations/AcceptInvitationPage').then(m => ({ default: m.AcceptInvitationPage })));
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
const AcceptSubAdminInvitationPage = lazy(() => import('@/modules/admin/sub-admins/AcceptSubAdminInvitationPage').then(m => ({ default: m.AcceptSubAdminInvitationPage })));
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

function guardedLazyElement(
  scope: 'organization' | 'admin',
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete',
  Component: React.LazyExoticComponent<React.ComponentType>
) {
  return (
    <PermissionGuard scope={scope} resource={resource} action={action}>
      {lazyElement(Component)}
    </PermissionGuard>
  );
}

function RoleRedirect() {
  const { user } = useSelector((state: RootState) => state.auth);
  if (user?.must_change_password) {
    return <Navigate to="/force-change-password" replace />;
  }
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  return <Navigate to={isAdmin ? '/admin/dashboard' : '/dashboard'} replace />;
}

const organizationScopedRoutes = [
  { path: 'dashboard', element: guardedLazyElement('organization', 'dashboard', 'read', DashboardPage) },
  { path: 'contacts', element: guardedLazyElement('organization', 'contacts', 'read', ContactListPage) },
  { path: 'contacts/import', element: guardedLazyElement('organization', 'contacts', 'create', ImportCSVPage) },
  { path: 'contacts/tags', element: guardedLazyElement('organization', 'contacts', 'read', TagsPage) },
  { path: 'contacts/groups', element: guardedLazyElement('organization', 'contacts', 'read', GroupsPage) },
  { path: 'contacts/groups/:id', element: guardedLazyElement('organization', 'contacts', 'read', GroupDetailPage) },
  { path: 'contacts/:id', element: guardedLazyElement('organization', 'contacts', 'read', ContactDetailPage) },
  { path: 'templates', element: guardedLazyElement('organization', 'templates', 'read', TemplateListPage) },
  { path: 'templates/create', element: guardedLazyElement('organization', 'templates', 'create', CreateTemplatePage) },
  { path: 'templates/:id/edit', element: guardedLazyElement('organization', 'templates', 'update', CreateTemplatePage) },
  { path: 'templates/:id', element: guardedLazyElement('organization', 'templates', 'read', TemplateDetailPage) },
  { path: 'flows', element: guardedLazyElement('organization', 'flows', 'read', FlowListPage) },
  { path: 'flows/create', element: guardedLazyElement('organization', 'flows', 'create', FlowBuilderPage) },
  { path: 'flows/:id/edit', element: guardedLazyElement('organization', 'flows', 'update', FlowBuilderPage) },
  { path: 'flows/:id', element: guardedLazyElement('organization', 'flows', 'read', FlowDetailPage) },
  { path: 'campaigns', element: guardedLazyElement('organization', 'campaigns', 'read', CampaignListPage) },
  { path: 'campaigns/create', element: guardedLazyElement('organization', 'campaigns', 'create', CreateCampaignPage) },
  { path: 'campaigns/:id', element: guardedLazyElement('organization', 'campaigns', 'read', CampaignDetailPage) },
  { path: 'chat', element: guardedLazyElement('organization', 'chat', 'read', ChatPage) },
  { path: 'team', element: guardedLazyElement('organization', 'team_members', 'read', TeamMembersPage) },
  { path: 'automations', element: guardedLazyElement('organization', 'automations', 'read', AutomationsPage) },
  { path: 'automations/create', element: guardedLazyElement('organization', 'automations', 'create', CreateAutomationPage) },
  { path: 'automations/webhooks', element: guardedLazyElement('organization', 'automations', 'read', WebhookManagementPage) },
  { path: 'automations/:id/edit', element: guardedLazyElement('organization', 'automations', 'update', CreateAutomationPage) },
  { path: 'automations/:id', element: guardedLazyElement('organization', 'automations', 'read', AutomationDetailPage) },
  { path: 'support', element: guardedLazyElement('organization', 'support', 'read', SupportPage) },
  { path: 'support/:id', element: guardedLazyElement('organization', 'support', 'read', TicketDetailPage) },
  { path: 'subscription', element: guardedLazyElement('organization', 'subscription', 'read', SubscriptionPage) },
  { path: 'wallet', element: guardedLazyElement('organization', 'wallet', 'read', WalletPage) },
  { path: 'whatsapp/connect', element: guardedLazyElement('organization', 'whatsapp', 'create', WhatsAppOnboardingPage) },
  { path: 'settings', element: guardedLazyElement('organization', 'settings', 'read', SettingsPage) },
  { path: 'developer', element: guardedLazyElement('organization', 'developer', 'read', DeveloperPage) },
];

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
  {
    path: '/organizations/invitations/accept',
    element: lazyElement(AcceptInvitationPage),
  },
  {
    path: '/admin/invitations/accept',
    element: lazyElement(AcceptSubAdminInvitationPage),
  },
  // Protected routes (with app layout)
  {
    element: <AuthGuard />,
    children: [
      { path: '/force-change-password', element: <ForceChangePasswordPage /> },
      {
        element: <AppLayout />,
        children: [
          {
            path: '/org/:slug',
            element: <OrganizationScopeGuard />,
            children: organizationScopedRoutes,
          },
          { path: '/dashboard', element: <OrganizationPathRedirect targetPath="/dashboard" /> },
          { path: '/contacts', element: <OrganizationPathRedirect targetPath="/contacts" /> },
          { path: '/contacts/import', element: <OrganizationPathRedirect targetPath="/contacts/import" /> },
          { path: '/contacts/tags', element: <OrganizationPathRedirect targetPath="/contacts/tags" /> },
          { path: '/contacts/groups', element: <OrganizationPathRedirect targetPath="/contacts/groups" /> },
          { path: '/contacts/groups/:id', element: <OrganizationPathRedirect /> },
          { path: '/contacts/:id', element: <OrganizationPathRedirect /> },
          { path: '/templates', element: <OrganizationPathRedirect targetPath="/templates" /> },
          { path: '/templates/create', element: <OrganizationPathRedirect targetPath="/templates/create" /> },
          { path: '/templates/:id/edit', element: <OrganizationPathRedirect /> },
          { path: '/templates/:id', element: <OrganizationPathRedirect /> },
          { path: '/flows', element: <OrganizationPathRedirect targetPath="/flows" /> },
          { path: '/flows/create', element: <OrganizationPathRedirect targetPath="/flows/create" /> },
          { path: '/flows/:id/edit', element: <OrganizationPathRedirect /> },
          { path: '/flows/:id', element: <OrganizationPathRedirect /> },
          { path: '/campaigns', element: <OrganizationPathRedirect targetPath="/campaigns" /> },
          { path: '/campaigns/create', element: <OrganizationPathRedirect targetPath="/campaigns/create" /> },
          { path: '/campaigns/:id', element: <OrganizationPathRedirect /> },
          { path: '/chat', element: <OrganizationPathRedirect targetPath="/chat" /> },
          { path: '/team', element: <OrganizationPathRedirect targetPath="/team" /> },
          { path: '/automations', element: <OrganizationPathRedirect targetPath="/automations" /> },
          { path: '/automations/create', element: <OrganizationPathRedirect targetPath="/automations/create" /> },
          { path: '/automations/webhooks', element: <OrganizationPathRedirect targetPath="/automations/webhooks" /> },
          { path: '/automations/:id/edit', element: <OrganizationPathRedirect /> },
          { path: '/automations/:id', element: <OrganizationPathRedirect /> },
          { path: '/organizations', element: lazyElement(OrganizationsPage) },
          { path: '/organizations/:id', element: lazyElement(OrgDetailPage) },
          { path: '/support', element: <OrganizationPathRedirect targetPath="/support" /> },
          { path: '/support/:id', element: <OrganizationPathRedirect /> },
          { path: '/subscription', element: <OrganizationPathRedirect targetPath="/subscription" /> },
          { path: '/wallet', element: <OrganizationPathRedirect targetPath="/wallet" /> },
          { path: '/whatsapp/connect', element: <OrganizationPathRedirect targetPath="/whatsapp/connect" /> },
          { path: '/settings', element: <OrganizationPathRedirect targetPath="/settings" /> },
          { path: '/developer', element: <OrganizationPathRedirect targetPath="/developer" /> },
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
          { path: '/admin/dashboard', element: guardedLazyElement('admin', 'dashboard', 'read', AdminDashboardPage) },
          { path: '/admin/users', element: guardedLazyElement('admin', 'users', 'read', AdminUserListPage) },
          { path: '/admin/users/create', element: guardedLazyElement('admin', 'users', 'create', CreateUserPage) },
          { path: '/admin/users/:id', element: guardedLazyElement('admin', 'users', 'read', AdminUserDetailPage) },
          { path: '/admin/plans', element: guardedLazyElement('admin', 'plans', 'read', PlanListPage) },
          { path: '/admin/plans/coupons', element: guardedLazyElement('admin', 'plans', 'read', CouponsPage) },
          { path: '/admin/support', element: guardedLazyElement('admin', 'support', 'read', AdminTicketListPage) },
          { path: '/admin/support/:id', element: guardedLazyElement('admin', 'support', 'read', AdminTicketDetailPage) },
          { path: '/admin/sub-admins', element: guardedLazyElement('admin', 'sub_admins', 'read', SubAdminListPage) },
          { path: '/admin/sub-admins/roles', element: guardedLazyElement('admin', 'roles', 'read', RoleManagementPage) },
          { path: '/admin/notifications', element: guardedLazyElement('admin', 'notifications', 'read', AdminNotificationsPage) },
          { path: '/admin/email', element: guardedLazyElement('admin', 'emails', 'create', EmailManagementPage) },
          { path: '/admin/settings', element: guardedLazyElement('admin', 'settings', 'read', AdminSettingsPage) },
        ],
      },
    ],
  },
  // Redirect root based on user role
  { path: '/', element: <RoleRedirect /> },
  // 404
  { path: '*', element: <div className="flex h-full min-h-[60vh] items-center justify-center"><h1 className="text-2xl font-semibold text-muted-foreground">404 — Page Not Found</h1></div> },
]);
