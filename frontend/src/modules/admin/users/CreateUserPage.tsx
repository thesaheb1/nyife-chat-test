import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PhoneNumberInput } from '@/shared/components/PhoneNumberInput';
import {
  directCreateUserSchema,
  inviteUserSchema,
  type CreateUserFormData,
  type InviteUserFormData,
} from './validations';
import { useCreateAdminUser, useInviteAdminUser } from './useAdminUsers';
import { getApiErrorMessage } from '@/core/errors/apiError';

type CreateMode = 'direct' | 'invite';

const DEFAULT_MODE: CreateMode = 'direct';

export function CreateUserPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const createUser = useCreateAdminUser();
  const inviteUser = useInviteAdminUser();
  const currentMode = (searchParams.get('mode') as CreateMode) || DEFAULT_MODE;

  const directForm = useForm<CreateUserFormData>({
    resolver: zodResolver(directCreateUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const inviteForm = useForm<InviteUserFormData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
    },
  });

  const handleDirectCreate = async (values: CreateUserFormData) => {
    try {
      await createUser.mutateAsync({
        ...values,
        phone: values.phone || undefined,
      });
      toast.success('User created. The account is active and must change password on first login.');
      navigate('/admin/users');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to create the user account.'));
    }
  };

  const handleInvite = async (values: InviteUserFormData) => {
    try {
      await inviteUser.mutateAsync({
        ...values,
        phone: values.phone || undefined,
      });
      toast.success('User invitation sent.');
      navigate('/admin/users?tab=invitations');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to send the user invitation.'));
    }
  };

  const isBusy =
    directForm.formState.isSubmitting
    || inviteForm.formState.isSubmitting
    || createUser.isPending
    || inviteUser.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create or Invite User</h1>
          <p className="text-sm text-muted-foreground">
            Create an active user with a default password or send an invitation email.
          </p>
        </div>
      </div>

      <Tabs
        value={currentMode}
        onValueChange={(value) => setSearchParams({ mode: value })}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="direct">
            <UserPlus className="mr-2 h-4 w-4" />
            Direct Create
          </TabsTrigger>
          <TabsTrigger value="invite">
            <Mail className="mr-2 h-4 w-4" />
            Invite by Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Create Active User</CardTitle>
              <CardDescription>
                The new user is created immediately, email is auto-verified, and the account is forced to change password on first login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={directForm.handleSubmit(handleDirectCreate)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="direct-first-name">First name</Label>
                    <Input id="direct-first-name" {...directForm.register('first_name')} />
                    {directForm.formState.errors.first_name ? (
                      <p className="text-xs text-destructive">{directForm.formState.errors.first_name.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="direct-last-name">Last name</Label>
                    <Input id="direct-last-name" {...directForm.register('last_name')} />
                    {directForm.formState.errors.last_name ? (
                      <p className="text-xs text-destructive">{directForm.formState.errors.last_name.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="direct-email">Email</Label>
                    <Input id="direct-email" type="email" {...directForm.register('email')} />
                    {directForm.formState.errors.email ? (
                      <p className="text-xs text-destructive">{directForm.formState.errors.email.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="direct-phone">Phone</Label>
                    <Controller
                      control={directForm.control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneNumberInput
                          id="direct-phone"
                          autoComplete="tel"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          invalid={Boolean(directForm.formState.errors.phone)}
                        />
                      )}
                    />
                    {directForm.formState.errors.phone ? (
                      <p className="text-xs text-destructive">{directForm.formState.errors.phone.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="direct-password">Default password</Label>
                  <Input id="direct-password" type="password" {...directForm.register('password')} />
                  {directForm.formState.errors.password ? (
                    <p className="text-xs text-destructive">{directForm.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Recommended: share the temporary password securely and ask the user to change it immediately after the first sign-in.
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isBusy}>
                    {createUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create User
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/admin/users')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>Invite by Email</CardTitle>
              <CardDescription>
                Send a secure invitation link so the user can set their own password and reach the normal login flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={inviteForm.handleSubmit(handleInvite)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-first-name">First name</Label>
                    <Input id="invite-first-name" {...inviteForm.register('first_name')} />
                    {inviteForm.formState.errors.first_name ? (
                      <p className="text-xs text-destructive">{inviteForm.formState.errors.first_name.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-last-name">Last name</Label>
                    <Input id="invite-last-name" {...inviteForm.register('last_name')} />
                    {inviteForm.formState.errors.last_name ? (
                      <p className="text-xs text-destructive">{inviteForm.formState.errors.last_name.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input id="invite-email" type="email" {...inviteForm.register('email')} />
                    {inviteForm.formState.errors.email ? (
                      <p className="text-xs text-destructive">{inviteForm.formState.errors.email.message}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-phone">Phone</Label>
                    <Controller
                      control={inviteForm.control}
                      name="phone"
                      render={({ field }) => (
                        <PhoneNumberInput
                          id="invite-phone"
                          autoComplete="tel"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          invalid={Boolean(inviteForm.formState.errors.phone)}
                        />
                      )}
                    />
                    {inviteForm.formState.errors.phone ? (
                      <p className="text-xs text-destructive">{inviteForm.formState.errors.phone.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Invitations expire automatically. Admins can resend or revoke them from the invitations tab.
                </div>

                <div className="flex gap-3">
                  <Button type="submit" disabled={isBusy}>
                    {inviteUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Send Invitation
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate('/admin/users')}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
