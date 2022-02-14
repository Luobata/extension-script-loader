import Tab = chrome.tabs.Tab;

function getFocusedTab(): Promise<Tab> {
    return new Promise((resolve) => {
        chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
        }, (tabs) => {
            resolve(tabs && tabs[0]);
        });
    });
}

/**
 *  获取当前用户可见的 tab 数组
 *  理解"可见"：
 *      多个 tab 页在同一个标签栏只可见一个 tab
 *      如果鼠标长按一个 tab 并拖动独立出来，此时可见的 tab 就有两个
 *      所以可见，可指代独立窗口中的 tab
 * @returns {Promise<Tab[]>}
 */
function getCurrentTabs(): Promise<Tab[]> {
    return new Promise((resolve) => {
        chrome.tabs.query({
            active: true,
            currentWindow: true,
        }, (tabs) => {
            resolve(tabs);
        });
    });
}

function getActiveTabs(): Promise<Tab[]> {
    return new Promise((resolve) => {
        chrome.tabs.query({
            active: true,
        }, (tabs) => {
            resolve(tabs);
        });
    });
}

export default class TabsUtil {
    static getAllTab(cb): void {
        if (!cb) return;
        chrome.tabs.query({}, (tabs) => {
            cb(tabs);
        });
    }

    static getAllTabIdList(cb): void {
        if (!cb) return;
        this.getAllTab((tabs) => {
            cb(tabs.map(tab => tab.id));
        });
    }

    static getAndForEachAllTabsId(cb): void {
        if (!cb) return;
        this.getAllTabIdList((id) => {
            cb(id);
        });
    }

    static async asyncGetTabById(tabId): Promise<Tab> {
        return new Promise(resolve => {
            this.getTabById(tabId, tab => {
                resolve(tab);
            });
        });
    }

    static getTabById(tabId, cb): void {
        chrome.tabs.get(tabId, (tab) => {
            cb(tab);
        });
    }

    static isTabExist(tabId, cb): void {
        if (!cb) return;
        this.getAllTab((tabs) => {
            cb(tabs.some(tab => tab.id === tabId));
        });
    }

    /**
     * 获取当前 focus 的 tab ，无论有没有分离的标签页面，都只会有一个，指当前正在操作的窗口
     * @param cb {function(Tab)}
     */
    static getFocusedTab(cb): void {
        if (!cb) return;
        getFocusedTab()
            .then((tab) => {
                cb(tab);
            });
    }

    static getCurrentTab(cb): void {
        if (!cb) return;
        this.getCurrentTabsList(tabs => cb(tabs[0]));
    }

    static getCurrentTabId(cb): void {
        if (!cb) return;
        this.getCurrentTabsList(tabs => cb(tabs[0] && tabs[0].id));
    }

    /**
     * 获取当前用户可见的 tab 数组
     * @param cb {function(Tab[]|undefined)}
     */
    static getCurrentTabsList(cb): void {
        if (!cb) return;
        getCurrentTabs()
            .then(cb);
    }

    /**
     * 获取当前用户可见的 tab 的 id 数组
     * 理解"可见"：
     *  多个 tab 页在同一个标签栏只可见一个 tab
     *  如果鼠标长按一个 tab 并拖动独立出来，此时可见的 tab 就有两个
     *  所以可见，可指代独立窗口中的 tab
     * @param cb {function(number[]|undefined)}
     */
    static getCurrentTabsIdList(cb): void {
        if (cb) {
            this.getCurrentTabsList(tabs => cb(tabs.map(tab => tab.id)));
        }
    }

    /**
     * 遍历获取的所有可见的 tab ，用该 tab 作为参数，分别调一次回调函数
     * @param cb {function(Tab)}
     */
    static getAndForEachCurrentTab(cb): void {
        if (cb) {
            this.getCurrentTabsList(tabs => tabs.forEach(cb));
        }
    }

    /**
     * 遍历获取的所有可见的 tab ，用该 tab 的 id 作为参数，分别调一次回调函数
     * @param cb {function(number|undefined)}
     */
    static getAndForEachCurrentTabsId(cb): void {
        if (cb) {
            this.getAndForEachCurrentTab(tab => cb(tab.id));
        }
    }

    static getActiveTabList(cb): void {
        if (!cb) return;
        getActiveTabs()
            .then(cb);
    }

    static getActiveTabIdList(cb): void {
        this.getActiveTabList((tabList) => {
            cb(tabList.map(tab => tab.id));
        });
    }

    static getAndForEachActiveTabId(cb): void {
        this.getActiveTabIdList((idList) => {
            idList.forEach(cb);
        });
    }

    /**
     * 在当前 focus 的页面后新增一个 tab
     * @param tab 将会在目标 tab 的后面创建
     * @param {Object} options - windowId、index、url、active、selected、pinned、openerTabId
     * @param {function(Tab)} [cb]
     */
    static createAfterFocused(tab, options, cb): void {
        const { index, id: openerTabId, windowId } = tab;
        const createOptions = Object.assign(
            {},
            {
                windowId,
                index: index + 1,
                openerTabId,
            },
            options,
        );
        chrome.tabs.create(createOptions, cb);
    }

    static executeScript(tabId, details, cb): void {
        this.waitForTabCompleted(tabId, () => {
            chrome.tabs.executeScript(tabId, details, cb);
        });
    }

    /**
     * 针对监听器，只监听一次
     * @param target
     * @param removeCondition
     * @param listener
     */
    static listenAtOnce(target, removeCondition, listener): void {
        const fn = (...params): void => {
            if (removeCondition(...params)) {
                if (typeof listener === 'function') {
                    listener(...params);
                }
                // eslint-disable-next-line no-unused-expressions
                target && target.removeListener(fn);
            }
        };
        // eslint-disable-next-line no-unused-expressions
        target && target.addListener(fn);
    }

    /**
     * 传入 tabId 等待 tab 的状态变为 complete
     * @param tabId
     * @param callback
     */
    static waitForTabCompleted(tabId, callback): void {
        this.listenAtOnce(chrome.tabs.onUpdated, (id, changeInfo) => {
            const { status } = changeInfo;
            return id === tabId && status && status === 'complete';
        }, callback);
    }
}
