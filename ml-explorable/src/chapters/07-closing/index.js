import { h } from '../../lib/ui.js';
import './chapter.css';

const GLOSSARY = [
  ['model', 'model', 'A rule that turns what you know into a guess. A line, a neuron, a network.', 'what-is-a-model'],
  ['error', 'loss', 'One number for how wrong the model is. Learning means making it smaller.', 'what-is-a-model'],
  ['learn', 'gradient descent', 'Feel which way is downhill on the error landscape, take a small step, repeat.', 'getting-less-wrong'],
  ['learn', 'learning rate', 'How big each step is. Too small is slow; too big overshoots.', 'getting-less-wrong'],
  ['model', 'neuron', 'Weigh the inputs, add a bias, squash with an activation function.', 'a-single-neuron'],
  ['model', 'neural network', 'Many neurons wired together, so straight cuts combine into any shape.', 'a-neural-network'],
  ['learn', 'backpropagation', 'Passing the error backwards to work out how to nudge every weight.', 'a-neural-network'],
  ['error', 'overfitting', 'Memorizing the examples (noise included) instead of the pattern.', 'memorizing-vs-learning'],
  ['data', 'test set', 'Examples kept hidden during training, to check the model honestly.', 'memorizing-vs-learning'],
  ['model', 'language model', 'Puts a probability on every possible next word (or token).', 'next-word'],
];

const SIMPLIFIED = [
  ['Real data has many more dimensions.', 'Our examples had one or two inputs so we could draw them. A photo has millions of pixels, so its error landscape has millions of directions — impossible to picture, but the same downhill recipe works.'],
  ['Real models are enormous.', 'Your biggest network here had about a hundred weights. Modern image and language models have millions to hundreds of billions, and train for weeks on specialised chips.'],
  ['The step-taking is fancier.', 'Real training looks at small random batches of data per step and uses smarter optimizers (with names like Adam) that adapt the step size for each weight. The heart of it is still gradient descent.'],
  ['Overfitting has more cures.', 'Besides more data, practitioners use tricks like stopping training early, randomly switching off neurons ("dropout"), and penalising extreme weights ("regularization").'],
  ['Language models are neural networks.', 'Our chatbot demo counted word pairs. Real ones use a network design called the transformer that can weigh every earlier word when predicting the next one.'],
];

const LINKS = [
  ['Elements of AI', 'https://www.elementsofai.com/', 'A free, non-technical online course on what AI is and isn\'t.', 'no maths'],
  ['A visual introduction to machine learning', 'http://www.r2d3.us/visual-intro-to-machine-learning-part-1/', 'A beautiful scrolling story about how a model learns to tell cities apart.', 'no maths'],
  ['TensorFlow Playground', 'https://playground.tensorflow.org/', 'A bigger version of chapter 4: build and train networks in your browser.', 'hands-on'],
  ['3Blue1Brown: Neural networks', 'https://www.3blue1brown.com/topics/neural-networks', 'Gorgeous animated videos on networks, gradient descent, backpropagation and transformers.', 'videos'],
  ['Neural Networks and Deep Learning', 'http://neuralnetworksanddeeplearning.com/', 'Michael Nielsen\'s free online book — the next step if you enjoyed the maths underneath.', 'book'],
  ['Neural Networks: Zero to Hero', 'https://karpathy.ai/zero-to-hero.html', 'Andrej Karpathy builds networks — up to a small GPT — from scratch, in code.', 'for coders'],
];

export default {
  id: 'where-next',
  kicker: 'Epilogue',
  title: 'What you\'ve learned, and where to go next',
  mount(root) {
    root.append(h('div', { class: 'prose reveal', html: `
      <p>In a few minutes you fitted a line by hand, rolled a ball down an error landscape, wired up a neuron, watched a
      network carve out spirals, caught a model memorizing, and trained a tiny text predictor. Every one of those was the real
      thing, computed live — just small enough to see.</p>
      <p>Here is the vocabulary you picked up along the way. Click any term to jump back to where you met it.</p>` }));

    root.append(h('div', { class: 'glossary reveal' }, GLOSSARY.map(([role, term, def, id]) =>
      h('a', { class: `gloss gloss--${role}`, href: `#${id}` }, h('span', { class: 'gloss__term' }, term), h('span', { class: 'gloss__def' }, def)))));

    root.append(h('h3', { class: 'ch7-h reveal' }, 'What this page simplified'));
    root.append(h('div', { class: 'simplified reveal' }, SIMPLIFIED.map(([t, d]) => h('details', {}, h('summary', {}, t), h('p', {}, d)))));

    root.append(h('h3', { class: 'ch7-h reveal' }, 'Where to learn more'));
    root.append(h('div', { class: 'links reveal' }, LINKS.map(([t, url, d, tag]) =>
      h('a', { class: 'link-card', href: url, target: '_blank', rel: 'noopener' },
        h('span', { class: 'link-card__tag' }, tag), h('span', { class: 'link-card__title' }, t), h('span', { class: 'link-card__desc' }, d)))));

    root.append(h('p', { class: 'prose ch7-end reveal', html:
      'The big idea to take with you: <strong>machine learning is not magic and not programming in the usual sense.</strong> Nobody wrote rules for spotting spirals or finishing fables. We chose a flexible model, defined what "wrong" means, and let the computer get less wrong, one small step at a time.' }));
  },
};
