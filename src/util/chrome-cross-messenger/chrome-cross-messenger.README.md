# ChromeCrossMessenger

## 产生的原因

在 Chrome 插件的开发中，涉及三类环境：`Background Script（幕后脚本）`、`Content Script（内容脚本）`、`Popup（弹出框）`。在不同环境中能使用的 api 也有所不同。 
当我第一次接触 chrome 插件的消息通信机制时，就被 `chrome.runtime.sendMessage` 和 `chrome.tabs.sendMessage` 迷惑了。

1. 第一个迷惑点是：它们都可以发消息，但是都通过 `chrome.runtime.onMessage` 来接收消息，为什么 `tabs` 发的消息可以被 `runtime` 接收到？
2. 第二个迷惑点是：我需要在发消息前思考，当前处于哪一类环境，需要用的是 `tabs` 还是 `runtime` ?

最重要的是，当我需要在不同环境之间通信，受限于插件能力本身，需要进行繁琐消息链路构造转发，如同一个页面的不同内容脚本，它们之间的通信通常需要借由幕后脚本去转发，消息链路是这样的：内容脚本A -> 幕后脚本 -> 获取当前的tab -> 内容脚本B。

考虑另一种复杂的情况：在`页面A`的`内容脚本A`通过`幕后脚本`创建了`页面B`，并在`页面B`中嵌入了`内容脚本B`，之后`内容脚本A`往`内容脚本B`发送消息，此时的通信链路是这样的：内容脚本A -> 幕后脚本 -> 创建tab并嵌入内容脚本B -> 将tabId发回内容脚本A -> 内容脚本A需要向指定 tab 发送消息 -> 幕后脚本 -> 收到 tab 并转发消息 -> 内容脚本B 

在上面两个情况的过程中，background 的转发是繁琐的，每一次新建通信都要考虑 background 的转发层，于是 `ChromeCrossMessenger` 诞生了。

## 可以做什么

`ChromeCrossMessenger` 的核心功能：
1. 解放了开发时手动编写幕后脚本转发层代码的劳动力
2. 增加了事件和事件处理器的概念，避免消息冲突
3. 可以做到环境无感知的发送消息，即无需考虑当前处于何种环境，通过 `send` 方法，只要存在监听该事件的处理方，就会收到该事件的触发（除了事件发送方本身）

基于以上三个功能，可以减少开发时的心智负担和提升开发效率，后续将会考虑引入 iframe 的支持。

## 用法示例

### 引入

```javascript
import ChromeCrossMessenger from 'EUtil/chrome-cross-messenger/chrome-cross-messenger';
```

### send 方法示例

注意一个 `popup` 的坑，只有 `popup` 处于用户可见状态时，往 `popup` 发消息才是有效的

- `content-script1.js`

```javascript
const crossMessenger = NewCrossMessenger.getInstance();
crossMessenger.addEventHandlers({
    'background': (data, extra) => {
        console.log('receive from background', data, extra);
    },
    'popup': (data, extra) => {
            console.log('receive from popup', data, extra);
    },
    'content': (data, extra) => {
            console.log('receive from content', data, extra);
    },
});

// 方法执行后，会触发 content-script2、background、popup的 content 处理函数
crossMessenger.send('content', 'content-script1 发出的消息...');
```

- `content-script2.js`

```javascript
const crossMessenger = NewCrossMessenger.getInstance();
crossMessenger.addEventHandlers({
    'background': (data, extra) => {
        console.log('receive from background', data, extra);
    },
    'popup': (data, extra) => {
            console.log('receive from popup', data, extra);
    },
    'content': (data, extra) => {
            console.log('receive from content', data, extra);
    },
});

// 方法执行后，会触发 content-script1、background、popup中名为 content 事件处理函数
crossMessenger.send('content', 'content-script1 发出的消息...');
```

- `background.js`

```javascript
const crossMessenger = NewCrossMessenger.getInstance();
crossMessenger.addEventHandlers({
    'background': (data, extra) => {
        console.log('receive from background', data, extra);
    },
    'popup': (data, extra) => {
            console.log('receive from popup', data, extra);
    },
    'content': (data, extra) => {
            console.log('receive from content', data, extra);
    },
});

// 方法执行后，会触发 content-script1、content-script2、popup中名为 background 事件处理函数
crossMessenger.send('background', 'content-script 发出的消息...');
```

- `popup.js`

```javascript
const crossMessenger = NewCrossMessenger.getInstance();
crossMessenger.addEventHandlers({
    'background': (data, extra) => {
        console.log('receive from background', data, extra);
    },
    'popup': (data, extra) => {
            console.log('receive from popup', data, extra);
    },
    'content': (data, extra) => {
            console.log('receive from content', data, extra);
    },
});

// 方法执行后，会触发 content-script1、content-script2、background中名为 popup 事件处理函数
crossMessenger.send('popup', 'content-script 发出的消息...');
```

## API

### API 列表

- getInstance 静态方法，获取实例
- send 懒人版消息发送方法，会将消息发送到发送方之外的全部的消息接受方(对于内容脚本，仅 active tab)
- sendToBackground 此方法保证消息仅触发 background 中对应的事件
- sendToContent 此方法保证消息仅触发当前 active tab 中 content 中对应的事件
- sendToPopup 【在 popup 打开时】此方法保证消息仅触发 popup 中对应的事件
- sendToAll 全频道发送，除了自身之外，所有的消息接受方将收到消息（对于内容脚本，包括非 active 但已打开的 tab）
- sendById 发送消息到指定 tab 除自身之外所有的内容脚本中（对，仅内容脚本）
- sendByIdList 发送消息到指定 tab 数组除自身之外所有的内容脚本中（对，仅内容脚本）
- on 对特定事件监听，会覆盖已有的事件处理函数
- addEventHandlers 监听多个事件，同名 event 会替换，非同名 event 会合并
- isConnected 判断某个 tab 或 frame 中是否存在已连接的 content 可通信

### getInstance

用于获取消息通信工具实例，避免重复实例化

### on 方法

监听一个特定的事件，注意同名 event 会直接替换

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 事件名 | string | 无 |
| handler | 消息处理函数 | EventHandler | 无 |

```typescript
export type EventHandler = (message: any, extra: EventHandlerExtra) => void;

export interface EventHandlerExtra {
    sender: MessageSender;
    sendResponse: (response?: any) => void;
    message: Message; // 未解构的 message 和 EventHandler 中的 message 参数存在区别
}
```

### addEventHandlers 方法

监听多个事件，同名 event 会替换，非同名 event 会合并

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| eventMapping | 新增的事件处理 map | EventMapping | 无 |

```typescript
export interface EventMapping {
    [event: string]: EventHandler;
}
```

### isConnected 方法
|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| { tabId, frameId } | 判断某个 tab 或 frame 是否存在 content 可通信 | { tabId?: number; frameId?: number } | 无 |


### send 方法

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

### sendToXxx 方法

当你确认确定需要往哪一类环境发消息时，推荐使用以下方法，减少消息的污染。

#### sendToBackground

此方法保证消息仅触发 background 中对应的事件，对应如下三种情况：

1. 处于 background 时调用此方法：不处理，并发出警告，因为无法拿到 sender 等信息
2. 处于 popup 时调用此方法：构造 Message 直接传递
3. 处于 content 时调用此方法：构造 Message 直接传递

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

#### sendToContent

此方法保证消息仅触发当前 active tab 中 content 中对应的事件，对应如下三种情况：

1. 处于 background 时调用此方法：构造 Message ，获取所有 active tab 的 tab id 后发送
2. 处于 popup 时调用此方法：同 background
3. 处于 content 时调用此方法：构造 Forward 类型的 Message 传递到 background ，background 再获取所有 active tab 的 tab id 后发送（不会触发消息发出方 content 中的同名 event）

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

#### sendToPopup

【在 popup 打开时】此方法保证消息仅触发 popup 中对应的事件，对应如下三种情况：

1. 处于 background 时调用此方法：构造 Message ，直接发送
2. 处于 popup 时调用此方法：不处理，并发出警告，因为无法拿到 sender 等信息
3. 处于 content 时调用此方法：构造 Forward 类型的 Message 传递到 background ，background 再直接发送到 popup

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

#### sendToAll

全频道发送，除了自身之外，所有消息接受方将收到消息，包括未 active 但已打开的 tab

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

### sendByXxx 方法

通用用于指定 tab 的 id ，然后往指定 tab 的 content script 中发送消息

#### sendById

发送消息到指定 tab 除自身之外所有的内容脚本中（对，仅内容脚本）

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| id | 指定的 tab id | number | 无 |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |

#### sendByIdList

发送消息到指定 tab 数组除自身之外所有的内容脚本中（对，仅内容脚本）

|  参数  | 说明 | 类型 | 默认值 |
| :----: | :----: | :----: | :----: |
| id | 指定的 tab id | number | 无 |
| event | 通信频道的前缀 | string | 无 |
| data（可选） | 传递的数据 | any | 无 |
| options（可选） | 可指定 frameId、extensionId、includeTlsChannelId、callback 等 | SendOptions | 无 |
