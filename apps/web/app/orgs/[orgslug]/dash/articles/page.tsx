import { getOrganizationContextInfo } from '@services/organizations/orgs'
import { Metadata } from 'next'
import React from 'react'
import ArticlesHome from './client'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 120,
    tags: ['organizations'],
  })

  return {
    title: 'Articles — ' + org.name,
    description: org.description,
    robots: {
      index: false,
      follow: false,
    },
  }
}

async function ArticlesPage(props: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await props.params
  return <ArticlesHome orgslug={orgslug} />
}

export default ArticlesPage