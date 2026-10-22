import {expect} from 'chai';
import {Meteor} from 'meteor/meteor';
import {TAPi18n} from 'meteor/tap:i18n';
import catalogs from '../../catalogs';
import {asPromise} from '../../helpers';

function leaves(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) => {
    const name = prefix ? prefix + '.' + key : key;
    return typeof value === 'string' ? [[name, value]] :
      value && typeof value === 'object' && !Array.isArray(value) ? leaves(value, name) : [];
  });
}

describe('Sandstorm production catalogs', function () {
  this.timeout(30000);
  it('discovers exactly the seven application languages', function () {
    expect(Object.keys(TAPi18n.getLanguages()).sort()).to.deep.equal(Object.keys(catalogs).sort());
    expect(TAPi18n.getCanonicalLanguageTag('ZH-cn')).to.equal('zh-CN');
    expect(TAPi18n.getCanonicalLanguageTag('zh-tw')).to.equal('zh-TW');
    // Regional fallback is the adapter's responsibility, not canonicalization.
    expect(TAPi18n.getCanonicalLanguageTag('fr-CA')).to.equal(undefined);
  });
  for (const [tag, catalog] of Object.entries(catalogs)) {
    it('loads and translates nested UTF-8 strings for ' + tag, async function () {
      if (Meteor.isClient) await asPromise(TAPi18n.setLanguage(tag));
      const translate = (key, options = {}) => TAPi18n.__(key, options, tag);
      let checked = 0;
      for (const [key, value] of leaves(catalog)) {
        if (!value || /__|%|\$t\(/.test(value)) continue;
        expect(translate(key), tag + ':' + key).to.equal(value);
        checked++;
      }
      expect(checked).to.be.greaterThan(100);
      expect(translate('sandstorm_missing_key_probe')).to.equal('sandstorm_missing_key_probe');
      const localized = new Map(leaves(catalog));
      for (const [key, value] of leaves(catalogs.en)) {
        if (localized.has(key) || !value || /__|%|\$t\(/.test(value)) continue;
        expect(translate(key), 'English fallback: ' + key).to.equal(value);
      }
    });
  }
});
