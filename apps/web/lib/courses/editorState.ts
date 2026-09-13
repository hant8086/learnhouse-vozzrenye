/** Compare JSON form values by content: Formik clones nested initial values. */
export function equalFormValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && equalFormValue(a[key], b[key]))
}

/** Uploaded filenames belong exclusively to the thumbnail endpoint. */
export function courseMetadataPayload(structure: Record<string, unknown>, pending: Record<string, unknown>, unsynced: Record<string, unknown>) {
  const payload = { ...structure, ...pending, ...unsynced }
  delete payload.thumbnail_image
  delete payload.thumbnail_video
  delete payload._certificationData
  // The upload endpoint also sets the display type. Only overwrite it when
  // the author explicitly changed that selector in this editor session.
  if (!Object.prototype.hasOwnProperty.call(pending, 'thumbnail_type') &&
      !Object.prototype.hasOwnProperty.call(unsynced, 'thumbnail_type')) delete payload.thumbnail_type
  return payload
}

/** Acknowledge only edits included in the request, retaining newer edits. */
export function acknowledgeMetadataSave(
  structure: Record<string, unknown>,
  pending: Record<string, unknown>,
  unsynced: Record<string, unknown>,
  submitted: Record<string, unknown>,
) {
  const outstanding = { ...pending, ...unsynced }
  const remaining = Object.fromEntries(Object.entries(outstanding).filter(([key, value]) =>
    !equalFormValue(value, submitted[key])))
  return {
    courseStructure: { ...structure, ...outstanding },
    pendingChanges: remaining,
    unsyncedChanges: {},
    isSaved: Object.keys(remaining).length === 0,
  }
}
