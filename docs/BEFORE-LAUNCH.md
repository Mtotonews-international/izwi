# Before any real child joins

The software enforces rules. It does not replace people, policy or the law. Do not open Izwi to children until every line here has an owner and a date.

## Legal and policy
- [ ] Register Mtoto News as a data controller with the Office of the Data Protection Commissioner (Kenya). Check the rules for each other country before opening there.
- [ ] Carry out a data protection impact assessment.
- [ ] Write the privacy notice and the terms in language a 13 year old understands. A lawyer approves them.
- [ ] Confirm the wording of the consent message to guardians (`server/routes.js`, `/consent/request`) and of the "Your work and your information" page (`WORKINFO` in `public/content.js`). Both make promises: the work stays the member's, data is not sold, the account can be deleted.
- [ ] Decide how long data is kept, and build account deletion on request.
- [ ] Decide whether 18 year olds stay in the same space as 13 year olds.
- [ ] Define "Community" as an audience. Today it means members in the same country.

## Safeguarding
- [ ] Name the safeguarding lead and a deputy.
- [ ] Write the escalation procedure: what a moderator does when a child may be at risk, who is called, within what time, and when Child Helpline 116 or the police are involved.
- [ ] Build the safeguarding lead's page for escalated items, or agree a manual process until it exists.
- [ ] Vet every teacher, group leader and moderator before their account is created.
- [ ] Train moderators. Agree working hours and what members are told when nobody is reviewing.
- [ ] Agree with each school how a teacher handles an "asked to talk" request.
- [ ] Have children test the rules, safety lessons and Help pages, and rewrite what they do not understand.

## Technical
- [ ] Run on HTTPS only, with `NODE_ENV=production`.
- [ ] Set up a real SMS provider and test it with a real phone. The Africa's Talking code in `server/sms.js` has not been tested against a live account.
- [ ] Back up the `data` folder every day and practise restoring it.
- [ ] Encrypt the server disk. Guardian phone numbers are stored in the database as plain text.
- [ ] Have someone outside the team test the security.
- [ ] Add the moderation team's list of harmful words in English, Swahili and Sheng to `server/filter.js`.
- [ ] Decide the upload size limit for low-data users and add compression for audio and video.
- [ ] Host the two fonts yourself so pages load without calling Google.

## Content
- [ ] Have Toto Kreatives trainers review every lesson. The lessons in `public/content.js` are first drafts.
- [ ] Check the licence of each outside module linked from the lessons. They are linked, not copied.
- [ ] Review the recommended books for each age band.
