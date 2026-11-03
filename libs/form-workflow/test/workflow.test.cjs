const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');
const { useFormikContext } = require('formik');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    module._compile(output.outputText, filename);
  };
}
const { FormWorkflow, useFormWorkflow } = require('../src/form-workflow.tsx');
const { step, orSplit, andSplit, resolvePath } = require('../src/engine.ts');
const screen = (id, options = {}) => step({ id, component: () => null, ...options });

async function mount(nodes, onSubmit = async () => {}) {
  const state = {};
  function Probe() {
    state.workflow = useFormWorkflow();
    state.formik = useFormikContext();
    return null;
  }
  let renderer;
  await act(async () => {
    renderer = create(React.createElement(FormWorkflow, {
      nodes, initialValues: { name: '' }, onSubmit,
    }, React.createElement(Probe)));
  });
  state.renderer = renderer;
  state.dispose = async () => act(async () => renderer.unmount());
  state.next = async () => {
    let result;
    await act(async () => { result = await state.workflow.next(); });
    return result;
  };
  return state;
}

test('API response selects nested OR and AND branches before navigation', async () => {
  const nodes = [screen('verify', { execute: async () => ({ approved: true }) }),
    orSplit('decision', [{ id: 'approved', when: (_, results) => results.verify?.approved,
      nodes: [andSplit('checks', [{ id: 'documents', nodes: [screen('documents')] }])],
    }]), screen('review')];
  assert.deepEqual(resolvePath(nodes, {}).map((entry) => entry.id), ['verify', 'review']);
  const state = await mount(nodes);
  try {
    assert.equal(await state.next(), true);
    assert.equal(state.workflow.currentStep.id, 'documents');
    assert.deepEqual(state.workflow.results.verify, { approved: true });
  } finally { await state.dispose(); }
});

test('validation failure does not execute the API', async () => {
  let calls = 0;
  const state = await mount([screen('verify', {
    validate: () => ({ name: 'Required' }), execute: async () => { calls++; },
  })]);
  try {
    assert.equal(await state.next(), false);
    assert.equal(calls, 0);
    assert.equal(state.formik.touched.name, true);
  } finally { await state.dispose(); }
});

test('API failure stays on the step and supports retry', async () => {
  let calls = 0;
  const state = await mount([screen('verify', { execute: async () => {
    if (++calls === 1) throw new Error('Unavailable');
    return 'ok';
  } }), screen('review')]);
  try {
    assert.equal(await state.next(), false);
    assert.equal(state.workflow.error.message, 'Unavailable');
    assert.equal(state.workflow.currentStep.id, 'verify');
    assert.equal(await state.next(), true);
    assert.equal(state.workflow.error, null);
    assert.equal(state.workflow.currentStep.id, 'review');
  } finally { await state.dispose(); }
});

test('pending requests block duplicate Next and reset aborts stale responses', async () => {
  let finish;
  let signal;
  let calls = 0;
  let operation;
  const state = await mount([screen('verify', { execute: (context) => {
    calls++;
    signal = context.signal;
    return new Promise((resolve) => { finish = resolve; });
  } }), screen('review')]);
  try {
    await act(async () => { operation = state.workflow.next(); });
    assert.equal(state.workflow.isExecuting, true);
    assert.equal(await state.next(), false);
    assert.equal(calls, 1);
    await act(async () => {
      state.renderer.root.findByType('form').props.onReset({ preventDefault() {} });
    });
    assert.equal(signal.aborted, true);
    await act(async () => { finish('stale'); await operation; });
    assert.deepEqual(state.workflow.results, {});
    assert.equal(state.workflow.currentStep.id, 'verify');
    assert.equal(state.workflow.isExecuting, false);
  } finally { await state.dispose(); }
});

test('resubmitting an earlier step discards downstream results', async () => {
  const state = await mount([
    screen('first', { execute: async () => 'first-response' }),
    screen('second', { execute: async ({ results }) => {
      assert.equal(results.first, 'first-response');
      return 'second-response';
    } }), screen('review'),
  ]);
  try {
    await state.next();
    await state.next();
    assert.equal(state.workflow.results.second, 'second-response');
    await act(async () => { state.workflow.goTo('first'); });
    await state.next();
    assert.deepEqual(state.workflow.results, { first: 'first-response' });
  } finally { await state.dispose(); }
});

test('final API completes before submit and changing values ignores stale responses', async () => {
  const events = [];
  const state = await mount([screen('final', { execute: async () => { events.push('api'); } })],
    async () => { events.push('submit'); });
  try {
    assert.equal(await state.next(), true);
    assert.deepEqual(events, ['api', 'submit']);
  } finally { await state.dispose(); }
  let finish;
  let operation;
  const pending = await mount([screen('verify', { execute: () => new Promise((resolve) => { finish = resolve; }) }), screen('review')]);
  try {
    await act(async () => { operation = pending.workflow.next(); });
    await act(async () => { await pending.formik.setFieldValue('name', 'changed'); });
    await act(async () => { finish('old'); assert.equal(await operation, false); });
    assert.equal(pending.workflow.currentStep.id, 'verify');
    assert.deepEqual(pending.workflow.results, {});
  } finally { await pending.dispose(); }
});