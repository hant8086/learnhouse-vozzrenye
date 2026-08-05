import { useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext'
import TableOfContents from './TableOfContents'
import AICanvaToolkit from './AI/AICanvaToolkit'
// FORK CHANGE (SEO): the extension list and the content normalizer moved to
// canvaExtensions.ts so the server-rendered static pass (CanvaStaticContent)
// generates HTML from the EXACT same schema this editor renders. See the note
// there on why the two must never diverge.
import { buildCanvaExtensions, normalizeCanvaContent } from './canvaExtensions'

interface Editor {
  content: string
  activity: any
  hideTableOfContents?: boolean
  // Passed by the activity/embed/board renderers so the video block can build
  // stream URLs even where the Org/Course React contexts aren't populated.
  courseUuid?: string
  orgUuid?: string
}

function Canva(props: Editor) {
  /**
   * Important Note : This is a workaround to enable user interaction features to be implemented easily, like text selection, AI features and other planned features, this is set to true but otherwise it should be set to false.
   * Another workaround is implemented below to disable the editor from being edited by the user by setting the caret-color to transparent and using a custom extension to filter out transactions that add/edit/remove text.
   * To let the various Custom Extensions know that the editor is not editable, React context (EditorOptionsProvider) will be used instead of props.extension.options.editable.
   */
  const isEditable = true

  // Normalize content to fix AI-generated mark types (strong -> bold, em -> italic)
  const normalizedContent = useMemo(
    () => normalizeCanvaContent(props.content),
    [props.content]
  )

  const extensions = useMemo(
    () =>
      buildCanvaExtensions({
        activity: props.activity,
        courseUuid: props.courseUuid,
        orgUuid: props.orgUuid,
        isEditable,
      }),
    [props.activity, props.courseUuid, props.orgUuid]
  )

  const editor: any = useEditor({
    immediatelyRender: false,
    editable: isEditable,
    extensions,
    content: normalizedContent,
  })

  return (
    <EditorOptionsProvider options={{ isEditable: false }}>
      <div className="w-full mx-auto">
        <AICanvaToolkit activity={props.activity} editor={editor} />
        <div className="canva-content-wrapper">
          {!props.hideTableOfContents && <TableOfContents editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    </EditorOptionsProvider>
  )
}

export default Canva
