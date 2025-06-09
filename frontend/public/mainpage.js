/**
 * mainpage.js (v4.0.0) - API 계산 데이터 수신 메인페이지 시스템
 * 개선사항: percent.js에서 계산된 완성 데이터를 받아서 표시
 */

document.addEventListener('DOMContentLoaded', function() {
    // === 전역 변수 및 상태 관리 ===
    let isLoading = false;
    let loadingTimeout = null;
    let dataUpdateTimeout = null;
    
    // 정리해야 할 이벤트 리스너들
    const eventListeners = [];
    
    // 🎯 API 계산 데이터 수신 관련 상태
    let mainPageState = {
        // 원본 데이터 저장
        originalPartyData: [],
        originalMemberData: [],
        
        // 계산된 데이터 저장 (percent.js에서 수신)
        calculatedPartyData: [],
        calculatedMemberData: [],
        
        // 현재 표시 데이터
        currentPartyRanking: [],
        currentMemberRanking: [],
        
        // 데이터 수신 상태
        isUsingCalculatedData: false,
        lastDataReceived: null,
        calculationTimestamp: null,
        percentPageConnected: false,
        realTimeUpdateChannel: null,
        appliedWeights: null
    };

    // === 📡 안전한 BroadcastChannel 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[MainPage] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (mainPageState.realTimeUpdateChannel) {
                try {
                    mainPageState.realTimeUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 🔧 통일된 채널명 사용
            mainPageState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            mainPageState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                try {
                    const data = event.data;
                    console.log('[MainPage] 📡 데이터 수신:', data.type);
                    
                    if (data.type === 'calculated_data_distribution' && data.source === 'percent_page') {
                        await handleCalculatedDataReceived(data);
                    } else if (data.type === 'data_reset_to_original' && data.source === 'percent_page') {
                        await handleDataResetRequest(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'main_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected',
                            data_mode: mainPageState.isUsingCalculatedData ? 'calculated' : 'original'
                        });
                        mainPageState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                } catch (error) {
                    console.warn('[MainPage] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            mainPageState.realTimeUpdateChannel.addEventListener('error', function(error) {
                console.warn('[MainPage] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[MainPage] ✅ BroadcastChannel 초기화 완료 (v4)');
            return true;
            
        } catch (error) {
            console.error('[MainPage] BroadcastChannel 초기화 실패:', error);
            mainPageState.realTimeUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!mainPageState.realTimeUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            mainPageState.realTimeUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[MainPage] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    mainPageState.realTimeUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[MainPage] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 🔗 실시간 데이터 수신 시스템 초기화 ===
    function initializeRealTimeDataReceive() {
        console.log('[MainPage] 🔗 API 계산 데이터 수신 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정
            createBroadcastChannel();
            
            // 2. localStorage 이벤트 감지
            window.addEventListener('storage', function(e) {
                if (e.key === 'calculated_data_distribution' && !isLoading) {
                    try {
                        const eventData = JSON.parse(e.newValue);
                        console.log('[MainPage] 📢 localStorage 계산 데이터 변경 감지:', eventData.type);
                        if (eventData.type === 'calculated_data_distribution') {
                            handleCalculatedDataReceived(eventData);
                        } else if (eventData.type === 'data_reset_to_original') {
                            handleDataResetRequest(eventData);
                        }
                    } catch (error) {
                        console.warn('[MainPage] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            // 3. 🎯 percent 페이지 연결 확인 (능동적)
            setTimeout(() => {
                checkPercentPageConnection();
                // 5초마다 연결 확인
                setInterval(checkPercentPageConnection, 5000);
            }, 1000);
            
            console.log('[MainPage] ✅ 실시간 데이터 수신 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[MainPage] 실시간 데이터 수신 시스템 초기화 실패:', error);
        }
    }

    // === 🔍 percent 페이지 연결 확인 ===
    function checkPercentPageConnection() {
        try {
            const success = safeBroadcast({
                type: 'connection_check',
                source: 'main_page',
                timestamp: new Date().toISOString()
            });
            
            if (!success) {
                console.warn('[MainPage] percent 페이지 연결 확인 브로드캐스트 실패');
            }
        } catch (error) {
            console.warn('[MainPage] percent 페이지 연결 확인 중 오류:', error);
        }
    }

    // === 🎯 핵심: percent.js에서 계산된 데이터 수신 처리 ===
    async function handleCalculatedDataReceived(eventData) {
        if (isLoading) {
            console.log('[MainPage] 🔄 이미 처리 중입니다.');
            return;
        }

        try {
            isLoading = true;
            
            console.log('[MainPage] 🎯 계산된 메인페이지 데이터 수신 처리 시작...');
            
            // 사용자에게 알림
            showDataUpdateNotification('percent.js에서 계산된 데이터로 메인페이지를 업데이트하는 중...', 'info', 3000);
            
            // 로딩 상태 표시
            showLoading(true);
            
            // 🎯 계산된 정당 데이터 적용
            if (eventData.partyData && eventData.partyData.top3) {
                mainPageState.calculatedPartyData = eventData.partyData.top3;
                mainPageState.currentPartyRanking = eventData.partyData.top3.map((party, index) => ({
                    rank: index + 1,
                    name: party.name,
                    score: party.score,
                    original_score: party.original_score,
                    score_changed: party.score_changed,
                    weight_applied: party.weight_applied,
                    _isCalculated: true
                }));
                
                console.log(`[MainPage] ✅ 계산된 정당 TOP3 적용 완료: ${mainPageState.calculatedPartyData.length}개`);
            }
            
            // 🎯 계산된 의원 데이터 적용
            if (eventData.memberData && eventData.memberData.top3) {
                mainPageState.calculatedMemberData = eventData.memberData.top3;
                mainPageState.currentMemberRanking = eventData.memberData.top3.map((member, index) => ({
                    rank: index + 1,
                    name: member.name,
                    party: member.party,
                    score: member.score,
                    original_score: member.original_score,
                    score_changed: member.score_changed,
                    weight_applied: member.weight_applied,
                    _isCalculated: true
                }));
                
                console.log(`[MainPage] ✅ 계산된 의원 TOP3 적용 완료: ${mainPageState.calculatedMemberData.length}명`);
            }
            
            // 🎯 상태 업데이트
            mainPageState.isUsingCalculatedData = true;
            mainPageState.lastDataReceived = new Date(eventData.timestamp);
            mainPageState.calculationTimestamp = eventData.timestamp;
            mainPageState.appliedWeights = eventData.appliedWeights;
            
            // UI 업데이트
            updatePartyRankingCard(mainPageState.currentPartyRanking);
            updateMemberRankingCard(mainPageState.currentMemberRanking);
            
            // 업데이트 정보 표시
            showCalculatedDataInfo();
            
            // 연결 상태 업데이트
            mainPageState.percentPageConnected = true;
            updateConnectionStatus();
            
            // 성공 알림
            const weightCount = eventData.appliedWeights ? Object.keys(eventData.appliedWeights).length : 0;
            showDataUpdateNotification(
                `✅ API 계산 데이터로 메인페이지 업데이트 완료! (${weightCount}개 가중치)`, 
                'success', 
                4000
            );
            
            console.log('[MainPage] ✅ 계산된 데이터 수신 처리 완료');
            
        } catch (error) {
            console.error('[MainPage] ❌ 계산된 데이터 수신 처리 실패:', error);
            showDataUpdateNotification(`메인페이지 데이터 수신 실패: ${error.message}`, 'error', 5000);
        } finally {
            isLoading = false;
            showLoading(false);
        }
    }

    // === 🔄 데이터 리셋 요청 처리 ===
    async function handleDataResetRequest(eventData) {
        try {
            console.log('[MainPage] 🔄 데이터 리셋 요청 수신:', eventData.action);
            
            showDataUpdateNotification('원본 데이터로 복원하는 중...', 'info', 2000);
            
            // 계산된 데이터 상태 해제
            mainPageState.isUsingCalculatedData = false;
            mainPageState.lastDataReceived = null;
            mainPageState.calculationTimestamp = null;
            mainPageState.appliedWeights = null;
            mainPageState.calculatedPartyData = [];
            mainPageState.calculatedMemberData = [];
            
            // 원본 데이터로 복원
            if (mainPageState.originalPartyData.length > 0 || mainPageState.originalMemberData.length > 0) {
                // 원본 데이터가 있으면 그것 사용
                mainPageState.currentPartyRanking = mainPageState.originalPartyData.slice(0, 3).map((party, index) => ({
                    rank: index + 1,
                    name: party.name,
                    score: party.score,
                    _isCalculated: false
                }));
                
                mainPageState.currentMemberRanking = mainPageState.originalMemberData.slice(0, 3).map((member, index) => ({
                    rank: index + 1,
                    name: member.name,
                    party: member.party,
                    score: member.score,
                    _isCalculated: false
                }));
                
                updatePartyRankingCard(mainPageState.currentPartyRanking);
                updateMemberRankingCard(mainPageState.currentMemberRanking);
            } else {
                // 원본 데이터가 없으면 API에서 다시 로드
                await loadMainPageData();
            }
            
            updateConnectionStatus();
            showDataUpdateNotification('✅ 원본 API 데이터로 복원되었습니다!', 'success', 3000);
            
        } catch (error) {
            console.error('[MainPage] ❌ 데이터 리셋 실패:', error);
            showDataUpdateNotification('원본 데이터 복원에 실패했습니다', 'error');
        }
    }

    // === 📊 계산된 데이터 정보 표시 ===
    function showCalculatedDataInfo() {
        try {
            let infoElement = document.getElementById('main-calculated-data-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'main-calculated-data-info';
                infoElement.style.cssText = `
                    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
                    padding: 12px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white; border-radius: 10px; font-size: 14px; text-align: center;
                    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); z-index: 1000;
                    animation: slideInMain 0.6s ease-out; max-width: 500px;
                `;
                document.body.appendChild(infoElement);
            }
            
            const partyCount = mainPageState.calculatedPartyData.length;
            const memberCount = mainPageState.calculatedMemberData.length;
            const weightCount = mainPageState.appliedWeights ? Object.keys(mainPageState.appliedWeights).length : 0;
            
            const timeInfo = mainPageState.calculationTimestamp ? 
                new Date(mainPageState.calculationTimestamp).toLocaleTimeString('ko-KR') : 
                new Date().toLocaleTimeString('ko-KR');
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">📡</span>
                    <span>메인페이지 API 계산 데이터 업데이트! 정당 <strong>${partyCount}개</strong>, 의원 <strong>${memberCount}명</strong> (${weightCount}개 가중치)</span>
                    <span style="font-size: 11px; opacity: 0.9;">${timeInfo}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('main-calculated-data-styles')) {
                const style = document.createElement('style');
                style.id = 'main-calculated-data-styles';
                style.textContent = `
                    @keyframes slideInMain {
                        from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
                        to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 6초 후 자동 숨김
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.style.opacity = '0';
                    infoElement.style.transform = 'translateX(-50%) translateY(-20px) scale(0.9)';
                    setTimeout(() => infoElement.remove(), 400);
                }
            }, 6000);
            
        } catch (error) {
            console.warn('[MainPage] 계산 데이터 정보 표시 실패:', error);
        }
    }

    // === 🔔 데이터 업데이트 전용 알림 시스템 ===
    function showDataUpdateNotification(message, type = 'info', duration = 4000) {
        try {
            // 기존 알림 제거
            const existingNotification = document.querySelector('.main-data-update-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = 'main-data-update-notification';
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                padding: 14px 25px; border-radius: 10px; z-index: 10001; font-size: 14px;
                max-width: 500px; box-shadow: 0 6px 18px rgba(0,0,0,0.15);
                font-family: 'Blinker', sans-serif; font-weight: 500; text-align: center;
                opacity: 0; transform: translateX(-50%) translateY(-20px);
                transition: all 0.4s ease; line-height: 1.4;
                background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                           type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                           type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 
                           'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'};
                color: white;
            `;
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    <span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '📡'}</span>
                    <span>${message}</span>
                    <span style="font-size: 16px;">🏠</span>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // 애니메이션 시작
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(-50%) translateY(0)';
            }, 10);
            
            // 자동 제거
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(-50%) translateY(-20px)';
                    setTimeout(() => notification.remove(), 400);
                }
            }, duration);
            
        } catch (error) {
            console.log(`[MainPage 데이터 알림] ${message} (${type})`);
        }
    }

    // === 🎨 연결 상태 표시 업데이트 ===
    function updateConnectionStatus() {
        try {
            let statusElement = document.getElementById('main-data-sync-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'main-data-sync-status';
                statusElement.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px; z-index: 1000;
                    padding: 8px 12px; color: white; border-radius: 20px; 
                    font-size: 11px; font-weight: 500; backdrop-filter: blur(4px);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.3s ease; 
                    font-family: 'Blinker', sans-serif;
                `;
                document.body.appendChild(statusElement);
            }
            
            const hasOriginalData = mainPageState.originalPartyData.length > 0 || mainPageState.originalMemberData.length > 0;
            
            if (mainPageState.isUsingCalculatedData && mainPageState.percentPageConnected) {
                statusElement.style.background = 'rgba(139, 92, 246, 0.9)';
                statusElement.innerHTML = '📡 API 계산 데이터 적용됨';
            } else if (mainPageState.percentPageConnected) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 percent 페이지 연결됨';
            } else if (hasOriginalData) {
                statusElement.style.background = 'rgba(59, 130, 246, 0.9)';
                statusElement.innerHTML = '📊 원본 API 데이터';
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 기본 데이터';
            }
            
        } catch (error) {
            console.warn('[MainPage] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 나머지 기존 코드들은 모두 동일하게 유지 ===
    
    // API 연결 상태 확인
    function checkAPIService() {
        if (typeof window.APIService === 'undefined') {
            console.error('❌ APIService를 찾을 수 없습니다. global_sync.js가 로드되었는지 확인하세요.');
            showError('API 서비스 연결 실패');
            return false;
        } else {
            console.log('✅ APIService 연결됨');
            return true;
        }
    }

    // === 유틸리티 함수들 ===
    
    // 안전한 DOM 요소 선택
    function safeQuerySelector(selector) {
        try {
            return document.querySelector(selector);
        } catch (error) {
            console.warn(`DOM 선택 실패: ${selector}`, error);
            return null;
        }
    }
    
    // 안전한 DOM 요소 선택 (복수)
    function safeQuerySelectorAll(selector) {
        try {
            return document.querySelectorAll(selector);
        } catch (error) {
            console.warn(`DOM 선택 실패: ${selector}`, error);
            return [];
        }
    }

    // 알림 표시 함수 (개선된 버전)
    function showNotification(message, type = 'info') {
        try {
            if (window.APIService && typeof window.APIService.showNotification === 'function') {
                window.APIService.showNotification(message, type);
            } else {
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        } catch (error) {
            console.warn('알림 표시 실패:', error);
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 에러 메시지 표시 (개선된 버전)
    function showError(message) {
        // 기존 에러 알림 제거
        const existingError = safeQuerySelector('.error-notification');
        if (existingError) {
            existingError.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        try {
            document.body.appendChild(notification);
        } catch (error) {
            console.error('에러 알림 추가 실패:', error);
        }
        
        // 5초 후 자동 제거
        setTimeout(() => {
            try {
                if (notification && notification.parentNode) {
                    notification.remove();
                }
            } catch (error) {
                console.warn('에러 알림 제거 실패:', error);
            }
        }, 5000);
        
        showNotification(message, 'error');
    }

    // 로딩 상태 표시 (개선된 버전)
    function showLoading(show = true) {
        try {
            const cards = safeQuerySelectorAll('.card');
            cards.forEach(card => {
                if (card) {
                    if (show) {
                        card.style.opacity = '0.6';
                        card.style.pointerEvents = 'none';
                    } else {
                        card.style.opacity = '1';
                        card.style.pointerEvents = 'auto';
                    }
                }
            });
            
            // 로딩 타임아웃 설정 (30초)
            if (show) {
                if (loadingTimeout) {
                    clearTimeout(loadingTimeout);
                }
                loadingTimeout = setTimeout(() => {
                    console.warn('로딩 타임아웃 - 강제로 로딩 상태 해제');
                    showLoading(false);
                    showError('데이터 로드 시간이 초과되었습니다.');
                }, 30000);
            } else {
                if (loadingTimeout) {
                    clearTimeout(loadingTimeout);
                    loadingTimeout = null;
                }
            }
        } catch (error) {
            console.error('로딩 상태 변경 실패:', error);
        }
    }

    // 정당명 정규화 (개선된 버전)
    function normalizePartyName(partyName) {
        if (!partyName || typeof partyName !== 'string') {
            return '정보없음';
        }
        
        const trimmedName = partyName.trim();
        if (!trimmedName) {
            return '정보없음';
        }
        
        const nameMapping = {
            '더불어민주당': '더불어민주당',
            '민주당': '더불어민주당',
            '국민의힘': '국민의힘',
            '국민의 힘': '국민의힘',
            '조국혁신당': '조국혁신당',
            '개혁신당': '개혁신당',
            '진보당': '진보당',
            '기본소득당': '기본소득당',
            '사회민주당': '사회민주당',
            '무소속': '무소속',
            '없음': '무소속'
        };

        return nameMapping[trimmedName] || trimmedName;
    }

    // 데이터 유효성 검증
    function validateData(data, type) {
        if (!Array.isArray(data)) {
            console.warn(`${type} 데이터가 배열이 아닙니다:`, data);
            return false;
        }
        
        if (data.length === 0) {
            console.warn(`${type} 데이터가 비어있습니다`);
            return false;
        }
        
        return true;
    }

    // === API 데이터 가져오기 함수들 (원본 데이터용) ===
    
    // 정당 순위 데이터 가져오기
    async function fetchPartyRankingData() {
        try {
            console.log('📊 정당 순위 데이터 로드 중...');

            if (!window.APIService || !window.APIService.getPartyPerformance) {
                throw new Error('정당 성과 API가 준비되지 않았습니다');
            }

            const rawData = await window.APIService.getPartyPerformance();
            const partyData = rawData?.party_ranking || rawData || [];

            if (!validateData(partyData, '정당')) {
                console.warn('정당 데이터가 없습니다. 기본값 사용');
                return getDefaultPartyRanking();
            }

            console.log('🔍 정당 원본 데이터 샘플:', partyData.slice(0, 2));

            const processedData = partyData
                .filter(party => {
                    return party && 
                           party.party && 
                           party.party !== '알 수 없음';
                })
                .map(party => {
                    const score = parseFloat(party.avg_total_score) || 0;
                    return {
                        name: normalizePartyName(party.party),
                        score: Math.round(Math.max(0, Math.min(100, score))),
                        originalData: party,
                        _isCalculated: false
                    };
                })
                .sort((a, b) => b.score - a.score);

            if (processedData.length === 0) {
                console.warn('처리된 정당 데이터가 없습니다. 기본값 사용');
                return getDefaultPartyRanking();
            }

            console.log('✅ 정당 순위 데이터 가공 완료:', processedData);
            
            // 🎯 원본 데이터 저장
            mainPageState.originalPartyData = processedData;
            
            return processedData.slice(0, 3).map((party, index) => ({
                rank: index + 1,
                name: party.name,
                score: party.score,
                _isCalculated: false
            }));

        } catch (error) {
            console.error('❌ 정당 순위 데이터 로드 실패:', error);
            return getDefaultPartyRanking();
        }
    }

    // 국회의원 순위 데이터 가져오기
    async function fetchMemberRankingData() {
        try {
            console.log('👥 국회의원 순위 데이터 로드 중...');

            if (!window.APIService || !window.APIService.getMemberPerformance) {
                throw new Error('의원 성과 API가 준비되지 않았습니다');
            }

            const rawData = await window.APIService.getMemberPerformance();
            const memberPerformanceData = rawData?.ranking || rawData || [];

            console.log('🔍 getMemberPerformance 응답 원본:', rawData);
            console.log('🔍 ranking 배열:', memberPerformanceData);

            if (!Array.isArray(memberPerformanceData) || memberPerformanceData.length === 0) {
                console.warn('의원 성과 데이터가 없습니다. 기본값 사용');
                return getDefaultMemberRanking();
            }

            const validMembers = memberPerformanceData.filter(member => {
                const score = parseFloat(member.total_score ?? member.total_socre);
                return member &&
                    member.lawmaker_name &&
                    member.lawmaker_name !== '알 수 없음' &&
                    !isNaN(score) &&
                    score > 0;
            });

            if (validMembers.length === 0) {
                console.warn('유효한 의원 데이터가 없습니다. 기본값 사용');
                return getDefaultMemberRanking();
            }

            const processedMembers = validMembers.map(member => {
                const rawScore = member.total_score ?? member.total_socre ?? 0;
                const score = Math.round(parseFloat(rawScore) * 10) / 10;

                return {
                    name: member.lawmaker_name,
                    party: normalizePartyName(member.party) || '정보없음',
                    score: score,
                    originalData: member,
                    _isCalculated: false
                };
            });

            const top3 = processedMembers
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((member, index) => {
                    console.log(`[TOP${index + 1}] ${member.name} (${member.party}) - ${member.score}%`);

                    return {
                        rank: index + 1,
                        name: member.name,
                        party: member.party,
                        score: member.score,
                        _isCalculated: false
                    };
                });

            console.log('✅ 국회의원 순위 데이터 로드 완료:', top3);
            
            // 🎯 원본 데이터 저장 (전체 데이터)
            mainPageState.originalMemberData = processedMembers;
            
            return top3;

        } catch (error) {
            console.error('❌ 국회의원 순위 데이터 로드 실패:', error);
            return getDefaultMemberRanking();
        }
    }

    // 기본 데이터
    function getDefaultPartyRanking() {
        const defaultData = [
            { rank: 1, name: '더불어민주당', score: 87.1, _isCalculated: false },
            { rank: 2, name: '진보당', score: 85.9, _isCalculated: false },
            { rank: 3, name: '조국혁신당', score: 81.9, _isCalculated: false }
        ];
        
        // 🎯 원본 데이터도 저장
        mainPageState.originalPartyData = defaultData.map(party => ({
            ...party,
            originalData: {}
        }));
        
        return defaultData;
    }

    function getDefaultMemberRanking() {
        const defaultData = [
            { rank: 1, name: '어기구', party: '더불어민주당', score: 94, _isCalculated: false },
            { rank: 2, name: '이건태', party: '더불어민주당', score: 91, _isCalculated: false },
            { rank: 3, name: '박성준', party: '더불어민주당', score: 88, _isCalculated: false }
        ];
        
        // 🎯 원본 데이터도 저장
        mainPageState.originalMemberData = defaultData.map(member => ({
            ...member,
            originalData: {}
        }));
        
        return defaultData;
    }

    // === UI 업데이트 함수들 (개선된 버전) ===
    
    // 정당 순위 카드 업데이트
    function updatePartyRankingCard(partyData) {
        try {
            if (!validateData(partyData, '정당 순위')) {
                console.error('❌ 유효하지 않은 정당 데이터');
                return;
            }
            
            const partyCard = safeQuerySelector('.card:first-child');
            if (!partyCard) {
                console.error('❌ 정당 순위 카드를 찾을 수 없습니다');
                return;
            }
            
            const rankingList = partyCard.querySelector('.ranking-list');
            if (!rankingList) {
                console.error('❌ 정당 순위 리스트를 찾을 수 없습니다');
                return;
            }
            
            // 기존 내용 비우기
            rankingList.innerHTML = '';
            
            partyData.forEach((party, index) => {
                if (!party || !party.name) {
                    console.warn('유효하지 않은 정당 데이터 스킵:', party);
                    return;
                }
                
                const rankingItem = document.createElement('li');
                rankingItem.className = 'ranking-item';
                
                const rank = party.rank || (index + 1);
                const name = String(party.name || '정보없음');
                const score = Math.round(party.score || 0);
                
                // 🎯 계산 데이터 표시 추가
                const dataIndicator = party._isCalculated ? 
                    '<span style="color: #8b5cf6; font-size: 10px; margin-left: 5px;" title="API 계산 데이터">📡</span>' : 
                    '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="원본 API 데이터">📊</span>';
                
                rankingItem.innerHTML = `
                    <div class="rank-number">${rank}</div>
                    <div class="info">
                        <div class="name">${name}${dataIndicator}</div>
                        ${party.score_changed ? 
                            `<div style="font-size: 10px; color: #8b5cf6; margin-top: 2px;">원본: ${party.original_score}</div>` : ''
                        }
                    </div>
                    <div class="percentage">${score}%</div>
                `;
                
                rankingList.appendChild(rankingItem);
            });
            
            console.log('✅ 정당 순위 카드 업데이트 완료');
        } catch (error) {
            console.error('❌ 정당 순위 카드 업데이트 실패:', error);
        }
    }

    // 국회의원 순위 카드 업데이트
    function updateMemberRankingCard(memberData) {
        try {
            if (!validateData(memberData, '의원 순위')) {
                console.error('❌ 유효하지 않은 의원 데이터');
                return;
            }
            
            const memberCard = safeQuerySelector('.card:last-child');
            if (!memberCard) {
                console.error('❌ 국회의원 순위 카드를 찾을 수 없습니다');
                return;
            }
            
            const rankingList = memberCard.querySelector('.ranking-list');
            if (!rankingList) {
                console.error('❌ 국회의원 순위 리스트를 찾을 수 없습니다');
                return;
            }
            
            // 기존 내용 비우기
            rankingList.innerHTML = '';
            
            memberData.forEach((member, index) => {
                if (!member || !member.name) {
                    console.warn('유효하지 않은 의원 데이터 스킵:', member);
                    return;
                }
                
                const rankingItem = document.createElement('li');
                rankingItem.className = 'ranking-item';
                
                const rank = member.rank || (index + 1);
                const name = String(member.name || '정보없음');
                const party = String(member.party || '정보없음');
                const score = Math.round(parseFloat(member.score) * 10) / 10; 
                
                // 🎯 계산 데이터 표시 추가
                const dataIndicator = member._isCalculated ? 
                    '<span style="color: #8b5cf6; font-size: 10px; margin-left: 5px;" title="API 계산 데이터">📡</span>' : 
                    '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="원본 API 데이터">📊</span>';
                
                rankingItem.innerHTML = `
                    <div class="rank-number">${rank}</div>
                    <div class="info">
                        <div class="name">${name}${dataIndicator}</div>
                        <div class="party-name">${party}</div>
                        ${member.score_changed ? 
                            `<div style="font-size: 10px; color: #8b5cf6; margin-top: 2px;">원본: ${member.original_score}</div>` : ''
                        }
                    </div>
                    <div class="percentage">${score}%</div>
                `;
                
                rankingList.appendChild(rankingItem);
            });
            
            console.log('✅ 국회의원 순위 카드 업데이트 완료');
        } catch (error) {
            console.error('❌ 국회의원 순위 카드 업데이트 실패:', error);
        }
    }

    // === 메인 데이터 로드 함수 (개선된 버전) ===
    async function loadMainPageData() {
        if (!checkAPIService()) {
            console.warn('⚠️ APIService 없음 - 기본 데이터 사용');
            const defaultPartyData = getDefaultPartyRanking();
            const defaultMemberData = getDefaultMemberRanking();
            
            mainPageState.currentPartyRanking = defaultPartyData;
            mainPageState.currentMemberRanking = defaultMemberData;
            updatePartyRankingCard(defaultPartyData);
            updateMemberRankingCard(defaultMemberData);
            return;
        }

        if (isLoading) {
            console.log('🔄 이미 로딩 중입니다');
            return;
        }

        console.log('🚀 메인페이지 원본 데이터 로드 시작...');
        
        try {
            isLoading = true;
            showLoading(true);
            
            // Promise.allSettled로 안전하게 동시 로드
            const [partyResult, memberResult] = await Promise.allSettled([
                fetchPartyRankingData(),
                fetchMemberRankingData()
            ]);
            
            // 정당 순위 처리
            if (partyResult.status === 'fulfilled' && partyResult.value) {
                mainPageState.currentPartyRanking = partyResult.value;
                console.log('✅ 정당 순위 로드 성공');
            } else {
                console.warn('정당 순위 로드 실패, 기본값 사용:', partyResult.reason);
                const defaultData = getDefaultPartyRanking();
                mainPageState.currentPartyRanking = defaultData;
            }
            
            // 국회의원 순위 처리
            if (memberResult.status === 'fulfilled' && memberResult.value) {
                mainPageState.currentMemberRanking = memberResult.value;
                console.log('✅ 실제 API 데이터로 명예의 의원 업데이트 완료');
            } else {
                console.warn('국회의원 순위 로드 실패, 기본값 사용:', memberResult.reason);
                const defaultData = getDefaultMemberRanking();
                mainPageState.currentMemberRanking = defaultData;
            }
            
            // 계산된 데이터가 있으면 그것을 우선 사용
            if (mainPageState.isUsingCalculatedData) {
                if (mainPageState.calculatedPartyData.length > 0) {
                    mainPageState.currentPartyRanking = mainPageState.calculatedPartyData;
                }
                if (mainPageState.calculatedMemberData.length > 0) {
                    mainPageState.currentMemberRanking = mainPageState.calculatedMemberData;
                }
            }
            
            // UI 업데이트
            updatePartyRankingCard(mainPageState.currentPartyRanking);
            updateMemberRankingCard(mainPageState.currentMemberRanking);
            
            showNotification('메인페이지 데이터 로드 완료', 'success');
            console.log('✅ 메인페이지 데이터 로드 완료');
            
        } catch (error) {
            console.error('❌ 메인페이지 데이터 로드 실패:', error);
            
            // 기본 데이터로 폴백
            const defaultPartyData = getDefaultPartyRanking();
            const defaultMemberData = getDefaultMemberRanking();
            
            mainPageState.currentPartyRanking = defaultPartyData;
            mainPageState.currentMemberRanking = defaultMemberData;
            
            updatePartyRankingCard(defaultPartyData);
            updateMemberRankingCard(defaultMemberData);
            
            showError('데이터 로드에 실패했습니다. 기본 데이터를 표시합니다.');
        } finally {
            isLoading = false;
            showLoading(false);
        }
    }

    // === 네비게이션 및 이벤트 설정 (기존 유지) ===
    
    function setupNavigation() {
        try {
            // 더보기 버튼들
            const showMoreButtons = safeQuerySelectorAll('.show-more');
            
            showMoreButtons.forEach((button, index) => {
                if (button) {
                    const clickHandler = function() {
                        if (index === 0) {
                            window.location.href = 'rank_party.html';
                        } else if (index === 1) {
                            window.location.href = 'rank_member.html';
                        }
                    };
                    
                    button.addEventListener('click', clickHandler);
                    eventListeners.push({ element: button, event: 'click', handler: clickHandler });
                }
            });

            // 상세 퍼센트 링크
            const percentLink = safeQuerySelector('.percentages-container .more-link');
            if (percentLink) {
                const percentClickHandler = function() {
                    window.location.href = 'percent.html';
                };
                
                percentLink.addEventListener('click', percentClickHandler);
                percentLink.style.cursor = 'pointer';
                eventListeners.push({ element: percentLink, event: 'click', handler: percentClickHandler });
            }

            // 공지사항 링크
            const noticeLink = safeQuerySelector('.notices-container .more-link');
            if (noticeLink) {
                const noticeClickHandler = function() {
                    window.location.href = 'announcements.html';
                };
                
                noticeLink.addEventListener('click', noticeClickHandler);
                noticeLink.style.cursor = 'pointer';
                eventListeners.push({ element: noticeLink, event: 'click', handler: noticeClickHandler });
            }

            console.log('✅ 네비게이션 설정 완료');
        } catch (error) {
            console.error('❌ 네비게이션 설정 실패:', error);
        }
    }

    // === 기존 팝업 관련 함수들 (유지) ===
    function shouldShowImagePopup() {
        try {
            const today = new Date().toDateString();
            const hiddenDate = localStorage.getItem('imagePopupHiddenDate');
            return hiddenDate !== today;
        } catch (error) {
            console.warn('localStorage 접근 불가:', error);
            return true;
        }
    }

    function shouldShowPercentPopup() {
        try {
            const today = new Date().toDateString();
            const hiddenDate = localStorage.getItem('percentPopupHiddenDate');
            return hiddenDate !== today;
        } catch (error) {
            console.warn('localStorage 접근 불가:', error);
            return true;
        }
    }

    // === 🔧 전역 함수 등록 ===
    
    // 수동 새로고침 함수들
    window.refreshMainPageData = function() {
        console.log('[MainPage] 🔄 수동 새로고침 요청');
        return loadMainPageData();
    };

    // 호환 함수들
    window.refreshMemberDetails = function() {
        console.log('[MainPage] 🔄 의원 데이터 새로고침 (호환)');
        return loadMainPageData();
    };

    window.refreshPartyRanking = function() {
        console.log('[MainPage] 🔄 정당 데이터 새로고침 (호환)');
        return loadMainPageData();
    };

    // === 🛠️ 디버깅 함수들 (향상된 버전) ===
    window.mainPageDebug = {
        getState: () => mainPageState,
        refreshData: () => loadMainPageData(),
        
        // 데이터 수신 관련
        getDataReceiveState: () => ({
            isUsingCalculatedData: mainPageState.isUsingCalculatedData,
            lastDataReceived: mainPageState.lastDataReceived,
            calculationTimestamp: mainPageState.calculationTimestamp,
            percentPageConnected: mainPageState.percentPageConnected,
            appliedWeights: mainPageState.appliedWeights
        }),
        getOriginalData: () => ({
            parties: mainPageState.originalPartyData,
            members: mainPageState.originalMemberData
        }),
        getCalculatedData: () => ({
            parties: mainPageState.calculatedPartyData,
            members: mainPageState.calculatedMemberData
        }),
        getCurrentData: () => ({
            parties: mainPageState.currentPartyRanking,
            members: mainPageState.currentMemberRanking
        }),
        
        // 🔧 BroadcastChannel 관련 디버그
        recreateChannel: () => {
            console.log('[MainPage] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[MainPage] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        
        getChannelStatus: () => {
            return {
                exists: !!mainPageState.realTimeUpdateChannel,
                type: typeof mainPageState.realTimeUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[MainPage] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        
        checkConnection: () => {
            checkPercentPageConnection();
            console.log('[MainPage] percent 페이지 연결 확인 요청 전송');
        },
        
        showInfo: () => {
            console.log('[MainPage] 📊 메인페이지 정보 (v4.0.0 - API 계산 데이터 수신):');
            console.log('- 원본 정당 데이터:', mainPageState.originalPartyData.length, '개');
            console.log('- 원본 의원 데이터:', mainPageState.originalMemberData.length, '명');
            console.log('- 계산된 정당 데이터:', mainPageState.calculatedPartyData.length, '개');
            console.log('- 계산된 의원 데이터:', mainPageState.calculatedMemberData.length, '명');
            console.log('- 현재 정당 순위:', mainPageState.currentPartyRanking.length, '개');
            console.log('- 현재 의원 순위:', mainPageState.currentMemberRanking.length, '명');
            console.log('- API 연결:', window.APIService?._isReady ? '✅' : '❌');
            console.log('- percent 페이지 연결:', mainPageState.percentPageConnected ? '✅' : '❌');
            console.log('- 계산된 데이터 사용:', mainPageState.isUsingCalculatedData ? '✅' : '❌');
            console.log('- 마지막 데이터 수신:', mainPageState.lastDataReceived || '없음');
            console.log('- 적용된 가중치:', mainPageState.appliedWeights);
            console.log('- BroadcastChannel 상태:', this.getChannelStatus());
        }
    };

    // === 🚀 초기화 실행 ===
    
    try {
        // 실시간 데이터 수신 시스템 먼저 초기화
        initializeRealTimeDataReceive();
        
        // API 서비스 확인 후 데이터 로드
        if (checkAPIService()) {
            // API 데이터 로드 (팝업보다 늦게 실행)
            setTimeout(loadMainPageData, 1500);
        }

        // 네비게이션 설정
        setupNavigation();
        
        // 연결 상태 표시 업데이트
        updateConnectionStatus();

        // 팝업 표시 (기존 로직 유지)
        setTimeout(() => {
            try {
                if (shouldShowImagePopup()) {
                    // 이미지 팝업 로직...
                } else if (shouldShowPercentPopup()) {
                    // 퍼센트 팝업 로직...
                }
            } catch (error) {
                console.error('팝업 표시 중 오류:', error);
            }
        }, 1000);

        console.log('✅ API 계산 데이터 수신 메인페이지 스크립트 로드 완료 (v4.0.0)');
        console.log('🎯 디버깅: window.mainPageDebug.showInfo()');
        
    } catch (error) {
        console.error('❌ 메인페이지 초기화 실패:', error);
        showError('페이지 초기화에 실패했습니다.');
    }
});
