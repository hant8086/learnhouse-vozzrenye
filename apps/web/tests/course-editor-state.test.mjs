import { describe, expect, test } from 'bun:test'
import { equalFormValue, courseMetadataPayload } from '../lib/courses/editorState.ts'

describe('module editor persistence', () => {
  test('opening or reloading a cloned Formik form does not create edits', () => {
    const initial = { name: 'Модуль', tag_colors: { a: '#FFFFFF' } }
    const values = JSON.parse(JSON.stringify(initial))
    expect(Object.keys(values).filter(key => !equalFormValue(values[key], initial[key]))).toEqual([])
    expect(equalFormValue({}, {})).toBe(true)
    expect(equalFormValue({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(equalFormValue({ a: '#FFFFFF' }, { a: '#000000' })).toBe(false)
  })
  test('saving text after an upload cannot restore the stale cover or its type', () => {
    const server = { thumbnail_image: 'new.jpg', thumbnail_type: 'both' }
    const payload = courseMetadataPayload({ name: 'Old', thumbnail_image: '', thumbnail_video: 'old.mp4', thumbnail_type: 'image' }, { name: 'New' }, {})
    expect({ ...server, ...payload }).toEqual({ name: 'New', thumbnail_image: 'new.jpg', thumbnail_type: 'both' })
    expect(payload).not.toHaveProperty('thumbnail_video')
  })
  test('explicit type edits and immediate text edits survive save', () => {
    expect(courseMetadataPayload({ name: 'Old', _certificationData: {} }, { thumbnail_type: 'video' }, { name: 'New' })).toEqual({ name: 'New', thumbnail_type: 'video' })
  })
})
