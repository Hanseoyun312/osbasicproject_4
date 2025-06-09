document.addEventListener('DOMContentLoaded', function() {
    // === 전역 변수 및 상태 관리 (강화된 버전) ===
    let isLoading = false;
    let loadingTimeout = null;
    let weightUpdateTimeout = null;
    
    // 정리해야 할 이벤트 리스너들
    const eventListeners = [];
    
    // 🎯 클라이언트 가중치 연동 관련 상태
    let mainPageState = {
        currentWeights: null,
        lastWeightUpdate: null,
        isRecalculating: false,
        percentPageConnected: false,
        realTimeUpdateChannel: null,
        
        // 원본 데이터 저장
        originalPartyData: [],
        originalMemberData: [],
        
        // 현재 표시 데이터
        currentPartyRanking: [],
        currentMemberRanking: []
    };
    
    // === 🧮 가중치 계산 설정 ===
    const WEIGHT_CALCULATOR = {
        // percent.js와 동일한 매핑
        FIELD_MAPPING: {
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

        // 정규화 기준값들
        memberNormalizationBounds: {
            committee_secretary_count: { min: 0, max: 10 },
            invalid_vote_ratio: { min: 0, max: 100 },
            bill_pass_sum: { min: 0, max: 500 },
            committee_leader_count: { min: 0, max: 5 },
            petition_sum: { min: 0, max: 200 },
            petition_pass_sum: { min: 0, max: 100 },
            attendance_rate: { min: 0, max: 100 },
            vote_match_ratio: { min: 0, max: 100 },
            vote_mismatch_ratio: { min: 0, max: 100 }
        },

        partyNormalizationBounds: {
            committee_secretary_count: { min: 0, max: 20 },
            invalid_vote_ratio: { min: 0, max: 10 }, // 정당은 퍼센트값
            bill_pass_sum: { min: 0, max: 1000 },
            committee_leader_count: { min: 0, max: 15 },
            petition_sum: { min: 0, max: 500 },
            petition_pass_sum: { min: 0, max: 300 },
            attendance_rate: { min: 0, max: 100 },
            vote_match_ratio: { min: 0, max: 100 },
            vote_mismatch_ratio: { min: 0, max: 100 }
        }
    };

    // === 🔗 실시간 연동 시스템 초기화 ===
    function initializeRealTimeSync() {
        console.log('[MainPage] 🔗 클라이언트 가중치 연동 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정
            if (typeof BroadcastChannel !== 'undefined') {
                mainPageState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v3');
                
                mainPageState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                    const data = event.data;
                    console.log('[MainPage] 📡 가중치 업데이트 수신:', data);
                    
                    if (data.type === 'client_weights_updated' && data.source === 'percent_page') {
                        await handleClientWeightUpdate(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        mainPageState.realTimeUpdateChannel.postMessage({
                            type: 'connection_response',
                            source: 'main_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected'
                        });
                        mainPageState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                });
                
                console.log('[MainPage] ✅ BroadcastChannel 초기화 완료');
            }
            
            // 2. localStorage 이벤트 감지
            window.addEventListener('storage', function(e) {
                if (e.key === 'client_weight_change_event' && !mainPageState.isRecalculating) {
                    try {
                        const eventData = JSON.parse(e.newValue);
                        console.log('[MainPage] 📢 localStorage 가중치 변경 감지:', eventData);
                        handleClientWeightUpdate(eventData);
                    } catch (error) {
                        console.warn('[MainPage] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            // 3. 저장된 가중치 확인 및 로드
            loadStoredWeights();
            
            console.log('[MainPage] ✅ 실시간 연동 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[MainPage] 실시간 연동 시스템 초기화 실패:', error);
        }
    }

    // === 💾 저장된 가중치 로드 ===
    function loadStoredWeights() {
        try {
            const storedWeights = localStorage.getItem('current_weights');
            if (storedWeights) {
                const weightData = JSON.parse(storedWeights);
                console.log('[MainPage] 📥 저장된 가중치 로드:', weightData);
                
                mainPageState.currentWeights = weightData.weights;
                mainPageState.lastWeightUpdate = new Date(weightData.timestamp);
                
                // 데이터가 이미 로드되었다면 즉시 재계산
                if (mainPageState.originalPartyData.length > 0 || mainPageState.originalMemberData.length > 0) {
                    recalculateAllScores();
                }
            } else {
                console.log('[MainPage] 📋 저장된 가중치 없음 - 기본 점수 사용');
            }
        } catch (error) {
            console.error('[MainPage] 저장된 가중치 로드 실패:', error);
        }
    }

    // === 🎯 핵심: 클라이언트 가중치 업데이트 처리 ===
    async function handleClientWeightUpdate(eventData) {
        if (mainPageState.isRecalculating) {
            console.log('[MainPage] 🔄 이미 재계산 중입니다.');
            return;
        }

        try {
            mainPageState.isRecalculating = true;
            
            console.log('[MainPage] 🎯 클라이언트 가중치 업데이트 시작...');
            
            // 사용자에게 알림
            showWeightUpdateNotification('가중치가 변경되었습니다. 메인페이지 순위를 재계산하는 중...', 'info', 3000);
            
            // 로딩 상태 표시
            showLoading(true);
            
            // 가중치 업데이트
            mainPageState.currentWeights = eventData.weights;
            mainPageState.lastWeightUpdate = new Date(eventData.timestamp);
            
            // 🧮 모든 점수 재계산
            await recalculateAllScores();
            
            // 성공 알림
            showWeightUpdateNotification('✅ 메인페이지 순위가 새로운 가중치로 업데이트되었습니다!', 'success', 4000);
            
            console.log('[MainPage] ✅ 클라이언트 가중치 업데이트 완료');
            
        } catch (error) {
            console.error('[MainPage] ❌ 클라이언트 가중치 업데이트 실패:', error);
            showWeightUpdateNotification(`메인페이지 순위 업데이트 실패: ${error.message}`, 'error', 5000);
        } finally {
            mainPageState.isRecalculating = false;
            showLoading(false);
        }
    }

    // === 🧮 핵심: 모든 점수 재계산 ===
    async function recalculateAllScores() {
        try {
            console.log('[MainPage] 🧮 메인페이지 모든 점수 재계산 시작...');
            
            if (!mainPageState.currentWeights) {
                console.log('[MainPage] ⚠️ 가중치가 없어서 기본 점수 사용');
                return;
            }
            
            // 정당 순위 재계산
            if (mainPageState.originalPartyData.length > 0) {
                await recalculatePartyScores();
            }
            
            // 의원 순위 재계산  
            if (mainPageState.originalMemberData.length > 0) {
                await recalculateMemberScores();
            }
            
            // UI 업데이트
            updatePartyRankingCard(mainPageState.currentPartyRanking);
            updateMemberRankingCard(mainPageState.currentMemberRanking);
            
            // 업데이트 정보 표시
            showScoreUpdateInfo();
            
            console.log('[MainPage] ✅ 메인페이지 모든 점수 재계산 완료');
            
        } catch (error) {
            console.error('[MainPage] ❌ 메인페이지 점수 재계산 실패:', error);
            throw error;
        }
    }

    // === 🧮 정당 점수 재계산 ===
    async function recalculatePartyScores() {
        try {
            if (mainPageState.originalPartyData.length === 0) return;
            
            // 정규화 기준값 계산
            const bounds = calculatePartyNormalizationBounds(mainPageState.originalPartyData);
            
            // 각 정당의 점수 재계산
            const recalculatedParties = mainPageState.originalPartyData.map(party => {
                const newScore = calculatePartyScore(party, mainPageState.currentWeights, bounds);
                
                return {
                    ...party,
                    score: newScore,
                    calculatedScore: newScore,
                    weightApplied: true
                };
            });
            
            // 점수 기준으로 정렬하여 상위 3개 선택
            recalculatedParties.sort((a, b) => b.score - a.score);
            
            mainPageState.currentPartyRanking = recalculatedParties.slice(0, 3).map((party, index) => ({
                rank: index + 1,
                name: party.name,
                score: party.score
            }));
            
            console.log('[MainPage] ✅ 정당 점수 재계산 완료');
            
        } catch (error) {
            console.error('[MainPage] ❌ 정당 점수 재계산 실패:', error);
        }
    }

    // === 🧮 의원 점수 재계산 ===
    async function recalculateMemberScores() {
        try {
            if (mainPageState.originalMemberData.length === 0) return;
            
            // 정규화 기준값 계산
            const bounds = calculateMemberNormalizationBounds(mainPageState.originalMemberData);
            
            // 각 의원의 점수 재계산
            const recalculatedMembers = mainPageState.originalMemberData.map(member => {
                const newScore = calculateMemberScore(member, mainPageState.currentWeights, bounds);
                
                return {
                    ...member,
                    score: newScore,
                    calculatedScore: newScore,
                    weightApplied: true
                };
            });
            
            // 점수 기준으로 정렬하여 상위 3개 선택
            recalculatedMembers.sort((a, b) => b.score - a.score);
            
            mainPageState.currentMemberRanking = recalculatedMembers.slice(0, 3).map((member, index) => ({
                rank: index + 1,
                name: member.name,
                party: member.party || '정보없음',
                score: member.score
            }));
            
            console.log('[MainPage] ✅ 의원 점수 재계산 완료');
            
        } catch (error) {
            console.error('[MainPage] ❌ 의원 점수 재계산 실패:', error);
        }
    }

    // === 🧮 유틸리티 함수들 ===
    
    // 정당 정규화 기준값 계산
    function calculatePartyNormalizationBounds(partyData) {
        const bounds = {};
        
        Object.values(WEIGHT_CALCULATOR.FIELD_MAPPING).forEach(field => {
            const values = partyData
                .map(party => getPartyFieldValue(party, field))
                .filter(val => !isNaN(val) && val !== null && val !== undefined);
            
            if (values.length > 0) {
                bounds[field] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            } else {
                bounds[field] = WEIGHT_CALCULATOR.partyNormalizationBounds[field] || { min: 0, max: 100 };
            }
            
            // 최대값과 최소값이 같으면 범위를 1로 설정
            if (bounds[field].max === bounds[field].min) {
                bounds[field].max = bounds[field].min + 1;
            }
        });
        
        return bounds;
    }
    
    // 의원 정규화 기준값 계산
    function calculateMemberNormalizationBounds(memberData) {
        const bounds = {};
        
        Object.values(WEIGHT_CALCULATOR.FIELD_MAPPING).forEach(field => {
            const values = memberData
                .map(member => getMemberFieldValue(member, field))
                .filter(val => !isNaN(val) && val !== null && val !== undefined);
            
            if (values.length > 0) {
                bounds[field] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            } else {
                bounds[field] = WEIGHT_CALCULATOR.memberNormalizationBounds[field] || { min: 0, max: 100 };
            }
            
            // 최대값과 최소값이 같으면 범위를 1로 설정
            if (bounds[field].max === bounds[field].min) {
                bounds[field].max = bounds[field].min + 1;
            }
        });
        
        return bounds;
    }

    // 정당 점수 계산
    function calculatePartyScore(party, weights, bounds) {
        let totalScore = 0;
        let totalWeight = 0;
        
        Object.entries(weights).forEach(([weightLabel, weightValue]) => {
            const fieldName = WEIGHT_CALCULATOR.FIELD_MAPPING[weightLabel];
            
            if (fieldName && bounds[fieldName]) {
                const rawValue = getPartyFieldValue(party, fieldName);
                const normalizedValue = normalizeValue(rawValue, bounds[fieldName]);
                const weightedValue = normalizedValue * weightValue;
                
                totalScore += weightedValue;
                totalWeight += weightValue;
            }
        });
        
        // 0-100 범위로 변환
        const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
        return Math.round(finalScore * 10) / 10;
    }

    // 의원 점수 계산
    function calculateMemberScore(member, weights, bounds) {
        let totalScore = 0;
        let totalWeight = 0;
        
        Object.entries(weights).forEach(([weightLabel, weightValue]) => {
            const fieldName = WEIGHT_CALCULATOR.FIELD_MAPPING[weightLabel];
            
            if (fieldName && bounds[fieldName]) {
                const rawValue = getMemberFieldValue(member, fieldName);
                const normalizedValue = normalizeValue(rawValue, bounds[fieldName]);
                const weightedValue = normalizedValue * weightValue;
                
                totalScore += weightedValue;
                totalWeight += weightValue;
            }
        });
        
        // 0-100 범위로 변환
        const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
        return Math.round(finalScore * 10) / 10;
    }

    // 정당 필드값 추출
    function getPartyFieldValue(party, fieldName) {
        switch (fieldName) {
            case 'attendance_rate':
                return parseFloat(party.attendanceRate || party.avg_attendance || 85);
            case 'bill_pass_sum':
                return parseInt(party.billPassSum || party.bill_pass_sum || 0);
            case 'petition_sum':
                return parseInt(party.petitionSum || party.petition_sum || 0);
            case 'petition_pass_sum':
                return parseInt(party.petitionPassSum || party.petition_pass_sum || 0);
            case 'committee_leader_count':
                return parseInt(party.chairmanCount || party.committee_leader_count || 0);
            case 'committee_secretary_count':
                return parseInt(party.secretaryCount || party.committee_secretary_count || 0);
            case 'invalid_vote_ratio':
                return parseFloat(party.invalidVoteRatio || party.avg_invalid_vote_ratio || 2);
            case 'vote_match_ratio':
                return parseFloat(party.voteMatchRatio || party.avg_vote_match_ratio || 85);
            case 'vote_mismatch_ratio':
                return parseFloat(party.voteMismatchRatio || party.avg_vote_mismatch_ratio || 15);
            default:
                return 0;
        }
    }

    // 의원 필드값 추출
    function getMemberFieldValue(member, fieldName) {
        switch (fieldName) {
            case 'attendance_rate':
                return parseFloat(member.attendanceRate || member.attendance_rate || 85);
            case 'bill_pass_sum':
                return parseInt(member.billPassSum || member.bill_pass_sum || 0);
            case 'petition_sum':
                return parseInt(member.petitionSum || member.petition_sum || 0);
            case 'petition_pass_sum':
                return parseInt(member.petitionPassSum || member.petition_pass_sum || 0);
            case 'committee_leader_count':
                return parseInt(member.chairmanCount || member.committee_leader_count || 0);
            case 'committee_secretary_count':
                return parseInt(member.secretaryCount || member.committee_secretary_count || 0);
            case 'invalid_vote_ratio':
                return parseFloat(member.invalidVoteRatio || member.invalid_vote_ratio || 2);
            case 'vote_match_ratio':
                return parseFloat(member.voteMatchRatio || member.vote_match_ratio || 85);
            case 'vote_mismatch_ratio':
                return parseFloat(member.voteMismatchRatio || member.vote_mismatch_ratio || 15);
            default:
                return 0;
        }
    }

    // 값 정규화 (0-1 범위로)
    function normalizeValue(value, bounds) {
        if (isNaN(value) || bounds.max === bounds.min) {
            return 0;
        }
        
        const normalized = (value - bounds.min) / (bounds.max - bounds.min);
        return Math.max(0, Math.min(1, normalized));
    }

    // === 📊 점수 업데이트 정보 표시 ===
    function showScoreUpdateInfo() {
        try {
            let infoElement = document.getElementById('main-score-update-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'main-score-update-info';
                infoElement.style.cssText = `
                    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
                    padding: 12px 20px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                    color: white; border-radius: 10px; font-size: 14px; text-align: center;
                    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3); z-index: 1000;
                    animation: slideInMain 0.6s ease-out; max-width: 500px;
                `;
                document.body.appendChild(infoElement);
            }
            
            const partyCount = mainPageState.currentPartyRanking.length;
            const memberCount = mainPageState.currentMemberRanking.length;
            const weightCount = mainPageState.currentWeights ? Object.keys(mainPageState.currentWeights).length : 0;
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">🏠</span>
                    <span>메인페이지 순위 업데이트! 정당 <strong>${partyCount}개</strong>, 의원 <strong>${memberCount}명</strong> (${weightCount}개 가중치 적용)</span>
                    <span style="font-size: 11px; opacity: 0.9;">${new Date().toLocaleTimeString('ko-KR')}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('main-score-update-styles')) {
                const style = document.createElement('style');
                style.id = 'main-score-update-styles';
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
            console.warn('[MainPage] 점수 업데이트 정보 표시 실패:', error);
        }
    }

    // === 🔔 가중치 업데이트 전용 알림 시스템 ===
    function showWeightUpdateNotification(message, type = 'info', duration = 4000) {
        try {
            // 기존 가중치 알림 제거
            const existingNotification = document.querySelector('.main-weight-update-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = 'main-weight-update-notification';
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
                    <span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
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
            console.log(`[MainPage 가중치 알림] ${message} (${type})`);
        }
    }

    // === 🎨 연결 상태 표시 업데이트 ===
    function updateConnectionStatus() {
        try {
            let statusElement = document.getElementById('main-weight-sync-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'main-weight-sync-status';
                statusElement.style.cssText = `
                    position: fixed; bottom: 20px; right: 20px; z-index: 1000;
                    padding: 8px 12px; background: rgba(139, 92, 246, 0.9); color: white;
                    border-radius: 20px; font-size: 11px; font-weight: 500;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1); backdrop-filter: blur(4px);
                    transition: all 0.3s ease; font-family: 'Blinker', sans-serif;
                `;
                document.body.appendChild(statusElement);
            }
            
            const hasWeights = mainPageState.currentWeights !== null;
            const hasData = mainPageState.originalPartyData.length > 0 || mainPageState.originalMemberData.length > 0;
            
            if (mainPageState.percentPageConnected && hasWeights && hasData) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 메인페이지 가중치 연동됨';
            } else if (hasWeights && hasData) {
                statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
                statusElement.innerHTML = '⚖️ 가중치 적용됨';
            } else if (mainPageState.percentPageConnected) {
                statusElement.style.background = 'rgba(139, 92, 246, 0.9)';
                statusElement.innerHTML = '⏳ 가중치 대기중';
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 기본 순위';
            }
            
        } catch (error) {
            console.warn('[MainPage] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === API 연결 상태 확인 ===
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

    // === API 데이터 가져오기 함수들 (수정된 버전) ===
    
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
                        
                        // 🎯 가중치 계산에 필요한 상세 데이터 저장
                        attendanceRate: parseFloat(party.avg_attendance || 85),
                        billPassSum: parseInt(party.bill_pass_sum || 50),
                        petitionSum: parseInt(party.petition_sum || 20),
                        petitionPassSum: parseInt(party.petition_pass_sum || 10),
                        chairmanCount: parseInt(party.committee_leader_count || 1),
                        secretaryCount: parseInt(party.committee_secretary_count || 2),
                        invalidVoteRatio: parseFloat(party.avg_invalid_vote_ratio ? party.avg_invalid_vote_ratio * 100 : 2),
                        voteMatchRatio: parseFloat(party.avg_vote_match_ratio ? party.avg_vote_match_ratio * 100 : 85),
                        voteMismatchRatio: parseFloat(party.avg_vote_mismatch_ratio ? party.avg_vote_mismatch_ratio * 100 : 15),
                        
                        originalData: party
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
                score: party.score
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
                    
                    // 🎯 가중치 계산에 필요한 상세 데이터 저장
                    attendanceRate: parseFloat(member.attendance_rate || 85),
                    billPassSum: parseInt(member.bill_pass_sum || 0),
                    petitionSum: parseInt(member.petition_sum || 0),
                    petitionPassSum: parseInt(member.petition_pass_sum || 0),
                    chairmanCount: parseInt(member.committee_leader_count || 0),
                    secretaryCount: parseInt(member.committee_secretary_count || 0),
                    invalidVoteRatio: parseFloat(member.invalid_vote_ratio || 2),
                    voteMatchRatio: parseFloat(member.vote_match_ratio || 85),
                    voteMismatchRatio: parseFloat(member.vote_mismatch_ratio || 15),
                    
                    originalData: member
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
                        score: member.score
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
            { rank: 1, name: '더불어민주당', score: 87.1 },
            { rank: 2, name: '진보당', score: 85.9 },
            { rank: 3, name: '조국혁신당', score: 81.9 }
        ];
        
        // 🎯 원본 데이터도 저장
        mainPageState.originalPartyData = defaultData.map(party => ({
            ...party,
            attendanceRate: 85 + Math.random() * 10,
            billPassSum: Math.floor(Math.random() * 100 + 50),
            petitionSum: Math.floor(Math.random() * 50 + 20),
            petitionPassSum: Math.floor(Math.random() * 30 + 10),
            chairmanCount: Math.floor(Math.random() * 5 + 1),
            secretaryCount: Math.floor(Math.random() * 8 + 2),
            invalidVoteRatio: 1 + Math.random() * 3,
            voteMatchRatio: 80 + Math.random() * 15,
            voteMismatchRatio: 5 + Math.random() * 15
        }));
        
        return defaultData;
    }

    function getDefaultMemberRanking() {
        const defaultData = [
            { rank: 1, name: '어기구', party: '더불어민주당', score: 94 },
            { rank: 2, name: '이건태', party: '더불어민주당', score: 91 },
            { rank: 3, name: '박성준', party: '더불어민주당', score: 88 }
        ];
        
        // 🎯 원본 데이터도 저장
        mainPageState.originalMemberData = defaultData.map(member => ({
            ...member,
            attendanceRate: 85 + Math.random() * 10,
            billPassSum: Math.floor(Math.random() * 100),
            petitionSum: Math.floor(Math.random() * 50),
            petitionPassSum: Math.floor(Math.random() * 30),
            chairmanCount: Math.floor(Math.random() * 3),
            secretaryCount: Math.floor(Math.random() * 5),
            invalidVoteRatio: 1 + Math.random() * 3,
            voteMatchRatio: 80 + Math.random() * 15,
            voteMismatchRatio: 5 + Math.random() * 15
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
                
                // 🎯 가중치 적용 표시 추가
                const weightIndicator = mainPageState.currentWeights ? 
                    '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="가중치 적용됨">⚖️</span>' : '';
                
                rankingItem.innerHTML = `
                    <div class="rank-number">${rank}</div>
                    <div class="info">
                        <div class="name">${name}${weightIndicator}</div>
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
                
                // 🎯 가중치 적용 표시 추가
                const weightIndicator = mainPageState.currentWeights ? 
                    '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="가중치 적용됨">⚖️</span>' : '';
                
                rankingItem.innerHTML = `
                    <div class="rank-number">${rank}</div>
                    <div class="info">
                        <div class="name">${name}${weightIndicator}</div>
                        <div class="party-name">${party}</div>
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
            
            // 🎯 가중치가 있으면 즉시 재계산
            if (mainPageState.currentWeights) {
                await recalculateAllScores();
            } else {
                mainPageState.currentPartyRanking = defaultPartyData;
                mainPageState.currentMemberRanking = defaultMemberData;
                updatePartyRankingCard(defaultPartyData);
                updateMemberRankingCard(defaultMemberData);
            }
            return;
        }

        if (isLoading) {
            console.log('🔄 이미 로딩 중입니다');
            return;
        }

        console.log('🚀 메인페이지 데이터 로드 시작...');
        
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
            
            // 🎯 가중치가 있으면 즉시 재계산
            if (mainPageState.currentWeights) {
                await recalculateAllScores();
            } else {
                // 가중치가 없으면 원본 데이터로 표시
                updatePartyRankingCard(mainPageState.currentPartyRanking);
                updateMemberRankingCard(mainPageState.currentMemberRanking);
            }
            
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

    // WeightSync 호환 함수들
    window.refreshMemberDetails = function() {
        console.log('[MainPage] 🔄 의원 데이터 새로고침 (WeightSync 호환)');
        return loadMainPageData();
    };

    window.refreshPartyRanking = function() {
        console.log('[MainPage] 🔄 정당 데이터 새로고침 (WeightSync 호환)');
        return loadMainPageData();
    };

    // === 🛠️ 디버깅 함수들 ===
    window.mainPageDebug = {
        getState: () => mainPageState,
        refreshData: () => loadMainPageData(),
        recalculateScores: () => recalculateAllScores(),
        getCurrentWeights: () => mainPageState.currentWeights,
        
        showInfo: () => {
            console.log('[MainPage] 📊 메인페이지 정보 (v3.0.0):');
            console.log('- 원본 정당 데이터:', mainPageState.originalPartyData.length, '개');
            console.log('- 원본 의원 데이터:', mainPageState.originalMemberData.length, '명');
            console.log('- 현재 정당 순위:', mainPageState.currentPartyRanking.length, '개');
            console.log('- 현재 의원 순위:', mainPageState.currentMemberRanking.length, '명');
            console.log('- API 연결:', window.APIService?._isReady ? '✅' : '❌');
            console.log('- 가중치 연결:', mainPageState.percentPageConnected ? '✅' : '❌');
            console.log('- 현재 가중치:', mainPageState.currentWeights);
            console.log('- 마지막 가중치 업데이트:', mainPageState.lastWeightUpdate || '없음');
        },
        
        testWeightCalculation: () => {
            if (mainPageState.currentWeights && mainPageState.originalPartyData.length > 0) {
                const party = mainPageState.originalPartyData[0];
                const bounds = calculatePartyNormalizationBounds(mainPageState.originalPartyData);
                const score = calculatePartyScore(party, mainPageState.currentWeights, bounds);
                console.log(`[MainPage] ${party.name} 정당 점수 계산:`, score);
            }
            
            if (mainPageState.currentWeights && mainPageState.originalMemberData.length > 0) {
                const member = mainPageState.originalMemberData[0];
                const bounds = calculateMemberNormalizationBounds(mainPageState.originalMemberData);
                const score = calculateMemberScore(member, mainPageState.currentWeights, bounds);
                console.log(`[MainPage] ${member.name} 의원 점수 계산:`, score);
            }
        }
    };

    // === 🚀 초기화 실행 ===
    
    try {
        // 실시간 연동 시스템 먼저 초기화
        initializeRealTimeSync();
        
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

        console.log('✅ 클라이언트 가중치 연동 메인페이지 스크립트 로드 완료 (v3.0.0)');
        console.log('🎯 디버깅: window.mainPageDebug.showInfo()');
        
    } catch (error) {
        console.error('❌ 메인페이지 초기화 실패:', error);
        showError('페이지 초기화에 실패했습니다.');
    }
});
