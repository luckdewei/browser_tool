// Tab 切换逻辑
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.add('active');
    });
});

// 初始化加载 Tab1 配置
chrome.storage.local.get(['interceptConfig'], (result) => {
    if (result.interceptConfig) {
        document.getElementById('domains').value = result.interceptConfig.domains.join(',');
        document.getElementById('replaceFields').value = JSON.stringify(result.interceptConfig.fields);
    }
});

// Tab1: 保存配置并通知页面
document.getElementById('saveConfig').addEventListener('click', () => {
    const domainsStr = document.getElementById('domains').value;
    const fieldsStr = document.getElementById('replaceFields').value;

    try {
        const config = {
            domains: domainsStr.split(',').map(d => d.trim()).filter(d => d),
            fields: fieldsStr ? JSON.parse(fieldsStr) : {}
        };

        chrome.storage.local.set({ interceptConfig: config }, () => {
            document.getElementById('status1').innerText = '配置已保存并生效！';
            setTimeout(() => document.getElementById('status1').innerText = '', 2000);

            // 通知当前活跃标签页更新拦截配置
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_CONFIG', config });
            });
        });
    } catch (e) {
        alert('JSON 格式错误，请检查替换字段内容！');
    }
});

// Tab2: 复制 SessionStorage
document.getElementById('copySession').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SESSION' }, (response) => {
            if (response && response.data) {
                chrome.storage.local.set({ copiedSession: response.data }, () => {
                    document.getElementById('status2').innerText = 'Session 复制成功！';
                    setTimeout(() => document.getElementById('status2').innerText = '', 2000);
                });
            }
        });
    });
});

// Tab2: 粘贴 SessionStorage
document.getElementById('pasteSession').addEventListener('click', () => {
    chrome.storage.local.get(['copiedSession'], (result) => {
        if (!result.copiedSession) {
            alert('没有找到已复制的 Session 数据！');
            return;
        }
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_SESSION', data: result.copiedSession }, () => {
                document.getElementById('status2').innerText = '覆盖成功，请刷新页面！';
                setTimeout(() => document.getElementById('status2').innerText = '', 2000);
            });
        });
    });
});