# GitHub Pages Deployment

## Structure

The source repository is [leafpcye/MRBDMapGameLab](https://github.com/leafpcye/MRBDMapGameLab). `npm run build` produces only the static runtime in `dist/`:

```text
dist/
├── .nojekyll
├── index.html
├── styles.css
├── app.js
├── build-info.js
├── manifest.webmanifest
├── sw.js
└── modules/
```

`dist/` and the local root `build-info.js` are generated and ignored. They are never committed to `main`.

## Workflow

`.github/workflows/deploy-pages.yml` runs on:

- pushes to `main`;
- manual `workflow_dispatch`.

It uses GitHub-maintained checkout, Node setup, Pages configuration, Pages artifact upload, and Pages deployment Actions. The job runs `npm test` and `npm run build` before upload.

## Pages activation

If the workflow reports that Pages is not enabled:

1. Open repository **Settings**.
2. Select **Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** as Source.
4. Re-run **Deploy MRBD Probe to GitHub Pages** once.

Do not create a `gh-pages` branch.

## Deployment URL

Expected project URL:

```text
https://leafpcye.github.io/MRBDMapGameLab/
```

Until the Pages workflow completes and the URL returns the current build, its status is:

```text
Pending GitHub Pages activation
```

## Verification

After a successful workflow:

1. Open the project URL and confirm HTTP 200.
2. Check `styles.css`, `app.js`, `build-info.js`, `sw.js`, `manifest.webmanifest`, and one `modules/*.js` URL below `/MRBDMapGameLab/`.
3. Confirm missing resources return 404.
4. Confirm `build-info.js` contains the short commit from the successful workflow.
5. At a 600×600 viewport, open Environment, Input, and Storage.
6. Attempt explicit Service Worker registration and confirm its scope ends in `/MRBDMapGameLab/`.
7. Treat all of this only as a desktop deployment precheck.

## Build commit

The workflow receives `GITHUB_SHA`. The build generator shortens it and writes it only to the uploaded `dist/build-info.js`. The deployed header shows the same COMMIT value. No generated build file is committed.

## Actions logs

Open the repository’s **Actions** tab and select **Deploy MRBD Probe to GitHub Pages**. The build job contains test/build/artifact logs; the deploy job contains the Pages URL and deployment status.

## Rollback

Do not force-push. Revert the problematic source commit normally:

```bash
git revert <commit>
git push origin main
```

The resulting `main` push deploys a new artifact containing the reverted source and its new commit identity.

## Clear an old Service Worker

Use Storage → **Unregister SW** in the probe. On a desktop browser, developer tools → Application → Service Workers can also unregister the app-scoped worker. Browser site-data controls may be used to clear this origin’s data when explicitly desired; the probe itself does not broadly delete caches.

## Add to Meta AI App

Only after the HTTPS URL has been verified:

1. Use the Meta AI App flow for adding/opening a Web App.
2. Enter the full project URL including the trailing `/MRBDMapGameLab/`.
3. Record whether MRBD opens it; do not infer success from desktop deployment.
4. Begin the first real-device procedure in [mrbd-phase-1a-test-plan.md](mrbd-phase-1a-test-plan.md).
