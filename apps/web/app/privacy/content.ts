import type { LegalContent } from '@components/Legal/LegalDocument'
import { CONTACT_EMAIL, OPERATOR_NAME, SERVICE_DOMAIN } from '@components/Legal/legalConfig'

/**
 * Privacy policy copy.
 *
 * Every factual claim here was checked against this codebase and the running
 * deployment rather than written from a template:
 *
 * - account and security fields — `apps/api/src/db/users.py`
 * - audit records (IP, user agent, append-only) — `apps/api/src/db/user_audit_events.py`
 * - password hashing (Argon2) — `apps/api/src/security/security.py`
 * - Google scopes (`openid email profile`) — `app/api/auth/google/authorize/route.ts`
 * - AI off, telemetry off, files on local disk — deployment env on the host
 * - no analytics keys reach the browser — served `/runtime-config.js`
 *
 * If any of those change, this file changes with them. A privacy policy that
 * drifts from the system it describes is worse than none: Google's OAuth
 * review checks that the policy matches actual behaviour.
 */

export const privacyRu: LegalContent = {
  title: 'Политика конфиденциальности',
  intro: `Документ описывает, какие персональные данные обрабатывает образовательная платформа ${SERVICE_DOMAIN}, зачем, на каком основании и как долго. Мы описываем систему такой, какая она есть сейчас, а не такой, какой она могла бы быть.`,
  sections: [
    {
      id: 'controller',
      heading: 'Кто обрабатывает данные',
      body: [
        `Оператором персональных данных выступает ${OPERATOR_NAME} — владелец и администратор платформы ${SERVICE_DOMAIN}.`,
        `По любым вопросам об обработке данных и для реализации своих прав пишите на ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'data',
      heading: 'Какие данные мы собираем',
      body: [
        'Данные учётной записи, которые вы указываете сами:',
        {
          list: [
            'имя пользователя, имя и фамилия, адрес электронной почты;',
            'пароль — хранится только в виде хеша Argon2, восстановить его невозможно;',
            'по желанию: аватар, краткое описание профиля и ответы на дополнительные поля регистрации, если администратор их настроил.',
          ],
        },
        'Данные безопасности, которые система формирует сама:',
        {
          list: [
            'подтверждение почты, дата последней смены пароля, способ регистрации (пароль или Google);',
            'число неудачных попыток входа и время блокировки — это защита от подбора пароля;',
            'дата и IP-адрес последнего входа.',
          ],
        },
        'Данные об обучении: пройденные курсы и активности, прогресс, сданные задания и оценки, полученные сертификаты, сообщения в обсуждениях.',
        'Журнал действий: платформа ведёт неизменяемый журнал значимых событий (вход и выход, отправка задания, выставление оценки, выдача сертификата). В нём сохраняются тип события, время, IP-адрес и строка User-Agent браузера.',
      ],
    },
    {
      id: 'google',
      heading: 'Вход через Google',
      body: [
        'Если вы входите через Google, мы запрашиваем только три базовых разрешения: openid, email и profile. Мы не запрашиваем доступ к Gmail, Google Диску, Календарю, контактам или любым другим сервисам Google.',
        'От Google мы получаем идентификатор аккаунта, адрес электронной почты, имя и ссылку на фотографию профиля.',
        'Эти данные используются исключительно для того, чтобы создать вашу учётную запись на платформе и опознавать вас при последующих входах. Они хранятся в той же базе, что и остальные данные аккаунта.',
        'Использование данных, полученных из Google API, соответствует Политике Google API Services User Data, включая требования Limited Use. Мы не передаём эти данные рекламным платформам, брокерам данных и любым перепродавцам информации и не используем их для показа рекламы, ретаргетинга или профилирования в рекламных целях.',
        'Отозвать доступ можно в любой момент в настройках вашего аккаунта Google. После отзыва вход через Google перестанет работать, но сама учётная запись на платформе сохранится.',
      ],
    },
    {
      id: 'purpose',
      heading: 'Зачем мы это делаем',
      body: [
        {
          list: [
            'предоставить доступ к платформе и учебным материалам — это исполнение договора с вами;',
            'подтверждать личность, защищать аккаунт от взлома и расследовать инциденты — наш законный интерес в безопасности сервиса;',
            'вести подтверждаемую историю обучения, чтобы оценки и сертификаты имели силу;',
            'отвечать на ваши обращения.',
          ],
        },
        'Мы не используем ваши данные для рекламы, не строим рекламные профили и не продаём и не передаём данные третьим лицам для их собственных целей.',
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookie',
      body: [
        'Платформа использует только технически необходимые cookie: сессионную cookie, которая держит вас в системе, и cookie защиты от межсайтовой подделки запросов (CSRF).',
        'Рекламных и аналитических cookie нет. Мы не подключаем внешние системы веб-аналитики и не отслеживаем вас на других сайтах.',
      ],
    },
    {
      id: 'third-parties',
      heading: 'Кому мы передаём данные',
      body: [
        'В текущей конфигурации платформа не передаёт персональные данные сторонним обработчикам. Функции искусственного интеллекта, внешняя телеметрия и системы веб-аналитики отключены, платёжный провайдер не подключён, файлы хранятся на диске нашего сервера, а не во внешнем облаке.',
        'Единственный внешний участник — Google, и только если вы сами выбрали вход через Google.',
        'Мы раскроем данные, если этого потребует закон или это будет необходимо для защиты прав, безопасности и целостности сервиса.',
        'Если в будущем мы подключим внешнего обработчика, эта страница будет обновлена до того, как обработка начнётся.',
      ],
    },
    {
      id: 'storage',
      heading: 'Где хранятся данные',
      body: [
        'Данные размещаются на серверах, которые мы контролируем, в дата-центре Hetzner в городе Фалькенштайн, Германия (Европейский союз).',
        'Передача между вашим браузером и платформой всегда защищена TLS.',
      ],
    },
    {
      id: 'retention',
      heading: 'Сколько мы храним данные',
      body: [
        'Данные учётной записи и учебные материалы хранятся, пока существует ваша учётная запись.',
        'Важное исключение, о котором стоит знать: журнал действий устроен как неизменяемая запись — строки в него только добавляются и не изменяются и не удаляются. Он служит подтверждением истории обучения, поэтому при удалении аккаунта связанные с ним записи журнала сохраняются, но перестают быть привязаны к вашему профилю.',
      ],
    },
    {
      id: 'rights',
      heading: 'Ваши права',
      body: [
        'Вы вправе:',
        {
          list: [
            'получить копию своих данных и узнать, как они обрабатываются;',
            'исправить неточные данные — большую часть можно изменить прямо в настройках профиля;',
            'потребовать удаления учётной записи с учётом оговорки о журнале действий выше;',
            'возразить против обработки или потребовать её ограничения;',
            'подать жалобу в надзорный орган по защите данных.',
          ],
        },
        `Чтобы воспользоваться любым из этих прав, напишите на ${CONTACT_EMAIL}. Мы ответим в разумный срок, но не позднее одного месяца.`,
      ],
    },
    {
      id: 'security',
      heading: 'Безопасность',
      body: [
        'Пароли хранятся в виде хешей Argon2. Весь трафик идёт по HTTPS. После серии неудачных попыток входа аккаунт временно блокируется. Служебные порты базы данных и внутренних сервисов недоступны из интернета.',
        'Ни одна система не защищена абсолютно, поэтому используйте уникальный пароль и сообщайте нам о подозрительной активности.',
      ],
    },
    {
      id: 'children',
      heading: 'Дети',
      body: [
        'Платформа не предназначена для детей младше 16 лет, и мы сознательно не собираем их данные. Если такие данные попали к нам, напишите нам, и мы их удалим.',
      ],
    },
    {
      id: 'changes',
      heading: 'Изменения политики',
      body: [
        'При изменении политики мы обновляем дату в начале страницы. О существенных изменениях мы сообщим на платформе до того, как они вступят в силу.',
      ],
    },
  ],
}

export const privacyEn: LegalContent = {
  title: 'Privacy Policy',
  intro: `This document explains what personal data the ${SERVICE_DOMAIN} learning platform processes, why, on what basis, and for how long. It describes the system as it actually runs today, not as a template imagines it.`,
  sections: [
    {
      id: 'controller',
      heading: 'Who processes your data',
      body: [
        `${OPERATOR_NAME} operates the ${SERVICE_DOMAIN} platform and acts as the data controller.`,
        `For any question about how your data is handled, or to exercise your rights, write to ${CONTACT_EMAIL}.`,
      ],
    },
    {
      id: 'data',
      heading: 'What we collect',
      body: [
        'Account data you provide:',
        {
          list: [
            'username, first and last name, email address;',
            'your password, stored only as an Argon2 hash and never recoverable;',
            'optionally an avatar, a short profile bio, and answers to any additional signup fields your administrator has configured.',
          ],
        },
        'Security data the system generates:',
        {
          list: [
            'email verification status, date of last password change, signup method (password or Google);',
            'failed login attempt count and lockout time, which exist to stop password guessing;',
            'the time and IP address of your last sign-in.',
          ],
        },
        'Learning data: courses and activities you open, your progress, assignment submissions and grades, certificates you earn, and messages you post in discussions.',
        'Audit records: the platform keeps an append-only record of significant events (sign-in and sign-out, assignment submission, grading, certificate issuance). Each entry stores the event type, timestamp, IP address and browser User-Agent string.',
      ],
    },
    {
      id: 'google',
      heading: 'Signing in with Google',
      body: [
        'If you sign in with Google, we request only three basic scopes: openid, email and profile. We do not request access to Gmail, Google Drive, Calendar, contacts, or any other Google service.',
        'From Google we receive your account identifier, email address, name and profile picture URL.',
        'We use this solely to create your platform account and to recognise you on later sign-ins. It is stored in the same database as the rest of your account data.',
        "Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not transfer this data to advertising platforms, data brokers or information resellers, and we do not use it for serving ads, retargeting, or personalised or interest-based advertising.",
        'You can revoke our access at any time from your Google account settings. Doing so disables Google sign-in but leaves your platform account intact.',
      ],
    },
    {
      id: 'purpose',
      heading: 'Why we process it',
      body: [
        {
          list: [
            'to give you access to the platform and its learning material — performance of our agreement with you;',
            'to verify identity, protect accounts against compromise and investigate incidents — our legitimate interest in keeping the service secure;',
            'to keep a verifiable record of learning so that grades and certificates mean something;',
            'to answer your enquiries.',
          ],
        },
        'We do not use your data for advertising, we do not build advertising profiles, and we do not sell or share your data with third parties for their own purposes.',
      ],
    },
    {
      id: 'cookies',
      heading: 'Cookies',
      body: [
        'The platform sets only strictly necessary cookies: a session cookie that keeps you signed in, and a cookie that protects against cross-site request forgery.',
        'There are no advertising or analytics cookies. We do not embed third-party web analytics and we do not track you across other sites.',
      ],
    },
    {
      id: 'third-parties',
      heading: 'Who we share data with',
      body: [
        'As currently configured, the platform shares no personal data with third-party processors. AI features, external telemetry and web analytics are switched off, no payment provider is connected, and uploaded files are stored on our own server disk rather than in external cloud storage.',
        'The only external party involved is Google, and only if you choose to sign in with Google.',
        'We will disclose data where the law requires it, or where it is necessary to protect the rights, safety and integrity of the service.',
        'If we ever add an external processor, this page will be updated before that processing begins.',
      ],
    },
    {
      id: 'storage',
      heading: 'Where data is stored',
      body: [
        'Data is held on servers we control, in the Hetzner data centre in Falkenstein, Germany (European Union).',
        'Traffic between your browser and the platform is always protected with TLS.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      body: [
        'Account data and learning material are kept for as long as your account exists.',
        'One exception is worth stating plainly: the audit record is append-only by design — rows are added but never modified or deleted. It exists to make the learning history verifiable, so when an account is deleted its audit entries survive but are no longer tied to your profile.',
      ],
    },
    {
      id: 'rights',
      heading: 'Your rights',
      body: [
        'You have the right to:',
        {
          list: [
            'obtain a copy of your data and learn how it is processed;',
            'correct inaccurate data — most of it you can edit yourself in your profile settings;',
            'request deletion of your account, subject to the audit-record caveat above;',
            'object to processing, or ask that it be restricted;',
            'lodge a complaint with a data protection supervisory authority.',
          ],
        },
        `To exercise any of these, write to ${CONTACT_EMAIL}. We will respond within a reasonable period and no later than one month.`,
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      body: [
        'Passwords are stored as Argon2 hashes. All traffic runs over HTTPS. Accounts are temporarily locked after repeated failed sign-in attempts. Database and internal service ports are not reachable from the internet.',
        'No system is perfectly secure, so please use a unique password and tell us about anything that looks wrong.',
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      body: [
        'The platform is not intended for children under 16 and we do not knowingly collect their data. If such data has reached us, contact us and we will remove it.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      body: [
        'When this policy changes we update the date at the top of the page. We will announce material changes on the platform before they take effect.',
      ],
    },
  ],
}
