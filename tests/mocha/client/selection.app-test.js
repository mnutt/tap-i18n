import {expect} from 'chai';
import {TAPi18n} from 'meteor/tap:i18n';
import {$} from 'meteor/jquery';
import {Tracker} from 'meteor/tracker';
import {Blaze} from 'meteor/blaze';
import {Template} from 'meteor/templating';
import {TapI18nTest, asPromise} from '../../helpers';

if (TapI18nTest.regularCatalog()) describe('TAPi18n - asynchronous selection contract', function () {
  let getJSON, loaded;
  beforeEach(async function () {
    await asPromise(TAPi18n.setLanguage('en'));
    getJSON = $.getJSON;
    loaded = TAPi18n._loaded_languages;
    TAPi18n._loaded_languages = ['en'];
  });
  afterEach(async function () {
    $.getJSON = getJSON;
    TAPi18n._loaded_languages = loaded;
    await asPromise(TAPi18n.setLanguage('en'));
  });

  it('keeps English usable after failure and completes a successful retry', async function () {
    const first = $.Deferred(), retry = $.Deferred();
    let requests = 0;
    $.getJSON = () => (++requests === 1 ? first : retry).promise();
    const failed = asPromise(TAPi18n.setLanguage('cc')).then(
      () => { throw new Error('Expected rejection'); }, error => error);
    expect(TAPi18n.getLanguage()).to.equal('en');
    first.reject({}, 'error');
    expect((await failed).message).to.include('error');
    expect(TAPi18n.__('message')).to.equal('English message');
    const ready = asPromise(TAPi18n.setLanguage('cc'));
    retry.resolve({project: {message: 'cc message'}});
    await ready;
    expect(TAPi18n.getLanguage()).to.equal('cc');
    expect(TAPi18n.__('message')).to.equal('cc message');
    expect(requests).to.equal(2);
  });

  it('does not let a delayed older request replace the latest selection', async function () {
    const pending = $.Deferred();
    $.getJSON = () => pending.promise();
    const older = asPromise(TAPi18n.setLanguage('cc'));
    await asPromise(TAPi18n.setLanguage('en'));
    pending.resolve({project: {message: 'cc message'}});
    await older;
    Tracker.flush();
    expect(TAPi18n.getLanguage()).to.equal('en');
    expect(TAPi18n.__('message')).to.equal('English message');
  });

  it('updates a mounted Blaze view without remounting', async function () {
    const helper = Blaze._getGlobalHelper(TAPi18n.conf.helper_name);
    const template = new Template('selectionContract', function () {
      return helper('message', {hash: {}});
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const view = Blaze.render(template, container);
    try {
      Tracker.flush();
      expect(container.textContent).to.equal('English message');
      await asPromise(TAPi18n.setLanguage('cc'));
      Tracker.flush();
      expect(container.textContent).to.equal('cc message');
      expect(view.isDestroyed).to.equal(false);
    } finally {
      Blaze.remove(view);
      container.remove();
    }
  });
});
