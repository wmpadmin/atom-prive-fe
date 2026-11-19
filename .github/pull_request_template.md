## What changed

<!-- One or two sentences, in the words a user of the screen would use. -->

## Feedback point

<!-- Which point from the client's feedback list or the scope sheet this answers, e.g. "#78 KYC thumbnails". Write "none" for housekeeping. -->

## Where it goes

- [ ] `develop` (a finished point)
- [ ] `staging` (release for testing)
- [ ] `production` (release to the client's URL)

## How it was tested

<!-- What you clicked through, in which role, in light and dark. -->

## Screenshots

<!-- Before and after for any screen that looks different. -->

## Checks

- [ ] CI is green (lint, `tsc -b`, tests, build)
- [ ] No local-only files in the diff (`menu-*.ts`, `client-workspace/*`, `docs/image.png`)
- [ ] Needs a backend change? Linked here: <!-- PR link -->
