(function (root, factory) {
  'use strict';

  var contact = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = contact;
    return;
  }
  root.NBContact = contact;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function validate(fields) {
    fields = fields || {};
    var value = {
      name: typeof fields.name === 'string' ? fields.name.trim() : '',
      email: typeof fields.email === 'string' ? fields.email.trim() : '',
      message: typeof fields.message === 'string' ? fields.message.trim() : '',
      website: typeof fields.website === 'string' ? fields.website.trim() : ''
    };
    if (!value.name || !value.email || !value.message) {
      return { ok: false, message: 'Name, email and a message, please.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email) || value.email.length > 254) {
      return { ok: false, message: 'That email does not look right.' };
    }
    if (value.name.length > 100 || value.message.length > 5000) {
      return { ok: false, message: 'Please shorten the name or message before sending.' };
    }
    return { ok: true, value: value };
  }

  function submit(sendContact, fields) {
    var checked = validate(fields);
    if (!checked.ok) return Promise.resolve(checked);
    return Promise.resolve(sendContact(checked.value)).then(function () {
      return { ok: true, message: 'Received. A reply comes when the paint allows.' };
    }).catch(function (error) {
      if (error && error.status === 429) {
        return { ok: false, message: 'Too many notes were sent recently. Please wait ten minutes and try again.' };
      }
      return { ok: false, message: 'That did not send. Please try again or use the email link beside the form.' };
    });
  }

  return { validate: validate, submit: submit };
});
