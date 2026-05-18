let interceptConfig = { domains: [], fields: {} };

// 监听来自 content.js 的配置更新
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'SYNC_INTERCEPT_CONFIG') {
        interceptConfig = event.data.config;
    }
});

// 检查 URL 是否在拦截名单内
function isMatchDomain(url) {
    if (!interceptConfig.domains || interceptConfig.domains.length === 0) return false;
    return interceptConfig.domains.some(domain => url.includes(domain));
}

// 替换 JSON 参数的逻辑
function replaceJsonParams(body) {
    if (!body || typeof body !== 'string' || Object.keys(interceptConfig.fields).length === 0) return body;
    try {
        let jsonObj = JSON.parse(body);
        Object.assign(jsonObj, interceptConfig.fields);
        return JSON.stringify(jsonObj);
    } catch (e) {
        return body; // 非 JSON 格式原样返回
    }
}

// ---------------- 拦截 Fetch ----------------
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

    if (url && isMatchDomain(url) && args[1] && args[1].body) {
        // 如果是 POST/PUT 请求且携带 body，替换 body 中的字段
        args[1].body = replaceJsonParams(args[1].body);
        console.log(`[Plugin] Fetch Intercepted:`, url, args[1].body);
    }
    return originalFetch.apply(this, args);
};

// ---------------- 拦截 XMLHttpRequest ----------------
const originalXHR = window.XMLHttpRequest;
window.XMLHttpRequest = function () {
    const xhr = new originalXHR();
    const originalOpen = xhr.open;
    const originalSend = xhr.send;
    let requestUrl = '';

    xhr.open = function (method, url, ...rest) {
        requestUrl = url;
        return originalOpen.call(this, method, url, ...rest);
    };

    xhr.send = function (body) {
        if (requestUrl && isMatchDomain(requestUrl) && body) {
            body = replaceJsonParams(body);
            console.log(`[Plugin] XHR Intercepted:`, requestUrl, body);
        }
        return originalSend.call(this, body);
    };
    return xhr;
};