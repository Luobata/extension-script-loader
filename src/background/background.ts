/**
 * @desc background index
 */

import ChromeCrossMessenger from 'SRC/util/chrome-cross-messenger/chrome-cross-messenger';
import { loadRemoteContent } from 'SRC/util/const';

console.log('test');

export default class Background {
    private _corss: ChromeCrossMessenger;

    constructor() {
        this._corss = ChromeCrossMessenger.getInstance();

        this._listener();
    }

    private _listener(): void {
        this._corss.on(loadRemoteContent, (data, { sender }) => {
            console.log(data, sender);
        });
    }
}
