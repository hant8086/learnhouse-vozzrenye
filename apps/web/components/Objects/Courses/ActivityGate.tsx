'use client'

import { useTranslation } from 'react-i18next'
import { getUriWithOrg } from '@services/config/config'
import AccessGate from '@components/Objects/Access/AccessGate'

interface ActivityGateProps {
  activity: any | null
  activityid: string
  courseuuid: string
  orgslug: string
  isAuthenticated: boolean
}

export default function ActivityGate({
  activity,
  activityid,
  courseuuid,
  orgslug,
  isAuthenticated,
}: ActivityGateProps) {
  const { t } = useTranslation()
  const cleanActivityId = activity?.activity_uuid?.replace('activity_', '') || activityid.replace('activity_', '')
  const signInPath = `/course/${courseuuid}/activity/${cleanActivityId}`

  return (
    <AccessGate
      title={activity?.name || t('course.locked_title', 'This activity is locked')}
      orgslug={orgslug}
      isAuthenticated={isAuthenticated}
      signInPath={signInPath}
      backHref={`${getUriWithOrg(orgslug, '')}/course/${courseuuid}`}
      backLabel={t('course.back_to_course', 'Back to course')}
      backButton
      copy={{
        signInLabel: t('course.gate_signin_label', 'MEMBERS / SIGN IN TO READ'),
        paidLabel: t('course.gate_paid_label', 'PRO / PAID ACCESS'),
        signInTitle: t('course.gate_signin_title', "There's more to this lesson"),
        signInBody: t(
          'course.gate_signin_body',
          "This lesson is open to platform readers. Sign in — it's free and takes less than a minute."
        ),
        restrictedTitle: t('course.gate_restricted_title', 'Continue with this lesson'),
        restrictedBody: t(
          'course.gate_restricted_body',
          'This lesson is part of a paid course. Browse the catalog to find the access option that unlocks it.'
        ),
        offerEyebrow: t('course.gate_offer_eyebrow', 'How to get access'),
        offerBody: t(
          'course.gate_offer_body',
          'Course access unlocks this lesson and the rest of the course.'
        ),
        offerCta: t('course.gate_offer_cta', 'Browse courses'),
        signInCta: t('auth.sign_in', 'Sign in'),
      }}
    />
  )
}
