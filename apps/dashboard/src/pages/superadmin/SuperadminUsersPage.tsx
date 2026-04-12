import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type { CreateUserInput, SuperadminUser } from '@repo/contracts'
import { Copy, Eye, EyeOff, LoaderCircle, Plus, RefreshCw, Search } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useCreateSuperadminUserMutation, useSuperadminUsersQuery } from '@/features/superadmin-users/superadmin-users-hooks'
import { buildVisiblePages, copyText, EMAIL_PATTERN, formatDateTime, generateTemporaryPassword, trimToUndefined } from '@/features/superadmin-users/superadmin-users-utils'
import { parseAuthRoles } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

const DEFAULT_PAGE_SIZE = 20
const PAGE_SIZE_OPTIONS = ['10', '20', '50']

const formatRoleLabel = (role: string) =>
  parseAuthRoles(role)
    .map((value) => value[0]?.toUpperCase() + value.slice(1))
    .join(', ') || role

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const UserStatusBadges = ({ user }: { user: SuperadminUser }) => (
  <div className="flex flex-wrap gap-1.5">
    <Badge variant={user.emailVerified ? 'success' : 'outline'}>{user.emailVerified ? 'Verified' : 'Unverified'}</Badge>
    <Badge variant={user.banned ? 'destructive' : 'secondary'}>{user.banned ? 'Disabled' : 'Active'}</Badge>
    {user.mustChangePassword ? <Badge variant="warning">Password reset required</Badge> : null}
  </div>
)

const createInitialFormState = () => ({
  email: '',
  name: '',
  firstName: '',
  lastName: '',
  temporaryPassword: generateTemporaryPassword(),
  alreadyVerified: false,
})

export default function SuperadminUsersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePositiveInt(searchParams.get('page'), 1)
  const pageSize = parsePositiveInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE)
  const query = searchParams.get('query')?.trim() || ''
  const [searchInput, setSearchInput] = useState(query)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState(createInitialFormState)
  const usersQuery = useSuperadminUsersQuery({
    page,
    pageSize,
    query: query || undefined,
  })
  const createMutation = useCreateSuperadminUserMutation()

  useEffect(() => {
    setSearchInput(query)
  }, [query])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const trimmed = searchInput.trim()

      if (trimmed === query) {
        return
      }

      setSearchParams((current) => {
        const next = new URLSearchParams(current)

        if (trimmed) {
          next.set('query', trimmed)
        } else {
          next.delete('query')
        }

        next.set('page', '1')
        next.set('pageSize', String(pageSize))

        return next
      })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [pageSize, query, searchInput, setSearchParams])

  const users = usersQuery.data?.users ?? []
  const pagination = usersQuery.data?.pagination
  const totalPages = pagination?.totalPages ?? 0

  const columns = useMemo<ColumnDef<SuperadminUser>[]>(
    () => [
      {
        header: 'User',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-sm text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        header: 'Profile',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.profile.firstName, row.original.profile.lastName].filter(Boolean).join(' ') || 'No profile name'}
          </span>
        ),
      },
      {
        header: 'Role',
        cell: ({ row }) => <Badge variant="outline">{formatRoleLabel(row.original.role)}</Badge>,
      },
      {
        header: 'Status',
        cell: ({ row }) => <UserStatusBadges user={row.original} />,
      },
      {
        header: 'Created',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
      },
      {
        header: 'Actions',
        cell: ({ row }) => (
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            to={`/superadmin/users/${row.original.id}`}
          >
            View
          </Link>
        ),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const setPage = (nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(nextPage))
      next.set('pageSize', String(pageSize))

      if (query) {
        next.set('query', query)
      }

      return next
    })
  }

  const setNextPageSize = (value: string | null) => {
    if (!value) {
      return
    }

    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', '1')
      next.set('pageSize', value)

      if (query) {
        next.set('query', query)
      }

      return next
    })
  }

  const resetCreateForm = () => {
    setCreateError(null)
    setShowTemporaryPassword(false)
    setCreateForm(createInitialFormState())
  }

  const handleCreateDialogChange = (open: boolean) => {
    setIsCreateOpen(open)

    if (!open) {
      resetCreateForm()
    }
  }

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)

    if (!EMAIL_PATTERN.test(createForm.email.trim())) {
      setCreateError('Enter a valid email address.')
      return
    }

    if (createForm.name.trim().length === 0) {
      setCreateError('Enter a display name.')
      return
    }

    if (createForm.temporaryPassword.trim().length < 12) {
      setCreateError('Use at least 12 characters for the temporary password.')
      return
    }

    const payload: CreateUserInput = {
      email: createForm.email.trim(),
      name: createForm.name.trim(),
      temporaryPassword: createForm.temporaryPassword.trim(),
      alreadyVerified: createForm.alreadyVerified,
      firstName: trimToUndefined(createForm.firstName),
      lastName: trimToUndefined(createForm.lastName),
    }

    try {
      const response = await createMutation.mutateAsync(payload)
      toast.success('User created')
      handleCreateDialogChange(false)
      navigate(`/superadmin/users/${response.user.id}`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create the user.')
    }
  }

  const handleCopyTemporaryPassword = async () => {
    try {
      await copyText(createForm.temporaryPassword)
      toast.success('Temporary password copied')
    } catch {
      toast.error('Unable to copy the password')
    }
  }

  const pageItems = buildVisiblePages(page, totalPages)

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage user records, access state, and temporary passwords.</p>
        </div>
        <Button className="gap-2 self-start md:self-auto" onClick={() => setIsCreateOpen(true)}>
          <Plus />
          Create user
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Search by name, email, or profile fields.</CardDescription>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="Search users" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </div>

            <Select value={String(pageSize)} onValueChange={setNextPageSize}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {usersQuery.isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : usersQuery.isError ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {usersQuery.error.message}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  {pagination?.totalItems ?? 0} total users
                  {usersQuery.isFetching ? ' • refreshing…' : ''}
                </span>
                <Button className="gap-2" size="sm" variant="outline" onClick={() => usersQuery.refetch()}>
                  {usersQuery.isFetching ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                  Refresh
                </Button>
              </div>

              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell className="h-24 text-center text-sm text-muted-foreground" colSpan={columns.length}>
                        No users match the current search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {totalPages > 0 ? (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>

                  <Pagination className="mx-0 w-auto justify-start md:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <Button disabled={page <= 1} size="sm" variant="outline" onClick={() => setPage(page - 1)}>
                          Previous
                        </Button>
                      </PaginationItem>

                      {pageItems.map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {item === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <Button size="icon-sm" variant={item === page ? 'outline' : 'ghost'} onClick={() => setPage(item)}>
                              {item}
                            </Button>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <Button disabled={page >= totalPages} size="sm" variant="outline" onClick={() => setPage(page + 1)}>
                          Next
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>Create a user with a temporary password and force a password change on next sign-in.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-4" onSubmit={handleCreateSubmit}>
            <Field>
              <FieldLabel>Email</FieldLabel>
              <FieldContent>
                <Input
                  autoComplete="email"
                  placeholder="person@example.com"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Name</FieldLabel>
              <FieldContent>
                <Input
                  placeholder="Display name"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                />
              </FieldContent>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>First name</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="Optional"
                    value={createForm.firstName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, firstName: event.target.value }))}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Last name</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="Optional"
                    value={createForm.lastName}
                    onChange={(event) => setCreateForm((current) => ({ ...current, lastName: event.target.value }))}
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel>Temporary password</FieldLabel>
              <FieldContent>
                <div className="flex gap-2">
                  <Input
                    autoComplete="new-password"
                    placeholder="Temporary password"
                    type={showTemporaryPassword ? 'text' : 'password'}
                    value={createForm.temporaryPassword}
                    onChange={(event) => setCreateForm((current) => ({ ...current, temporaryPassword: event.target.value }))}
                  />
                  <Button size="icon-sm" type="button" variant="outline" onClick={() => setShowTemporaryPassword((current) => !current)}>
                    {showTemporaryPassword ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button
                    size="icon-sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setCreateForm((current) => ({
                        ...current,
                        temporaryPassword: generateTemporaryPassword(),
                      }))
                    }
                  >
                    <RefreshCw />
                  </Button>
                  <Button size="icon-sm" type="button" variant="outline" onClick={handleCopyTemporaryPassword}>
                    <Copy />
                  </Button>
                </div>
                <FieldDescription>Share this password with the user before the dialog closes.</FieldDescription>
              </FieldContent>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                checked={createForm.alreadyVerified}
                onCheckedChange={(checked) => setCreateForm((current) => ({ ...current, alreadyVerified: checked === true }))}
              />
              <FieldContent>
                <FieldLabel>Already verified</FieldLabel>
                <FieldDescription>Keep email verification enabled for manually provisioned accounts.</FieldDescription>
              </FieldContent>
            </Field>

            {createError ? <p className="text-sm text-destructive">{createError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleCreateDialogChange(false)}>
                Cancel
              </Button>
              <Button disabled={createMutation.isPending} type="submit">
                {createMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
                Create user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
