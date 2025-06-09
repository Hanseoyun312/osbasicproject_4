/**
 * percent.js (v3.1.0) - 클라이언트 사이드 가중치 시스템 + 서버 오류 처리 강화
 * 개선사항: 서버 저장 시도 + 실패 시 클라이언트 폴백 + 강화된 오류 처리
 */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // === 📊 가중치 설정 구성 (클라이언트 전용) ===
    const WEIGHT_CONFIG = {
        // 기본 가중치 설정
        DEFAULT_WEIGHTS: {
            '간사': 3,
            '무효표 및 기권': 2,
            '본회의 가결': 40,
            '위원장': 5,
            '청원 소개': 8,
            '청원 결과': 23,
            '출석': 8,
            '투표 결과 일치': 7,
            '투표 결과 불일치': 4
        },

        // 🎯 클라이언트 가중치 매핑 (데이터 필드명과 연결)
        DATA_FIELD_MAPPING: {
            '간사': 'committee_secretary_count',
            '무효표 및 기권': 'invalid_vote_ratio',
            '본회의 가결': 'bill_pass_sum',
            '위원장': 'committee_leader_count',
            '청원 소개': 'petition_sum',
            '청원 결과': 'petition_pass_sum',
            '출석': 'attendance_rate',
            '투표 결과 일치': 'vote_match_ratio',
            '투표 결과 불일치': 'vote_mismatch_ratio'
        },

        // 타이밍 설정
        AUTO_SAVE_DELAY: 1000,
        AUTO_APPLY_DELAY: 500,    // 즉시 적용
        STORAGE_KEY: 'client_weights_v3',
        BACKUP_KEY: 'weight_backup_history_v3',
        
        // 🔧 서버 설정
        SERVER_RETRY_COUNT: 3,
        SERVER_RETRY_DELAY: [2000, 4000, 6000] // 2초, 4초, 6초
    };

    // === 🔧 애플리케이션 상태 관리 ===
    let appState = {
        weights: {},
        isLoading: false,
        isSaving: false,
        isApplying: false,
        lastSaved: null,
        lastApplied: null,
        hasUnsavedChanges: false,
        autoSaveTimer: null,
        autoApplyTimer: null,
        
        // 🎯 클라이언트 전용 상태
        connectedPages: new Set(),
        realTimeUpdatesEnabled: true,
        lastCalculatedWeights: null,
        
        // 🚨 서버 연결 상태
        serverMode: 'hybrid', // 'server', 'client', 'hybrid'
        lastServerAttempt: null,
        serverErrorCount: 0,
        isRetryingServer: false
    };

    // DOM 요소들
    const elements = {
        checkboxItems: document.querySelectorAll('.checkbox-item'),
        percentInputs: document.querySelectorAll('.percent-input'),
        checkboxInputs: document.querySelectorAll('.checkbox-input'),
        resetButton: document.getElementById('resetButton'),
        saveStatus: document.getElementById('saveStatus'),
        lastUpdated: document.getElementById('lastUpdated'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        importFile: document.getElementById('importFile')
    };

    // === 🚀 초기화 함수 ===
    async function initializeApp() {
        try {
            console.log('[Percent] 🚀 클라이언트 사이드 가중치 시스템 초기화... (v3.1.0)');
            
            showLoadingState(true);
            
            // 실시간 업데이트 시스템 초기화
            initializeRealTimeSystem();
            
            // 저장된 설정 불러오기
            loadSavedSettings();
            
            // UI 초기화
            initializeUI();
            
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // 자동 적용 시스템 시작
            setupAutoApply();
            
            // 랭킹 페이지 연결 확인
            checkConnectedPages();
            
            // 서버 상태 확인
            await checkServerStatus();
            
            showLoadingState(false);
            
            console.log('[Percent] ✅ 클라이언트 사이드 가중치 시스템 초기화 완료');
            showNotification('가중치 설정이 준비되었습니다! 변경사항이 즉시 랭킹에 반영됩니다.', 'success');
            
        } catch (error) {
            console.error('[Percent] ❌ 초기화 실패:', error);
            showLoadingState(false);
            showNotification('초기화에 실패했습니다: ' + error.message, 'error');
        }
    }

    // === 🔗 실시간 업데이트 시스템 초기화 ===
    function initializeRealTimeSystem() {
        console.log('[Percent] 🔗 실시간 업데이트 시스템 초기화...');
        
        // BroadcastChannel 설정 (페이지간 실시간 통신)
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                window.weightUpdateChannel = new BroadcastChannel('client_weight_updates_v3');
                
                // 다른 페이지에서 연결 확인 요청 수신
                window.weightUpdateChannel.addEventListener('message', function(event) {
                    if (event.data.type === 'connection_check') {
                        // 응답 전송
                        window.weightUpdateChannel.postMessage({
                            type: 'connection_response',
                            source: 'percent_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected',
                            serverMode: appState.serverMode
                        });
                        
                        appState.connectedPages.add(event.data.source);
                        updateConnectedPagesDisplay();
                    }
                });
                
                console.log('[Percent] ✅ BroadcastChannel 초기화 완료');
            } catch (e) {
                console.warn('[Percent] ⚠️ BroadcastChannel 초기화 실패:', e);
            }
        }
        
        // 페이지 연결 상태 주기적 확인
        setInterval(checkConnectedPages, 10000); // 10초마다
    }

    // === 🔍 서버 상태 확인 ===
    async function checkServerStatus() {
        try {
            if (window.APIService && window.APIService.getEnvironmentInfo) {
                await window.APIService.getEnvironmentInfo();
                appState.serverMode = 'hybrid';
                console.log('[Percent] ✅ 서버 연결 상태: 정상');
                return true;
            }
        } catch (error) {
            console.warn('[Percent] ⚠️ 서버 연결 실패, 클라이언트 모드 사용:', error);
            appState.serverMode = 'client';
            return false;
        }
    }

    // === 📡 연결된 페이지 확인 ===
    function checkConnectedPages() {
        if (window.weightUpdateChannel) {
            // 연결 확인 요청 전송
            window.weightUpdateChannel.postMessage({
                type: 'connection_check',
                source: 'percent_page',
                timestamp: new Date().toISOString()
            });
        }
    }

    // === 🎨 연결된 페이지 표시 업데이트 ===
    function updateConnectedPagesDisplay() {
        try {
            let statusElement = document.getElementById('connected-pages-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'connected-pages-status';
                statusElement.style.cssText = `
                    margin-top: 15px; padding: 12px 16px; 
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    border-radius: 8px; font-size: 13px; color: white;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                `;
                
                // 체크박스 그리드 다음에 추가
                const checkboxGrid = document.querySelector('.checkbox-grid');
                if (checkboxGrid) {
                    checkboxGrid.insertAdjacentElement('afterend', statusElement);
                }
            }
            
            const connectedCount = appState.connectedPages.size;
            const serverStatus = appState.serverMode === 'hybrid' ? '🌐 서버 연결됨' : 
                               appState.serverMode === 'client' ? '💻 클라이언트 모드' : '🔄 확인 중';
            
            statusElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🔗 연결된 랭킹 페이지: <strong>${connectedCount}개</strong></span>
                    <span style="color: #fbbf24;">${serverStatus}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 11px; opacity: 0.9;">
                        ${connectedCount > 0 ? 
                            '✓ 실시간 업데이트 활성화' : 
                            '⚠ 랭킹 페이지를 열어주세요'
                        }
                    </span>
                    ${appState.serverMode === 'client' ? 
                        '<button onclick="retryServerConnection()" style="font-size: 10px; padding: 2px 8px; background: rgba(255,255,255,0.2); border: none; border-radius: 4px; color: white; cursor: pointer;">서버 재연결</button>' : 
                        ''
                    }
                </div>
            `;
            
        } catch (error) {
            console.warn('[Percent] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 🎯 핵심: 강화된 가중치 적용 (서버 저장 시도 + 클라이언트 폴백) ===
    async function applyWeightsToRanking() {
        try {
            console.log('[Percent] 🎯 강화된 가중치 적용 시작...');
            
            appState.isApplying = true;
            updateSaveStatus('saving', '🔄 가중치 적용 중...');

            // 📊 현재 활성화된 가중치 수집
            const activeWeights = {};
            let totalWeight = 0;
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                
                if (!input.disabled) {
                    const value = parseFloat(input.value.replace('%', '')) || 0;
                    activeWeights[label] = value;
                    totalWeight += value;
                }
            });

            // 가중치 검증
            if (Math.abs(totalWeight - 100) > 0.1) {
                throw new Error(`총 가중치가 100%가 아닙니다 (현재: ${totalWeight.toFixed(1)}%)`);
            }

            console.log('[Percent] 📤 적용할 가중치:', activeWeights);

            // 🚀 1단계: 서버 저장 시도 (hybrid 모드일 때만)
            let serverSuccess = false;
            if (appState.serverMode === 'hybrid') {
                serverSuccess = await attemptServerSave(activeWeights);
            }

            // 🎯 2단계: 클라이언트 저장 (항상 실행)
            const weightData = {
                weights: activeWeights,
                timestamp: new Date().toISOString(),
                totalWeight: totalWeight,
                version: '3.1.0',
                serverSaved: serverSuccess,
                mode: serverSuccess ? 'hybrid' : 'client'
            };
            
            localStorage.setItem('current_weights', JSON.stringify(weightData));
            
            // 🚀 3단계: 실시간 랭킹 업데이트 알림 전송
            await notifyRankingUpdate(activeWeights, totalWeight, serverSuccess);

            // 상태 업데이트
            appState.lastApplied = new Date();
            appState.isApplying = false;
            appState.lastCalculatedWeights = { ...activeWeights };
            
            // 성공 메시지
            const statusMessage = serverSuccess ? 
                '✅ 서버 저장 + 순위 업데이트 완료!' : 
                '✅ 클라이언트 저장 + 순위 업데이트 완료!';
            
            updateSaveStatus('saved', statusMessage);
            updateLastAppliedDisplay();
            
            console.log('[Percent] ✅ 강화된 가중치 적용 완료');
            
            // 🎉 성공 알림
            const notificationMessage = serverSuccess ? 
                '가중치가 서버에 저장되고 순위가 업데이트되었습니다! 🎉' :
                '가중치가 로컬에 저장되고 순위가 업데이트되었습니다! 💻';
            
            showNotification(notificationMessage, 'success', 4000);
            
            return true;

        } catch (error) {
            console.error('[Percent] ❌ 가중치 적용 실패:', error);
            
            appState.isApplying = false;
            updateSaveStatus('error', '❌ 적용 실패');
            showNotification(`가중치 적용 실패: ${error.message}`, 'error', 6000);
            
            return false;
        }
    }

    // === 🔧 서버 저장 시도 (재시도 포함) ===
    async function attemptServerSave(weights) {
        const maxRetries = WEIGHT_CONFIG.SERVER_RETRY_COUNT;
        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[Percent] 🔄 서버 저장 시도 ${attempt}/${maxRetries}...`);
                
                if (attempt === 1) {
                    updateSaveStatus('saving', '🌐 서버에 저장 중...');
                } else {
                    updateSaveStatus('saving', `🔄 서버 재시도 ${attempt}/${maxRetries}...`);
                }
                
                // APIService를 통한 서버 저장
                if (window.APIService && window.APIService.updateWeights) {
                    const response = await window.APIService.updateWeights(weights);
                    console.log(`[Percent] ✅ 서버 저장 성공 (시도 ${attempt}):`, response);
                    
                    appState.serverErrorCount = 0;
                    appState.lastServerAttempt = new Date();
                    
                    return true;
                }
                
                throw new Error('APIService가 사용할 수 없습니다');
                
            } catch (error) {
                lastError = error;
                console.error(`[Percent] ❌ 서버 저장 실패 (시도 ${attempt}):`, error);
                
                appState.serverErrorCount++;
                
                // 500 에러 특별 처리
                if (error.message && error.message.includes('500')) {
                    console.warn(`[Percent] 🚨 서버 내부 오류 감지 (시도 ${attempt}/${maxRetries})`);
                    
                    if (attempt < maxRetries) {
                        const waitTime = WEIGHT_CONFIG.SERVER_RETRY_DELAY[attempt - 1];
                        showNotification(`서버 오류로 ${waitTime/1000}초 후 재시도합니다... (${attempt}/${maxRetries})`, 'warning', waitTime);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }
                
                // 다른 에러의 경우 즉시 재시도
                if (attempt < maxRetries) {
                    const waitTime = 1000; // 1초 대기
                    console.log(`[Percent] ⏳ ${waitTime/1000}초 후 재시도...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        // 모든 재시도 실패
        console.error(`[Percent] ❌ ${maxRetries}번의 서버 저장 시도 모두 실패:`, lastError);
        
        // 클라이언트 모드로 전환
        appState.serverMode = 'client';
        updateConnectedPagesDisplay();
        
        // 서버 오류 알림 표시
        showServerErrorNotification(lastError);
        
        return false;
    }

    // === 🚨 서버 오류 알림 표시 ===
    function showServerErrorNotification(serverError) {
        try {
            // 기존 서버 오류 알림 제거
            const existing = document.querySelector('.server-error-notification');
            if (existing) existing.remove();
            
            const notification = document.createElement('div');
            notification.className = 'server-error-notification';
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                padding: 20px 30px; border-radius: 12px; z-index: 10002;
                max-width: 600px; box-shadow: 0 8px 25px rgba(0,0,0,0.2);
                font-family: 'Blinker', sans-serif; line-height: 1.5;
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                color: white; text-align: center; font-size: 14px;
                border: 2px solid #fbbf24; backdrop-filter: blur(8px);
            `;
            
            notification.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <span style="font-size: 24px;">⚠️</span>
                        <strong style="font-size: 16px;">서버 연결 문제 감지</strong>
                        <span style="font-size: 24px;">🔧</span>
                    </div>
                    
                    <div style="font-size: 13px; opacity: 0.95;">
                        서버에 일시적인 문제가 발생했지만, <strong>가중치는 로컬에 저장되어 정상 작동</strong>합니다.<br>
                        모든 페이지에서 새로운 가중치로 점수가 계산됩니다.
                    </div>
                    
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 8px;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                style="padding: 8px 16px; background: rgba(255,255,255,0.2); border: none; 
                                       border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                            확인
                        </button>
                        <button onclick="retryServerConnection()" 
                                style="padding: 8px 16px; background: rgba(255,255,255,0.3); border: none; 
                                       border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                            서버 재연결 시도
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 15초 후 자동 숨김
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(-50%) translateY(-20px) scale(0.95)';
                    setTimeout(() => notification.remove(), 500);
                }
            }, 15000);
            
        } catch (error) {
            console.warn('[Percent] 서버 오류 알림 표시 실패:', error);
            // 폴백 알림
            alert('⚠️ 서버 연결 문제가 발생했지만 가중치는 로컬에 저장되어 정상 작동합니다.');
        }
    }

    // === 🔄 서버 재연결 시도 함수 ===
    window.retryServerConnection = async function() {
        try {
            console.log('[Percent] 🔄 서버 재연결 시도...');
            
            if (appState.isRetryingServer) {
                showNotification('이미 재연결을 시도하고 있습니다.', 'warning');
                return;
            }
            
            appState.isRetryingServer = true;
            showNotification('서버 재연결을 시도하는 중...', 'info', 2000);
            
            // 현재 저장된 가중치 확인
            const currentWeights = getCurrentWeights();
            if (!currentWeights) {
                showNotification('❌ 저장된 가중치가 없습니다.', 'error');
                return;
            }
            
            // 서버 상태 확인
            const serverOk = await checkServerStatus();
            if (!serverOk) {
                showNotification('서버가 여전히 불안정합니다. 잠시 후 다시 시도해주세요.', 'warning', 4000);
                return;
            }
            
            // 가중치 서버 저장 재시도
            const success = await attemptServerSave(currentWeights);
            
            if (success) {
                appState.serverMode = 'hybrid';
                updateConnectedPagesDisplay();
                showNotification('✅ 서버 재연결 및 가중치 동기화 완료!', 'success', 4000);
                
                // 성공한 가중치를 다시 브로드캐스트
                await notifyRankingUpdate(currentWeights, 100, true);
            } else {
                showNotification('❌ 서버 재연결에 실패했습니다. 클라이언트 모드로 계속 진행됩니다.', 'error', 5000);
            }
            
        } catch (error) {
            console.error('[Percent] ❌ 서버 재연결 실패:', error);
            showNotification('❌ 서버 재연결에 실패했습니다.', 'error', 5000);
        } finally {
            appState.isRetryingServer = false;
        }
    };

    // === 📊 현재 가중치 가져오기 함수 ===
    function getCurrentWeights() {
        try {
            // 1. 메모리에서 확인
            if (window.currentWeights) {
                return window.currentWeights;
            }
            
            // 2. localStorage에서 확인
            const stored = localStorage.getItem('current_weights');
            if (stored) {
                const weightData = JSON.parse(stored);
                return weightData.weights;
            }
            
            // 3. DOM에서 확인 (슬라이더 값들)
            const weights = {};
            elements.percentInputs.forEach(input => {
                if (!input.disabled) {
                    const label = input.dataset.item;
                    weights[label] = parseFloat(input.value.replace('%', '')) || 0;
                }
            });
            
            if (Object.keys(weights).length > 0) {
                return weights;
            }
            
            return null;
            
        } catch (error) {
            console.error('[Percent] 현재 가중치 가져오기 실패:', error);
            return null;
        }
    }

    // === 📢 랭킹 업데이트 알림 시스템 ===
    async function notifyRankingUpdate(weights, totalWeight, serverSaved = false) {
        try {
            console.log('[Percent] 📢 랭킹 업데이트 알림 전송...');
            
            const updateData = {
                type: 'client_weights_updated',
                timestamp: new Date().toISOString(),
                source: 'percent_page',
                weights: weights,
                totalWeight: totalWeight,
                clientSide: true,
                serverSaved: serverSaved,
                
                // 🎯 클라이언트 전용 메타데이터
                updateId: `client_update_${Date.now()}`,
                connectedPages: Array.from(appState.connectedPages),
                weightMapping: WEIGHT_CONFIG.DATA_FIELD_MAPPING,
                mode: appState.serverMode
            };
            
            // 1. localStorage 이벤트
            localStorage.setItem('client_weight_change_event', JSON.stringify(updateData));
            localStorage.setItem('last_client_weight_update', Date.now().toString());
            
            // 2. BroadcastChannel (실시간 통신)
            if (window.weightUpdateChannel) {
                window.weightUpdateChannel.postMessage(updateData);
                console.log('[Percent] 📡 BroadcastChannel로 업데이트 알림 전송');
            }
            
            // 3. 커스텀 이벤트
            document.dispatchEvent(new CustomEvent('clientWeightSettingsChanged', {
                detail: updateData
            }));
            
            console.log('[Percent] ✅ 랭킹 업데이트 알림 전송 완료');
            
        } catch (error) {
            console.error('[Percent] 랭킹 업데이트 알림 실패:', error);
            throw error;
        } finally {
            // localStorage 정리
            setTimeout(() => {
                localStorage.removeItem('client_weight_change_event');
            }, 1000);
        }
    }

    // === 📋 설정 저장/불러오기 ===
    function loadSavedSettings() {
        try {
            console.log('[Percent] 📥 저장된 설정 불러오기...');

            const savedData = localStorage.getItem(WEIGHT_CONFIG.STORAGE_KEY);
            
            if (savedData) {
                const parsed = JSON.parse(savedData);
                console.log('[Percent] ✅ 저장된 설정 복원');
                
                Object.keys(parsed).forEach(label => {
                    if (label.startsWith('_')) return; // 메타데이터 스킵
                    
                    const data = parsed[label];
                    
                    // 체크박스 복원
                    elements.checkboxInputs.forEach(checkbox => {
                        const checkboxLabel = checkbox.closest('.checkbox-item')
                            .querySelector('.checkbox-label').textContent.trim();
                        if (checkboxLabel === label) {
                            checkbox.checked = data.enabled;
                        }
                    });
                    
                    // 입력값 복원
                    elements.percentInputs.forEach(input => {
                        if (input.dataset.item === label) {
                            input.value = data.value + '%';
                            input.disabled = !data.enabled;
                            updateInputStyle(input, data.enabled);
                        }
                    });
                });
                
                appState.lastSaved = new Date(parsed._timestamp || Date.now());
                
            } else {
                console.log('[Percent] 📋 저장된 설정 없음 - 기본값 사용');
                resetToDefaults();
            }
            
            calculateAndDisplayTotal();
            updateLastSavedDisplay();
            
        } catch (error) {
            console.error('[Percent] 설정 불러오기 실패:', error);
            resetToDefaults();
            showNotification('설정 불러오기에 실패하여 기본값을 사용합니다', 'warning');
        }
    }

    function saveSettings() {
        try {
            console.log('[Percent] 💾 설정 저장 중...');
            
            const settingsData = {};
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                const value = parseFloat(input.value.replace('%', '')) || 0;
                const isEnabled = !input.disabled;
                
                settingsData[label] = {
                    value: value,
                    enabled: isEnabled
                };
            });
            
            // 메타데이터 추가
            settingsData._timestamp = Date.now();
            settingsData._version = '3.1.0';
            settingsData._lastApplied = appState.lastApplied?.toISOString();
            settingsData._serverMode = appState.serverMode;
            
            localStorage.setItem(WEIGHT_CONFIG.STORAGE_KEY, JSON.stringify(settingsData));
            
            appState.lastSaved = new Date();
            appState.hasUnsavedChanges = false;
            
            updateSaveStatus('saved', '💾 자동 저장됨');
            updateLastSavedDisplay();
            
            console.log('[Percent] ✅ 설정 저장 완료');
            return true;
            
        } catch (error) {
            console.error('[Percent] 설정 저장 실패:', error);
            updateSaveStatus('error', '💥 저장 실패');
            throw error;
        }
    }

    // === 🎮 이벤트 리스너 설정 ===
    function setupEventListeners() {
        console.log('[Percent] 🎮 이벤트 리스너 설정...');

        // 체크박스 이벤트
        elements.checkboxInputs.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const itemName = this.dataset.item;
                updatePercentField(itemName, this.checked);
            });
        });

        // 퍼센트 입력 필드 이벤트
        elements.percentInputs.forEach(input => {
            setupPercentInputEvents(input);
        });

        // 초기화 버튼
        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', resetToDefaults);
        }

        // 백업/복원 버튼들
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportSettings);
        }
        
        if (elements.importBtn) {
            elements.importBtn.addEventListener('click', () => elements.importFile?.click());
        }
        
        if (elements.importFile) {
            elements.importFile.addEventListener('change', importSettings);
        }

        // 페이지 언로드 시 저장
        window.addEventListener('beforeunload', function(event) {
            if (appState.hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = '저장되지 않은 변경사항이 있습니다.';
            }
            
            // BroadcastChannel 정리
            if (window.weightUpdateChannel) {
                window.weightUpdateChannel.close();
            }
        });
    }

    // === 🔄 자동 적용 시스템 ===
    function setupAutoApply() {
        console.log('[Percent] 🔄 자동 적용 시스템 시작...');
    }

    function scheduleAutoApply() {
        appState.hasUnsavedChanges = true;
        updateSaveStatus('saving', '💾 저장 중...');
        
        clearTimeout(appState.autoSaveTimer);
        clearTimeout(appState.autoApplyTimer);
        
        // 먼저 설정 저장
        appState.autoSaveTimer = setTimeout(() => {
            try {
                saveSettings();
                
                // 🎯 100% 도달 시 자동 적용
                let total = 0;
                elements.percentInputs.forEach(input => {
                    if (!input.disabled) {
                        total += parseFloat(input.value.replace('%', '')) || 0;
                    }
                });
                
                if (Math.abs(total - 100) < 0.1) {
                    // 즉시 순위에 적용
                    appState.autoApplyTimer = setTimeout(() => {
                        console.log('[Percent] 🔄 자동 순위 적용 (100% 도달)');
                        applyWeightsToRanking();
                    }, WEIGHT_CONFIG.AUTO_APPLY_DELAY);
                }
                
            } catch (error) {
                console.error('[Percent] 자동 저장 실패:', error);
                updateSaveStatus('error', '💥 저장 실패');
            }
        }, WEIGHT_CONFIG.AUTO_SAVE_DELAY);
    }

    // === 📊 UI 관리 함수들 ===
    function updatePercentField(itemName, isChecked) {
        elements.percentInputs.forEach(input => {
            if (input.dataset.item === itemName) {
                input.disabled = !isChecked;
                updateInputStyle(input, isChecked);
                
                if (!isChecked) {
                    input.value = '0%';
                }
            }
        });
        
        calculateAndDisplayTotal();
        scheduleAutoApply();
    }

    function updateInputStyle(input, isEnabled) {
        if (isEnabled) {
            input.style.opacity = '1';
            input.style.backgroundColor = '#f9f9f9';
            input.style.cursor = 'text';
        } else {
            input.style.opacity = '0.3';
            input.style.backgroundColor = '#e0e0e0';
            input.style.cursor = 'not-allowed';
        }
    }

    function calculateAndDisplayTotal() {
        let total = 0;
        let activeCount = 0;

        elements.percentInputs.forEach(input => {
            if (!input.disabled) {
                const value = parseFloat(input.value.replace('%', '')) || 0;
                total += value;
                activeCount++;
            }
        });

        // 합계 표시 UI 업데이트
        let totalDisplay = document.querySelector('.total-display');
        if (!totalDisplay) {
            totalDisplay = document.createElement('div');
            totalDisplay.className = 'total-display';
            document.querySelector('.percent-grid').after(totalDisplay);
        }
        
        const isValid = Math.abs(total - 100) < 0.1;
        totalDisplay.className = `total-display ${isValid ? 'valid' : 'invalid'}`;
        
        totalDisplay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: ${isValid ? '#f0f9ff' : '#fef2f2'}; border: 1px solid ${isValid ? '#3b82f6' : '#ef4444'}; border-radius: 8px; margin-top: 15px;">
                <span style="color: #64748b;">활성 항목: <strong>${activeCount}개</strong></span>
                <span style="color: ${isValid ? '#0ea5e9' : '#ef4444'};">총합: <strong>${total.toFixed(1)}%</strong></span>
                ${isValid ? 
                    '<span style="color: #10b981; font-weight: 600;">✓ 순위 적용 가능</span>' : 
                    '<span style="color: #ef4444; font-weight: 600;">⚠ 100%로 조정 필요</span>'
                }
            </div>
        `;
    }

    function resetToDefaults() {
        if (!confirm('모든 값을 초기값으로 되돌리시겠습니까?')) {
            return;
        }

        try {
            console.log('[Percent] 🔄 기본값으로 초기화...');

            // 모든 체크박스 체크
            elements.checkboxInputs.forEach(checkbox => {
                checkbox.checked = true;
            });

            // 모든 입력 필드 초기값 설정
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                const defaultValue = WEIGHT_CONFIG.DEFAULT_WEIGHTS[label];
                
                if (defaultValue !== undefined) {
                    input.value = defaultValue + '%';
                    input.disabled = false;
                    updateInputStyle(input, true);
                }
            });

            calculateAndDisplayTotal();
            scheduleAutoApply();
            
            showNotification('기본값으로 초기화되었습니다', 'info');
            console.log('[Percent] ✅ 기본값 초기화 완료');
            
        } catch (error) {
            console.error('[Percent] 기본값 초기화 실패:', error);
            showNotification('초기화에 실패했습니다', 'error');
        }
    }

    // === 기타 UI 함수들 ===
    function updateSaveStatus(status, message) {
        if (!elements.saveStatus) return;
        
        elements.saveStatus.className = `save-status ${status}`;
        elements.saveStatus.textContent = message;
    }

    function updateLastSavedDisplay() {
        if (!elements.lastUpdated) return;
        
        const savedTime = appState.lastSaved ? appState.lastSaved.toLocaleTimeString('ko-KR') : '없음';
        const appliedTime = appState.lastApplied ? appState.lastApplied.toLocaleTimeString('ko-KR') : '없음';
        const serverStatus = appState.serverMode === 'hybrid' ? '🌐 서버 연결' : '💻 클라이언트 모드';
        
        elements.lastUpdated.innerHTML = `
            <div style="font-size: 12px; color: #64748b;">
                <div>💾 마지막 저장: ${savedTime}</div>
                <div>🎯 마지막 적용: ${appliedTime}</div>
                <div>${serverStatus}</div>
            </div>
        `;
    }

    function updateLastAppliedDisplay() {
        updateLastSavedDisplay();
    }

    function showLoadingState(isLoading) {
        document.body.style.opacity = isLoading ? '0.7' : '1';
        document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    }

    function initializeUI() {
        console.log('[Percent] 🎨 UI 초기화...');
        
        // 페이지 로드 애니메이션
        document.querySelector('.checkbox-grid')?.classList.add('fade-in');
        document.querySelector('.percent-grid')?.classList.add('fade-in');
        
        // 초기 상태 업데이트
        updateSaveStatus('saved', '💾 준비됨');
        calculateAndDisplayTotal();
        
        // 연결 상태 표시 초기화
        updateConnectedPagesDisplay();
    }

    // === 🔔 알림 시스템 ===
    function showNotification(message, type = 'info', duration = 4000) {
        try {
            if (window.APIService?.showNotification) {
                window.APIService.showNotification(message, type, duration);
            } else {
                console.log(`[Percent 알림 - ${type.toUpperCase()}] ${message}`);
                
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
                    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
                    color: white; border-radius: 8px; z-index: 10000; font-size: 13px;
                    max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    font-family: 'Blinker', sans-serif; opacity: 0; transform: translateX(100%);
                    transition: all 0.3s ease; line-height: 1.4;
                `;
                notification.textContent = message;
                document.body.appendChild(notification);
                
                setTimeout(() => {
                    notification.style.opacity = '1';
                    notification.style.transform = 'translateX(0)';
                }, 10);
                
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => notification.remove(), 300);
                    }
                }, duration);
            }
        } catch (error) {
            console.log(`[Percent 알림 오류] ${message} (${type})`);
        }
    }

    // === 퍼센트 입력 필드 이벤트 설정 ===
    function setupPercentInputEvents(input) {
        // 실시간 입력 처리
        input.addEventListener('input', function(e) {
            if (this.disabled) {
                e.preventDefault();
                return;
            }

            const cursorPosition = this.selectionStart;
            const cleanedValue = cleanNumericValue(this.value);
            
            this.value = cleanedValue + '%';
            
            const newCursorPosition = Math.min(cursorPosition, this.value.length - 1);
            this.setSelectionRange(newCursorPosition, newCursorPosition);
            
            calculateAndDisplayTotal();
            scheduleAutoApply();
        });

        // 포커스 해제 시 처리
        input.addEventListener('blur', function() {
            if (this.disabled) return;
            
            let cleanedValue = cleanNumericValue(this.value);
            
            if (cleanedValue === '') {
                cleanedValue = '0';
            }
            
            this.value = cleanedValue + '%';
            
            calculateAndDisplayTotal();
            scheduleAutoApply();
        });
    }

    function cleanNumericValue(value) {
        let cleanValue = value.replace('%', '').trim();
        cleanValue = cleanValue.replace(/[^\d.-]/g, '');
        
        if (cleanValue === '' || cleanValue === '-') {
            return '0';
        }
        
        if (cleanValue.length > 1) {
            if (cleanValue.startsWith('0') && cleanValue[1] !== '.') {
                cleanValue = cleanValue.replace(/^0+/, '') || '0';
            }
        }
        
        return cleanValue;
    }

    // === 📦 백업 및 복원 기능 ===
    function exportSettings() {
        try {
            const settingsData = {
                weights: {},
                metadata: {
                    version: '3.1.0',
                    exportDate: new Date().toISOString(),
                    source: 'percent_client_v3_1',
                    lastApplied: appState.lastApplied?.toISOString(),
                    serverMode: appState.serverMode
                }
            };
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                settingsData.weights[label] = {
                    value: parseFloat(input.value.replace('%', '')) || 0,
                    enabled: !input.disabled
                };
            });
            
            const dataStr = JSON.stringify(settingsData, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `client_weight_settings_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('가중치 설정이 내보내기되었습니다', 'success');
            
        } catch (error) {
            console.error('[Percent] 설정 내보내기 실패:', error);
            showNotification('내보내기에 실패했습니다', 'error');
        }
    }

    function importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                
                if (!importedData.weights) {
                    throw new Error('유효하지 않은 설정 파일입니다');
                }
                
                // 설정 적용
                Object.entries(importedData.weights).forEach(([label, data]) => {
                    // 체크박스 업데이트
                    elements.checkboxInputs.forEach(checkbox => {
                        if (checkbox.dataset.item === label) {
                            checkbox.checked = data.enabled;
                        }
                    });
                    
                    // 입력값 업데이트
                    elements.percentInputs.forEach(input => {
                        if (input.dataset.item === label) {
                            input.value = data.value + '%';
                            input.disabled = !data.enabled;
                            updateInputStyle(input, data.enabled);
                        }
                    });
                });
                
                calculateAndDisplayTotal();
                scheduleAutoApply();
                
                showNotification('가중치 설정이 가져오기되었습니다', 'success');
                
            } catch (error) {
                console.error('[Percent] 설정 가져오기 실패:', error);
                showNotification('가져오기에 실패했습니다: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // === 🌐 전역 함수 등록 ===
    window.ClientWeightSystem = {
        init: initializeApp,
        save: saveSettings,
        apply: applyWeightsToRanking,
        reset: resetToDefaults,
        retryServer: window.retryServerConnection,
        getState: () => appState,
        getCurrentWeights: getCurrentWeights,
        checkServerStatus: checkServerStatus,
        version: '3.1.0'
    };

    // === 🔧 개발자 도구 ===
    window.debugClientWeights = {
        state: appState,
        config: WEIGHT_CONFIG,
        getCurrentWeights: getCurrentWeights,
        testNotification: (msg, type) => showNotification(msg, type),
        simulateWeightUpdate: () => applyWeightsToRanking(),
        checkConnectedPages: checkConnectedPages,
        retryServer: window.retryServerConnection,
        checkServerStatus: checkServerStatus,
        simulateServerError: () => {
            appState.serverMode = 'client';
            showServerErrorNotification(new Error('500 Internal Server Error (Simulated)'));
        },
        help: () => {
            console.log('[Percent] 🔧 클라이언트 사이드 가중치 시스템 디버그 도구 (v3.1.0):');
            console.log('  - getCurrentWeights(): 현재 가중치 반환');
            console.log('  - testNotification(msg, type): 알림 테스트');
            console.log('  - simulateWeightUpdate(): 가중치 업데이트 시뮬레이션');
            console.log('  - checkConnectedPages(): 연결된 페이지 확인');
            console.log('  - retryServer(): 서버 재연결 시도');
            console.log('  - checkServerStatus(): 서버 상태 확인');
            console.log('  - simulateServerError(): 서버 오류 시뮬레이션');
        }
    };

    // === 🚀 앱 시작 ===
    initializeApp();

    console.log('[Percent] ✅ 클라이언트 사이드 가중치 시스템 + 서버 오류 처리 강화 로드 완료 (v3.1.0)');
    console.log('[Percent] 🔧 디버그: window.debugClientWeights.help()');
});
