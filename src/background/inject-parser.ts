/**
 * @desc inject parser
 */

import ContentParser, { contentConfig } from './content-parser';

export default class InjectParser extends ContentParser {
    // private _conf: ManifestConf['components'][0]['injected_scripts'][0];

    constructor(
        srcCode: string,
        srcKey: string,
        sender: chrome.runtime.MessageSender,
        conf: contentConfig = {
            matches: [],
            exclude_matches: [],
            allFrames: true,
            iframe_only: false,
            runAt: 'document_start',
            srcUrl: '',
        },
    ) {
        const newCode = `
             const fn = function (){
                 ${srcCode};
             };
             window.contentGlobal.insertCode(fn);
         `;

        // TODO 怎么同步conf
        super(newCode, srcKey, sender, conf);
        // this._conf = data.detail;
    }

    public destroy(): void {
        super.destroy();
        // TODO
    }
}
