// 1. 注入 inject.js 到主世界 (包括顶级 window 和各个 iframe 的 window)
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 2. 页面加载时，获取初始拦截配置
chrome.storage.local.get(['interceptConfig'], (result) => {
    if (result.interceptConfig) {
        setTimeout(() => {
            window.postMessage({ type: 'SYNC_INTERCEPT_CONFIG', config: result.interceptConfig }, '*');
        }, 500); // 留出一点时间等待 inject.js 加载完成
    }
});

// 3. 监听 Storage 变化：当 Popup 保存配置时，所有 iframe 都会收到此事件，并同步给自己的 inject.js
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.interceptConfig) {
        window.postMessage({ type: 'SYNC_INTERCEPT_CONFIG', config: changes.interceptConfig.newValue }, '*');
    }
});

// 4. 监听来自 Popup 的 Session 操作消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SESSION') {
        // 如果是 iframe 收到消息，你可能只想复制顶层窗口的 session。
        // 这里默认抓取当前环境的 session
        sendResponse({ data: JSON.stringify(sessionStorage) });
    }
    else if (request.type === 'SET_SESSION') {
        try {
            const sessionData = JSON.parse(request.data);
            for (let key in sessionData) {
                sessionStorage.setItem(key, sessionData[key]);
            }
            sendResponse({ success: true });
        } catch (e) {
            sendResponse({ success: false });
        }
    }
    return true; // 保持通道异步
});