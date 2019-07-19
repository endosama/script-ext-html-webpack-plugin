'use strict';

const CONSTANTS = require('./constants.js');
const SYNC = 'sync';
const ATTRIBUTE_PRIORITIES = [SYNC, 'async', 'defer'];

const common = require('./common.js');
const debug = common.debug;
const isScript = common.isScript;
const matches = common.matches;
const getScriptName = common.getScriptName;

const shouldUpdate = (options) => {
  if (ATTRIBUTE_PRIORITIES.indexOf(options.defaultAttribute) < 0) {
    throw new Error(`${CONSTANTS.PLUGIN}: invalid default attribute`);
  }
  return !(options.defaultAttribute === SYNC &&
    options.inline.test.length === 0 &&
    options.async.test.length === 0 &&
    options.defer.test.length === 0 &&
    options.module.test.length === 0);
};

const update = (assets, options, tags, outputFileName) => {
  const update = updateElement.bind(null, assets, options, outputFileName);
  return tags.map(update);
};

const updateElement = (assets, options, outputFileName, tag) => {
  return (isScript(tag)) ?
    updateScriptElement(assets, options, tag, outputFileName) :
    tag;
};

const updateScriptElement = (assets, options, tag, outputFileName) => {
  debug(`${CONSTANTS.EVENT}: processing <script> element: ${JSON.stringify(tag)}`);
  return (isInline(options, tag)) ?
    replaceWithInlineElement(assets, options, tag) :
    updateSrcElement(options, tag, outputFileName);
};

const isInline = (options, tag) =>
  matches(getScriptName(options, tag), options.inline.test);

const replaceWithInlineElement = (assets, options, tag) => {
  const scriptName = getScriptName(options, tag);
  const asset = assets[scriptName];
  if (!asset) throw new Error(`${CONSTANTS.PLUGIN}: no asset with href '${scriptName}'`);
  const newTag = {
    tagName: 'script',
    closeTag: true,
    innerHTML: asset.source()
  };
  debug(`${CONSTANTS.PLUGIN}: replaced by: ${JSON.stringify(newTag)}`);
  return newTag;
};

const deepMatch = (scriptName, html, config) => {
  if (config && config.length > 0) {
    let result = false;
    config.forEach(conf => {
      if (typeof conf.chunkName === 'function') {
        if (conf.htmlPath === html) {
          result = result || conf.htmlPath === html && conf.chunkName(scriptName);
        }
      }
      let chunkName = '';
      if (typeof conf.chunkName === 'string') {
        chunkName = conf.chunkName;
      } else if (conf.chunkName instanceof RegExp) {
        chunkName = conf.chunkName;
      } else if (Array.isArray(conf.chunkName)) {
        chunkName = conf.chunkName; //TODO: handle
      }
      result = result || conf.htmlPath === html && chunkName === scriptName;
    });
    return result;
  }
  return false;
}
const updateSrcElement = (options, tag, outputFileName) => {
  const scriptName = getScriptName(options, tag);
  // select new attribute, if any, by priority
  let newAttribute;
  ATTRIBUTE_PRIORITIES.some(attribute => {
    if (matches(scriptName, options[attribute].test) || deepMatch(scriptName, outputFileName, options[attribute].test)) {
      newAttribute = attribute;
      return true;
    }
  });
  if (!newAttribute) newAttribute = options.defaultAttribute;
  if (newAttribute !== SYNC) {
    tag.attributes[newAttribute] = true;
  }
  // possibly overwrite existing type attribute
  if (matches(scriptName, options.module.test)) {
    tag.attributes.type = 'module';
  }
  debug(`${CONSTANTS.PLUGIN}: updated to: ${JSON.stringify(tag)}`);
  return tag;
};

module.exports = {
  shouldUpdate,
  update
};
