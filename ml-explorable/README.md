# How Machines Learn — an explorable explanation

A single scrolling page that teaches how machine learning works to people with
no technical background. Readers learn by dragging, sliding and watching real
models train. **Nothing is pre-recorded**: every loss, gradient, prediction and
training run is computed live in the browser, in plain JavaScript.

| # | Chapter | What the reader does | What really runs |
|---|---------|----------------------|------------------|
| 1 | What is a model? | Drags a line through ice-cream sales data, then lets the computer try | Linear regression, gradient descent on mean squared error |
| 2 | Learning by getting less wrong | Rolls a ball down the error curve with a step-size slider | Exact 1D slice of the loss; gradient descent that really diverges when the step is too big |
| 3 | A single neuron | Drives weights, bias and activation; tries to solve two puzzles | One sigmoid neuron trained by gradient descent (it provably can't solve XOR) |
| 4 | A neural network | Trains a network on circles / corners / spirals, changes its size | Multi-layer perceptron with backpropagation + momentum |
| 5 | Memorizing vs. learning | Raises model complexity until it overfits, then collects more data | Exact least-squares polynomial fits (Chebyshev basis) with a held-out test set |
| 6 | How chatbots guess the next word | Types words, sees next-word probabilities, samples text | Trigram model with Witten–Bell smoothing, trained on ten retold Aesop fables |
| 7 | Epilogue | Glossary, what was simplified, further reading | — |

### The time element

Every chapter that learns has a **timeline** under it (`src/lib/timeline.js`).
While a model trains, real snapshots of its parameters are recorded along with
the error. The reader can:

- **scrub** back to any moment and see the model exactly as it was,
- **replay** the whole run,
- **rewind and resume**: press play while looking at the past and training
  continues from that moment (e.g. rewind a diverging run in chapter 2 and pick
  a smaller step size).

Chapter 5's timeline is over *data collected* rather than training steps, and
chapter 6's is over *words read*, so they show how more data changes a model.

## Run it locally

Requires Node.js 18+.

```bash
cd ml-explorable
npm install
npm run dev        # http://localhost:5173
```

Production build (static files in `dist/`):

```bash
npm run build
npm run preview    # serve the built site at http://localhost:4173
```

## Tests

```bash
npm test           # unit tests: MLP gradient check, XOR, regression, n-gram
npm run check      # end-to-end: needs `npm run dev` running in another terminal
```

`npm run check` drives every chapter in headless Chromium at desktop (1280px)
and phone (375px) widths. It drags handles, moves sliders and presses play,
then asserts real outcomes: gradient descent reaches the exact least-squares
line, a too-large learning rate diverges, the network classifies every point,
test error rises with complexity and falls with more data, scrubbing the
timeline restores earlier models. It also checks there's no horizontal scroll,
no console errors, that touch targets are large enough, and that
`prefers-reduced-motion` is respected. Screenshots go to `shots/`.

It uses `playwright-core` with the Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome` by default; point it at
another browser with `CHROMIUM=/path/to/chrome npm run check`, or at another
server with `URL=http://localhost:4173/ npm run check`.

## Deploy (free)

The build is a folder of static files, so any static host works. `vite.config.js`
uses a relative `base`, so it also works from a sub-path.

**GitHub Pages** (set up in this repo): the workflow in
`.github/workflows/deploy-ml-explorable.yml` builds and publishes the site on
every push to `main` that touches `ml-explorable/`. One-time setup: in the
repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The site
will be at `https://<user>.github.io/<repo>/`. You can also run the workflow by
hand from the **Actions** tab.

**Netlify / Vercel / Cloudflare Pages**: import the repository and set

- base / root directory: `ml-explorable`
- build command: `npm run build`
- output directory: `dist`

Or drag the `dist/` folder onto <https://app.netlify.com/drop>.

## Project structure

```
ml-explorable/
  index.html               page shell, hero, colour key
  src/
    main.js                mounts chapters in order + scroll reveals
    hero.js                live background: a small network fitting drifting data
    styles/                tokens.css (colours, type), base.css, controls.css
    lib/
      timeline.js          the shared training timeline (record / scrub / replay / rewind)
      loop.js              requestAnimationFrame loop; pauses off-screen and in hidden tabs
      canvas.js            HiDPI canvas, scales, pointer dragging
      ui.js                sliders, buttons, segmented controls, readouts
      rng.js, motion.js    seeded randomness, prefers-reduced-motion
    ml/                    the machine learning, no dependencies
      linear.js            linear regression + gradient descent
      mlp.js               neural network: forward pass, backprop, momentum SGD
      datasets.js          circles, four corners (XOR), spirals
      poly.js              polynomial least squares (Chebyshev features)
      ngram.js, fables.js  trigram next-word model and its training text
    chapters/NN-name/      one folder per chapter: index.js + chapter.css
  tests/                   unit tests (node:test) and the Playwright end-to-end check
```

### Adding or reordering chapters

Each chapter exports `{ id, title, mount(element) }` (and optionally `kicker`).
Add a folder under `src/chapters/`, then add it to the `chapters` array in
`src/main.js`. The order of that array is the order on the page, and chapter
numbers are assigned automatically.

To give a new chapter a timeline:

```js
const tl = createTimeline(lab, {
  onScrubStart: () => loop.pause(),
  onView: (state) => { /* show the model as it was */ },
});
tl.record(step, { loss }, model.getState());   // inside the training loop
const past = tl.rewindHere();                   // on play: resume from the past if scrubbed back
```

## Design notes

- **Colour language** (in `src/styles/tokens.css`), the same in every chapter:
  amber = data, cyan = the model, coral = error, violet = learning / the next
  step. Positive weights are cyan, negative weights coral. The two classes in
  chapter 4 use both colour *and* shape (circles vs. triangles).
- Training loops do a little work per animation frame and pause when the
  chapter is off screen, so the page never freezes.
- With `prefers-reduced-motion`, scroll reveals and the hero animation are off;
  nothing auto-plays, and replays jump instead of animating.

## Credits

The chapter 6 text retells ten of Aesop's fables (public-domain stories) in new,
plain wording written for this project. Fonts: Fraunces, Inter and JetBrains
Mono via Google Fonts.
