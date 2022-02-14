/**
 * @desc 对inject content做一个劫持
 */

import contentGlobal, {
    contentGlobalMessageBridgeEventStr,
} from './chontent-api-extension';

function loadFn(str: string) {
    // 怎么把这部分复用？
    const injectGlobal = {
        triggerListener: (key: string, data: Object): void => {
            window.postMessage(
                {
                    type: str,
                    obj: {
                        eventKey: key,
                        data,
                    },
                },
                '*',
            );
        },
        addListnener: (key: string, cb: Function): void => {
            window.addEventListener('message', data => {
                const bridgeData = data.data;
                if (bridgeData?.type === str) {
                    if (bridgeData?.obj.eventKey === key) {
                        cb(bridgeData?.obj?.data);
                    }
                }
            });
        },
    };
    window.injectGlobal = injectGlobal;

    return injectGlobal;
}

(() => {
    contentGlobal.insertCode(loadFn, contentGlobalMessageBridgeEventStr);
})();

export default loadFn(contentGlobalMessageBridgeEventStr);
