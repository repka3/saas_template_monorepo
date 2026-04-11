# Dashboard Profile Page Plan

## Goal

Add a real profile page in the dashboard app so an authenticated user can:

- view their current profile data
- update `firstName` and `lastName`
- upload an avatar
- crop and zoom an avatar before upload
- remove an existing avatar

The page should use the backend endpoints that now exist:

- `GET /api/users/:id`
- `PATCH /api/users/me/profile`

## Repo Facts This Plan Is Based On

- The dashboard app uses React 19, React Router 7, `react-hook-form`, `zod`, and `@tanstack/react-query`.
- The dashboard currently has auth/session handling through `better-auth`, but no general API client yet.
- The dashboard shell exists through `RoleShell`, `TopBar`, `UserLayout`, and `SuperAdminLayout`.
- The dashboard currently exposes only index routes for `/dashboard` and `/superadmin`.
- The dashboard has no existing profile page, no profile route, and no route-level API state management.
- The backend now supports:
  - `GET /api/users/:id` for the authenticated actor or superadmin
  - `PATCH /api/users/me/profile` with `multipart/form-data`
  - public avatar serving from `/uploads/avatars/*`
- The current auth session in the dashboard comes from Better Auth and may need a `refetch()` after profile mutation so session-derived UI stays current.

## Decisions

### Scope

Implement one shared profile experience that is reachable from both shells:

- `/dashboard/profile`
- `/superadmin/profile`

Reason:

- the backend endpoint is self-service and not role-specific
- both roles have a profile
- a shared page avoids duplicated UI and duplicated fetch/mutation logic

### Read Strategy

Use the existing session user ID from `useAuth()` and fetch:

- `GET /api/users/:sessionUserId`

Reason:

- the backend already has a read endpoint with the right response shape
- no new backend `GET /users/me` endpoint is required for this feature

### Update Strategy

Use `PATCH /api/users/me/profile` with `multipart/form-data`.

Submit:

- `firstName`
- `lastName`
- `removeAvatar`
- `avatar`

Reason:

- this matches the backend contract exactly
- it avoids inventing a separate frontend-only protocol

### Frontend Data Layer

Introduce a minimal dashboard API client and use React Query for server state.

Reason:

- `@tanstack/react-query` is already installed
- the feature needs query + mutation + invalidation
- the dashboard currently has no reusable fetch wrapper

### Form Strategy

Use `react-hook-form` with a small client Zod schema for text validation and form normalization.

Client-side rules:

- `firstName`: trim, max 100, blank becomes empty UI value but sent as `''`
- `lastName`: trim, max 100, blank becomes empty UI value but sent as `''`
- avatar file validation on the client should mirror backend constraints where practical:
  - accept JPEG, PNG, WebP
  - max 2 MB

Notes:

- the backend remains the source of truth
- client validation is for fast feedback only
- the cropped output must still respect the backend size limit

### Avatar UX

The page should support:

- showing the current avatar if present
- showing initials fallback if not present
- local preview when a new file is selected
- opening a crop flow after a new file is selected
- drag and zoom controls for avatar framing
- confirming the crop before the file becomes the pending upload
- explicit "Remove avatar" action
- clear conflict behavior:
  - selecting a new avatar clears pending removal intent
  - choosing remove avatar clears any newly selected file

Reason:

- the backend rejects sending both `avatar` and `removeAvatar=true`
- the UI should prevent that invalid state before submit

### Crop Strategy

Add a client-side cropper step before upload.

Use a dedicated cropper library, for example:

- `react-easy-crop`

Reason:

- the feature needs drag, zoom, and a circular crop mask
- this avoids writing custom crop math from scratch
- the backend contract can stay unchanged if the frontend uploads the processed result as a normal file/blob

Crop flow:

- user selects an image file
- frontend validates basic type and size
- frontend opens a crop dialog or sheet
- crop UI shows a circular mask
- user repositions and zooms the image
- on confirm, the frontend renders the crop to a canvas
- the canvas output is converted into the final uploadable `Blob` or `File`
- the cropped result is what gets appended to `FormData`

Important implementation note:

- the cropper should use a circular framing mask for UX
- the exported file should still be a square avatar image, not a literal transparent circle

Reason:

- this preserves compatibility with JPEG uploads
- circular display can still be achieved everywhere with CSS
- it keeps backend storage simple while giving users circular framing control

### Session Refresh

After a successful profile mutation:

- invalidate/refetch the profile query
- call `useAuth().refetch()` once

Reason:

- top bar and any session-derived avatar/name displays should not drift after update

## Files To Add Or Update

### Dashboard bootstrap

Update:

- `apps/dashboard/src/main.tsx`

Changes:

- add `QueryClientProvider`
- add a shared `QueryClient`
- mount the existing `Toaster`

### API utilities

Add:

- `apps/dashboard/src/lib/api-client.ts`

Responsibilities:

- derive base API URL from `VITE_API_URL`
- provide a small `apiFetch()` wrapper with `credentials: 'include'`
- parse the backend error envelope
- throw a typed dashboard API error for failed requests

Optional:

- export a small helper for building absolute avatar URLs from backend-relative paths

### Profile types and validation

Add:

- `apps/dashboard/src/features/profile/profile-schema.ts`
- `apps/dashboard/src/features/profile/profile-types.ts`
- `apps/dashboard/src/features/profile/avatar-crop.ts`

Responsibilities:

- define the client form schema
- define the profile/user response shape expected from the backend
- add crop helper utilities that turn crop coordinates into the final uploadable file/blob
- keep the frontend contract explicit instead of sprinkling anonymous types

### Profile data hooks

Add:

- `apps/dashboard/src/features/profile/use-profile-query.ts`
- `apps/dashboard/src/features/profile/use-profile-mutation.ts`

Query hook responsibilities:

- read session user ID from `useAuth()`
- fetch `GET /api/users/:id`
- expose loading/error/data state

Mutation hook responsibilities:

- construct `FormData`
- send `PATCH /api/users/me/profile`
- invalidate the profile query
- trigger `auth.refetch()`
- surface success/error toast feedback
- accept the already-cropped avatar file rather than the raw selected file

### Shared page component

Add:

- `apps/dashboard/src/pages/shared/ProfilePage.tsx`

Responsibilities:

- render the profile UI
- load current data
- initialize/reset the form from query data
- manage avatar preview, crop, and remove state
- submit updates
- handle remove-avatar state cleanly

### Routing

Update:

- `apps/dashboard/src/App.tsx`

Changes:

- add nested profile route under `/dashboard`
- add nested profile route under `/superadmin`
- point both routes to the same shared `ProfilePage`

### Navigation

Update:

- `apps/dashboard/src/layouts/RoleShell.tsx`
- `apps/dashboard/src/layouts/TopBar.tsx`

Changes:

- add a sidebar entry for `Profile`
- add a top-bar dropdown entry that links to the profile route for the current role

Route targets:

- user: `/dashboard/profile`
- superadmin: `/superadmin/profile`

### Optional UI helpers

If the shared profile page becomes noisy, add small local components under:

- `apps/dashboard/src/features/profile/components/`

Examples:

- `AvatarPicker`
- `AvatarCropDialog`
- `ProfileFormActions`
- `ProfileSkeleton`

Do not extract components prematurely if the page remains readable as one file.

## Page Behavior

### Loading state

While the profile query is pending:

- show a page-level skeleton or loading card

### Error state

If the profile query fails:

- show a page-level error alert
- allow retry

### Save state

During mutation:

- disable submit
- disable conflicting avatar controls
- show a saving label/spinner

During cropping:

- disable normal save until crop is confirmed or cancelled
- keep the raw selected file local only
- only treat the cropped result as the pending upload

### Success state

On successful save:

- show a success toast
- refresh profile data
- refresh auth session
- keep the user on the profile page

## API Contract Mapping

### GET request

Use:

- `GET /api/users/:id`

Where `:id` is:

- `auth.user.id`

Expected response:

```json
{
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "image": "/uploads/avatars/....png",
    "profile": {
      "firstName": "...",
      "lastName": "...",
      "avatarPath": "/uploads/avatars/....png"
    }
  }
}
```

### PATCH request

Use `FormData`.

Rules:

- include `firstName` and `lastName` when submitting the form
- include `removeAvatar=true` only when the user explicitly chose avatar removal
- include `avatar` only when a new cropped file is ready
- never send both `removeAvatar=true` and `avatar`

## Implementation Order

### 1. Bootstrap the dashboard runtime

- add React Query provider in `main.tsx`
- mount the existing toaster
- verify the app still renders

### 2. Add the dashboard API wrapper

- implement `apiFetch()`
- normalize backend error envelopes into a typed frontend error
- add avatar URL helper if useful

### 3. Add profile feature modules

- profile types
- client schema
- crop helper utilities
- query hook
- mutation hook

### 4. Build the shared profile page

- fetch current profile
- display fields and avatar
- support crop/zoom/preview/removal logic
- submit multipart form updates

Detailed avatar flow:

- choose file
- validate file type/size
- open crop UI
- confirm crop into the final uploadable file
- preview the cropped avatar
- allow clearing or reselecting before save

### 5. Wire routes and navigation

- add `/dashboard/profile`
- add `/superadmin/profile`
- add sidebar and top-bar entry points

### 6. Verify end-to-end behavior

- manual smoke test user flow
- manual smoke test superadmin-self flow
- verify avatars load from backend public path

## Verification Checklist

### Static checks

Run:

- `pnpm --filter dashboard lint`
- `pnpm --filter dashboard build`

### Manual checks

Verify:

1. standard user can open `/dashboard/profile`
2. superadmin can open `/superadmin/profile`
3. current names populate correctly from backend data
4. saving only names works
5. blank names clear correctly
6. selecting an avatar opens the crop UI
7. crop UI supports drag and zoom
8. confirming crop previews the final avatar correctly
9. valid cropped avatar upload works
10. avatar removal works
11. invalid file type is blocked or shows a useful error
12. oversized file is blocked or shows a useful error
13. top-bar/session-derived UI updates after save

## Out Of Scope

- admin editing another user's profile from the dashboard
- generic media library
- drag-and-drop uploads
- optimistic updates beyond local form preview
- frontend test harness setup if not already needed elsewhere

Exception:

- avatar cropping and crop export for this profile page are in scope

## Default Assumptions To Implement Exactly

- shared profile page for both `USER` and `SUPERADMIN`
- routes are `/dashboard/profile` and `/superadmin/profile`
- reads use `GET /api/users/:sessionUserId`
- writes use `PATCH /api/users/me/profile`
- mutation payload is `multipart/form-data`
- avatar file selection includes a crop-and-zoom confirmation step
- crop UI uses a circular mask but exports a square avatar image
- React Query is used for profile query/mutation state
- `react-hook-form` + Zod are used for form handling
- the existing `Toaster` is mounted and used for success/error feedback
