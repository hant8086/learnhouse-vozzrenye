import { default as React } from 'react'
import { Metadata } from 'next'
import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext'
import AIEditorProvider from '@components/Contexts/AI/AIEditorContext'
import ArticleEditorLoader from '@components/Objects/Editor/ArticleEditorLoader'

export const metadata: Metadata = {
  title: 'Edit Article',
  description: 'Edit standalone article content',
}

const EditArticle = async (params: any) => {
  const articleuuid = (await params.params).articleuuid

  return (
    <EditorOptionsProvider options={{ isEditable: true }}>
      <AIEditorProvider>
        <ArticleEditorLoader articleuuid={articleuuid} />
      </AIEditorProvider>
    </EditorOptionsProvider>
  )
}

export default EditArticle
