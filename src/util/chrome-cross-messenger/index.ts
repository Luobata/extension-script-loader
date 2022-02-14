import ChromeCrossMessenger from './chrome-cross-messenger';

// 决定限定获取实例函数的名称，方便全局搜索
export const getCrossMessengerInstance = (): ChromeCrossMessenger => {
    return ChromeCrossMessenger.getInstance();
};
