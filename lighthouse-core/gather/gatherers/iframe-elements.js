/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Gatherer = require('./gatherer.js');
const pageFunctions = require('../../lib/page-functions.js');

/* eslint-env browser, node */

/**
 * @return {LH.Artifacts['IFrameElements']}
 */
/* istanbul ignore next */
function collectIFrameElements() {
  // @ts-ignore - put into scope via stringification
  const iFrameElements = getElementsInDocument('iframe'); // eslint-disable-line no-undef
  return iFrameElements.map(/** @param {HTMLIFrameElement} node */ (node) => {
    const clientRect = node.getBoundingClientRect();
    const {top, bottom, left, right, width, height} = clientRect;
    return {
      id: node.id,
      src: node.src,
      clientRect: {top, bottom, left, right, width, height},
      // @ts-ignore - put into scope via stringification
      isPositionFixed: isPositionFixed(node), // eslint-disable-line no-undef
    };
  });
}

class IFrameElements extends Gatherer {
  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @return {Promise<LH.Artifacts['IFrameElements']>}
   * @override
   */
  async afterPass(passContext) {
    const driver = passContext.driver;

    const {frameTree} = await driver.sendCommand('Page.getFrameTree');
    let toVisit = [frameTree];
    /** @type {Map<string | undefined, LH.Crdp.Page.Frame | undefined>} */
    const framesByDomId = new Map();

    while (toVisit.length) {
      const frameTree = toVisit.shift();
      // Should never be undefined, but needed for tsc.
      if (!frameTree) continue;
      if (framesByDomId.has(frameTree.frame.name)) {
        // DOM ID collision, mark as undefined.
        framesByDomId.set(frameTree.frame.name, undefined);
      } else {
        framesByDomId.set(frameTree.frame.name, frameTree.frame);
      }

      // Add children to queue.
      if (frameTree.childFrames) {
        toVisit = toVisit.concat(frameTree.childFrames);
      }
    }

    const expression = `(() => {
      ${pageFunctions.getOuterHTMLSnippetString};
      ${pageFunctions.getElementsInDocumentString};
      ${pageFunctions.isPositionFixedString};
      return (${collectIFrameElements})();
    })()`;

    /** @type {LH.Artifacts['IFrameElements']} */
    const iframeElements = await driver.evaluateAsync(expression, {useIsolation: true});
    for (const el of iframeElements) {
      el.frame = framesByDomId.get(el.id);
    }
    return iframeElements;
  }
}

module.exports = IFrameElements;
