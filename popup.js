// popup.js
// 存储键名
const STORAGE_KEY = 'rules'

// 当前规则
let currentRules = {
    domains: [],
    replacements: []
}

// DOM 元素
const domainsTextarea = document.getElementById('domains')
const replacementsList = document.getElementById('replacementsList')
const fieldName = document.getElementById('fieldName')
const oldValue = document.getElementById('oldValue')
const newValue = document.getElementById('newValue')
const addReplacementBtn = document.getElementById('addReplacementBtn')
const saveDomainsBtn = document.getElementById('saveDomainsBtn')
const enableRulesBtn = document.getElementById('enableRulesBtn')
const disableRulesBtn = document.getElementById('disableRulesBtn')
const tab1Status = document.getElementById('tab1Status')
const copySessionBtn = document.getElementById('copySessionBtn')
const pasteSessionBtn = document.getElementById('pasteSessionBtn')
const sessionDataTextarea = document.getElementById('sessionData')
const tab2Status = document.getElementById('tab2Status')

// 加载规则
async function loadRules() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            if (result.rules) {
                currentRules = result.rules
            } else {
                currentRules = { domains: [], replacements: [] }
            }
            resolve(currentRules)
        })
    })
}

// 保存规则
async function saveRules() {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: currentRules }, () => {
            resolve()
        })
    })
}

// 渲染域名列表
function renderDomains() {
    domainsTextarea.value = currentRules.domains.join('\n')
}

// 渲染替换规则列表
function renderReplacements() {
    if (!currentRules.replacements || currentRules.replacements.length === 0) {
        replacementsList.innerHTML = '<div style="color:#999; padding:8px; text-align:center;">暂无替换规则</div>'
        return
    }

    replacementsList.innerHTML = ''
    currentRules.replacements.forEach((rule, index) => {
        const div = document.createElement('div')
        div.className = 'rule-item'
        const oldValueDisplay = rule.oldValue && rule.oldValue.trim() !== "" ? ` (仅当值为 "${escapeHtml(rule.oldValue)}" 时)` : " (替换所有值)"
        div.innerHTML = `
      <div style="margin-bottom:4px;">
        <span class="rule-badge">字段</span> <strong>${escapeHtml(rule.field)}</strong>
      </div>
      <div style="margin-bottom:4px;">
        <span class="rule-badge">原值</span> <span style="color:#666;">${rule.oldValue && rule.oldValue.trim() !== "" ? escapeHtml(rule.oldValue) : "任意值"}${oldValueDisplay}</span>
      </div>
      <div>
        <span class="rule-badge">新值</span> <strong style="color:#34a853;">${escapeHtml(rule.newValue)}</strong>
      </div>
      <button class="delete-replacement" data-index="${index}" style="float:right; background:#ea4335; color:white; border:none; border-radius:4px; padding:2px 8px; margin-top:-30px; cursor:pointer;">删除</button>
    `
        replacementsList.appendChild(div)
    })

    // 绑定删除事件
    document.querySelectorAll('.delete-replacement').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(btn.dataset.index)
            currentRules.replacements.splice(index, 1)
            renderReplacements()
            saveRules().then(() => {
                showStatus(tab1Status, '规则已删除', 'success')
            })
        })
    })
}

// 简单的防XSS
function escapeHtml(str) {
    if (!str) return ''
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;'
        if (m === '<') return '&lt;'
        if (m === '>') return '&gt;'
        return m
    })
}

// 显示状态消息
function showStatus(element, message, type) {
    element.textContent = message
    element.className = `status ${type}`
    element.style.display = 'block'
    setTimeout(() => {
        element.style.display = 'none'
    }, 2000)
}

// Tab 切换
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn')
    const contents = document.querySelectorAll('.tab-content')

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab
            tabs.forEach(t => t.classList.remove('active'))
            contents.forEach(c => c.classList.remove('active'))
            tab.classList.add('active')
            document.getElementById(targetId).classList.add('active')
        })
    })
}

// 获取当前活动标签页的ID
async function getCurrentTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab.id
}

// 读取当前页面的sessionStorage
async function readSessionStorage() {
    const tabId = await getCurrentTabId()
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                const data = {}
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i)
                    data[key] = sessionStorage.getItem(key)
                }
                return data
            }
        })
        return results[0]?.result || {}
    } catch (err) {
        console.error('读取失败:', err)
        throw new Error('无法访问页面，请确保当前页面允许扩展运行脚本')
    }
}

// 写入sessionStorage到当前页面
async function writeSessionStorage(data) {
    const tabId = await getCurrentTabId()
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (sessionData) => {
                sessionStorage.clear()
                for (const [key, value] of Object.entries(sessionData)) {
                    sessionStorage.setItem(key, value)
                }
                return true
            },
            args: [data]
        })
        return true
    } catch (err) {
        console.error('写入失败:', err)
        throw new Error('无法写入，请确保当前页面允许扩展运行脚本')
    }
}

// 初始化
async function init() {
    await loadRules()
    renderDomains()
    renderReplacements()

    // 保存域名
    saveDomainsBtn.addEventListener('click', async () => {
        const text = domainsTextarea.value
        const domains = text.split('\n').filter(d => d.trim().length > 0).map(d => d.trim())
        currentRules.domains = domains
        await saveRules()
        showStatus(tab1Status, `已保存 ${domains.length} 个域名`, 'success')
    })

    // 添加替换规则
    addReplacementBtn.addEventListener('click', async () => {
        const field = fieldName.value.trim()
        const oldVal = oldValue.value.trim()
        const newVal = newValue.value.trim()

        if (!field) {
            showStatus(tab1Status, '请填写字段名', 'error')
            return
        }
        if (newVal === "") {
            showStatus(tab1Status, '请填写新值', 'error')
            return
        }

        if (!currentRules.replacements) currentRules.replacements = []
        currentRules.replacements.push({
            field: field,
            oldValue: oldVal,
            newValue: newVal
        })

        fieldName.value = ''
        oldValue.value = ''
        newValue.value = ''
        renderReplacements()
        await saveRules()
        showStatus(tab1Status, '替换规则已添加', 'success')
    })

    // 启用拦截
    enableRulesBtn.addEventListener('click', () => {
        if (currentRules.domains.length === 0) {
            showStatus(tab1Status, '请先设置至少一个域名', 'error')
            return
        }
        if (currentRules.replacements.length === 0) {
            showStatus(tab1Status, '请先添加至少一条替换规则', 'error')
            return
        }
        showStatus(tab1Status, '✅ 拦截规则已生效！', 'success')
    })

    // 禁用拦截 - 清空规则但保留界面配置
    disableRulesBtn.addEventListener('click', async () => {
        currentRules.domains = []
        currentRules.replacements = []
        renderDomains()
        renderReplacements()
        await saveRules()
        showStatus(tab1Status, '已禁用所有拦截规则', 'success')
    })

    // 复制sessionStorage
    copySessionBtn.addEventListener('click', async () => {
        try {
            const data = await readSessionStorage()
            const jsonStr = JSON.stringify(data, null, 2)
            sessionDataTextarea.value = jsonStr
            await navigator.clipboard.writeText(jsonStr)
            showStatus(tab2Status, '✅ 已复制到剪贴板', 'success')
        } catch (err) {
            showStatus(tab2Status, err.message, 'error')
        }
    })

    // 写入sessionStorage
    pasteSessionBtn.addEventListener('click', async () => {
        let jsonStr = sessionDataTextarea.value
        if (!jsonStr.trim()) {
            try {
                jsonStr = await navigator.clipboard.readText()
                sessionDataTextarea.value = jsonStr
            } catch (e) {
                showStatus(tab2Status, '请在文本框中粘贴数据或先复制', 'error')
                return
            }
        }

        try {
            const data = JSON.parse(jsonStr)
            if (typeof data !== 'object' || data === null) {
                throw new Error('数据格式无效')
            }
            await writeSessionStorage(data)
            showStatus(tab2Status, '✅ 已成功写入当前页面的 sessionStorage', 'success')
        } catch (err) {
            showStatus(tab2Status, '数据格式错误: ' + err.message, 'error')
        }
    })
}

initTabs()
init()