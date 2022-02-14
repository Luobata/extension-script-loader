import { genID, getScriptType, ScriptType } from './utils';
import {
    BuildMessageParams,
    ConnectedFrame,
    DoSendParams,
    EventHandler,
    EventMapping,
    ForwardType,
    InternalEventHandler,
    Message,
    MetaEventName,
    RuntimeOptions,
    SendOptions,
    TabsOptions,
} from './types';
import TabsUtil from '../tabs-util';

export default class ChromeCrossMessenger {
    private static instance: undefined | ChromeCrossMessenger; // 唯一实例
    private readonly id: string; // 当前注册的唯一 id
    private eventMapping: EventMapping; // 事件处理
    private readonly contextType: ScriptType; // 当前所处的环境
    private readonly connectedTab: Record<number, Set<string>>; // 已连接的 tab 的记录表，由于一个 tab 会有多个 ContentScript，所以一个tabId对应多个MessengerId
    private readonly connectedFrame: Record<number, ConnectedFrame>; // 记录已连接的frameId，由于一个 iframe 会有多个 ContentScript，所以一个iframeId对应多个MessengerId和tabId，tadId用于tab断开连接时完整删除
    private listenerCallback: InternalEventHandler; // 统一消息处理函数
    private isBeforeRefresh: boolean; // 刷新前标记
    private refreshTimer: NodeJS.Timer; // 刷新清除定时器

    private constructor() {
        this.id = genID();
        this.contextType = getScriptType();
        this.eventMapping = {};
        this.connectedTab = {};
        this.connectedFrame = {};
        this.listenerCallback = null;
        this.isBeforeRefresh = false;
        this.refreshTimer = null;
        this.initMetaEvents();
        this.notifyConnect();
        this.initListener();
    }

    public static getInstance(): ChromeCrossMessenger {
        if (!this.instance) {
            this.instance = new ChromeCrossMessenger();
        }
        // console.log(`${this.instance.contextType} CrossMessenger`, this.instance.id);
        return this.instance;
    }

    /**
     * 监听一个特定的事件，注意同名 event 会直接替换
     * @param event 事件名
     * @param handler 消息处理函数
     */
    public on(event: string, handler: EventHandler): void {
        this.eventMapping[event] = handler;
    }

    /**
     * 监听多个事件，同名 event 会替换，非同名 event 会合并
     * @param eventMapping 新增的事件处理 map
     */
    public addEventHandlers(eventMapping: EventMapping): void {
        this.eventMapping = Object.assign({}, this.eventMapping, eventMapping);
    }

    /**
     * 监听多个事件，同名 event 会替换，非同名 event 会合并(兼容旧版API)
     * @param eventMapping 新增的事件处理 map
     * @deprecated
     */
    public assignEventHandler(eventMapping: EventMapping): void {
        this.addEventHandlers(eventMapping);
    }

    /**
     * 懒人版消息发送方法，会将消息发送到发送方之外的全部消息接受方，对应如下情况：
     * 1、处于 background 时调用此方法，消息发送到：popup、当前 active tab 的 content
     * 2、处于 popup 时调用此方法，消息发送到：background、当前 active tab 的 content
     * 3、处于 content 时调用此方法，消息发送到：background、popup、排查自身之后当前 active tab 的 content
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public send(event: string, data?: any, options?: SendOptions): void {
        if (this.isContent()) {
            this.sendToContent(event, data, options);
            this.sendToBackground(event, data, options);
            this.sendToPopup(event, data, options);
        } else if (this.isBackground()) {
            this.sendToContent(event, data, options);
            this.sendToPopup(event, data, options);
        } else {
            this.sendToBackground(event, data, options);
            this.sendToContent(event, data, options);
        }
    }

    /**
     * 此方法保证消息仅触发 background 中对应的事件，对应如下三种情况：
     * 1、处于 background 时调用此方法：不处理，并发出警告，因为无法拿到 sender 等信息
     * 2、处于 popup 时调用此方法：构造 Message 直接传递
     * 3、处于 content 时调用此方法：构造 Message 直接传递
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendToBackground(
        event: string,
        data?: any,
        options?: SendOptions,
    ): void {
        const message = this.buildMessage({
            event,
            data,
        });
        if (this.isBackground()) {
            console.warn('当前处于 background 中...');
            return;
        }
        this.doSend({
            message,
            options,
            callback: options?.callback,
        });
    }

    /**
     * 此方法保证消息仅触发当前 active tab 中 content 中对应的事件，对应如下三种情况：
     * 1、处于 background 时调用此方法：构造 Message ，获取所有 active tab 的 tab id 后发送
     * 2、处于 popup 时调用此方法：同 background
     * 3、处于 content 时调用此方法：构造 Forward 类型的 Message 传递到 background ，background 再获取所有 active tab 的 tab id 后发送（不会触发消息发出方 content 中的同名 event）
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendToContent(
        event: string,
        data?: any,
        options?: SendOptions,
    ): void {
        const message = this.buildMessage(
            {
                event,
                data,
                forwardType: ForwardType.ActiveTab,
                forwardOptions: options,
            },
            true,
        );
        const sendParams: DoSendParams = {
            message,
            options,
            callback: options?.callback,
        };
        if (this.isContent()) {
            this.doSend(sendParams);
        } else {
            this.doSendToActive(sendParams);
        }
    }

    /**
     * 【在 popup 打开时】此方法保证消息仅触发 popup 中对应的事件，对应如下三种情况：
     * 1、处于 background 时调用此方法：构造 Message ，直接发送
     * 2、处于 popup 时调用此方法：不处理，并发出警告，因为无法拿到 sender 等信息
     * 3、处于 content 时调用此方法：构造 Forward 类型的 Message 传递到 background ，background 再直接发送到 popup
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendToPopup(event: string, data?: any, options?: SendOptions): void {
        const message = this.buildMessage(
            {
                event,
                data,
                forwardType: ForwardType.Popup,
                forwardOptions: options,
            },
            true,
        );
        if (this.isPopup()) {
            console.warn('当前处于 popup 中...');
            return;
        }
        this.doSend({
            message,
            options,
            callback: options?.callback,
        });
    }

    /**
     * 全频道发送，除了自身之外，所有消息接受方将收到消息，包括未 active 但已打开的 tab
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendToAll(event: string, data?: any, options?: SendOptions): void {
        if (this.isContent()) {
            const message = this.buildMessage(
                {
                    event,
                    data,
                    forwardType: ForwardType.All,
                    forwardOptions: options,
                },
                true,
            );
            this.doSend({
                message,
                options,
                callback: options?.callback,
            });
            this.sendToBackground(event, data, options);
            this.sendToPopup(event, data, options);
            return;
        }
        const message = this.buildMessage({
            event,
            data,
        });
        this.doSendToAll({
            message,
            options,
            callback: options?.callback,
        });
        if (this.isBackground()) {
            this.sendToPopup(event, data, options);
        } else {
            this.sendToBackground(event, data, options);
        }
    }

    /**
     * 发送消息到指定 tab 除自身之外所有的内容脚本中（对，仅内容脚本）
     * @param id 指定的 tab id
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendById(
        id: number,
        event: string,
        data?: any,
        options?: SendOptions,
    ): void {
        this.sendByIdList([id], event, data, options);
    }

    /**
     * 发送消息到指定 tab 数组除自身之外所有的内容脚本中（对，仅内容脚本）
     * @param idList 指定的 tab id 数组
     * @param event 事件名
     * @param data 传递的数据
     * @param options 可指定 frameId、extensionId、includeTlsChannelId、callback 等
     */
    public sendByIdList(
        idList: number[],
        event: string,
        data?: any,
        options?: SendOptions,
    ): void {
        const message = this.buildMessage(
            {
                event,
                data,
                forwardType: ForwardType.TabIdList,
                forwardOptions: options,
                forwardIdList: idList,
            },
            true,
        );
        const sendParams: DoSendParams = {
            message,
            options,
            callback: options?.callback,
        };
        if (this.isExtension()) {
            this.doSendByIdList(idList, sendParams);
        } else {
            this.doSend(sendParams);
        }
    }

    /**
     * 判断某个 tab 中是否存在已连接的 content (兼容旧版API)
     * @param tabId 需要检测的 tab id
     * @param frameId 需要检测的 frame id
     */
    public isConnected({
        tabId,
        frameId,
    }: {
        tabId?: number;
        frameId?: number;
    }): boolean {
        const connectedTabSet = this.connectedTab[tabId];
        const connectedFrameSet = this.connectedFrame[frameId]?.set;
        return !!(
            (connectedTabSet && connectedTabSet.size) ||
            (connectedFrameSet && connectedFrameSet.size)
        );
    }

    /**
     * 发送消息到所有 active tab 的 content 中
     * @param sendParams 发消息的参数
     * @private
     */
    private doSendToActive(sendParams: DoSendParams): void {
        TabsUtil.getActiveTabIdList((idList) => {
            this.doSendByIdList(idList, sendParams);
        });
    }

    /**
     * 发送消息到所有 tab 的 content 中
     * @param sendParams 发消息的参数
     * @private
     */
    private doSendToAll(sendParams: DoSendParams): void {
        TabsUtil.getAllTabIdList((idList) => {
            this.doSendByIdList(idList, sendParams);
        });
    }

    /**
     * 发送消息到指定 tab 数组中
     * @param idList 指定的 tab id 数组
     * @param sendParams 发消息的参数
     * @private
     */
    private doSendByIdList(idList: number[], sendParams: DoSendParams): void {
        idList.forEach((activeId) => {
            sendParams.id = activeId;
            this.doSend(sendParams);
        });
    }

    /**
     * 进行实际的消息发送
     * @param id 指定的 tab id
     * @param extensionId 指定的插件 id ，可以和其他插件通信
     * @param message 消息体
     * @param options 指定的 options
     * @param callback 回调函数
     * @private
     */
    private doSend({
        id,
        extensionId,
        message,
        options,
        callback,
    }: DoSendParams): void {
        const args = [];
        if (id) args.push(id);
        if (extensionId) args.push(extensionId);
        if (message) args.push(message);
        if (options) {
            const realOptions = this.extraOptions(options);
            realOptions && args.push(realOptions);
        }
        if (callback) args.push(callback);
        // 处于 background 且没有指定 id 时，消息就会发送到 popup 页
        if (this.isExtension() && id) {
            chrome.tabs.sendMessage.apply(null, args);
        } else {
            chrome.runtime.sendMessage.apply(null, args);
        }
    }

    /**
     * 初始化默认的事件，包括连接、断开连接、转发事件，仅在 background 中注册
     * @private
     */
    private initMetaEvents(): void {
        if (!this.isBackground()) return;

        this.addEventHandlers({
            // 记录 tab 连接
            [MetaEventName.Connect]: (data, { sender, message }) => {
                const tabId = sender.tab.id;
                const sourceId = message.sourceId;
                const frameId = sender.frameId;

                // console.log(`tab=${tabId}, frame=${frameId} is connected...`);

                if (!this.connectedTab[tabId])
                    this.connectedTab[tabId] = new Set<string>();
                this.connectedTab[tabId].add(sourceId);

                if (!this.connectedFrame[frameId])
                    this.connectedFrame[frameId] = {
                        set: new Set<string>(),
                        tabId,
                    };
                this.connectedFrame[frameId].set.add(sourceId);
            },

            // messenger 断开连接，清空该 messenger id 相关的连接状态
            [MetaEventName.MessengerDisconnect]: (
                data,
                { sender, message },
            ) => {
                const tabId = sender.tab.id;
                const sourceId = message.sourceId;
                const frameId = sender.frameId;

                // console.log(`tab=${tabId}, frame=${frameId} is disconnected...`, this.connectedTab, this.connectedFrame);

                const connectedTabSet = this.connectedTab[tabId];
                if (connectedTabSet) {
                    connectedTabSet.delete(sourceId);
                    if (connectedTabSet.size === 0)
                        delete this.connectedTab[tabId];
                }

                const connectedFrameSet = this.connectedFrame[frameId].set;
                if (connectedFrameSet) {
                    connectedFrameSet.delete(sourceId);
                    if (connectedFrameSet.size === 0)
                        delete this.connectedFrame[frameId];
                }
            },

            // tab 断开连接，清空该 tab 下所有的连接状态
            [MetaEventName.TabDisconnect]: (data, { sender }) => {
                const tabId = sender.tab.id;

                delete this.connectedTab[tabId];
                Object.keys(this.connectedFrame)
                    .filter((frameId) => {
                        return this.connectedFrame[frameId].tabId === tabId;
                    })
                    .forEach((frameId) => {
                        delete this.connectedFrame[frameId];
                    });

                // console.log(`tab close: tab=${tabId} is disconnected...`, this.connectedTab, this.connectedFrame);
            },

            // 处理转发
            [MetaEventName.Forward]: (data, { message }) => {
                const sendParams: DoSendParams = {
                    message: message.data,
                    options: message.options.forwardOptions,
                };
                const forwardType = message?.options?.forwardType;
                // 根据类型做不同的中转处理
                switch (forwardType) {
                    case ForwardType.ActiveTab:
                        this.doSendToActive(sendParams);
                        break;
                    case ForwardType.All:
                        this.doSendToAll(sendParams);
                        break;
                    case ForwardType.TabIdList:
                        this.doSendByIdList(
                            message?.options?.forwardIdList || [],
                            sendParams,
                        );
                        break;
                    case ForwardType.Popup:
                        this.doSend(sendParams);
                        break;
                    default:
                        console.error(`${this.id} 转发消息异常`, message);
                        break;
                }
            },
        });
    }

    /**
     * 初始化消息处理函数，将判断事件和对应的处理函数，获得可调用的事件处理函数时进行调用
     * @private
     */
    private initListener(): void {
        this.listenerCallback = (
            message: Message,
            sender,
            sendResponse,
        ): void => {
            // 兼容没有使用 cross-messenger 的通信
            const targetEvent = message && (message.event || message.channel);
            const fn = this.eventMapping[targetEvent];
            if (fn && message.sourceId !== this.id) {
                fn(message.data, {
                    message,
                    sender,
                    sendResponse,
                });
            }
            sendResponse({});
        };

        // 添加消息统一处理函数
        chrome.runtime.onMessage.addListener(this.listenerCallback);

        // 当已经绑定过监听器、处于背景、非顶层window，不需要绑定监听器
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        if (
            window[`beforeUnloadListenerInstalled${this.id}`] ||
            this.isBackground() ||
            window.self !== window.top
        )
            return;

        // 页面刷新时需要移除相关的监听，否则会重复触发
        window.addEventListener('beforeunload', () => {
            // 标记刷新前已经触发了 beforeunload ，否则不认为是刷新事件
            this.isBeforeRefresh = true;
            if (this.refreshTimer) clearTimeout(this.refreshTimer);
            this.refreshTimer = setTimeout(() => {
                this.isBeforeRefresh = false;
            }, 1000);
        });
        window.addEventListener('unload', () => {
            if (!this.isBeforeRefresh) return;
            this.handleTabDisconnect();
        });

        // 标记当前脚本已安装消息处理
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        window[`beforeUnloadListenerInstalled${this.id}`] = true;
    }

    /**
     * 构造消息
     * @param event 事件
     * @param data 数据
     * @param parent 父消息
     * @param forwardOptions 转发选项
     * @param forwardType 转发类型
     * @param forwardIdList 转发的id数组
     * @param forward 是否允许在处于 content 时构造转发类型的消息
     * @private
     */
    private buildMessage(
        {
            event,
            data,
            parent,
            forwardOptions,
            forwardType,
            forwardIdList,
        }: BuildMessageParams,
        forward?: boolean,
    ): Message {
        let message: Message = {
            sourceId: this.id,
            event,
            data,
            parent,
        };

        // 处于 content 且 forward 为 true 时构造一层 forward 类型的 Message ，用于中转
        if (forward && this.isContent()) {
            message = {
                sourceId: this.id,
                event: MetaEventName.Forward,
                data: message,
                options: {
                    forwardOptions,
                    forwardType,
                    forwardIdList,
                },
                parent: message,
            } as Message;
        }
        return message;
    }

    /**
     * 提取选项，chrome.runtime.sendMessage 和 chrome.tabs.sendMessage 允许的 options 分别不同
     * 当处于 background 和 popup 时提取 tabs 的 options 否则提取 runtime 的 options
     * @param options 混杂的选项
     * @private
     */
    private extraOptions(
        options: SendOptions,
    ): RuntimeOptions | TabsOptions | null {
        if (this.isExtension()) {
            return this.extraTabsOptions(options);
        }
        return this.extraRuntimeOptions(options);
    }

    /**
     * 提取 chrome.runtime.sendMessage 允许的 options
     * @param options 混杂的选项
     * @private
     */
    private extraRuntimeOptions(options: SendOptions): RuntimeOptions | null {
        if (!options.includeTlsChannelId) return null;
        return {
            includeTlsChannelId: options.includeTlsChannelId,
        };
    }

    /**
     * 提取 chrome.tabs.sendMessage 允许的 options
     * @param options 混杂的选项
     * @private
     */
    private extraTabsOptions(options: SendOptions): TabsOptions | null {
        if (!options.frameId) return null;
        return {
            frameId: options.frameId,
        };
    }

    /**
     * 通知 background 连接
     * @private
     */
    private notifyConnect(): void {
        if (!this.isContent()) return;
        this.sendToBackground(MetaEventName.Connect);
    }

    /**
     * 开发者主动关闭 Messenger 的连接时调用，仅清空当前 Messenger 相关的连接状态
     * @private
     */
    private notifyMessengerDisconnect(): void {
        if (!this.isContent()) return;
        this.sendToBackground(MetaEventName.MessengerDisconnect);
    }

    /**
     * tab 整个被关闭时调用，会清空所有连接状态
     * @private
     */
    private handleTabDisconnect(): void {
        if (!this.isContent()) return;
        this.sendToBackground(MetaEventName.TabDisconnect);
        this.removeListener();
    }

    /**
     * 开发者主动关闭 Messenger 的连接
     * 1、通知 background 仅清空当前 Messenger 相关的连接状态
     * 2、清理 eventMapping 和 listenerCallback
     */
    public close(): void {
        if (!this.isContent()) return;
        this.sendToBackground(MetaEventName.MessengerDisconnect);
        this.removeListener();
    }

    /**
     * 开发者主动关闭 Messenger 的连接(兼容旧版API)
     */
    public clear(): void {
        this.close();
    }

    /**
     * 移除事件处理器和监听器
     * @private
     */
    private removeListener(): void {
        this.eventMapping = {};
        if (this.listenerCallback)
            chrome.runtime.onMessage.removeListener(this.listenerCallback);
    }

    /**
     * 处于 background 或 popup ，属于插件
     */
    public isExtension(): boolean {
        return this.isBackground() || this.isPopup();
    }

    /**
     * 是否处于 content
     */
    public isContent(): boolean {
        return this.contextType === ScriptType.Content;
    }

    /**
     * 是否处于 background
     */
    public isBackground(): boolean {
        return this.contextType === ScriptType.Background;
    }

    /**
     * 是否处于 popup
     */
    public isPopup(): boolean {
        return this.contextType === ScriptType.Popup;
    }
}
