import MessageSender = chrome.runtime.MessageSender;

export enum ForwardType {
    All = 'all',
    ActiveTab = 'active-tab',
    TabIdList = 'tab-id-list',
    Popup = 'popup',
}

export interface MessageOptions {
    forwardType?: ForwardType;
    forwardOptions?: SendOptions;
    forwardIdList?: number[];
}

export interface Message {
    sourceId: string;
    event: string;
    channel?: string;
    data: any;
    options?: MessageOptions;
    parent?: Message;
}

export interface EventHandlerExtra {
    sender: MessageSender;
    sendResponse: (response?: any) => void;
    message: Message;
}

export interface RuntimeOptions {
    includeTlsChannelId?: boolean;
}

export interface TabsOptions {
    frameId?: number;
}

export type InternalEventHandler = (message: Message, sender?: MessageSender, sendResponse?: (response?: any) => void) => void;
export type EventHandler = (message: any, extra: EventHandlerExtra) => void;

export interface SendOptions extends RuntimeOptions, TabsOptions {
    callback?: (response: any) => void;
    extensionId?: string;
}

export enum MetaEventName {
    Connect = '^cross-content-messenger-connect$', // 用于通知 Background 当前 tab 已经连接，可以接收消息
    MessengerDisconnect = '^cross-content-messenger-disconnect$', // 用于通知 Background 当前通信工具已经关闭连接（tab未关闭，其他content的通信正常传输）
    TabDisconnect = '^cross-content-tab-disconnect$', // 用于通知 Background 当前 tab 已经关闭连接
    Forward = '^cross-content-messenger-forward$', // 表示需要转发
}

export interface DoSendParams {
    extensionId?: string;
    id?: number;
    message?: any;
    options?: SendOptions;
    callback?: (response: any) => void;
}

export interface BuildMessageParams extends MessageOptions {
    event: string;
    data?: any;
    parent?: Message;
}

export interface BuildForwardMessageParams extends MessageOptions {
    event: string;
    data?: any;
    parent?: Message;
}

export interface EventMapping {
    [event: string]: EventHandler;
}

export interface ConnectedFrame {
    set: Set<string>;
    tabId: number;
}
