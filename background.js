// background.js
// 存储规则: { domains: ["example.com"], replacements: [{ field: "userId", oldValue: "123", newValue: "456" }] }
let rules = {
    domains: [],
    replacements: []
}

// 从存储加载规则
chrome.storage.local.get(['rules'], (result) => {
    if (result.rules) {
        rules = result.rules
    }
})

// 监听规则更新
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.rules) {
        rules = changes.rules.newValue
    }
})

// 解析URL编码的请求体
function parseUrlEncoded(body) {
    const params = new URLSearchParams(body)
    const obj = {}
    for (const [key, value] of params) {
        obj[key] = value
    }
    return obj
}

// 将对象转换回URL编码字符串
function toUrlEncoded(obj) {
    return new URLSearchParams(obj).toString()
}

// 替换字段的值
function replaceFieldValues(obj, replacements) {
    const newObj = { ...obj }
    for (const { field, oldValue, newValue } of replacements) {
        if (field && newObj.hasOwnProperty(field)) {
            const currentValue = String(newObj[field])
            // 如果设置了旧值匹配，则只有匹配时才替换
            if (oldValue && oldValue.trim() !== "") {
                if (currentValue === oldValue) {
                    newObj[field] = newValue
                }
            } else {
                // 没有设置旧值，直接替换该字段的值
                newObj[field] = newValue
            }
        }
    }
    return newObj
}

// 检查域名是否在允许列表中
function isDomainAllowed(url) {
    if (!rules.domains || rules.domains.length === 0) return false
    try {
        const hostname = new URL(url).hostname
        return rules.domains.some(domain => hostname.includes(domain))
    } catch (e) {
        return false
    }
}

// 拦截请求
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // 只处理POST请求且有请求体的
        if (details.method !== 'POST') return
        if (!isDomainAllowed(details.url)) return
        if (!rules.replacements || rules.replacements.length === 0) return

        // 处理表单数据 (application/x-www-form-urlencoded)
        if (details.requestBody && details.requestBody.formData) {
            const formData = details.requestBody.formData
            // 将formData对象转换为普通对象
            const obj = {}
            for (const key in formData) {
                obj[key] = formData[key][0]
            }
            const newObj = replaceFieldValues(obj, rules.replacements)

            // 检查是否有变化
            if (JSON.stringify(obj) !== JSON.stringify(newObj)) {
                // 构建新的请求体
                const newFormData = new URLSearchParams()
                for (const key in newObj) {
                    newFormData.append(key, newObj[key])
                }
                return { requestBody: { formData: newFormData } }
            }
        }

        // 处理JSON或纯文本 (raw)
        if (details.requestBody && details.requestBody.raw) {
            try {
                const decoder = new TextDecoder('utf-8')
                const rawData = details.requestBody.raw[0].bytes
                const bodyStr = decoder.decode(rawData)
                let contentType = details.requestHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value || ''

                // 处理JSON
                if (contentType.includes('application/json')) {
                    const obj = JSON.parse(bodyStr)
                    const newObj = replaceFieldValues(obj, rules.replacements)
                    if (JSON.stringify(obj) !== JSON.stringify(newObj)) {
                        const encoder = new TextEncoder()
                        return { requestBody: { raw: [{ bytes: encoder.encode(JSON.stringify(newObj)) }] } }
                    }
                }
                // 处理URL编码
                else if (contentType.includes('application/x-www-form-urlencoded')) {
                    const obj = parseUrlEncoded(bodyStr)
                    const newObj = replaceFieldValues(obj, rules.replacements)
                    if (JSON.stringify(obj) !== JSON.stringify(newObj)) {
                        const encoder = new TextEncoder()
                        return { requestBody: { raw: [{ bytes: encoder.encode(toUrlEncoded(newObj)) }] } }
                    }
                }
            } catch (e) {
                console.error('解析请求体失败:', e)
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["blocking", "requestBody"]
)