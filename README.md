# AU0009 - AI Leadership (AI Strategy and Opportunity): resources page

One page with a drop-down for each of the 12 weeks. You add files by dropping them into a week folder and re-running the builder.

## Adding OneDrive links from the page (admin login)

1. Click **Admin** at the bottom right of the weeks list and log in.
2. The first time on each computer, the GitHub settings box opens. Enter your GitHub username, the repository name, and a GitHub access token (see below), then click **Test and save**.
3. Open a week and click **+ Add resource to Week N**. Paste the OneDrive share link. The type (PowerPoint, Word and so on) is filled in from the link. Add a title, then **Save**.
4. Learners see it within a minute or two. Use **Edit**, **Move up / Move down** and **Delete** on anything you added.

**In OneDrive:** Share, then Copy link. Set the link so learners can view it ("People in Blackpool and The Fylde College", or "Anyone with the link" if apprentices sign in with other accounts).

**Making the GitHub token (once):** GitHub, Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token.
- Repository access: *Only select repositories*, choose this site's repository
- Permissions: *Contents*, *Read and write*
- Pick an expiry date (for example, the end of February 2027 when the unit finishes)

The token is kept only in your browser on that computer. **Remove token** in GitHub settings deletes it.

**About the login:** the page has no server, so the login is only a gate that hides the admin buttons. The password is stored as a slow one-way hash rather than plain text, but nobody can save changes without your GitHub token, and that never leaves your browser. To change the password, ask Claude to regenerate the hash in `assets/app.js`.

Links you add are saved in `assets/links.js`. The files you drop in week folders still work too, and both appear together.

## Adding a week's files

1. Put the files in `weeks/week-02/` (or whichever week).
   - A `.pptx`, `.docx` or `.xlsx` **with a PDF of the same name** becomes one row: **View** opens the PDF, the second button downloads the original.
   - A PDF on its own gets a View button. Anything else (images, zip files and so on) gets a download button.
   - To control the order, start names with a number: `01-slides.pptx`, `02-learner-pack.docx`. The number is not shown on the page.
2. Double-click **Update page.bat** (Windows) or run `python build.py`.
3. Upload the whole folder to wherever the page is hosted (or just the changed week folder plus `assets/resources.js`).

## Changing week titles, dates, labels and links

Edit `weeks.json`, then run the builder again.

- `title`, `date` (YYYY-MM-DD) and `summary` for each week. The week whose date has most recently arrived opens automatically and is marked "This week".
- `files`: give a file a nicer label or a one-line description, keyed by its name without the extension:
  ```json
  "files": { "02-learner-pack": { "label": "Week 2 Learner Pack", "description": "Activities for Session 2" } }
  ```
  Without this, the label is made from the filename (`au0009-week-2-learner-pack` becomes "AU0009 Week 2 Learner Pack").
- `links`: add web links (Padlet, Forms, an AI tool) to a week:
  ```json
  "links": [ { "label": "Session 2 Padlet", "url": "https://padlet.com/...", "button": "Open" } ]
  ```
- `course`: the delivery line, share link, and QR image paths at the top of the page.

## Things to copy in once

| Folder | What goes there |
|---|---|
| `weeks/week-01/` | The four Week 1 files from the old page: `au0009-week-1-induction-and-ai-foundations.pptx` and `.pdf`, `au0009-week-1-learner-pack.docx` and `.pdf` |
| `assets/logos/` | `logo_bfc_group.png`, `logo_bfc_college.png`, `soc.png` |
| `assets/qr/` | `qr-page.png` (QR for the page's share link) and `qr-skills.png` |
| `skills/` | Your existing initial AI skills assessment |

Linking straight to one week: add `#week-5` to the end of the page address.

The builder needs Python 3. If it isn't installed, you can still edit `assets/resources.js` by hand by copying an existing Week 1 entry.
