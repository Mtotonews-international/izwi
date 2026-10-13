# Izwi

A safe space where children and young people learn creative skills, share what they make and work together on causes. Built for Mtoto News.

This is version 0.1: a working web application with real accounts, a database, file uploads and a moderation queue. It runs on one computer or one small server. It is ready for the team to run, test and improve. It is **not** ready for real children until the checklist in `docs/BEFORE-LAUNCH.md` is done.

## Run it on your computer

You need [Node.js](https://nodejs.org) version 20 or newer.

```bash
npm install          # once
npm run seed         # optional: adds sample people and content to an empty database
npm start            # then open http://localhost:3000
```

Sample accounts after `npm run seed`:

| Who | Sign in with | Secret |
|---|---|---|
| Moderator | mod@izwi.test | moderator-pass |
| Teacher | teacher@izwi.test | teacher-pass |
| Members | niko hapa, ule msee, amai a, zuri t, omar h | secret-word |

The sample school group code is `DEMO-2026`. Use it to join as a new member.

To try the guardian step: join as a new member, enter any phone number as the guardian, then open the site in a private window, choose **I am an adult**, then **Parent or guardian**, and sign in with the same number. In development the code is shown on the screen and printed in the terminal. On the live site it goes by SMS.

To start again from nothing, stop the server and delete the `data` folder.

Run the automated checks with `npm test`. They cover the rules that keep children safe. Run them before every release.

## Who can do what

| Person | How they sign in | What they can do |
|---|---|---|
| Member, 13 to 15 | Nickname and secret word | Learn. Post only after guardian consent and teacher confirmation. Three preset reactions. A new cause needs a co-sign. No campaign messages |
| Member, 16 to 18 | Nickname and secret word | The same, plus written feedback, campaign messages, a portfolio and starting causes directly. At 18 they give their own consent |
| Guardian | Phone number and a code by SMS | Give or withdraw consent. See what the child made. Allow or block sharing beyond the school. Co-sign causes for a child who joined alone |
| Teacher or group leader | Email and password | Confirm members who used the group code. Approve group messages. Co-sign causes. See progress. Receive "asked to talk" requests, without the reason |
| Moderator | Email and password | Approve, send back or escalate everything members make. Create groups and their leaders. Mark causes as won. Read the activity log |

Three ways to join: with a school code, with a community group code, or alone. A member who joins alone goes into the Izwi open group, which moderators look after.

## The rules the server enforces

All of these live in `server/routes.js` and `server/state.js`. The browser cannot get round them.

- Ages 13 to 18 only. The age band is worked out from the year of birth.
- Nothing a member makes is shown to anyone until an adult has approved it. Group messages go to the teacher or leader. Everything else goes to a moderator.
- A member cannot post without guardian consent. If consent is withdrawn, everything that member made is hidden from others at once.
- On the school and community routes a member sees and posts nothing in the group until the teacher or leader confirms them.
- Work is shown only to the audiences the member chose. "Community" and "Toto Verse" need the guardian's permission.
- A skill's lessons must be finished before creating in that format. Quiz answers are checked on the server.
- Uploaded files are private. A file opens only for people allowed to see the item it belongs to.
- There are no private messages anywhere.
- Phone numbers, social media handles and unkind words are flagged for the moderator. A flag never approves or blocks anything by itself.
- Every action by a teacher, guardian or moderator is written to the activity log.

## Where things are

```
public/content.js   All the words: skills, lessons, quiz questions, rules, safety topics. Edit lessons here
public/app.js       The browser app. It draws what the server sends and reports each tap
public/app.css      Colours, type and layout. Each space has its own colour
public/index.html   The single page
server/index.js     Starts the server and sets the security headers
server/routes.js    Every action: join, sign in, learn, create, causes, help, moderation
server/state.js     What each person is allowed to see
server/auth.js      Sessions, roles, age bands, rate limits
server/db.js        The database tables
server/filter.js    The word and phone-number filter
server/sms.js       Sending SMS to guardians
scripts/            create-moderator and seed-demo
test/api.test.js    Automated safety checks
docs/               Launch checklist and deployment notes
```

How a tap travels: the browser sends it to `/api/...`, the server checks who is asking and changes the database, then the browser asks `/api/state` again and redraws. There is one state call per role, so the browser never holds anything the person may not see.

## Common jobs

**Change a lesson or add a quiz question.** Edit `public/content.js`. Each lesson is `[title, text, question, [answers], number of the right answer]`. Each lesson has one question today. The format allows only one, so adding five per lesson means a small change in `routes.js` (`/learn`) and `app.js` (`learn`).

**Add a skill.** Add an entry to `T` and an emoji to `EMOJI` in `public/content.js`.

**Create the first moderator on a new server.**

```bash
npm run create-moderator -- you@mtotonews.com "Your Name" "a long password"
```

**Create a school or group.** Sign in as a moderator, open **Groups**, fill in the form. The code appears in the list. Give the teacher their email and first password in person.

**Add a word to the filter.** Edit the list in `server/filter.js`.

## What is not built yet

- Recording and editing video inside the app. Audio recording works for podcasts. Other formats are uploaded.
- Five quiz questions per lesson. There is one.
- The weekly SMS summary for guardians. The on and off switch is stored, but nothing sends the summary.
- Lessons over SMS for basic phones.
- Password reset. A moderator has to help for now.
- A page for the safeguarding lead. Escalated items are stored and counted, but there is no screen to work through them.
- Shareable portfolio links and verified credentials for 16 to 18 year olds.
- Translation. All text is English.
- Automatic checking of pictures, audio and video. A person reviews every upload.

See `docs/BEFORE-LAUNCH.md` for what must happen before real children join, and `docs/DEPLOY.md` for putting it on a server.
