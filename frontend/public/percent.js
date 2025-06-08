/**
 * percent.js (v4.0.0) - 완전 클라이언트 사이드 가중치 시스템
 * 개선사항: 서버 저장 제거, 클라이언트 전용 모드, 각 사용자별 독립적 가중치
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
        AUTO_APPLY_DELAY: 500,
        STORAGE_KEY: 'client_weights_v4',
        BACKUP_KEY: 'weight_backup_history_v4'
    };

    // === 🔧 애플리케이션 상태 관리 (클라이언트 전용) ===
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
        userId: generateUserId() // 각 사용자별 고유 ID
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

    // === 🆔 사용자별 고유 ID 생성 ===
    function generateUserId() {
        let userId = localStorage.getItem('client_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('client_user_id', userId);
        }
        return userId;
    }

    // === 🚀 초기화 함수 ===
    async function initializeApp() {
        try {
            console.log('[Percent] 🚀 클라이언트 전용 가중치 시스템 초기화... (v4.0.0)');
            console.log('[Percent] 👤 사용자 ID:', appState.userId);
            
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
            
            showLoadingState(false);
            
            console.log('[Percent] ✅ 클라이언트 전용 가중치 시스템 초기화 완료');
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
        createBroadcastChannel();
        
        // 페이지 연결 상태 주기적 확인
        setInterval(checkConnectedPages, 10000); // 10초마다
    }

    // === 📡 BroadcastChannel 생성 및 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[Percent] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (window.weightUpdateChannel) {
                try {
                    window.weightUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 새 채널 생성
            window.weightUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            // 다른 페이지에서 연결 확인 요청 수신
            window.weightUpdateChannel.addEventListener('message', function(event) {
                try {
                    if (event.data.type === 'connection_check') {
                        // 응답 전송 (채널 상태 확인 후)
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'percent_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected',
                            mode: 'client_only',
                            userId: appState.userId
                        });
                        
                        appState.connectedPages.add(event.data.source);
                        updateConnectedPagesDisplay();
                    }
                } catch (error) {
                    console.warn('[Percent] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            window.weightUpdateChannel.addEventListener('error', function(error) {
                console.warn('[Percent] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[Percent] ✅ BroadcastChannel 초기화 완료');
            return true;
            
        } catch (e) {
            console.warn('[Percent] ⚠️ BroadcastChannel 초기화 실패:', e);
            window.weightUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!window.weightUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            // 채널 상태 확인 (readyState는 없지만, 예외 발생으로 확인)
            window.weightUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[Percent] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    window.weightUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[Percent] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 📡 연결된 페이지 확인 (안전한 버전) ===
    function checkConnectedPages() {
        try {
            const success = safeBroadcast({
                type: 'connection_check',
                source: 'percent_page',
                timestamp: new Date().toISOString(),
                userId: appState.userId
            });
            
            if (!success) {
                console.warn('[Percent] 연결 확인 브로드캐스트 실패');
            }
        } catch (error) {
            console.warn('[Percent] 연결 확인 중 오류:', error);
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
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    border-radius: 8px; font-size: 13px; color: white;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
                `;
                
                // 체크박스 그리드 다음에 추가
                const checkboxGrid = document.querySelector('.checkbox-grid');
                if (checkboxGrid) {
                    checkboxGrid.insertAdjacentElement('afterend', statusElement);
                }
            }
            
            const connectedCount = appState.connectedPages.size;
            
            statusElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>🔗 연결된 랭킹 페이지: <strong>${connectedCount}개</strong></span>
                    <span style="color: #fbbf24;">💻 클라이언트 전용 모드</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                    <span style="font-size: 11px; opacity: 0.9;">
                        ${connectedCount > 0 ? 
                            '✓ 실시간 업데이트 활성화' : 
                            '⚠ 랭킹 페이지를 열어주세요'
                        }
                    </span>
                    <span style="font-size: 10px; opacity: 0.8;">
                        ID: ${appState.userId.substr(-8)}
                    </span>
                </div>
            `;
            
        } catch (error) {
            console.warn('[Percent] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 🎯 핵심: 클라이언트 전용 가중치 적용 ===
    async function applyWeightsToRanking() {
        try {
            console.log('[Percent] 🎯 클라이언트 전용 가중치 적용 시작...');
            
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

            // 🎯 클라이언트 저장
            const weightData = {
                weights: activeWeights,
                timestamp: new Date().toISOString(),
                totalWeight: totalWeight,
                version: '4.0.0',
                mode: 'client_only',
                userId: appState.userId
            };
            
            localStorage.setItem('current_weights', JSON.stringify(weightData));
            
            // 🚀 실시간 랭킹 업데이트 알림 전송
            await notifyRankingUpdate(activeWeights, totalWeight);

            // 상태 업데이트
            appState.lastApplied = new Date();
            appState.isApplying = false;
            appState.lastCalculatedWeights = { ...activeWeights };
            
            // 성공 메시지
            updateSaveStatus('saved', '✅ 클라이언트 저장 + 순위 업데이트 완료!');
            updateLastAppliedDisplay();
            
            console.log('[Percent] ✅ 클라이언트 전용 가중치 적용 완료');
            
            // 🎉 성공 알림
            showNotification('가중치가 클라이언트에 저장되고 순위가 업데이트되었습니다! 💻', 'success', 4000);
            
            return true;

        } catch (error) {
            console.error('[Percent] ❌ 가중치 적용 실패:', error);
            
            appState.isApplying = false;
            updateSaveStatus('error', '❌ 적용 실패');
            showNotification(`가중치 적용 실패: ${error.message}`, 'error', 6000);
            
            return false;
        }
    }

    // === 📢 랭킹 업데이트 알림 시스템 ===
    async function notifyRankingUpdate(weights, totalWeight) {
        try {
            console.log('[Percent] 📢 랭킹 업데이트 알림 전송...');
            
            const updateData = {
                type: 'client_weights_updated',
                timestamp: new Date().toISOString(),
                source: 'percent_page',
                weights: weights,
                totalWeight: totalWeight,
                clientSide: true,
                
                // 🎯 클라이언트 전용 메타데이터
                updateId: `client_update_${Date.now()}`,
                userId: appState.userId,
                connectedPages: Array.from(appState.connectedPages),
                weightMapping: WEIGHT_CONFIG.DATA_FIELD_MAPPING,
                mode: 'client_only'
            };
            
            // 1. localStorage 이벤트
            localStorage.setItem('client_weight_change_event', JSON.stringify(updateData));
            localStorage.setItem('last_client_weight_update', Date.now().toString());
            
            // 2. BroadcastChannel (실시간 통신) - 안전한 방식
            const broadcastSuccess = safeBroadcast(updateData);
            if (broadcastSuccess) {
                console.log('[Percent] 📡 BroadcastChannel로 업데이트 알림 전송 성공');
            } else {
                console.warn('[Percent] ⚠️ BroadcastChannel 알림 실패, localStorage만 사용');
            }
            
            // 3. 커스텀 이벤트
            document.dispatchEvent(new CustomEvent('clientWeightSettingsChanged', {
                detail: updateData
            }));
            
            console.log('[Percent] ✅ 랭킹 업데이트 알림 전송 완료');
            
        } catch (error) {
            console.error('[Percent] 랭킹 업데이트 알림 실패:', error);
            // 에러가 발생해도 localStorage는 작동하므로 완전히 실패하지 않음
            console.log('[Percent] 📦 localStorage 이벤트는 정상 작동합니다');
        } finally {
            // localStorage 정리
            setTimeout(() => {
                try {
                    localStorage.removeItem('client_weight_change_event');
                } catch (e) {
                    // 무시
                }
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
            settingsData._version = '4.0.0';
            settingsData._lastApplied = appState.lastApplied?.toISOString();
            settingsData._mode = 'client_only';
            settingsData._userId = appState.userId;
            
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
            
            // BroadcastChannel 정리 (안전하게)
            if (window.weightUpdateChannel) {
                try {
                    window.weightUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음, 무시
                }
                window.weightUpdateChannel = null;
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
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: ${isValid ? '#f0f9ff' : '#fef2f2'}; border: 1px solid ${isValid ? '#10b981' : '#ef4444'}; border-radius: 8px; margin-top: 15px;">
                <span style="color: #64748b;">활성 항목: <strong>${activeCount}개</strong></span>
                <span style="color: ${isValid ? '#10b981' : '#ef4444'};">총합: <strong>${total.toFixed(1)}%</strong></span>
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
        
        elements.lastUpdated.innerHTML = `
            <div style="font-size: 12px; color: #64748b;">
                <div>💾 마지막 저장: ${savedTime}</div>
                <div>🎯 마지막 적용: ${appliedTime}</div>
                <div>💻 클라이언트 전용 모드</div>
                <div>👤 ID: ${appState.userId.substr(-8)}</div>
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
        
        // 클라이언트 모드 알림 표시
        showClientModeInfo();
    }

    // === 💻 클라이언트 모드 정보 표시 ===
    function showClientModeInfo() {
        try {
            let infoElement = document.getElementById('client-mode-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'client-mode-info';
                infoElement.style.cssText = `
                    margin: 10px 0; padding: 12px 16px; 
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white; border-radius: 8px; font-size: 13px;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
                `;
                
                // 상단에 추가
                const container = document.querySelector('.main') || document.body;
                const firstChild = container.firstChild;
                if (firstChild) {
                    container.insertBefore(infoElement, firstChild);
                } else {
                    container.appendChild(infoElement);
                }
            }
            
            infoElement.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 16px;">💻</span>
                    <div>
                        <div style="font-weight: 600;">클라이언트 전용 모드</div>
                        <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
                            각 사용자별 독립적인 가중치 설정 • 실시간 랭킹 업데이트 • 로컬 저장
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.warn('[Percent] 클라이언트 모드 정보 표시 실패:', error);
        }
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
                    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
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
                    version: '4.0.0',
                    exportDate: new Date().toISOString(),
                    source: 'percent_client_v4',
                    lastApplied: appState.lastApplied?.toISOString(),
                    mode: 'client_only',
                    userId: appState.userId
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
        getState: () => appState,
        getCurrentWeights: () => {
            const weights = {};
            elements.percentInputs.forEach(input => {
                if (!input.disabled) {
                    const label = input.dataset.item;
                    weights[label] = parseFloat(input.value.replace('%', '')) || 0;
                }
            });
            return weights;
        },
        getUserId: () => appState.userId,
        version: '4.0.0'
    };

    // === 🔧 개발자 도구 ===
    window.debugClientWeights = {
        state: appState,
        config: WEIGHT_CONFIG,
        getCurrentWeights: () => window.ClientWeightSystem.getCurrentWeights(),
        testNotification: (msg, type) => showNotification(msg, type),
        simulateWeightUpdate: () => applyWeightsToRanking(),
        checkConnectedPages: checkConnectedPages,
        getUserId: () => appState.userId,
        resetUserId: () => {
            localStorage.removeItem('client_user_id');
            appState.userId = generateUserId();
            console.log('[Percent] 새로운 사용자 ID:', appState.userId);
            updateConnectedPagesDisplay();
            updateLastSavedDisplay();
        },
        recreateChannel: () => {
            console.log('[Percent] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[Percent] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        getChannelStatus: () => {
            return {
                exists: !!window.weightUpdateChannel,
                type: typeof window.weightUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[Percent] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        help: () => {
            console.log('[Percent] 🔧 클라이언트 전용 가중치 시스템 디버그 도구 (v4.0.0):');
            console.log('  - getCurrentWeights(): 현재 가중치 반환');
            console.log('  - testNotification(msg, type): 알림 테스트');
            console.log('  - simulateWeightUpdate(): 가중치 업데이트 시뮬레이션');
            console.log('  - checkConnectedPages(): 연결된 페이지 확인');
            console.log('  - getUserId(): 현재 사용자 ID 확인');
            console.log('  - resetUserId(): 새로운 사용자 ID 생성');
            console.log('  - recreateChannel(): BroadcastChannel 재생성');
            console.log('  - getChannelStatus(): 채널 상태 확인');
            console.log('  - testBroadcast(): 브로드캐스트 테스트');
        }
    };

    // === 🚀 앱 시작 ===
    initializeApp();

    console.log('[Percent] ✅ 클라이언트 전용 가중치 시스템 로드 완료 (v4.0.0)');
    console.log('[Percent] 💻 완전 클라이언트 모드 - 서버 저장 없음');
    console.log('[Percent] 👤 사용자 ID:', appState.userId);
    console.log('[Percent] 🔧 디버그: window.debugClientWeights.help()');
});
