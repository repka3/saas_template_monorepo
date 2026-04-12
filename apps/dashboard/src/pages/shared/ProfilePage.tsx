import { useCallback, useEffect, useRef, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, LoaderCircle, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getProfileDisplayAvatarUrl, getProfileDisplayInitial } from '@/features/profile/profile-display'
import { useProfileQuery } from '@/features/profile/use-profile-query'
import { useProfileMutation } from '@/features/profile/use-profile-mutation'
import { profileFormSchema, validateAvatarFile } from '@/features/profile/profile-schema'
import { getCroppedBlob } from '@/features/profile/avatar-crop'
import type { ProfileFormValues } from '@/features/profile/profile-schema'
import { cn } from '@/lib/utils'

const revokeObjectUrl = (value: string | null) => {
  if (value) {
    URL.revokeObjectURL(value)
  }
}

function AvatarPreview({
  src,
  alt,
  fallback,
  className,
  fallbackClassName,
}: {
  src: string | null
  alt: string
  fallback: string
  className?: string
  fallbackClassName?: string
}) {
  const [hasImageError, setHasImageError] = useState(false)

  useEffect(() => {
    setHasImageError(false)
  }, [src])

  if (!src || hasImageError) {
    return <span className={fallbackClassName}>{fallback}</span>
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasImageError(true)}
    />
  )
}

export default function ProfilePage() {
  const { data, error, isPending, refetch } = useProfileQuery()
  const mutation = useProfileMutation()
  const profile = data?.user.profile ?? null
  const email = data?.user.email

  // avatar state
  const [pendingAvatar, setPendingAvatar] = useState<Blob | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)

  // crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<Area | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropSrcRef = useRef<string | null>(null)
  const pendingPreviewRef = useRef<string | null>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { firstName: '', lastName: '' },
  })

  // sync form defaults when query data arrives
  useEffect(() => {
    if (data) {
      form.reset({
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
      })
    }
  }, [data, profile, form])

  useEffect(() => {
    cropSrcRef.current = cropSrc
  }, [cropSrc])

  useEffect(() => {
    pendingPreviewRef.current = pendingPreview
  }, [pendingPreview])

  useEffect(() => {
    return () => {
      revokeObjectUrl(cropSrcRef.current)
      revokeObjectUrl(pendingPreviewRef.current)
    }
  }, [])

  const isCropping = Boolean(cropSrc)

  // file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      toast.error(validationError)
      return
    }

    revokeObjectUrl(cropSrc)
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedArea(null)
  }

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedArea) return

    try {
      const blob = await getCroppedBlob(cropSrc, croppedArea)
      revokeObjectUrl(pendingPreview)
      setPendingAvatar(blob)
      setPendingPreview(URL.createObjectURL(blob))
      setRemoveAvatar(false)
    } catch {
      toast.error('Failed to process the image.')
    } finally {
      URL.revokeObjectURL(cropSrc)
      setCropSrc(null)
    }
  }

  const handleCropCancel = () => {
    revokeObjectUrl(cropSrc)
    setCropSrc(null)
  }

  const handleRemoveAvatar = () => {
    revokeObjectUrl(pendingPreview)
    setPendingAvatar(null)
    setPendingPreview(null)
    setRemoveAvatar(true)
  }

  const persistedAvatar = data?.user
    ? getProfileDisplayAvatarUrl(data.user, profile)
    : null

  const displayAvatar = removeAvatar
    ? null
    : pendingPreview ?? persistedAvatar

  const initial = data?.user
    ? getProfileDisplayInitial(data.user, profile)
    : (email || 'U').charAt(0).toUpperCase()

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      await mutation.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        avatar: pendingAvatar,
        removeAvatar,
      })

      toast.success('Profile updated')

      // clear local avatar state after successful save
      revokeObjectUrl(pendingPreview)
      setPendingAvatar(null)
      setPendingPreview(null)
      setRemoveAvatar(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update profile')
    }
  }

  // --- Loading ---
  if (isPending) {
    return (
      <div className="w-full max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="mx-auto size-24 rounded-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  // --- Error ---
  if (error) {
    return (
      <div className="w-full max-w-2xl">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Failed to load profile</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>Update your name and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
            {/* Avatar section */}
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <button
                type="button"
                className="group relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted transition-colors hover:border-muted-foreground/50"
                onClick={() => fileInputRef.current?.click()}
                disabled={mutation.isPending}
              >
                <AvatarPreview
                  src={displayAvatar}
                  alt="Avatar"
                  className="size-full object-cover"
                  fallback={initial}
                  fallbackClassName={cn('text-2xl font-semibold text-muted-foreground', displayAvatar && 'pointer-events-none')}
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-5 text-white" />
                </span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                disabled={mutation.isPending}
              />

              <div className="flex flex-col gap-2 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                  JPEG, PNG, or WebP. Max 2 MB.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={mutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 size-3.5" />
                    Upload
                  </Button>
                  {(pendingPreview || persistedAvatar) && !removeAvatar && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 className="mr-1.5 size-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Name fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  placeholder="First name"
                  disabled={mutation.isPending}
                  {...form.register('firstName')}
                />
                {form.formState.errors.firstName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  placeholder="Last name"
                  disabled={mutation.isPending}
                  {...form.register('lastName')}
                />
                {form.formState.errors.lastName && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email ?? ''} disabled />
            </div>

            {/* Submit */}
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || isCropping}>
                {mutation.isPending && (
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                )}
                {mutation.isPending ? 'Saving' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Crop dialog */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-popover shadow-2xl ring-1 ring-foreground/10">
            <div className="border-b px-4 py-3">
              <p className="font-medium">Crop avatar</p>
              <p className="text-sm text-muted-foreground">
                Drag to reposition. Use the slider to zoom.
              </p>
            </div>

            <div className="relative aspect-square w-full bg-black">
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="space-y-3 border-t px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleCropCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCropConfirm}>
                  Confirm
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
