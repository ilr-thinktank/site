import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync('public/site.js', 'utf8');
function setup(fetch) {
  let submit;
  const button = { disabled: false, textContent: 'Envoyer le message' };
  const status = {};
  const form = {
    action: 'https://formspree.io/f/mnpjgvdl', resets: 0,
    querySelector: () => button,
    addEventListener: (_, handler) => { submit = handler; },
    reportValidity: () => true,
    reset() { this.resets++; },
    setAttribute() {}, removeAttribute() {},
  };
  vm.runInNewContext(script, {
    document: {
      querySelector: selector => selector === '[data-contact-form]' ? form : status,
      querySelectorAll: () => [],
    },
    fetch, FormData: class { constructor(value) { assert.equal(value, form); } },
    AbortSignal,
  });
  return { form, button, status, submit: () => submit({ preventDefault() {} }) };
}

test('successful contact submission resets fields and restores button', async () => {
  const ui = setup(async (url, options) => {
    assert.equal(url, 'https://formspree.io/f/mnpjgvdl');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Accept, 'application/json');
    return { ok: true };
  });
  await ui.submit();
  assert.equal(ui.form.resets, 1);
  assert.match(ui.status.textContent, /bien été envoyé/);
  assert.equal(ui.button.disabled, false);
});

for (const failure of ['server', 'network']) {
  test(`${failure} failure preserves message for retry`, async () => {
    const ui = setup(async () => {
      if (failure === 'network') throw new Error('Offline');
      return { ok: false };
    });
    await ui.submit();
    assert.equal(ui.form.resets, 0);
    assert.equal(ui.status.className, 'ilr-contact-error');
    assert.equal(ui.button.disabled, false);
  });
}

test('contact prevents duplicate submissions while waiting', async () => {
  let resolve;
  let requests = 0;
  const ui = setup(() => { requests++; return new Promise(done => { resolve = done; }); });
  const pending = ui.submit();
  assert.equal(ui.button.disabled, true);
  await ui.submit();
  assert.equal(requests, 1);
  resolve({ ok: true });
  await pending;
});
