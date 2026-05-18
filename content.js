// 1. 注入 inject.js 到主世界，以便它可以重写页面的原生 fetch/XHR
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 2. 监听后台配置更新，通过 window.postMessage 传给 inject.js
chrome.storage.local.get(['interceptConfig'], (result) => {
    if (result.interceptConfig) {
        // 等待 inject.js 挂载完成后发送
        setTimeout(() => {
            window.postMessage({ type: 'SYNC_INTERCEPT_CONFIG', config: result.interceptConfig }, '*');
        }, 500);
    }
});

// 3. 监听来自 Popup 的消息（包括操作 Session 和 更新拦截配置）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_CONFIG') {
        window.postMessage({ type: 'SYNC_INTERCEPT_CONFIG', config: request.config }, '*');
        sendResponse({ success: true });
    }
    else if (request.type === 'GET_SESSION') {
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