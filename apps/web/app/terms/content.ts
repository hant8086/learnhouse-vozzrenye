import type { LegalContent } from '@components/Legal/LegalDocument'
import {
  BRAND_NAMES,
  CONTACT_EMAIL,
  GOVERNING_LAW,
  OPEN_CONTENT_LICENSE,
  OPEN_CONTENT_LICENSE_URL,
  OPERATOR_NAME,
  SERVICE_DOMAIN,
} from '@components/Legal/legalConfig'

const brandsRu = BRAND_NAMES.map((n) => '«' + n + '»').join(', ')
const brandsEn = BRAND_NAMES.map((n) => '“' + n + '”').join(', ')

/**
 * Terms of service copy.
 *
 * The open-source section is not boilerplate: this platform is a fork of
 * LearnHouse, which is licensed under the AGPL-3.0. Section 13 of that licence
 * requires that users interacting with the software over a network be offered
 * the corresponding source, so the offer belongs in the terms users actually
 * see.
 *
 * `GOVERNING_LAW` is intentionally allowed to be empty — the section is
 * omitted rather than naming a jurisdiction nobody chose.
 */

const governingLawRu: LegalContent['sections'] = GOVERNING_LAW
  ? [
      {
        id: 'law',
        heading: 'Применимое право',
        body: [
          `К настоящим Условиям применяется право юрисдикции: ${GOVERNING_LAW}. Споры, которые не удалось решить перепиской, рассматриваются судами этой юрисдикции.`,
        ],
      },
    ]
  : []

const governingLawEn: LegalContent['sections'] = GOVERNING_LAW
  ? [
      {
        id: 'law',
        heading: 'Governing law',
        body: [
          `These Terms are governed by the law of ${GOVERNING_LAW}. Disputes that cannot be resolved by correspondence fall to the courts of that jurisdiction.`,
        ],
      },
    ]
  : []

export const termsRu: LegalContent = {
  title: 'Условия использования',
  intro: `Условия регулируют использование образовательной платформы ${SERVICE_DOMAIN}. Создавая учётную запись или пользуясь платформой, вы соглашаетесь с ними.`,
  sections: [
    {
      id: 'service',
      heading: 'Что такое платформа',
      body: [
        `${SERVICE_DOMAIN} — образовательная платформа: на ней размещаются курсы и учебные материалы, отслеживается прогресс обучения, выполняются задания, ведутся обсуждения и выдаются сертификаты.`,
        'Доступ к части материалов может быть открытым, к части — только после входа в систему или по приглашению администратора.',
      ],
    },
    {
      id: 'account',
      heading: 'Учётная запись: когда она нужна',
      body: [
        'Учётная запись нужна не всегда. Объём того, что вы сообщаете о себе, определяется тем, к какому материалу вы обращаетесь.',
        {
          list: [
            'Открытый материал: просмотр не требует ни регистрации, ни входа, ни сообщения каких-либо личных данных. Достаточно открыть страницу.',
            'Материал, доступный после входа: нужна учётная запись, то есть адрес электронной почты и пароль — либо вход через Google. С этого момента ваши действия связываются с вашим профилем: прогресс, сданные задания, оценки.',
            'Платный материал: помимо учётной записи потребуются данные, необходимые для оформления и подтверждения оплаты.',
          ],
        },
        'Иными словами, личные данные запрашиваются ровно тогда, когда без них нельзя опознать, кому принадлежит доступ, прогресс или оплата, — и не раньше.',
        'Если учётная запись у вас есть, вы обязуетесь указывать достоверные данные и поддерживать их в актуальном состоянии.',
        'Вы отвечаете за сохранность пароля и за все действия, совершённые под вашей учётной записью. Заметив несанкционированный доступ, немедленно сообщите нам.',
        'Учётная запись личная. Передавать её другому лицу нельзя.',
        'Платформа не предназначена для лиц младше 16 лет.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Допустимое использование',
      body: [
        'Пользуясь платформой, вы обязуетесь не:',
        {
          list: [
            'нарушать закон и права других людей;',
            'пытаться получить доступ к чужим учётным записям, данным или служебным частям системы;',
            'нарушать работу платформы, создавать чрезмерную нагрузку, обходить ограничения доступа и меры безопасности;',
            'массово выгружать материалы, не помеченные как открытые, копировать и распространять их без разрешения правообладателя (к открытым материалам это не относится — их можно использовать на условиях их лицензии);',
            'размещать вредоносный код, спам, а также оскорбительные или незаконные материалы;',
            'выдавать себя за другого человека или организацию.',
          ],
        },
      ],
    },
    {
      id: 'content',
      heading: 'Материалы, лицензии и название',
      body: [
        'Здесь сходятся три разных вещи, и их важно не смешивать: программа, на которой работает платформа; учебные материалы, размещённые на ней; и название проекта. Каждая живёт по своим правилам.',
        'Программа — свободная, под AGPL-3.0. Об этом отдельный раздел ниже.',
        `Открытые материалы. Материал, явно помеченный как открытый, публикуется на условиях ${OPEN_CONTENT_LICENSE} (${OPEN_CONTENT_LICENSE_URL}). Его можно свободно читать, копировать, переводить, перерабатывать и распространять, в том числе в коммерческих целях, при трёх условиях:`,
        {
          list: [
            'указать источник — название проекта и ссылку на оригинал;',
            'отметить, что вы внесли изменения, если вы их вносили;',
            'распространять производный материал на тех же условиях, не закрывая его.',
          ],
        },
        'Всё остальное. Материал, не помеченный как открытый, — платные курсы, материалы для участников, чужие работы — защищён полностью. Доступ к нему даётся вам для личного обучения и никаких прав не передаёт. Отсутствие пометки означает «все права защищены», а не разрешение: молчание разрешением не является.',
        `Название. ${brandsRu} — это наименования проекта. Ни AGPL, ни ${OPEN_CONTENT_LICENSE} прав на них не передают: свободные лицензии касаются кода и текстов, а не имени, под которым они выпущены.`,
        'Отсюда следует различие, которое обычно и вызывает путаницу. Назвать проект, чтобы указать на источник, не только можно, но и нужно — этого прямо требует условие об указании источника: «по материалам проекта Воззрение», «на основе Технологии Просветления», со ссылкой на оригинал. Это добросовестное упоминание, и оно ничем не ограничено.',
        'Чего делать нельзя — присваивать имя. Нельзя выдавать свой проект, курс, сообщество, сайт или продукт за Воззрение или Технологию Просветления, использовать эти названия как собственное имя, в названии домена или в качестве товарного знака, а также подавать своё изложение так, будто оно исходит от нас, одобрено или проверено нами. Проще говоря: ссылаться на источник — да, представляться источником — нет.',
        'Ваши материалы. Права на то, что загружаете или пишете вы — ответы на задания, сообщения в обсуждениях, файлы, — остаются вашими. Вы предоставляете нам ограниченное право хранить, воспроизводить и показывать их в объёме, необходимом для работы платформы: чтобы преподаватель увидел вашу работу, а система сохранила ваш прогресс. Публикуя материал под открытой лицензией, вы подтверждаете, что вправе это сделать.',
        'Вы отвечаете за то, что имеете право размещать всё, что размещаете.',
      ],
    },
    {
      id: 'records',
      heading: 'Оценки и сертификаты',
      body: [
        'Оценки, прогресс и сертификаты отражают фактически выполненную работу. Платформа ведёт неизменяемый журнал учебных событий, чтобы эти записи можно было подтвердить.',
        'Мы вправе аннулировать оценку или сертификат, полученные с нарушением правил — например, при списывании или подделке результатов.',
      ],
    },
    {
      id: 'open-source',
      heading: 'Открытый исходный код',
      body: [
        'Платформа построена на LearnHouse — свободном программном обеспечении под лицензией GNU Affero General Public License версии 3 (AGPL-3.0) — с нашими изменениями.',
        `В соответствии с разделом 13 AGPL-3.0 пользователи, взаимодействующие с программой по сети, имеют право получить соответствующий исходный код изменённой версии. Чтобы его получить, напишите на ${CONTACT_EMAIL}.`,
        'Лицензия распространяется на код платформы, но не на размещённые на ней учебные материалы, не на пользовательские данные и не на название проекта: раздел 7(e) AGPL-3.0 прямо позволяет не передавать права на наименования, и мы ими пользуемся.',
        'То есть форк платформы можно поднять свободно — это и есть смысл AGPL, — но он должен называться своим именем, а не нашим.',
      ],
    },
    {
      id: 'availability',
      heading: 'Доступность сервиса',
      body: [
        'Мы стремимся к бесперебойной работе платформы, но не гарантируем её. Возможны плановые работы, сбои и перерывы.',
        'Платформа предоставляется «как есть», без гарантий пригодности для конкретной цели. Мы не гарантируем, что материалы приведут к какому-либо определённому результату.',
        'Мы вправе изменять функциональность платформы, а также приостановить или прекратить её работу. О существенных изменениях мы предупредим заранее, насколько это возможно.',
      ],
    },
    {
      id: 'liability',
      heading: 'Ответственность',
      body: [
        'В пределах, допускаемых законом, мы не отвечаем за косвенные убытки, упущенную выгоду и утрату данных, возникшие в связи с использованием платформы.',
        'Настоящий пункт не ограничивает ответственность, которую по закону ограничить нельзя.',
        'Вы самостоятельно храните копии важных для вас материалов.',
      ],
    },
    {
      id: 'suspension',
      heading: 'Приостановка и прекращение доступа',
      body: [
        'Мы вправе приостановить или прекратить доступ к учётной записи при нарушении настоящих Условий, при угрозе безопасности платформы или по требованию закона. По возможности мы сообщим о причине.',
        `Вы вправе в любой момент прекратить пользоваться платформой и запросить удаление учётной записи, написав на ${CONTACT_EMAIL}. Порядок удаления и связанные с ним оговорки описаны в Политике конфиденциальности.`,
      ],
    },
    {
      id: 'privacy',
      heading: 'Персональные данные',
      body: [
        'Обработка персональных данных описана в Политике конфиденциальности, которая является неотъемлемой частью настоящих Условий.',
      ],
    },
    ...governingLawRu,
    {
      id: 'changes',
      heading: 'Изменения условий',
      body: [
        'Мы можем изменять настоящие Условия. Дата последнего изменения указана в начале страницы, о существенных изменениях мы сообщим на платформе. Продолжая пользоваться платформой после вступления изменений в силу, вы принимаете новую редакцию.',
      ],
    },
    {
      id: 'contact',
      heading: 'Связь с нами',
      body: [`Оператор платформы — ${OPERATOR_NAME}. Вопросы и обращения: ${CONTACT_EMAIL}.`],
    },
  ],
}

export const termsEn: LegalContent = {
  title: 'Terms of Service',
  intro: `These Terms govern your use of the ${SERVICE_DOMAIN} learning platform. By creating an account or using the platform, you agree to them.`,
  sections: [
    {
      id: 'service',
      heading: 'What the platform is',
      body: [
        `${SERVICE_DOMAIN} is a learning platform: it hosts courses and learning material, tracks progress, collects assignments, hosts discussions and issues certificates.`,
        'Some material may be openly accessible; other material requires you to sign in or to be invited by an administrator.',
      ],
    },
    {
      id: 'account',
      heading: 'When an account is needed',
      body: [
        'An account is not always required. How much you tell us about yourself depends on what you are reading.',
        {
          list: [
            'Open material: viewing it requires no registration, no sign-in and no personal details at all. Opening the page is enough.',
            'Material behind sign-in: this needs an account — an email address and a password, or Google sign-in. From that point your activity is tied to your profile: progress, submissions, grades.',
            'Paid material: beyond an account, this needs the details required to take and confirm payment.',
          ],
        },
        'In short, personal data is asked for exactly when it is needed to know whose access, whose progress or whose payment this is — and not before.',
        'If you do have an account, you agree to give accurate information and keep it current.',
        'You are responsible for keeping your password safe and for activity carried out under your account. Tell us immediately if you notice unauthorised access.',
        'Accounts are personal and may not be transferred to someone else.',
        'The platform is not intended for people under 16.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: 'Acceptable use',
      body: [
        'When using the platform, you agree not to:',
        {
          list: [
            'break the law or infringe anyone else’s rights;',
            'attempt to reach other people’s accounts or data, or the internal parts of the system;',
            'disrupt the platform, place excessive load on it, or circumvent access controls and security measures;',
            'bulk-download material not marked as open, or copy and redistribute it without the rightsholder’s permission (this does not apply to open material, which you may use on the terms of its licence);',
            'upload malware or spam, or post abusive or unlawful material;',
            'impersonate another person or organisation.',
          ],
        },
      ],
    },
    {
      id: 'content',
      heading: 'Material, licences and the name',
      body: [
        'Three separate things meet here and are worth keeping apart: the software the platform runs on, the learning material published on it, and the name of the project. Each is governed by its own rules.',
        'The software is free software under the AGPL-3.0. It has its own section below.',
        `Open material. Material explicitly marked as open is published under ${OPEN_CONTENT_LICENSE} (${OPEN_CONTENT_LICENSE_URL}). You may read, copy, translate, adapt and redistribute it, including commercially, on three conditions:`,
        {
          list: [
            'credit the source — name the project and link to the original;',
            'state that you made changes, if you made any;',
            'release adaptations on the same terms, without closing them off.',
          ],
        },
        'Everything else. Material not marked as open — paid courses, member-only material, other people’s work — is fully reserved. Access is granted for your own learning and transfers no rights. The absence of a mark means “all rights reserved”, not permission: silence is not a grant.',
        `The name. ${brandsEn} are the names of the project. Neither the AGPL nor ${OPEN_CONTENT_LICENSE} transfers any right in them: free licences cover code and text, not the name they were released under.`,
        'That produces a distinction which is usually where confusion starts. Naming the project in order to credit it is not merely allowed but required — the attribution condition asks for exactly that: “based on material from Vozzrenye”, “adapted from Технология Просветления”, with a link to the original. That is nominative use and nothing here restricts it.',
        'What you may not do is take the name. You may not present your own project, course, community, site or product as Vozzrenye or Технология Просветления, use those names as your own name, in a domain name or as a trademark, or present your account of the material as though it came from us, or were endorsed or checked by us. Put simply: cite the source, yes; pose as the source, no.',
        'Your own material. Rights in what you write or upload — assignment answers, discussion posts, files — remain yours. You grant us a limited right to store, reproduce and display it to the extent needed to operate the platform: so an instructor can see your work and the system can record your progress. If you publish material under the open licence, you confirm you are entitled to do so.',
        'You are responsible for having the right to post whatever you post.',
      ],
    },
    {
      id: 'records',
      heading: 'Grades and certificates',
      body: [
        'Grades, progress and certificates reflect work actually done. The platform keeps an append-only record of learning events so those results can be verified.',
        'We may revoke a grade or certificate obtained in breach of these Terms — for example through cheating or falsified results.',
      ],
    },
    {
      id: 'open-source',
      heading: 'Open source',
      body: [
        'This platform is built on LearnHouse, free software licensed under the GNU Affero General Public License version 3 (AGPL-3.0), together with our modifications.',
        `In line with section 13 of the AGPL-3.0, users interacting with the software over a network are entitled to receive the corresponding source of the modified version. To obtain it, write to ${CONTACT_EMAIL}.`,
        'The licence covers the platform software. It does not cover the learning material hosted on it, nor user data, nor the name of the project: section 7(e) of the AGPL-3.0 expressly permits declining to grant rights in names, and we rely on that.',
        'So you are free to stand up your own fork — that is what the AGPL is for — but it must run under its own name, not ours.',
      ],
    },
    {
      id: 'availability',
      heading: 'Availability',
      body: [
        'We aim to keep the platform running but do not guarantee uninterrupted service. Maintenance, faults and outages happen.',
        'The platform is provided “as is”, without warranty of fitness for a particular purpose. We do not warrant that the material will produce any particular outcome.',
        'We may change the platform’s functionality, and may suspend or discontinue it. Where material changes are planned, we will give notice as far as reasonably possible.',
      ],
    },
    {
      id: 'liability',
      heading: 'Liability',
      body: [
        'To the extent permitted by law, we are not liable for indirect loss, lost profits or lost data arising from your use of the platform.',
        'Nothing here limits liability that cannot lawfully be limited.',
        'Please keep your own copies of material that matters to you.',
      ],
    },
    {
      id: 'suspension',
      heading: 'Suspension and termination',
      body: [
        'We may suspend or terminate access where these Terms are breached, where the security of the platform is at risk, or where the law requires it. We will tell you the reason where we can.',
        `You may stop using the platform at any time and request deletion of your account by writing to ${CONTACT_EMAIL}. How deletion works, and its one caveat, is set out in the Privacy Policy.`,
      ],
    },
    {
      id: 'privacy',
      heading: 'Personal data',
      body: [
        'How we handle personal data is described in the Privacy Policy, which forms part of these Terms.',
      ],
    },
    ...governingLawEn,
    {
      id: 'changes',
      heading: 'Changes to these Terms',
      body: [
        'We may change these Terms. The date of the last change is shown at the top of the page, and we will announce material changes on the platform. Continuing to use the platform after changes take effect means you accept the new version.',
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      body: [`The platform is operated by ${OPERATOR_NAME}. Questions and requests: ${CONTACT_EMAIL}.`],
    },
  ],
}
