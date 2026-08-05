/**
 * FORK CHANGE (SEO): the single source of truth for the Canva extension list.
 *
 * Extracted verbatim out of `DynamicCanva.tsx` so that TWO renderers can share
 * it: the interactive TipTap editor (`useEditor`) and the server-rendered static
 * HTML pass (`generateHTML` in `CanvaStaticContent.tsx`).
 *
 * They MUST share one list. `generateHTML` walks the schema's `renderHTML` and
 * silently drops any node type whose extension is missing, so a divergent list
 * would make blocks vanish from the crawler's copy of the page while still
 * appearing in the browser. Keeping one exported factory makes that divergence
 * impossible rather than merely unlikely.
 *
 * `addNodeView()` is never invoked by `generateHTML` (verified against
 * @tiptap/html 3.29.2 in a DOM-less Node process), so the React node views these
 * extensions declare — and the `next/dynamic({ ssr: false })` components behind
 * them — are not evaluated during server rendering. Only `renderHTML` runs.
 */
import StarterKit from '@tiptap/starter-kit'
import Youtube from '@tiptap/extension-youtube'

// Custom Extensions
import Callout from '@components/Objects/Editor/Extensions/Callout/Callout'
import InfoCallout from '@components/Objects/Editor/Extensions/Callout/Info/InfoCallout'
import WarningCallout from '@components/Objects/Editor/Extensions/Callout/Warning/WarningCallout'
import ImageBlock from '@components/Objects/Editor/Extensions/Image/ImageBlock'
import VideoBlock from '@components/Objects/Editor/Extensions/Video/VideoBlock'
import AudioBlock from '@components/Objects/Editor/Extensions/Audio/AudioBlock'
import MathEquationBlock from '@components/Objects/Editor/Extensions/MathEquation/MathEquationBlock'
import PDFBlock from '@components/Objects/Editor/Extensions/PDF/PDFBlock'
import LibraryBlock from '@components/Objects/Editor/Extensions/Library/LibraryBlock'
import QuizBlock from '@components/Objects/Editor/Extensions/Quiz/QuizBlock'
import MagicBlock from '@components/Objects/Editor/Extensions/MagicBlocks/MagicBlock'

// Lowlight — slim grammar set; see editorLowlight.ts
import { lowlight } from '@components/Objects/Editor/editorLowlight'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { NoTextInput } from '@components/Objects/Editor/Extensions/NoTextInput/NoTextInput'
import EmbedObjects from '@components/Objects/Editor/Extensions/EmbedObjects/EmbedObjects'
import Badges from '@components/Objects/Editor/Extensions/Badges/Badges'
import Buttons from '@components/Objects/Editor/Extensions/Buttons/Buttons'
import Flipcard from '@components/Objects/Editor/Extensions/Flipcard/Flipcard'
import FlipcardGrid from '@components/Objects/Editor/Extensions/Flipcard/FlipcardGrid'
import Scenarios from '@components/Objects/Editor/Extensions/Scenarios/Scenarios'
import CodePlayground from '@components/Objects/Editor/Extensions/CodePlayground/CodePlayground'
import { Table } from '@tiptap/extension-table'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import UserBlock from '@components/Objects/Editor/Extensions/Users/UserBlock'
import { getLinkExtension } from '@components/Objects/Editor/EditorConf'
import { CustomHeading } from './CustomHeadingExtenstion'
import WebPreview from '@components/Objects/Editor/Extensions/WebPreview/WebPreview'

export interface CanvaExtensionOptions {
  activity: any
  courseUuid?: string
  orgUuid?: string
  /**
   * See the note in DynamicCanva: the viewer runs with `editable: true` as a
   * workaround so text selection and the AI toolkit keep working; NoTextInput
   * plus the EditorOptionsProvider context are what actually make it read-only.
   */
  isEditable?: boolean
}

export function buildCanvaExtensions({
  activity,
  courseUuid,
  orgUuid,
  isEditable = true,
}: CanvaExtensionOptions): any[] {
  return [
    StarterKit.configure({
      heading: false,
      // Disable codeBlock since we use CodeBlockLowlight instead
      codeBlock: false,
      // Disable link since we use custom getLinkExtension() instead
      link: false,
      bulletList: {
        HTMLAttributes: {
          class: 'bullet-list',
        },
      },
      orderedList: {
        HTMLAttributes: {
          class: 'ordered-list',
        },
      },
    }),
    CustomHeading,
    NoTextInput,
    // Custom Extensions
    Callout,
    // Legacy nodes — backward compat with existing calloutInfo/calloutWarning content
    InfoCallout.configure({ editable: isEditable }),
    WarningCallout.configure({ editable: isEditable }),
    ImageBlock.configure({
      editable: isEditable,
      activity,
    }),
    VideoBlock.configure({
      editable: true,
      activity,
      orgUuid,
      courseUuid,
    }),
    AudioBlock.configure({
      editable: true,
      activity,
    }),
    MathEquationBlock.configure({
      editable: false,
      activity,
    }),
    PDFBlock.configure({
      editable: true,
      activity,
    }),
    LibraryBlock.configure({
      editable: isEditable,
      activity,
    }),
    QuizBlock.configure({
      editable: isEditable,
      activity,
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
    }),
    CodeBlockLowlight.configure({
      lowlight,
    }),
    EmbedObjects.configure({
      editable: isEditable,
      activity,
    }),
    Badges.configure({
      editable: isEditable,
      activity,
    }),
    Buttons.configure({
      editable: isEditable,
      activity,
    }),
    UserBlock.configure({
      editable: isEditable,
      activity,
    }),
    Table.configure({
      resizable: true,
    }),
    getLinkExtension(),
    WebPreview.configure({
      editable: true,
      activity,
    }),
    Flipcard.configure({
      editable: false,
      activity,
    }),
    FlipcardGrid.configure({
      editable: false,
      activity,
    }),
    Scenarios.configure({
      editable: false,
      activity,
    }),
    CodePlayground.configure({
      editable: false,
      activity,
    }),
    MagicBlock.configure({
      editable: false,
      activity,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ]
}

/**
 * Transforms ProseMirror JSON content to fix mark type names.
 * TipTap uses 'bold'/'italic' but AI sometimes generates 'strong'/'em'.
 */
export function normalizeMarkTypes(content: any): any {
  if (!content || typeof content !== 'object') return content
  if (Array.isArray(content)) return content.map(normalizeMarkTypes)

  const normalized: any = { ...content }
  if (normalized.marks && Array.isArray(normalized.marks)) {
    normalized.marks = normalized.marks.map((mark: any) => {
      if (mark.type === 'strong') return { ...mark, type: 'bold' }
      if (mark.type === 'em') return { ...mark, type: 'italic' }
      return mark
    })
  }
  if (normalized.content && Array.isArray(normalized.content)) {
    normalized.content = normalizeMarkTypes(normalized.content)
  }
  return normalized
}

/** Parse-and-normalize, shared by the editor and the static renderer. */
export function normalizeCanvaContent(content: any): any {
  if (!content) return content
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content
    return normalizeMarkTypes(parsed)
  } catch {
    return content
  }
}
