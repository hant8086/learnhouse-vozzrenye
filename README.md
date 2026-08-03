# Vozzrenye Platform — a fork of LearnHouse

This repository is the **Vozzrenye team's modified fork of [LearnHouse](https://github.com/learnhouse/learnhouse)**. It provides the content-platform layer of **Vozzrenye / Хранитель Воззрения** — an EdTech product delivered over Telegram and the Web.

The platform hosts our learning content — tracks, courses, lessons, media, and tiered public/free/paid access — and is adapted and re-branded for Vozzrenye. It runs as a standalone service alongside the rest of the product (bot, core services), which live in separate repositories.

> Deployment, build, and infrastructure specifics are intentionally not documented here; this repository is the application source.

## Capabilities (inherited from LearnHouse)

📖 Courses · ✏️ Block-based content editor · 📦 Collections · 📝 Assignments · 💬 Discussions · 🎙️ Podcasts · 📊 Analytics · 💻 Code execution · 🧠 AI · 🎓 Certificates · 👥 User groups · 🔍 SEO · 🎨 Custom branding.

Built with Next.js / React (web), FastAPI / Python (API), and a Hocuspocus real-time collaboration server, on PostgreSQL + Redis.

## Upstream & attribution

Based on **LearnHouse** — an open-source learning platform by Sweave (Badr B., [@swve](https://github.com/swve)) and its contributors.

- Upstream project: https://github.com/learnhouse/learnhouse
- This fork tracks upstream releases and applies Vozzrenye-specific modifications on top.

*LearnHouse and its logos are trademarks of their respective owners. This fork is an independent, modified version and is not affiliated with, sponsored by, or endorsed by the LearnHouse project.*

## License (AGPL-3.0) & modifications

This project is a **modified version of LearnHouse** and, like the original, is licensed under the **GNU Affero General Public License, version 3 (AGPL-3.0)**. See [LICENSE](LICENSE) for the full text.

In accordance with the AGPL:

- **Modified version.** This is a modified fork of LearnHouse. Modifications by the Vozzrenye team are ongoing since **August 2026**.
- **Source availability (§13).** This platform is operated as a network service. The complete corresponding source of the modified version running there is made available in this repository, licensed under AGPL-3.0.
- **Same license.** All modifications inherit AGPL-3.0; the work as a whole is distributed under the same terms.
- Original copyright and license notices from LearnHouse are retained.

If you interact with a running instance of this platform and want the corresponding source, it is this repository.
