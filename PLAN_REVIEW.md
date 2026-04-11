# PLAN.md Review — Update Profile Endpoint

## Overall Assessment

The plan is strong and factually grounded in the current backend. The remaining work is mostly about tightening failure-path behavior so the upload flow is safe and the API contract is explicit.

## Issues

### 1. Upload errors are not fully accounted for

The plan promises `400 validation_error` and `413 payload_too_large` responses for upload failures, but the current backend error handler only normalizes `HttpError`, `ZodError`, invalid JSON, and `entity.too.large`.

Without an explicit Multer error-mapping path, unsupported upload states will fall through as `500 internal_server_error`.

**Recommendation:** Make upload error translation explicit in the plan. At minimum:

- `MulterError` `LIMIT_FILE_SIZE` -> `413 payload_too_large`
- unsupported MIME type -> `400 validation_error`
- unexpected multipart field/file count issues -> `400 validation_error`

### 2. Uploaded file cleanup must cover every pre-commit failure path

The middleware order is correct: auth -> upload -> validation -> controller. The problem is ownership.

Once Multer writes a file to disk, that file must be treated as temporary until the database update succeeds. The original plan covered DB-failure cleanup, but it did not clearly cover validation or controller failures after the file is written.

**Recommendation:** State the rule directly: any error after upload persistence and before successful DB commit must delete the newly uploaded file. In practice:

- validation middleware cleans up on schema/field-conflict failure
- service logic cleans up on DB/update failure

### 3. Endpoint semantics should be `PATCH`, not `PUT`

The plan describes partial-update behavior: every field is optional and omitted fields remain unchanged. That is `PATCH` semantics.

Using `PUT` here would either be semantically misleading or would require replacement semantics that the rest of the plan does not want.

**Recommendation:** Use `PATCH /api/users/me/profile`.

### 4. Old avatar deletion failure should be non-fatal

The plan says to delete the previous avatar after the DB update succeeds, but it does not say what to do when that deletion fails.

At that point the user-facing state is already correct. Failing the request would create a worse inconsistency than keeping an orphaned old file.

**Recommendation:** Delete the old avatar on a best-effort basis, log failures, and do not roll back a successful DB write.

### 5. Path-safety guidance should be precise

The plan correctly says deletion must stay inside the managed upload directory, but it does not define the containment check.

A naive prefix check is easy to get wrong.

**Recommendation:** Use a resolved avatar directory plus a `path.relative()`-style containment check before deleting any stored file path.

## Minor Points

### File-only request is a valid change

The plan's "no actual change" rule is about an empty request shape, not a semantic no-op against current DB state. A request that uploads only `avatar` is valid and should not be cited as a validation failure example.

### Public static serving should stay narrowly scoped

Serving the entire uploads root from `/uploads` would make future non-avatar uploads public by default.

**Recommendation:** Serve only the avatars subdirectory publicly, while continuing to store the DB path as `/uploads/avatars/<filename>`.

### Concurrent avatar updates can leak orphaned files

Two simultaneous avatar updates can still leave an orphaned file even with correct happy-path cleanup. That is acceptable for v1 if it is treated as a known limitation rather than an unnoticed edge case.

### MIME validation is extension-level, not content-level

Declared MIME type checks are sufficient for this v1 local-disk flow, but they are not binary-signature validation.

**Recommendation:** Note that magic-byte sniffing is out of scope for v1.

### Test strategy should cover real multipart behavior

The existing route tests are mock-heavy. This endpoint needs at least a few upload-oriented tests that exercise multipart parsing, upload cleanup, and envelope mapping rather than only pure service mocks.

## Verdict

The plan becomes implementation-ready once these three items are explicit:

- `PATCH` endpoint semantics
- upload error mapping
- pre-commit uploaded-file cleanup ownership

The rest are implementation notes or acceptable v1 limitations.
