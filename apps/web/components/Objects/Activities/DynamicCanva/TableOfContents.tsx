import { useEffect, useState } from 'react'
import { Editor } from '@tiptap/react'
import { Check } from 'lucide-react'

interface TableOfContentsProps {
  editor: Editor | null
}

interface HeadingItem {
  level: number
  text: string
  id: string
  position: number
}


const TableOfContents = ({ editor }: TableOfContentsProps) => {
  const [headings, setHeadings] = useState<HeadingItem[]>([])

  useEffect(() => {
    if (!editor) return

    const updateHeadings = () => {
      const items: HeadingItem[] = []
      editor.state.doc.descendants((node, position) => {
        if (node.type.name.startsWith('heading')) {
          const level = node.attrs.level || 1
          // Match the actual rendered ID, including Cyrillic-only headings.
          const element = editor.view.nodeDOM(position)
          if (!(element instanceof HTMLElement) || !element.id) return
          const id = element.id

          items.push({
            level,
            text: node.textContent,
            id,
            position,
          })
        }
      })
      setHeadings(items)
    }

    editor.on('update', updateHeadings)
    updateHeadings()

    return () => {
      editor.off('update', updateHeadings)
    }
  }, [editor])

  if (headings.length === 0) return null

  return (
    <div className="vz-lesson-toc w-full bg-none border-none shadow-none p-0 m-0 font-[inherit] flex flex-col items-stretch h-fit">
      <ul className="!list-none !p-0 m-0">
        {headings.map((heading) => (
          <li
            key={heading.position}
            className="toc-item my-2 !list-none flex items-start gap-2"
            style={{ paddingLeft: `${(heading.level - 1) * 1.2}rem` }}
          >
            <span className="toc-check" aria-hidden="true"><Check size={15} strokeWidth={1.7} /></span>
            <a className={`toc-link toc-link-h${heading.level}`} href={`#${heading.id}`} onClick={(event) => {
              // Document positions also distinguish repeated heading titles.
              const element = editor?.view.nodeDOM(heading.position)
              if (!(element instanceof HTMLElement)) return
              event.preventDefault()
              element.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
              element.setAttribute('tabindex', '-1')
              element.focus({ preventScroll: true })
            }}>{heading.text}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TableOfContents
