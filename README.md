# Aqlyon Digital Marketing — website

The aqlyondm.com website, built with [Eleventy](https://www.11ty.dev/). It includes a content manager ([Decap CMS](https://decapcms.org/)) at **`/admin`**.

## What you can edit at /admin

| Section | What it controls |
|---|---|
| **Blog posts** | Articles on `/blog` and the latest three on the home page. Turn on *Draft* to hide a post. |
| **Customer testimonials** | Quote cards on the home page (up to 6). The section stays hidden until you add one. |
| **Client logos** | The scrolling logo strip under the hero. A client without a logo shows their name instead. |
| **Event photos** | One gallery page per event at `/events/…`. The newest five events also appear on the home page. |
| **Site content → Home page text** | Hero headline, the 7 journey steps, service tiles, section headings and contact text. |
| **Site content → Contact details & social links** | Phone numbers, email, WhatsApp number and social links used across the site. |

Every save in `/admin` commits to the **`main`** branch on GitHub. Netlify then rebuilds the live site, which takes about a minute.

## Events with registration (/manage)

Upcoming events, registrations, badges and check-in use the same event module as the Aqlyon Career Discovery Centre site, branded as **Aqlyon Brand Management** (event pages, badges, invitation emails and WhatsApp messages). Manage them at **`/manage`**, which has its own password and is separate from `/admin`.

- **Create events:** name, summary, details, cover photo, date and time zone, in person (location and map link) or online (private joining link), free or paid, and a seat limit.
- **Registration form builder:** name, email and mobile are always asked. WhatsApp and country are on by default; education level and student/parent can be switched on. You can add any question type (choices, dropdowns, grids, ratings, file upload and more) or a ready-made question such as company name or job title.
- **Registrations:** search, approve or reject paid registrations, open WhatsApp to an attendee, import from Excel, and download to Excel.
- **Badges and check-in:** every attendee gets a QR badge. Scan it at the door from `/manage`, or send helpers a private `/checkin` link that needs no password.
- **WhatsApp lists, event reports and calendar invitations:** calendar invitations use an Apps Script mailer on a Gmail account; connect it from Event manager → Calendar invitations.
- **Event pages:** each event has a shareable page at `/events/<event-name>` with link previews. Upcoming events show on the home page (the section is hidden when there are none) and on `/events/`.

Event photo galleries from `/admin` now live at `/gallery/<event-name>/` and are listed on `/events/` below the upcoming events.

**One-time setup:** in Netlify, go to **Site configuration → Environment variables**, add `ADMIN_PASSWORD` (a long password for `/manage`), then redeploy. Event data is kept in Netlify Blobs, so there's no database to set up.

**Test it on your own computer:** run `npm run build`, then `ADMIN_PASSWORD=test123 npm run dev`, and open http://localhost:8888/manage. Test data is saved in `.data/`.

## Branches

- **`staging`**: all code and design changes land here first and get a Netlify preview.
- **`main`**: the live site. Code changes are merged from `staging` only after Nabeel approves them. Content edits made in `/admin` go straight to `main`.

## One-time setup

### 1. Connect the repo to Netlify
1. In Netlify, choose **Add new site → Import an existing project → GitHub** and pick `nabeelnarangoli/aqlyondm`.
2. Set the production branch to **`main`**. The build settings come from `netlify.toml` (`npm run build`, publish folder `_site`).
3. Under **Site configuration → Build & deploy → Branches and deploy contexts**, turn on branch deploys for **`staging`**.

### 2. Let the editor log in with GitHub
1. On GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**:
   - Homepage URL: your Netlify site address (for example `https://aqlyondm.netlify.app`)
   - Authorization callback URL: `https://api.netlify.com/auth/done`
2. Copy the **Client ID**, then create and copy a **Client secret**.
3. In Netlify, go to **Site configuration → Access & security → OAuth → Install provider → GitHub** and paste both values.
4. Open `https://<your-site>/admin/` and click **Login with GitHub**.

Anyone else who needs to edit content must be added as a collaborator on the GitHub repo.

### 3. Call-back form
The **Request a call back** form uses Netlify Forms. Submissions appear under **Netlify → Forms → callback**. To be emailed about each one, add an email notification in **Site configuration → Notifications → Emails and webhooks → Form submission notifications**.

### 4. Bring over the WordPress blog posts
1. In WordPress, go to **Tools → Export → Posts → Download Export File**.
2. Run:
   ```bash
   npm install
   npm run import:wordpress -- path/to/export.xml --download
   ```
   This creates one file per published post in `src/blog/posts/`. With `--download`, it also copies each featured image into `src/uploads/blog/`.
3. Check the posts in `/admin`, then commit them.

### 5. Switch the domain
Keep the WordPress site live until the new site has been checked. When it's ready, add `aqlyondm.com` under **Netlify → Domain management** and update the DNS records it shows you.

## Working on the code

```bash
npm install
npm start            # site at http://localhost:8080
npx decap-server     # in a second terminal, to use /admin locally without logging in
```

Project layout:

```
src/
  _data/home.json, site.json   editable text and contact details
  blog/posts/*.md              blog posts
  testimonials/*.md            testimonials
  clients/*.md                 client logos
  events/*.md                  event galleries
  uploads/                     images uploaded through /admin
  _includes/                   layouts and page sections
  assets/                      CSS, JavaScript, logos
  admin/                       content manager (config.yml defines the fields)
```
