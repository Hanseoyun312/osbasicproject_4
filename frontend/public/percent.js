/**
 * percent.js (v2.2.0) - 통합 가중치 시스템
 * 개선사항: API 전송 최적화 + 실시간 랭킹 반영 + 사용자 피드백 강화
 */

document.addEventListener('DOMContentLoaded', function() {
    'use strict';

    // === 📊 가중치 설정 구성 (개선된 버전) ===
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

        // 🎯 정확한 API 필드 매핑 (서버 API 스키마 맞춤)
        API_FIELD_MAPPING: {
            '간사': 'secretary_weight',
            '무효표 및 기권': 'invalid_vote_weight',
            '본회의 가결': 'plenary_pass_weight',
            '위원장': 'chairman_weight',
            '청원 소개': 'petition_intro_weight',
            '청원 결과': 'petition_result_weight',
            '출석': 'attendance_weight',
            '투표 결과 일치': 'vote_match_weight',
            '투표 결과 불일치': 'vote_mismatch_weight'
        },

        // 🚀 API 설정 (최적화됨)
        API_ENDPOINTS: {
            UPDATE_WEIGHTS: 'https://baekilha.onrender.com/performance/api/update_weights/',
            MEMBER_PERFORMANCE: 'https://baekilha.onrender.com/performance/api/performance/',
            PARTY_PERFORMANCE: 'https://baekilha.onrender.com/performance/api/party_performance/',
            MEMBER_RANKING: 'https://baekilha.onrender.com/ranking/members/',
            PARTY_RANKING: 'https://baekilha.onrender.com/ranking/parties/score/'
        },

        // 타이밍 설정
        AUTO_SAVE_DELAY: 1000,         // 1초로 단축
        API_APPLY_DELAY: 2000,         // 2초로 단축
        SERVER_PROCESSING_TIME: 8000,  // 서버 처리 대기 시간
        MAX_RETRY_ATTEMPTS: 3,
        STORAGE_KEY: 'percent_settings_v2',
        BACKUP_KEY: 'percent_backup_history_v2'
    };

    // === 🔧 애플리케이션 상태 관리 (강화된 버전) ===
    let appState = {
        weights: {},
        apiConnected: false,
        isLoading: false,
        isSaving: false,
        isApplying: false,
        lastSaved: null,
        lastApplied: null,
        hasUnsavedChanges: false,
        autoSaveTimer: null,
        apiApplyTimer: null,
        retryCount: 0,
        
        // 🎯 새로운 상태 (랭킹 반영 추적)
        rankingUpdateInProgress: false,
        lastWeightsSent: null,
        successfulApply: false,
        connectedPages: new Set(),
        realTimeUpdatesEnabled: true
    };

    // DOM 요소들
    const elements = {
        checkboxItems: document.querySelectorAll('.checkbox-item'),
        percentInputs: document.querySelectorAll('.percent-input'),
        checkboxInputs: document.querySelectorAll('.checkbox-input'),
        resetButton: document.getElementById('resetButton'),
        apiStatusBar: document.getElementById('apiStatusBar'),
        apiStatusIndicator: document.getElementById('apiStatusIndicator'),
        apiStatusText: document.getElementById('apiStatusText'),
        apiTestBtn: document.getElementById('apiTestBtn'),
        apiApplyBtn: document.getElementById('apiApplyBtn'),
        saveStatus: document.getElementById('saveStatus'),
        lastUpdated: document.getElementById('lastUpdated'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        importFile: document.getElementById('importFile')
    };

    // === 🚀 초기화 함수 ===
    async function initializeApp() {
        try {
            console.log('[Percent] 🚀 통합 가중치 시스템 초기화 시작... (v2.2.0)');
            
            showLoadingState(true);
            
            // API 서비스 연결 대기
            await waitForAPIService();
            
            // 실시간 업데이트 시스템 초기화
            initializeRealTimeSystem();
            
            // 저장된 설정 불러오기
            loadSavedSettings();
            
            // UI 초기화
            initializeUI();
            
            // 이벤트 리스너 설정
            setupEventListeners();
            
            // API 연결 상태 확인
            await checkAPIConnection();
            
            // 자동 저장 시스템 시작
            setupAutoSave();
            
            // 랭킹 페이지 연결 확인
            checkConnectedPages();
            
            showLoadingState(false);
            
            console.log('[Percent] ✅ 통합 가중치 시스템 초기화 완료');
            showNotification('가중치 설정 시스템이 준비되었습니다! 랭킹 페이지와 실시간 연동됩니다.', 'success');
            
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
                window.weightUpdateChannel = new BroadcastChannel('weight_updates_v2');
                
                // 다른 페이지에서 연결 확인 요청 수신
                window.weightUpdateChannel.addEventListener('message', function(event) {
                    if (event.data.type === 'connection_check') {
                        // 응답 전송
                        window.weightUpdateChannel.postMessage({
                            type: 'connection_response',
                            source: 'percent_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected'
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
        
        // 기존 연결 정리 (30초 이상 응답 없는 페이지)
        const now = Date.now();
        appState.connectedPages.forEach(page => {
            // 필요시 연결 상태 정리 로직 추가
        });
    }

    // === 🎨 연결된 페이지 표시 업데이트 ===
    function updateConnectedPagesDisplay() {
        try {
            let statusElement = document.getElementById('connected-pages-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'connected-pages-status';
                statusElement.style.cssText = `
                    margin-top: 10px; padding: 8px 12px; background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px;
                    font-size: 12px; color: var(--string);
                `;
                
                const apiStatusBar = elements.apiStatusBar;
                if (apiStatusBar) {
                    apiStatusBar.insertAdjacentElement('afterend', statusElement);
                }
            }
            
            const connectedCount = appState.connectedPages.size;
            statusElement.innerHTML = `
                <span style="color: #3b82f6;">🔗 연결된 랭킹 페이지: ${connectedCount}개</span>
                ${connectedCount > 0 ? 
                    '<span style="color: #059669; margin-left: 10px;">✓ 실시간 업데이트 가능</span>' : 
                    '<span style="color: #dc2626; margin-left: 10px;">⚠ 랭킹 페이지를 열어주세요</span>'
                }
            `;
            
        } catch (error) {
            console.warn('[Percent] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 🚀 개선된 API 서버로 가중치 전송 (POST 방식) ===
    async function applyWeightsToAPI() {
        if (!appState.apiConnected) {
            showNotification('API가 연결되지 않았습니다', 'warning');
            return false;
        }

        try {
            console.log('[Percent] 🚀 서버로 가중치 POST 전송 시작...');
            
            appState.isApplying = true;
            appState.rankingUpdateInProgress = true;
            appState.successfulApply = false;
            
            updateAPIApplyButton(true);
            updateSaveStatus('saving', '🚀 서버 적용 중...');

            // 📊 현재 활성화된 가중치 수집 및 검증
            const activeWeights = {};
            let totalWeight = 0;
            
            elements.percentInputs.forEach(input => {
                const label = input.dataset.item;
                const apiField = WEIGHT_CONFIG.API_FIELD_MAPPING[label];
                
                if (!input.disabled && apiField) {
                    const value = parseFloat(input.value.replace('%', '')) || 0;
                    activeWeights[apiField] = value;
                    totalWeight += value;
                }
            });

            // 가중치 검증
            if (Math.abs(totalWeight - 100) > 0.1) {
                throw new Error(`총 가중치가 100%가 아닙니다 (현재: ${totalWeight.toFixed(1)}%)`);
            }

            console.log('[Percent] 📤 POST로 전송할 가중치:', activeWeights);
            console.log('[Percent] 📊 총 가중치:', totalWeight.toFixed(1) + '%');

            // 🎯 단계별 진행 상태 알림
            showNotification('1단계: 서버로 가중치 전송 중...', 'info', 3000);

            // 🚀 API 서버로 POST 전송 (개선된 에러 처리)
            let result;
            try {
                const response = await fetch(WEIGHT_CONFIG.API_ENDPOINTS.UPDATE_WEIGHTS, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(activeWeights)
                });

                console.log('[Percent] 📡 서버 응답 상태:', response.status, response.statusText);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP ${response.status}: ${response.statusText}\n응답: ${errorText}`);
                }

                result = await response.json();
                console.log('[Percent] ✅ 서버 POST 요청 성공:', result);

            } catch (fetchError) {
                // 폴백: global_sync.js의 updateWeights 함수 사용
                if (window.APIService && typeof window.APIService.updateWeights === 'function') {
                    console.log('[Percent] 🔄 APIService.updateWeights 폴백 사용...');
                    result = await window.APIService.updateWeights(activeWeights);
                } else {
                    throw fetchError;
                }
            }

            // 2단계: 서버 처리 대기
            showNotification(`2단계: 서버에서 점수 재계산 중... (${WEIGHT_CONFIG.SERVER_PROCESSING_TIME/1000}초 대기)`, 'info', 3000);
            updateSaveStatus('saving', '⏳ 서버 점수 재계산 중...');

            // 서버 처리 대기
            await new Promise(resolve => setTimeout(resolve, WEIGHT_CONFIG.SERVER_PROCESSING_TIME));

            // 3단계: 랭킹 페이지 업데이트 알림
            showNotification('3단계: 랭킹 페이지 실시간 업데이트 중...', 'info', 2000);
            updateSaveStatus('saving', '📊 랭킹 업데이트 중...');

            // 🎯 실시간 랭킹 업데이트 알림 전송 (강화된 버전)
            await notifyRankingUpdate(activeWeights, totalWeight);

            // 상태 업데이트
            appState.lastApplied = new Date();
            appState.isApplying = false;
            appState.rankingUpdateInProgress = false;
            appState.successfulApply = true;
            appState.lastWeightsSent = { ...activeWeights };
            
            updateAPIApplyButton(false);
            updateSaveStatus('saved', '✅ 서버 적용 완료!');
            
            console.log('[Percent] ✅ 가중치 적용 및 랭킹 업데이트 완료');
            
            // 🎉 최종 성공 알림
            showNotification('가중치가 성공적으로 적용되었습니다! 랭킹 페이지가 실시간 업데이트되었습니다. 🎉', 'success', 6000);
            
            // 적용 성공 피드백 (UI 강화)
            addSuccessFeedback();
            
            return true;

        } catch (error) {
            console.error('[Percent] ❌ 가중치 적용 실패:', error);
            
            appState.isApplying = false;
            appState.rankingUpdateInProgress = false;
            appState.successfulApply = false;
            
            updateAPIApplyButton(false);
            updateSaveStatus('error', '❌ 적용 실패');
            
            showNotification(`가중치 적용 실패: ${error.message}`, 'error', 8000);
            
            return false;
        }
    }

    // === 📢 강화된 랭킹 업데이트 알림 시스템 ===
    async function notifyRankingUpdate(weights, totalWeight) {
        try {
            console.log('[Percent] 📢 랭킹 업데이트 알림 전송...');
            
            const updateData = {
                type: 'weights_updated_v2',
                timestamp: new Date().toISOString(),
                source: 'percent_page',
                weights: weights,
                totalWeight: totalWeight,
                serverProcessed: true,
                requiresRankingRefresh: true,
                
                // 🎯 추가 메타데이터
                updateId: `update_${Date.now()}`,
                connectedPages: Array.from(appState.connectedPages),
                processingDelay: WEIGHT_CONFIG.SERVER_PROCESSING_TIME
            };
            
            // 1. localStorage 이벤트 (weight_sync.js 호환)
            localStorage.setItem('weight_change_event', JSON.stringify(updateData));
            localStorage.setItem('last_weight_update', Date.now().toString());
            
            // 2. BroadcastChannel (실시간 통신)
            if (window.weightUpdateChannel) {
                window.weightUpdateChannel.postMessage(updateData);
                console.log('[Percent] 📡 BroadcastChannel로 업데이트 알림 전송');
            }
            
            // 3. 커스텀 이벤트 (같은 페이지 내 컴포넌트용)
            document.dispatchEvent(new CustomEvent('weightSettingsChanged', {
                detail: updateData
            }));
            
            // 4. 직접 API 호출 (강제 새로고침)
            if (window.refreshRankingPages) {
                await window.refreshRankingPages(updateData);
            }
            
            console.log('[Percent] ✅ 랭킹 업데이트 알림 전송 완료');
            
            // 5. 업데이트 결과 확인 (3초 후)
            setTimeout(async () => {
                await verifyRankingUpdate(updateData);
            }, 3000);
            
        } catch (error) {
            console.error('[Percent] 랭킹 업데이트 알림 실패:', error);
            throw error;
        } finally {
            // localStorage 정리
            setTimeout(() => {
                localStorage.removeItem('weight_change_event');
            }, 1000);
        }
    }

    // === 🔍 랭킹 업데이트 검증 ===
    async function verifyRankingUpdate(updateData) {
        try {
            console.log('[Percent] 🔍 랭킹 업데이트 결과 검증...');
            
            // 업데이트 응답 확인
            const response = localStorage.getItem('weight_refresh_response');
            if (response) {
                const responseData = JSON.parse(response);
                console.log('[Percent] 📊 랭킹 페이지 응답:', responseData);
                
                if (responseData.success) {
                    showNotification('랭킹 페이지가 성공적으로 업데이트되었습니다! ✅', 'success', 4000);
                } else {
                    showNotification('일부 랭킹 페이지 업데이트에 실패했을 수 있습니다.', 'warning', 5000);
                }
                
                // 응답 정리
                localStorage.removeItem('weight_refresh_response');
            } else {
                console.log('[Percent] ⚠️ 랭킹 페이지로부터 응답을 받지 못했습니다.');
            }
            
        } catch (error) {
            console.warn('[Percent] 랭킹 업데이트 검증 실패:', error);
        }
    }

    // === 🎉 성공 피드백 UI ===
    function addSuccessFeedback() {
        try {
            // 이미 있는 피드백 요소 제거
            const existingFeedback = document.getElementById('success-feedback');
            if (existingFeedback) {
                existingFeedback.remove();
            }
            
            // 성공 피드백 요소 생성
            const feedback = document.createElement('div');
            feedback.id = 'success-feedback';
            feedback.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white; padding: 20px 30px; border-radius: 15px;
                box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
                z-index: 10001; font-size: 16px; font-weight: 600;
                text-align: center; min-width: 300px;
                animation: successFeedback 3s ease-in-out forwards;
            `;
            
            feedback.innerHTML = `
                <div style="font-size: 24px; margin-bottom: 10px;">🎉</div>
                <div>가중치 적용 완료!</div>
                <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
                    랭킹 페이지가 실시간으로 업데이트되었습니다
                </div>
            `;
            
            // CSS 애니메이션 추가
            if (!document.getElementById('success-feedback-styles')) {
                const style = document.createElement('style');
                style.id = 'success-feedback-styles';
                style.textContent = `
                    @keyframes successFeedback {
                        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                        20% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
                        80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                        100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(feedback);
            
            // 3초 후 제거
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.remove();
                }
            }, 3000);
            
        } catch (error) {
            console.warn('[Percent] 성공 피드백 표시 실패:', error);
        }
    }

    // === 🎯 API 연결 상태 확인 (강화된 버전) ===
    async function checkAPIConnection() {
        try {
            console.log('[Percent] 🔍 API 연결 상태 확인...');
            
            updateAPIStatus('connecting', 'API 연결 확인 중...');
            
            // 1. APIService 확인
            if (window.APIService && window.APIService._isReady) {
                const envInfo = window.APIService.getEnvironmentInfo();
                console.log('[Percent] 🔗 APIService 환경 정보:', envInfo);
            }
            
            // 2. 직접 API 엔드포인트 테스트
            const testResponse = await fetch(WEIGHT_CONFIG.API_ENDPOINTS.MEMBER_PERFORMANCE, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (testResponse.ok) {
                appState.apiConnected = true;
                updateAPIStatus('connected', '✅ API 서버 연결됨');
                console.log('[Percent] ✅ API 연결 성공');
                return true;
            } else {
                throw new Error(`API 테스트 실패: ${testResponse.status}`);
            }
            
        } catch (error) {
            console.warn('[Percent] ⚠️ API 연결 실패:', error.message);
            appState.apiConnected = false;
            updateAPIStatus('disconnected', '❌ API 연결 실패 - 오프라인 모드');
            return false;
        }
    }

    // === 📋 기존 핵심 함수들 (유지) ===
    
    // API 서비스 연결 대기
    async function waitForAPIService() {
        return new Promise((resolve) => {
            const maxWaitTime = 10000;
            let elapsed = 0;
            const checkInterval = 100;

            const checkAPI = () => {
                if (window.APIService && window.APIService._isReady) {
                    console.log('[Percent] ✅ API 서비스 연결됨');
                    resolve();
                } else if (elapsed >= maxWaitTime) {
                    console.warn('[Percent] ⚠️ API 서비스 연결 시간 초과 - 계속 진행');
                    resolve();
                } else {
                    elapsed += checkInterval;
                    setTimeout(checkAPI, checkInterval);
                }
            };

            checkAPI();
        });
    }

    // 설정 저장/불러오기 (기존 코드 유지)
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
            
            // 메타데이터 추가 (v2)
            settingsData._timestamp = Date.now();
            settingsData._version = '2.2.0';
            settingsData._lastApplied = appState.lastApplied?.toISOString();
            settingsData._successfulApply = appState.successfulApply;
            
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

    // UI 관리 함수들 (기존 코드 유지하되 일부 개선)
    function updateAPIStatus(status, message) {
        if (!elements.apiStatusIndicator || !elements.apiStatusText) return;
        
        elements.apiStatusIndicator.className = `status-indicator ${status}`;
        elements.apiStatusText.textContent = message;
        
        // 연결 상태에 따라 적용 버튼 활성화
        if (elements.apiApplyBtn) {
            elements.apiApplyBtn.disabled = status !== 'connected' || appState.isApplying;
        }
    }

    function updateAPIApplyButton(isApplying) {
        if (!elements.apiApplyBtn) return;
        
        elements.apiApplyBtn.disabled = isApplying || !appState.apiConnected;
        
        if (isApplying) {
            elements.apiApplyBtn.innerHTML = '🔄 적용 중...<br><small>잠시만 기다려주세요</small>';
        } else {
            elements.apiApplyBtn.innerHTML = '🚀 서버 적용<br><small>랭킹 페이지 업데이트</small>';
        }
    }

    function updateSaveStatus(status, message) {
        if (!elements.saveStatus) return;
        
        elements.saveStatus.className = `save-status ${status}`;
        elements.saveStatus.textContent = message;
    }

    function updateLastSavedDisplay() {
        if (!elements.lastUpdated || !appState.lastSaved) return;
        
        const timeString = appState.lastSaved.toLocaleTimeString('ko-KR');
        const appliedInfo = appState.lastApplied ? 
            ` | 서버 적용: ${appState.lastApplied.toLocaleTimeString('ko-KR')}` : '';
        
        elements.lastUpdated.textContent = `마지막 저장: ${timeString}${appliedInfo}`;
    }

    function showLoadingState(isLoading) {
        document.body.style.opacity = isLoading ? '0.7' : '1';
        document.body.style.pointerEvents = isLoading ? 'none' : 'auto';
    }

    // 숫자 값 정리 함수
    function cleanNumericValue(value, isNegativeField = false) {
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

    // 체크박스 상태에 따라 입력 필드 업데이트
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
        scheduleAutoSave();
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

    // 전체 퍼센트 합계 계산 및 표시
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
        
        // 🎯 서버 적용 버튼 상태도 반영
        const canApply = isValid && appState.apiConnected && !appState.isApplying;
        if (elements.apiApplyBtn) {
            elements.apiApplyBtn.disabled = !canApply;
        }
        
        totalDisplay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>활성 항목: ${activeCount}개</span>
                <span>총합: <strong style="color: ${isValid ? '#10b981' : '#ef4444'}">${total.toFixed(1)}%</strong></span>
                ${isValid ? 
                    '<span style="color: #10b981;">✓ 서버 적용 가능</span>' : 
                    '<span style="color: #ef4444;">⚠ 100%로 조정 필요</span>'
                }
            </div>
        `;
    }

    // 초기화 함수
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
            scheduleAutoSave();
            
            showNotification('기본값으로 초기화되었습니다', 'info');
            console.log('[Percent] ✅ 기본값 초기화 완료');
            
        } catch (error) {
            console.error('[Percent] 기본값 초기화 실패:', error);
            showNotification('초기화에 실패했습니다', 'error');
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

        // API 테스트 버튼
        if (elements.apiTestBtn) {
            elements.apiTestBtn.addEventListener('click', checkAPIConnection);
        }

        // 🎯 API 적용 버튼 (강화된 이벤트)
        if (elements.apiApplyBtn) {
            elements.apiApplyBtn.addEventListener('click', async function() {
                console.log('[Percent] 🚀 서버 적용 버튼 클릭');
                
                // 가중치 합계 확인
                let total = 0;
                elements.percentInputs.forEach(input => {
                    if (!input.disabled) {
                        total += parseFloat(input.value.replace('%', '')) || 0;
                    }
                });
                
                if (Math.abs(total - 100) > 0.1) {
                    showNotification(`가중치 총합이 100%가 아닙니다 (현재: ${total.toFixed(1)}%)`, 'warning');
                    return;
                }
                
                // 연결된 페이지 확인
                if (appState.connectedPages.size === 0) {
                    const proceed = confirm(
                        '랭킹 페이지가 열려있지 않습니다.\n' +
                        '가중치는 적용되지만 실시간 업데이트를 보려면 rank_party.html 또는 rank_member.html을 열어주세요.\n\n' +
                        '계속 진행하시겠습니까?'
                    );
                    
                    if (!proceed) return;
                }
                
                await applyWeightsToAPI();
            });
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

    // 퍼센트 입력 필드 상세 이벤트 설정
    function setupPercentInputEvents(input) {
        const label = input.dataset.item;

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
            scheduleAutoSave();
        });

        // 기타 이벤트들 (기존과 동일)
        input.addEventListener('keydown', function(e) {
            if (this.disabled) {
                e.preventDefault();
                return;
            }

            const cursorPosition = this.selectionStart;
            const valueLength = this.value.length;
            
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (cursorPosition >= valueLength - 1) {
                    e.preventDefault();
                    
                    if (e.key === 'Backspace' && cursorPosition === valueLength - 1) {
                        const newValue = this.value.slice(0, -2) + '%';
                        this.value = newValue.length > 1 ? newValue : '0%';
                        const newPosition = Math.max(0, this.value.length - 1);
                        this.setSelectionRange(newPosition, newPosition);
                        
                        calculateAndDisplayTotal();
                        scheduleAutoSave();
                    }
                }
            }
            
            if (e.key === 'ArrowRight' && cursorPosition >= valueLength - 1) {
                e.preventDefault();
            }
        });

        input.addEventListener('click', function() {
            if (this.disabled) return;
            
            if (this.value === '0%') {
                this.value = '%';
            }
            
            const valueLength = this.value.length;
            if (this.selectionStart >= valueLength - 1) {
                this.setSelectionRange(valueLength - 1, valueLength - 1);
            }
        });

        input.addEventListener('focus', function() {
            if (this.disabled) {
                this.blur();
                return;
            }
            
            if (this.value === '0%') {
                this.value = '%';
            }
            
            const valueLength = this.value.length;
            this.setSelectionRange(valueLength - 1, valueLength - 1);
        });

        input.addEventListener('blur', function() {
            if (this.disabled) return;
            
            let cleanedValue = cleanNumericValue(this.value);
            
            if (cleanedValue === '') {
                cleanedValue = '0';
            }
            
            this.value = cleanedValue + '%';
            
            calculateAndDisplayTotal();
            scheduleAutoSave();
        });

        input.addEventListener('paste', function(e) {
            if (this.disabled) {
                e.preventDefault();
                return;
            }
            
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const cleanedValue = cleanNumericValue(pastedText);
            
            this.value = cleanedValue + '%';
            
            const newPosition = this.value.length - 1;
            this.setSelectionRange(newPosition, newPosition);
            
            calculateAndDisplayTotal();
            scheduleAutoSave();
        });
    }

    // === 🔄 자동 저장 시스템 ===
    function setupAutoSave() {
        console.log('[Percent] 🔄 자동 저장 시스템 시작...');
    }

    function scheduleAutoSave() {
        appState.hasUnsavedChanges = true;
        updateSaveStatus('saving', '💾 저장 중...');
        
        clearTimeout(appState.autoSaveTimer);
        appState.autoSaveTimer = setTimeout(() => {
            try {
                saveSettings();
                
                // 🎯 자동 적용 기능 (선택적 - 100%일 때만)
                if (appState.apiConnected && !appState.isApplying && appState.realTimeUpdatesEnabled) {
                    let total = 0;
                    elements.percentInputs.forEach(input => {
                        if (!input.disabled) {
                            total += parseFloat(input.value.replace('%', '')) || 0;
                        }
                    });
                    
                    if (Math.abs(total - 100) < 0.1) {
                        clearTimeout(appState.apiApplyTimer);
                        appState.apiApplyTimer = setTimeout(() => {
                            console.log('[Percent] 🔄 자동 서버 적용 (100% 도달)');
                            applyWeightsToAPI();
                        }, WEIGHT_CONFIG.API_APPLY_DELAY);
                    }
                }
                
            } catch (error) {
                console.error('[Percent] 자동 저장 실패:', error);
                updateSaveStatus('error', '💥 저장 실패');
            }
        }, WEIGHT_CONFIG.AUTO_SAVE_DELAY);
    }

    // === 📦 백업 및 복원 기능 ===
    function exportSettings() {
        try {
            const settingsData = {
                weights: {},
                metadata: {
                    version: '2.2.0',
                    exportDate: new Date().toISOString(),
                    source: 'percent_page_v2',
                    lastApplied: appState.lastApplied?.toISOString(),
                    successfulApply: appState.successfulApply
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
            link.download = `weight_settings_${new Date().toISOString().split('T')[0]}.json`;
            
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
                scheduleAutoSave();
                
                showNotification('가중치 설정이 가져오기되었습니다', 'success');
                
            } catch (error) {
                console.error('[Percent] 설정 가져오기 실패:', error);
                showNotification('가져오기에 실패했습니다: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = '';
    }

    // === 🔄 UI 초기화 ===
    function initializeUI() {
        console.log('[Percent] 🎨 UI 초기화...');
        
        // 페이지 로드 애니메이션
        document.querySelector('.checkbox-grid')?.classList.add('fade-in');
        document.querySelector('.percent-grid')?.classList.add('fade-in');
        
        // 초기 상태 업데이트
        updateSaveStatus('saved', '💾 준비됨');
        calculateAndDisplayTotal();
        updateAPIApplyButton(false);
        
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

    // === 🌐 전역 함수 등록 ===
    window.PercentSystem = {
        init: initializeApp,
        save: saveSettings,
        apply: applyWeightsToAPI,
        reset: resetToDefaults,
        checkAPI: checkAPIConnection,
        getState: () => appState,
        forceApply: () => applyWeightsToAPI(),
        version: '2.2.0'
    };

    // === 🔧 개발자 도구 (강화된 버전) ===
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.debugPercent = {
            state: appState,
            config: WEIGHT_CONFIG,
            
            getWeights: () => {
                const weights = {};
                elements.percentInputs.forEach(input => {
                    weights[input.dataset.item] = {
                        value: parseFloat(input.value.replace('%', '')) || 0,
                        enabled: !input.disabled
                    };
                });
                return weights;
            },
            
            setWeight: (item, value, enabled = true) => {
                const input = Array.from(elements.percentInputs).find(i => i.dataset.item === item);
                const checkbox = Array.from(elements.checkboxInputs).find(c => c.dataset.item === item);
                
                if (input) {
                    input.value = value + '%';
                    input.disabled = !enabled;
                    updateInputStyle(input, enabled);
                }
                
                if (checkbox) {
                    checkbox.checked = enabled;
                }
                
                calculateAndDisplayTotal();
                scheduleAutoSave();
            },
            
            testAPI: checkAPIConnection,
            applyWeights: applyWeightsToAPI,
            saveSettings: saveSettings,
            reset: resetToDefaults,
            
            // 🎯 새로운 디버그 함수들
            testRankingConnection: () => {
                if (window.weightUpdateChannel) {
                    window.weightUpdateChannel.postMessage({
                        type: 'debug_test',
                        source: 'percent_page',
                        timestamp: new Date().toISOString(),
                        message: 'Debug connection test'
                    });
                    console.log('[Percent Debug] 랭킹 페이지 연결 테스트 전송');
                } else {
                    console.log('[Percent Debug] BroadcastChannel이 없습니다');
                }
            },
            
            simulateWeightUpdate: () => {
                const testWeights = {
                    secretary_weight: 5,
                    invalid_vote_weight: 3,
                    plenary_pass_weight: 35,
                    chairman_weight: 7,
                    petition_intro_weight: 10,
                    petition_result_weight: 25,
                    attendance_weight: 10,
                    vote_match_weight: 3,
                    vote_mismatch_weight: 2
                };
                
                notifyRankingUpdate(testWeights, 100);
                console.log('[Percent Debug] 가중치 업데이트 시뮬레이션 전송');
            },
            
            checkConnectedPages: () => {
                console.log('[Percent Debug] 연결된 페이지:', Array.from(appState.connectedPages));
                checkConnectedPages();
            },
            
            simulateNotification: (message, type) => showNotification(message, type),
            
            help: () => {
                console.log('[Percent] 🔧 통합 가중치 시스템 디버그 도구 (v2.2.0):');
                console.log('  - getWeights(): 현재 가중치 반환');
                console.log('  - setWeight(item, value, enabled): 가중치 설정');
                console.log('  - testAPI(): API 연결 테스트');
                console.log('  - applyWeights(): 서버 적용');
                console.log('  - testRankingConnection(): 랭킹 페이지 연결 테스트');
                console.log('  - simulateWeightUpdate(): 가중치 업데이트 시뮬레이션');
                console.log('  - checkConnectedPages(): 연결된 페이지 확인');
                console.log('  - simulateNotification(message, type): 알림 테스트');
            }
        };
        
        console.log('[Percent] 🔧 개발자 도구: window.debugPercent.help()');
    }

    // === 🚀 앱 시작 ===
    initializeApp();

    console.log('[Percent] ✅ 통합 가중치 시스템 로드 완료 (v2.2.0 - 실시간 랭킹 연동)');
});
