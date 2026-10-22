# Sandstorm fork compatibility

## Pinned baseline and scope

This fork starts from TAPevents/tap-i18n commit
`a0ae4fb1abc0698fdc265461019c18d9253ae2a1` (package `tap:i18n` 2.3.2).
The planning document referred to 2.3.1; the supplied checkout already contained
2.3.2 and its earlier initialization, compiler, language-tag and retry fixes.
The MIT license and TAPevents copyright remain in `LICENSE`. The bundled engine
remains i18next 1.7.3; no catalog migration or engine upgrade is included.

The package keeps its name for local, checked-in use. It has not been published.
Sandstorm must vendor a reviewed fork revision (including the license) or pin an
explicitly published version before production integration. A developer's package
symlink is not a production dependency strategy.

## Reproduced failures and bounded patches

1. **Dependency resolution:** Meteor 3.5.1 rejected the baseline because
   `api.versionsFrom('2.2.4')` constrained `webapp` to 1.10.1 while the runtime
   requires 2.3.0. Declaring both Meteor baselines admits the appropriate major
   version without removing compatibility with Meteor 2.
2. **Compiler discovery:** after resolving dependencies, Meteor 3 discovered
   undeclared test fixtures inside the local package. Nested `package-tap.i18n`
   files caused ordering errors; test dependencies also supplied invalid HTML
   document fixtures. `.meteorignore` excludes `tests/` from discovery.
   `Package.onTest` still explicitly loads its declared test files.
3. **Test diagnostics:** Meteor wraps compiler errors across lines. Negative
   tests now normalize diagnostic whitespace before checking the expected error;
   they still require an unsuccessful process exit and the specific diagnostic.

The package's runtime code needs no async rewrite for the exercised behavior.
A source audit found no Fiber, Future, wrapAsync or Promise.await usage in `lib`.
Successful real server startup exercises the selected Meteor dependencies;
that is not a claim that every path in those dependencies was audited.

## Reproduction

```sh
npm ci --prefix tests
npm test --prefix tests                    # default: Meteor 3.5.1
METEOR_RELEASE=2.16 npm test --prefix tests -- inferred
SANDSTORM_I18N_DIR="$HOME/src/sandstorm/shell/i18n" \
  KEEP_TEST_TMP=1 npm test --prefix tests -- sandstorm
```

The optional `sandstorm` scenario copies all seven supplied catalogs into an
isolated application and generates test expectations from their contents. It
does not register resources through JSON imports: only compiler output registers
translations. The expectations are test data. The fork does not maintain a second
copy of Sandstorm's catalogs.

Validation used Node 22.17.0 for the host runner, Meteor 3.5.1 (Node 24.15.0),
and Chromium 151.0.7922.173. Sandstorm catalog input came from the checkout at
`3e6ac1c5c309d1c423a809d0dd0475a06018de1b`.

Results:

- 39 host compiler/runner tests passed.
- All 13 runnable Meteor 3 scenarios passed, including `Package.onTest`,
  preloading, namespaced packages, compiler ordering and language-tag variants.
- All six negative compiler scenarios rejected the intended invalid inputs.
  Four were rerun after correcting whitespace matching in the runner.
- New tests verify failure and retry, delayed older selections, mounted Blaze
  updates, and Russian counts 1, 2, 5, 11, 21 with legacy context keys.
- The inferred-catalog scenario passed on Meteor 2.16: 47 server and 67 client tests.
- All seven real Sandstorm catalogs passed: eight server and eight browser tests,
  covering nested UTF-8 strings, missing keys, English fallback and Chinese casing.
- A production bundle of the Sandstorm catalog fixture built successfully using
  `meteor build /tmp/tap-i18n-production --directory --server-only` from its
  generated app directory. This is a fixture build, not a Sandstorm shell build.
- The built bundle started with its installed server dependencies and an isolated
  MongoDB. All six non-English HTTP catalog responses matched the original JSON;
  the multi-language route also passed. Runtime checks used
  `/tmp/tap-i18n-production-check.py`, with output in
  `/tmp/tap-i18n-production-runtime.log`. English remains embedded in the client.

The runner prints the temporary workspace and keeps logs with `KEEP_TEST_TMP=1`.
Original dependency failure: `/tmp/tap-i18n-tests-alTyXL/inferred/meteor.log`.
Compiler discovery failures: `/tmp/tap-i18n-tests-nqc6q2/inferred/meteor.log` and
`/tmp/tap-i18n-tests-XzieGj/inferred/meteor.log`. These local paths are diagnostic
artifacts, not required inputs to reproduce the failures.

## Application adapter still required

This repository implements the package portion of the migration. Sandstorm's
`/imports/tapi18n` adapter, declarations, startup and browser tests still need to
be changed together in the Sandstorm repository. Do not replace that adapter
with a bare re-export:

- `getCanonicalLanguageTag()` handles case, not regional fallback. Resolve an
  exact tag first, then a supported base tag (e.g. `fr-CA` to `fr`). Keep `zh-CN`
  and `zh-TW` distinct. Choose English for unsupported startup preferences.
- The API is `__(key, options, language)`. A single shorthand value works, but
  Sandstorm's variadic positional arguments must be converted to `options.sprintf`
  so the next value is not mistaken for a language tag. Clone caller options.
- Preserve `coerceTemplateText` for wrapped keys, arrays and string guards.
  Upstream's helper stringifies its key and does not implement Sandstorm's
  wrapper semantics. Its engine also returns a diagnostic string for an object
  entry by default. Keep these application-specific adaptations in the adapter.
  If retaining the adapter's `_` helper, configure the package's helper under a
  different name in `project-tap.i18n`; do not register `_` twice.
- Keep real `.done()`/`.fail()` readiness semantics. Startup failure must clear
  the loading state and keep English usable. Superseded requests may complete
  without becoming the selected language.
- Remove static catalog registration from the adapter. Let the compiler embed
  English and serve other languages through its same-origin routes.
- Ordinary Blaze text escapes interpolated strings. Triple-brace/HTML rendering
  sites need explicit assessment of user-supplied substitutions; preserving the
  legacy engine does not make arbitrary translated HTML safe.

Remaining application acceptance work: Sandstorm routing and caching, loading
indicator success/failure, wrapped-key and object-entry behavior at actual
rendering sites, HTML interpolation, live catalog rebuilds, and Sandstorm's full
production build/browser suite. The package checks do not establish those results.
