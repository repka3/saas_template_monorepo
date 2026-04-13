import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { UpdateUserInput } from '@repo/contracts'
import { ArrowLeft, Copy, Eye, EyeOff, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  useSuperadminUserQuery,
  useUpdateSuperadminUserMutation,
  useUpdateSuperadminUserRoleMutation,
} from '@/features/superadmin-users/superadmin-users-hooks'
import { copyText, EMAIL_PATTERN, formatDateTime, generateTemporaryPassword, trimToNull } from '@/features/superadmin-users/superadmin-users-utils'
import { type AppRole, parseAuthRoles } from '@/lib/auth-client'

type PendingAction = 'identity' | 'role' | 'disable' | 'enable' | 'password' | null

const formatRoleLabel = (role: string) =>
  parseAuthRoles(role)
    .map((value) => value[0]?.toUpperCase() + value.slice(1))
    .join(', ') || role

const UserStatusBadges = ({ emailVerified, banned, mustChangePassword }: { emailVerified: boolean; banned: boolean; mustChangePassword: boolean }) => (
  <div className="flex flex-wrap gap-1.5">
    <Badge variant={emailVerified ? 'success' : 'outline'}>{emailVerified ? 'Verified' : 'Unverified'}</Badge>
    <Badge variant={banned ? 'destructive' : 'secondary'}>{banned ? 'Disabled' : 'Active'}</Badge>
    {mustChangePassword ? <Badge variant="warning">Password reset required</Badge> : null}
  </div>
)

export default function SuperadminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const userQuery = useSuperadminUserQuery(id)
  const updateMutation = useUpdateSuperadminUserMutation(id ?? '')
  const updateRoleMutation = useUpdateSuperadminUserRoleMutation(id ?? '')
  const [identityForm, setIdentityForm] = useState({
    email: '',
    name: '',
    firstName: '',
    lastName: '',
    emailVerified: false,
  })
  const [roleForm, setRoleForm] = useState<AppRole>('user')
  const [disableReason, setDisableReason] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState(generateTemporaryPassword())
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)

  const user = userQuery.data?.user
  const currentRole = parseAuthRoles(user?.role)[0] ?? 'user'
  const canEditRole = currentRole === 'superadmin'
  const availableRoleOptions = canEditRole ? (['superadmin', 'user'] as const) : (['user'] as const)

  useEffect(() => {
    if (!user) {
      return
    }

    setIdentityForm({
      email: user.email,
      name: user.name,
      firstName: user.profile.firstName ?? '',
      lastName: user.profile.lastName ?? '',
      emailVerified: user.emailVerified,
    })
    setRoleForm(parseAuthRoles(user.role)[0] ?? 'user')
    setDisableReason(user.banReason ?? '')
  }, [user])

  const runUpdate = async ({
    action,
    payload,
    successMessage,
    onSuccess,
  }: {
    action: Exclude<PendingAction, 'enable'> | 'enable'
    payload: Parameters<typeof updateMutation.mutateAsync>[0]
    successMessage: string
    onSuccess?: () => void
  }) => {
    setPendingAction(action)

    try {
      await updateMutation.mutateAsync(payload)
      toast.success(successMessage)
      onSuccess?.()
    } finally {
      setPendingAction(null)
    }
  }

  const handleIdentitySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIdentityError(null)

    if (!user) {
      return
    }

    if (!EMAIL_PATTERN.test(identityForm.email.trim())) {
      setIdentityError('Enter a valid email address.')
      return
    }

    if (identityForm.name.trim().length === 0) {
      setIdentityError('Enter a display name.')
      return
    }

    const nextFirstName = trimToNull(identityForm.firstName)
    const nextLastName = trimToNull(identityForm.lastName)
    const payload: UpdateUserInput = {}

    if (identityForm.email.trim() !== user.email) {
      payload.email = identityForm.email.trim()
    }

    if (identityForm.name.trim() !== user.name) {
      payload.name = identityForm.name.trim()
    }

    if (nextFirstName !== user.profile.firstName) {
      payload.firstName = nextFirstName
    }

    if (nextLastName !== user.profile.lastName) {
      payload.lastName = nextLastName
    }

    if (identityForm.emailVerified !== user.emailVerified) {
      payload.emailVerified = identityForm.emailVerified
    }

    if (Object.keys(payload).length === 0) {
      toast.info('No identity changes to save')
      return
    }

    try {
      await runUpdate({
        action: 'identity',
        payload,
        successMessage: 'Identity updated',
      })
    } catch (error) {
      setIdentityError(error instanceof Error ? error.message : 'Failed to update identity.')
    }
  }

  const handleDisable = async () => {
    setAccessError(null)

    try {
      await runUpdate({
        action: 'disable',
        payload: {
          disabled: true,
          disableReason: trimToNull(disableReason) ?? undefined,
        },
        successMessage: 'User disabled',
        onSuccess: () => setIsDisableDialogOpen(false),
      })
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Failed to disable the user.')
    }
  }

  const handleEnable = async () => {
    setAccessError(null)

    try {
      await runUpdate({
        action: 'enable',
        payload: {
          disabled: false,
        },
        successMessage: 'User re-enabled',
        onSuccess: () => setIsEnableDialogOpen(false),
      })
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Failed to re-enable the user.')
    }
  }

  const handleTemporaryPasswordReset = async () => {
    setSecurityError(null)

    if (temporaryPassword.trim().length < 12) {
      setSecurityError('Use at least 12 characters for the temporary password.')
      return
    }

    try {
      await runUpdate({
        action: 'password',
        payload: {
          temporaryPassword: temporaryPassword.trim(),
        },
        successMessage: 'Temporary password reset',
        onSuccess: () => {
          setIsPasswordDialogOpen(false)
          setTemporaryPassword(generateTemporaryPassword())
        },
      })
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Failed to reset the password.')
    }
  }

  const handleCopyTemporaryPassword = async () => {
    try {
      await copyText(temporaryPassword)
      toast.success('Temporary password copied')
    } catch {
      toast.error('Unable to copy the password')
    }
  }

  const handleRoleSave = async () => {
    setAccessError(null)

    if (!user) {
      return
    }

    if (roleForm === currentRole) {
      toast.info('No role changes to save')
      return
    }

    setPendingAction('role')

    try {
      await updateRoleMutation.mutateAsync({
        role: roleForm,
      })
      toast.success('Role updated')
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : 'Failed to update the role.')
    } finally {
      setPendingAction(null)
    }
  }

  if (userQuery.isPending) {
    return (
      <div className="flex w-full flex-col gap-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    )
  }

  if (userQuery.isError || !user) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Alert variant="destructive">
          <ShieldAlert />
          <AlertTitle>Failed to load user</AlertTitle>
          <AlertDescription>{userQuery.error?.message ?? 'User not found.'}</AlertDescription>
        </Alert>
        <Link className={buttonVariants({ variant: 'outline', size: 'sm' })} to="/superadmin/users">
          <ArrowLeft />
          Back to users
        </Link>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} to="/superadmin/users">
            <ArrowLeft />
            Back to users
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <UserStatusBadges banned={user.banned} emailVerified={user.emailVerified} mustChangePassword={user.mustChangePassword} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Identity</CardTitle>
              <CardDescription>
                Update email, display name, and profile fields. Changing email resets verification unless you explicitly keep it enabled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleIdentitySubmit}>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <FieldContent>
                    <Input
                      autoComplete="email"
                      type="email"
                      value={identityForm.email}
                      onChange={(event) => setIdentityForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel>Name</FieldLabel>
                  <FieldContent>
                    <Input value={identityForm.name} onChange={(event) => setIdentityForm((current) => ({ ...current, name: event.target.value }))} />
                  </FieldContent>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>First name</FieldLabel>
                    <FieldContent>
                      <Input
                        value={identityForm.firstName}
                        onChange={(event) => setIdentityForm((current) => ({ ...current, firstName: event.target.value }))}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel>Last name</FieldLabel>
                    <FieldContent>
                      <Input value={identityForm.lastName} onChange={(event) => setIdentityForm((current) => ({ ...current, lastName: event.target.value }))} />
                    </FieldContent>
                  </Field>
                </div>

                <Field orientation="horizontal">
                  <input
                    checked={identityForm.emailVerified}
                    className="mt-1 size-4 rounded border border-input"
                    type="checkbox"
                    onChange={(event) => setIdentityForm((current) => ({ ...current, emailVerified: event.target.checked }))}
                  />
                  <FieldContent>
                    <FieldLabel>Email verified</FieldLabel>
                    <FieldDescription>Keep this checked if you intentionally want the updated email to remain verified.</FieldDescription>
                  </FieldContent>
                </Field>

                {identityError ? <p className="text-sm text-destructive">{identityError}</p> : null}

                <div className="flex justify-end">
                  <Button disabled={pendingAction !== null} type="submit">
                    {pendingAction === 'identity' ? <LoaderCircle className="animate-spin" /> : null}
                    Save identity
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>UI labels use “Disabled”, while the backend maps this to Better Auth ban and unban operations.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-foreground/10 px-3 py-2">
                  <span className="text-muted-foreground">Role</span>
                  <Badge variant="outline">{formatRoleLabel(user.role)}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-foreground/10 px-3 py-2">
                  <span className="text-muted-foreground">Current access</span>
                  <Badge variant={user.banned ? 'destructive' : 'success'}>{user.banned ? 'Disabled' : 'Active'}</Badge>
                </div>
              </div>

              <Field>
                <FieldLabel>Assigned role</FieldLabel>
                <FieldContent>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select disabled={!canEditRole} value={roleForm} onValueChange={(value) => setRoleForm(value as AppRole)}>
                      <SelectTrigger className="sm:w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoleOptions.map((role) => (
                          <SelectItem key={role} value={role}>
                            {formatRoleLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button disabled={pendingAction !== null || !canEditRole} type="button" variant="outline" onClick={handleRoleSave}>
                      {pendingAction === 'role' ? <LoaderCircle className="animate-spin" /> : null}
                      Save role
                    </Button>
                  </div>
                  <FieldDescription>
                    {canEditRole
                      ? 'Existing superadmins can be demoted here. If all superadmins are removed, use the bootstrap seed flow to recover access.'
                      : 'Standard users cannot be promoted here. New superadmin accounts must be created directly by a superadmin.'}
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Disable reason</FieldLabel>
                <FieldContent>
                  <Textarea
                    placeholder="Optional explanation shown only for the disable action"
                    rows={4}
                    value={disableReason}
                    onChange={(event) => setDisableReason(event.target.value)}
                  />
                </FieldContent>
              </Field>

              {accessError ? <p className="text-sm text-destructive">{accessError}</p> : null}

              <div className="flex flex-wrap gap-2">
                {user.banned ? (
                  <Button disabled={pendingAction !== null} variant="outline" onClick={() => setIsEnableDialogOpen(true)}>
                    Re-enable user
                  </Button>
                ) : (
                  <Button disabled={pendingAction !== null} variant="destructive" onClick={() => setIsDisableDialogOpen(true)}>
                    Disable user
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Set a temporary password and force the next login to go through the native Better Auth change-password flow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Field>
                <FieldLabel>Temporary password</FieldLabel>
                <FieldContent>
                  <div className="flex gap-2">
                    <Input
                      autoComplete="new-password"
                      type={showTemporaryPassword ? 'text' : 'password'}
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                    />
                    <Button size="icon-sm" type="button" variant="outline" onClick={() => setShowTemporaryPassword((current) => !current)}>
                      {showTemporaryPassword ? <EyeOff /> : <Eye />}
                    </Button>
                    <Button size="icon-sm" type="button" variant="outline" onClick={() => setTemporaryPassword(generateTemporaryPassword())}>
                      <RefreshCw />
                    </Button>
                    <Button size="icon-sm" type="button" variant="outline" onClick={handleCopyTemporaryPassword}>
                      <Copy />
                    </Button>
                  </div>
                  <FieldDescription>After reset, the user will have `mustChangePassword` set to `true`.</FieldDescription>
                </FieldContent>
              </Field>

              {securityError ? <p className="text-sm text-destructive">{securityError}</p> : null}

              <div className="flex justify-end">
                <Button disabled={pendingAction !== null} onClick={() => setIsPasswordDialogOpen(true)}>
                  Reset temporary password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Immutable record details and current password-reset status.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-xl border border-foreground/10 px-3 py-2">
              <p className="text-muted-foreground">User ID</p>
              <p className="mt-1 break-all font-mono text-xs">{user.id}</p>
            </div>
            <div className="rounded-xl border border-foreground/10 px-3 py-2">
              <p className="text-muted-foreground">Created</p>
              <p className="mt-1">{formatDateTime(user.createdAt)}</p>
            </div>
            <div className="rounded-xl border border-foreground/10 px-3 py-2">
              <p className="text-muted-foreground">Updated</p>
              <p className="mt-1">{formatDateTime(user.updatedAt)}</p>
            </div>
            <div className="rounded-xl border border-foreground/10 px-3 py-2">
              <p className="text-muted-foreground">Password reset state</p>
              <div className="mt-2">
                <Badge variant={user.mustChangePassword ? 'warning' : 'secondary'}>
                  {user.mustChangePassword ? 'Must change password' : 'Password up to date'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable user?</AlertDialogTitle>
            <AlertDialogDescription>This will block the account from using protected application routes until it is re-enabled.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction !== null} variant="destructive" onClick={handleDisable}>
              {pendingAction === 'disable' ? <LoaderCircle className="animate-spin" /> : null}
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isEnableDialogOpen} onOpenChange={setIsEnableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-enable user?</AlertDialogTitle>
            <AlertDialogDescription>This restores access for the account and clears the disabled state.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction !== null} onClick={handleEnable}>
              {pendingAction === 'enable' ? <LoaderCircle className="animate-spin" /> : null}
              Re-enable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset temporary password?</AlertDialogTitle>
            <AlertDialogDescription>This sets a new temporary password and forces the next login through `/change-password`.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pendingAction !== null} onClick={handleTemporaryPasswordReset}>
              {pendingAction === 'password' ? <LoaderCircle className="animate-spin" /> : null}
              Reset password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
