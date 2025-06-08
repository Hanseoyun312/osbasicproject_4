/**
 * rank_party.js (v3.1.0) - 클라이언트 사이드 가중치 연동 정당 랭킹 시스템
 * 개선사항: percent 페이지의 가중치를 받아서 클라이언트에서 정당 순위 재계산 + 통일된 채널명
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 클라이언트 가중치 연동 정당 랭킹 페이지 로드 시작 (v3.1.0)');

    // === 🔧 상태 관리 변수들 ===
    let partyData = [];
    let originalPartyData = [];  // 원본 데이터 보관
    let partyPerformanceData = {};
    let partyRankingData = {};
    let partyStatsData = {};
    let currentPage = 1;
    let itemsPerPage = 10;
    let currentSort = 'rank';
    let isLoading = false;

    // 🎯 클라이언트 가중치 연동 관련 상태
    let weightSyncState = {
        currentWeights: null,
        lastWeightUpdate: null,
        isRecalculating: false,
        percentPageConnected: false,
        realTimeUpdateChannel: null
    };

    // === 🧮 가중치 계산 설정 ===
    const WEIGHT_CALCULATOR = {
        // percent.js와 동일한 매핑
        FIELD_MAPPING: {
            '간사': 'committee_secretary_count',
            '무효표 및 기권': 'avg_invalid_vote_ratio',
            '본회의 가결': 'bill_pass_sum',
            '위원장': 'committee_leader_count',
            '청원 소개': 'petition_sum',
            '청원 결과': 'petition_pass_sum',
            '출석': 'avg_attendance',
            '투표 결과 일치': 'avg_vote_match_ratio',
            '투표 결과 불일치': 'avg_vote_mismatch_ratio'
        },

        // 정당 데이터 정규화를 위한 기준값들
        normalizationBounds: {
            committee_secretary_count: { min: 0, max: 20 },
            avg_invalid_vote_ratio: { min: 0, max: 0.1 },  // 비율값 (0-1)
            bill_pass_sum: { min: 0, max: 1000 },
            committee_leader_count: { min: 0, max: 15 },
            petition_sum: { min: 0, max: 500 },
            petition_pass_sum: { min: 0, max: 300 },
            avg_attendance: { min: 0, max: 100 },
            avg_vote_match_ratio: { min: 0, max: 1 },     // 비율값 (0-1)
            avg_vote_mismatch_ratio: { min: 0, max: 1 }   // 비율값 (0-1)
        }
    };

    // === 🎨 정당별 브랜드 색상 ===
    const partyColors = {
        "더불어민주당": {
            main: "#152484",
            secondary: "#15248480",
            bg: "#152484"
        },
        "국민의힘": {
            main: "#E61E2B", 
            secondary: "#E61E2B80",
            bg: "#E61E2B"
        },
        "조국혁신당": {
            main: "#06275E",
            secondary: "#0073CF",
            bg: "#06275E"
        },
        "개혁신당": {
            main: "#FF7210",
            secondary: "#FF721080",
            bg: "#FF7210"
        },
        "진보당": {
            main: "#D6001C",
            secondary: "#D6001C80",
            bg: "#D6001C"
        },
        "기본소득당": {
            main: "#091E3A",
            secondary: "#00D2C3",
            bg: "#091E3A"
        },
        "사회민주당": {
            main: "#43A213",
            secondary: "#F58400",
            bg: "#43A213"
        },
        "무소속": {
            main: "#4B5563",
            secondary: "#9CA3AF",
            bg: "#4B5563"
        }
    };

    // === 📡 안전한 BroadcastChannel 관리 ===
    function createBroadcastChannel() {
        if (typeof BroadcastChannel === 'undefined') {
            console.warn('[RankParty] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
            return false;
        }

        try {
            // 기존 채널이 있으면 정리
            if (weightSyncState.realTimeUpdateChannel) {
                try {
                    weightSyncState.realTimeUpdateChannel.close();
                } catch (e) {
                    // 이미 닫혔을 수 있음
                }
            }

            // 🔧 통일된 채널명 사용 (v4)
            weightSyncState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
            
            weightSyncState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                try {
                    const data = event.data;
                    console.log('[RankParty] 📡 가중치 업데이트 수신:', data);
                    
                    if (data.type === 'client_weights_updated' && data.source === 'percent_page') {
                        await handleClientWeightUpdate(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        safeBroadcast({
                            type: 'connection_response',
                            source: 'rank_party_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected'
                        });
                        weightSyncState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                } catch (error) {
                    console.warn('[RankParty] 메시지 처리 실패:', error);
                }
            });

            // 채널 오류 처리
            weightSyncState.realTimeUpdateChannel.addEventListener('error', function(error) {
                console.warn('[RankParty] BroadcastChannel 오류:', error);
                // 채널 재생성 시도
                setTimeout(createBroadcastChannel, 1000);
            });
            
            console.log('[RankParty] ✅ BroadcastChannel 초기화 완료 (v4)');
            return true;
            
        } catch (error) {
            console.error('[RankParty] BroadcastChannel 초기화 실패:', error);
            weightSyncState.realTimeUpdateChannel = null;
            return false;
        }
    }

    // === 📡 안전한 브로드캐스트 함수 ===
    function safeBroadcast(data) {
        try {
            if (!weightSyncState.realTimeUpdateChannel) {
                // 채널이 없으면 재생성 시도
                if (!createBroadcastChannel()) {
                    return false;
                }
            }

            weightSyncState.realTimeUpdateChannel.postMessage(data);
            return true;
            
        } catch (error) {
            console.warn('[RankParty] 브로드캐스트 실패, 채널 재생성 시도:', error);
            
            // 채널 재생성 시도
            if (createBroadcastChannel()) {
                try {
                    weightSyncState.realTimeUpdateChannel.postMessage(data);
                    return true;
                } catch (retryError) {
                    console.warn('[RankParty] 재시도 후에도 브로드캐스트 실패:', retryError);
                }
            }
            
            return false;
        }
    }

    // === 🔗 실시간 연동 시스템 초기화 ===
    function initializeRealTimeSync() {
        console.log('[RankParty] 🔗 클라이언트 가중치 연동 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정
            createBroadcastChannel();
            
            // 2. localStorage 이벤트 감지
            window.addEventListener('storage', function(e) {
                if (e.key === 'client_weight_change_event' && !weightSyncState.isRecalculating) {
                    try {
                        const eventData = JSON.parse(e.newValue);
                        console.log('[RankParty] 📢 localStorage 가중치 변경 감지:', eventData);
                        handleClientWeightUpdate(eventData);
                    } catch (error) {
                        console.warn('[RankParty] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            // 3. 저장된 가중치 확인 및 로드
            loadStoredWeights();
            
            console.log('[RankParty] ✅ 실시간 연동 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[RankParty] 실시간 연동 시스템 초기화 실패:', error);
        }
    }

    // === 💾 저장된 가중치 로드 ===
    function loadStoredWeights() {
        try {
            const storedWeights = localStorage.getItem('current_weights');
            if (storedWeights) {
                const weightData = JSON.parse(storedWeights);
                console.log('[RankParty] 📥 저장된 가중치 로드:', weightData);
                
                weightSyncState.currentWeights = weightData.weights;
                weightSyncState.lastWeightUpdate = new Date(weightData.timestamp);
                
                // 데이터가 이미 로드되었다면 즉시 재계산
                if (originalPartyData.length > 0) {
                    recalculatePartyScores();
                }
            } else {
                console.log('[RankParty] 📋 저장된 가중치 없음 - 기본 점수 사용');
            }
        } catch (error) {
            console.error('[RankParty] 저장된 가중치 로드 실패:', error);
        }
    }

    // === 🎯 핵심: 클라이언트 가중치 업데이트 처리 ===
    async function handleClientWeightUpdate(eventData) {
        if (weightSyncState.isRecalculating) {
            console.log('[RankParty] 🔄 이미 재계산 중입니다.');
            return;
        }

        try {
            weightSyncState.isRecalculating = true;
            
            console.log('[RankParty] 🎯 클라이언트 가중치 업데이트 시작...');
            
            // 사용자에게 알림
            showWeightUpdateNotification('가중치가 변경되었습니다. 정당 순위를 재계산하는 중...', 'info', 3000);
            
            // 로딩 상태 표시
            showLoading(true, '새로운 가중치로 정당 순위 재계산 중...');
            
            // 가중치 업데이트
            weightSyncState.currentWeights = eventData.weights;
            weightSyncState.lastWeightUpdate = new Date(eventData.timestamp);
            
            // 🧮 정당 점수 재계산
            await recalculatePartyScores();
            
            // 성공 알림
            showWeightUpdateNotification('✅ 정당 순위가 새로운 가중치로 업데이트되었습니다!', 'success', 4000);
            
            console.log('[RankParty] ✅ 클라이언트 가중치 업데이트 완료');
            
        } catch (error) {
            console.error('[RankParty] ❌ 클라이언트 가중치 업데이트 실패:', error);
            showWeightUpdateNotification(`정당 순위 업데이트 실패: ${error.message}`, 'error', 5000);
        } finally {
            weightSyncState.isRecalculating = false;
            showLoading(false);
        }
    }

    // === 🧮 핵심: 정당 점수 재계산 ===
    async function recalculatePartyScores() {
        try {
            console.log('[RankParty] 🧮 정당 점수 재계산 시작...');
            
            if (!weightSyncState.currentWeights) {
                console.log('[RankParty] ⚠️ 가중치가 없어서 기본 점수 사용');
                return;
            }
            
            if (originalPartyData.length === 0) {
                console.log('[RankParty] ⚠️ 원본 데이터가 없어서 재계산 불가');
                return;
            }
            
            // 1. 정규화 기준값 계산
            const bounds = calculateNormalizationBounds(originalPartyData);
            
            // 2. 각 정당의 점수 재계산
            const recalculatedParties = originalPartyData.map((party, index) => {
                const newScore = calculatePartyScore(party, weightSyncState.currentWeights, bounds);
                
                return {
                    ...party,
                    totalScore: newScore,
                    calculatedScore: newScore,
                    rank: 0, // 임시값, 나중에 재정렬 후 계산
                    rankSource: 'client_calculated',
                    scoreUpdated: true,
                    scoreChanged: true,
                    lastUpdated: new Date().toISOString(),
                    weightApplied: true
                };
            });
            
            // 3. 점수 기준으로 정렬하여 순위 부여
            recalculatedParties.sort((a, b) => b.totalScore - a.totalScore);
            recalculatedParties.forEach((party, index) => {
                party.rank = index + 1;
            });
            
            // 4. partyData 업데이트
            partyData = recalculatedParties;
            
            // 5. UI 업데이트
            renderPartyRankingTable();
            renderPagination();
            renderStatistics();
            
            // 6. 업데이트 정보 표시
            showScoreUpdateInfo(recalculatedParties.length);
            
            console.log('[RankParty] ✅ 정당 점수 재계산 완료');
            
        } catch (error) {
            console.error('[RankParty] ❌ 정당 점수 재계산 실패:', error);
            throw error;
        }
    }

    // === 🧮 정규화 기준값 계산 ===
    function calculateNormalizationBounds(partyData) {
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
                bounds[field] = WEIGHT_CALCULATOR.normalizationBounds[field] || { min: 0, max: 100 };
            }
            
            // 최대값과 최소값이 같으면 범위를 1로 설정 (0으로 나누기 방지)
            if (bounds[field].max === bounds[field].min) {
                bounds[field].max = bounds[field].min + 1;
            }
        });
        
        console.log('[RankParty] 📊 정당 정규화 기준값:', bounds);
        return bounds;
    }

    // === 🧮 개별 정당 점수 계산 ===
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
                
                // 디버그 로그 (처음 정당만)
                if (party.name === originalPartyData[0]?.name) {
                    console.log(`[RankParty] 📊 ${party.name} - ${weightLabel}: raw=${rawValue}, norm=${normalizedValue.toFixed(3)}, weight=${weightValue}, weighted=${weightedValue.toFixed(3)}`);
                }
            }
        });
        
        // 0-100 범위로 변환
        const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
        
        return Math.round(finalScore * 10) / 10; // 소수점 첫째자리까지
    }

    // === 🔧 유틸리티: 정당 필드값 추출 ===
    function getPartyFieldValue(party, fieldName) {
        // 다양한 필드명 매핑 시도
        const possibleFields = [
            fieldName,
            // 성과 데이터에서
            party._performance?.[fieldName],
            // 랭킹 데이터에서
            party._ranking?.[fieldName],
            // 직접 필드에서
            party[fieldName]
        ];
        
        for (const field of possibleFields) {
            if (field !== undefined && field !== null && !isNaN(parseFloat(field))) {
                return parseFloat(field);
            }
        }
        
        // 특별한 경우 처리
        switch (fieldName) {
            case 'avg_attendance':
                return parseFloat(party.attendanceRate || party.평균출석률 || 85);
            case 'bill_pass_sum':
                return parseInt(party.billPassSum || party.본회의가결 || 0);
            case 'petition_sum':
                return parseInt(party.petitionSum || party.청원수 || 0);
            case 'petition_pass_sum':
                return parseInt(party.petitionPassSum || party.청원가결 || 0);
            case 'committee_leader_count':
                return parseInt(party.chairmanCount || party.위원장수 || 0);
            case 'committee_secretary_count':
                return parseInt(party.secretaryCount || party.간사수 || 0);
            case 'avg_invalid_vote_ratio':
                return parseFloat(party.invalidVoteRatio ? party.invalidVoteRatio / 100 : 0.02); // 퍼센트를 비율로
            case 'avg_vote_match_ratio':
                return parseFloat(party.voteMatchRatio ? party.voteMatchRatio / 100 : 0.85);
            case 'avg_vote_mismatch_ratio':
                return parseFloat(party.voteMismatchRatio ? party.voteMismatchRatio / 100 : 0.15);
            default:
                return 0;
        }
    }

    // === 🧮 값 정규화 (0-1 범위로) ===
    function normalizeValue(value, bounds) {
        if (isNaN(value) || bounds.max === bounds.min) {
            return 0;
        }
        
        const normalized = (value - bounds.min) / (bounds.max - bounds.min);
        return Math.max(0, Math.min(1, normalized)); // 0-1 범위로 제한
    }

    // === 📊 점수 업데이트 정보 표시 ===
    function showScoreUpdateInfo(updatedCount) {
        try {
            let infoElement = document.getElementById('party-score-update-info');
            if (!infoElement) {
                infoElement = document.createElement('div');
                infoElement.id = 'party-score-update-info';
                infoElement.style.cssText = `
                    margin: 15px 0; padding: 12px 20px; 
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white; border-radius: 10px; font-size: 14px; text-align: center;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); 
                    animation: slideInParty 0.6s ease-out;
                `;
                
                const tableContainer = document.querySelector('.main') || document.body;
                const table = document.querySelector('.party-table');
                if (table && table.parentNode) {
                    table.parentNode.insertBefore(infoElement, table);
                } else {
                    tableContainer.appendChild(infoElement);
                }
            }
            
            const weightInfo = weightSyncState.currentWeights ? 
                `(${Object.keys(weightSyncState.currentWeights).length}개 가중치 적용)` : '';
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">🏛️</span>
                    <span><strong>${updatedCount}개</strong> 정당의 점수가 클라이언트에서 재계산되었습니다! ${weightInfo}</span>
                    <span style="font-size: 11px; opacity: 0.9;">${new Date().toLocaleTimeString('ko-KR')}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('party-score-update-styles')) {
                const style = document.createElement('style');
                style.id = 'party-score-update-styles';
                style.textContent = `
                    @keyframes slideInParty {
                        from { opacity: 0; transform: translateY(-15px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 10초 후 자동 숨김
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.style.opacity = '0';
                    infoElement.style.transform = 'translateY(-15px) scale(0.95)';
                    setTimeout(() => infoElement.remove(), 400);
                }
            }, 10000);
            
        } catch (error) {
            console.warn('[RankParty] 점수 업데이트 정보 표시 실패:', error);
        }
    }

    // === 🔔 가중치 업데이트 전용 알림 시스템 ===
    function showWeightUpdateNotification(message, type = 'info', duration = 4000) {
        try {
            // 기존 가중치 알림 제거
            const existingNotification = document.querySelector('.party-weight-update-notification');
            if (existingNotification) {
                existingNotification.remove();
            }
            
            const notification = document.createElement('div');
            notification.className = 'party-weight-update-notification';
            notification.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                padding: 16px 30px; border-radius: 12px; z-index: 10001; font-size: 14px;
                max-width: 550px; box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                font-family: 'Blinker', sans-serif; font-weight: 500; text-align: center;
                opacity: 0; transform: translateX(-50%) translateY(-25px);
                transition: all 0.5s ease; line-height: 1.5;
                background: ${type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 
                           type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 
                           type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 
                           'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'};
                color: white; backdrop-filter: blur(8px);
            `;
            
            notification.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                    <span style="font-size: 18px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                    <span>${message}</span>
                    <span style="font-size: 16px;">🏛️</span>
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
                    notification.style.transform = 'translateX(-50%) translateY(-25px)';
                    setTimeout(() => notification.remove(), 500);
                }
            }, duration);
            
        } catch (error) {
            console.log(`[RankParty 가중치 알림] ${message} (${type})`);
        }
    }

    // === 🎨 연결 상태 표시 업데이트 ===
    function updateConnectionStatus() {
        try {
            let statusElement = document.getElementById('party-weight-sync-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'party-weight-sync-status';
                statusElement.style.cssText = `
                    position: fixed; top: 10px; left: 10px; z-index: 1000;
                    padding: 8px 14px; background: rgba(59, 130, 246, 0.9); color: white;
                    border-radius: 25px; font-size: 11px; font-weight: 600;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.12); backdrop-filter: blur(6px);
                    transition: all 0.3s ease; font-family: 'Blinker', sans-serif;
                `;
                document.body.appendChild(statusElement);
            }
            
            const hasWeights = weightSyncState.currentWeights !== null;
            
            if (weightSyncState.percentPageConnected && hasWeights) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 정당 가중치 연동됨';
            } else if (hasWeights) {
                statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
                statusElement.innerHTML = '⚖️ 가중치 적용됨';
            } else if (weightSyncState.percentPageConnected) {
                statusElement.style.background = 'rgba(59, 130, 246, 0.9)';
                statusElement.innerHTML = '⏳ 가중치 대기중';
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 기본 순위';
            }
            
        } catch (error) {
            console.warn('[RankParty] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 🔧 유틸리티 함수들 ===

    // APIService 준비 확인
    function waitForAPIService() {
        return new Promise((resolve) => {
            function checkAPIService() {
                if (window.APIService && window.APIService._isReady && !window.APIService._hasError) {
                    console.log('✅ APIService 준비 완료');
                    resolve(true);
                } else {
                    console.log('⏳ APIService 준비 중...');
                    setTimeout(checkAPIService, 100);
                }
            }
            checkAPIService();
        });
    }

    // 알림 표시 함수
    function showNotification(message, type = 'info') {
        if (window.APIService && window.APIService.showNotification) {
            window.APIService.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    // 에러 메시지 표시
    function showError(message) {
        showNotification(message, 'error');
        console.error('[RankParty] ❌', message);
    }

    // 로딩 상태 표시
    function showLoading(show = true, message = '정당 데이터를 불러오는 중...') {
        isLoading = show;
        const loadingElement = document.getElementById('loading');
        const contentElement = document.getElementById('party-ranking-content') || 
                              document.querySelector('.main-content') || 
                              document.querySelector('.content');
        
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
        }
        if (contentElement) {
            contentElement.style.opacity = show ? '0.6' : '1';
            contentElement.style.pointerEvents = show ? 'none' : 'auto';
        }
        
        // 테이블 로딩 메시지 업데이트
        const tableBody = document.getElementById('partyTableBody');
        if (tableBody && show) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                        <div class="loading-spinner"></div>
                        ${message}
                    </td>
                </tr>
            `;
        }
    }

    // 정당명 정규화
    function normalizePartyName(partyName) {
        if (!partyName) return '정보없음';
        
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

        return nameMapping[partyName] || partyName;
    }

    // === 📊 기존 API 데이터 로드 함수들 (수정됨) ===

    // 정당 성과 데이터 로드
    async function fetchPartyPerformanceData() {
        try {
            const rawData = await window.APIService.getPartyPerformance();
            
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && typeof rawData === 'object') {
                if (rawData.data && Array.isArray(rawData.data)) {
                    processedData = rawData.data;
                } else if (rawData.results && Array.isArray(rawData.results)) {
                    processedData = rawData.results;
                } else if (rawData.parties && Array.isArray(rawData.parties)) {
                    processedData = rawData.parties;
                } else {
                    const values = Object.values(rawData);
                    if (values.length > 0 && Array.isArray(values[0])) {
                        processedData = values[0];
                    } else if (values.every(v => v && typeof v === 'object')) {
                        processedData = values;
                    }
                }
            }
            
            if (!processedData || !Array.isArray(processedData)) {
                console.warn('[RankParty] ⚠️ 정당 성과 데이터 형태가 예상과 다름, 기본값 사용');
                return {};
            }
            
            const performanceData = {};
            processedData.forEach(party => {
                const partyName = normalizePartyName(
                    party.party || party.POLY_NM || party.정당명 || party.party_name || 
                    party.name || party.lawmaker_party || party.Party || party.당명
                );
                
                if (partyName && partyName !== '정보없음') {
                    performanceData[partyName] = {
                        party: partyName,
                        avg_attendance: parseFloat(party.avg_attendance || party.평균출석률 || 85),
                        avg_invalid_vote_ratio: parseFloat(party.avg_invalid_vote_ratio || 0.02),
                        avg_vote_match_ratio: parseFloat(party.avg_vote_match_ratio || 0.85),
                        avg_vote_mismatch_ratio: parseFloat(party.avg_vote_mismatch_ratio || 0.15),
                        bill_pass_sum: parseInt(party.bill_pass_sum || party.가결수 || 50),
                        petition_sum: parseInt(party.petition_sum || party.청원수 || 20),
                        petition_pass_sum: parseInt(party.petition_pass_sum || party.청원가결 || 10),
                        committee_leader_count: parseInt(party.committee_leader_count || 1),
                        committee_secretary_count: parseInt(party.committee_secretary_count || 2),
                        avg_total_score: parseFloat(party.avg_total_score || party.총점 || 75),
                        _raw: party
                    };
                }
            });
            
            partyPerformanceData = performanceData;
            console.log(`[RankParty] ✅ 정당 성과 데이터 로드 완료: ${Object.keys(performanceData).length}개`);
            return performanceData;
            
        } catch (error) {
            console.error('[RankParty] ❌ 정당 성과 데이터 로드 실패:', error);
            partyPerformanceData = {};
            return {};
        }
    }

    // 정당 랭킹 데이터 로드
    async function fetchPartyRankingData() {
        try {
            console.log('[RankParty] 🏆 정당 랭킹 데이터 조회...');
            
            const rawData = await window.APIService.getPartyScoreRanking();
            
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && typeof rawData === 'object') {
                if (rawData.data && Array.isArray(rawData.data)) {
                    processedData = rawData.data;
                } else if (rawData.results && Array.isArray(rawData.results)) {
                    processedData = rawData.results;
                } else {
                    const values = Object.values(rawData);
                    if (values.length > 0 && Array.isArray(values[0])) {
                        processedData = values[0];
                    }
                }
            }
            
            if (!processedData || !Array.isArray(processedData)) {
                console.warn('[RankParty] ⚠️ 정당 랭킹 데이터 형태가 예상과 다름');
                return {};
            }
            
            const rankingData = {};
            processedData.forEach((ranking, index) => {
                const partyName = normalizePartyName(
                    ranking.POLY_NM || ranking.정당명 || ranking.party || 
                    ranking.party_name || ranking.name
                );
                
                if (partyName && partyName !== '정보없음') {
                    rankingData[partyName] = {
                        party: partyName,
                        rank: parseInt(
                            ranking.평균실적_순위 || ranking.rank || ranking.순위 || 
                            ranking.ranking || (index + 1)
                        ),
                        _raw: ranking
                    };
                }
            });
            
            partyRankingData = rankingData;
            console.log(`[RankParty] ✅ 정당 랭킹 데이터 로드 완료: ${Object.keys(rankingData).length}개`);
            return rankingData;
            
        } catch (error) {
            console.error('[RankParty] ❌ 정당 랭킹 데이터 로드 실패:', error);
            partyRankingData = {};
            return {};
        }
    }

    // 정당 통계 데이터 로드
    async function fetchPartyStatsData() {
        try {
            console.log('[RankParty] 📈 정당 통계 데이터 조회...');
            
            const rawData = await window.APIService.getPartyStatsRanking();
            
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && typeof rawData === 'object') {
                if (rawData.data && Array.isArray(rawData.data)) {
                    processedData = rawData.data;
                } else if (rawData.results && Array.isArray(rawData.results)) {
                    processedData = rawData.results;
                }
            }
            
            if (!processedData || !Array.isArray(processedData)) {
                console.warn('[RankParty] ⚠️ 정당 통계 데이터가 없거나 형식이 다름');
                return {};
            }
            
            const statsData = {};
            processedData.forEach(stats => {
                const partyName = normalizePartyName(
                    stats.party || stats.POLY_NM || stats.정당명 || stats.party_name
                );
                if (partyName && partyName !== '정보없음') {
                    statsData[partyName] = {
                        party: partyName,
                        _raw: stats
                    };
                }
            });
            
            partyStatsData = statsData;
            console.log(`[RankParty] ✅ 정당 통계 데이터 로드 완료: ${Object.keys(statsData).length}개`);
            return statsData;
            
        } catch (error) {
            console.warn('[RankParty] ⚠️ 정당 통계 데이터 로드 실패 (선택적):', error);
            partyStatsData = {};
            return {};
        }
    }

    // === 🎯 원본 데이터 병합 및 저장 ===
    function mergeAndStoreOriginalData() {
        try {
            console.log('[RankParty] 📊 원본 정당 데이터 병합 중...');
            
            // 정당 목록 생성
            const allPartyNames = new Set();
            
            ['더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '기본소득당', '사회민주당', '무소속'].forEach(name => {
                allPartyNames.add(name);
            });
            
            Object.keys(partyPerformanceData).forEach(name => allPartyNames.add(name));
            Object.keys(partyRankingData).forEach(name => allPartyNames.add(name));

            // 🎯 원본 데이터 생성
            originalPartyData = Array.from(allPartyNames).map((partyName, index) => {
                const performance = partyPerformanceData[partyName];
                const ranking = partyRankingData[partyName];
                const stats = partyStatsData[partyName];
                
                return {
                    // 기본 정보
                    name: partyName,
                    party: partyName,
                    rank: ranking ? ranking.rank : (index + 1),
                    rankSource: ranking ? 'api' : 'estimated',
                    totalScore: performance ? performance.avg_total_score : (80 - index * 5),
                    
                    // 🎯 가중치 계산에 필요한 상세 데이터
                    attendanceRate: performance ? performance.avg_attendance : (85 + Math.random() * 10),
                    billPassSum: performance ? performance.bill_pass_sum : Math.floor(Math.random() * 100 + 50),
                    petitionSum: performance ? performance.petition_sum : Math.floor(Math.random() * 50 + 20),
                    petitionPassSum: performance ? performance.petition_pass_sum : Math.floor(Math.random() * 30 + 10),
                    chairmanCount: performance ? performance.committee_leader_count : Math.floor(Math.random() * 5 + 1),
                    secretaryCount: performance ? performance.committee_secretary_count : Math.floor(Math.random() * 8 + 2),
                    invalidVoteRatio: performance ? (performance.avg_invalid_vote_ratio * 100) : (1 + Math.random() * 3),
                    voteMatchRatio: performance ? (performance.avg_vote_match_ratio * 100) : (80 + Math.random() * 15),
                    voteMismatchRatio: performance ? (performance.avg_vote_mismatch_ratio * 100) : (5 + Math.random() * 15),
                    
                    // 원본 데이터 참조
                    _performance: performance,
                    _ranking: ranking,
                    _stats: stats
                };
            }).filter(party => party.name && party.name !== '정보없음');

            originalPartyData.sort((a, b) => a.rank - b.rank);

            console.log(`[RankParty] ✅ 원본 정당 데이터 병합 완료: ${originalPartyData.length}개`);
            
        } catch (error) {
            console.error('[RankParty] ❌ 원본 정당 데이터 병합 실패:', error);
            originalPartyData = [];
        }
    }

    // 기본 정당 데이터 로드
    async function loadPartyData() {
        try {
            console.log('[RankParty] 📊 정당 데이터 로드 중...');
            showLoading(true);

            await waitForAPIService();

            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('APIService를 사용할 수 없습니다');
            }

            const [performanceResult, rankingResult, statsResult] = await Promise.allSettled([
                fetchPartyPerformanceData(),
                fetchPartyRankingData(),
                fetchPartyStatsData()
            ]);

            const results = {
                performance: performanceResult.status === 'fulfilled',
                ranking: rankingResult.status === 'fulfilled',
                stats: statsResult.status === 'fulfilled'
            };

            console.log('[RankParty] 📊 API 로드 결과:', results);

            if (!results.performance && !results.ranking) {
                console.warn('[RankParty] ⚠️ 모든 API 로드 실패, 기본 데이터 사용');
                partyData = getDefaultPartyData();
                originalPartyData = [...partyData]; // 기본 데이터도 원본으로 저장
                return;
            }

            // 🎯 원본 데이터 병합 및 저장
            mergeAndStoreOriginalData();
            
            // 가중치가 있으면 즉시 재계산, 없으면 기본 처리
            if (weightSyncState.currentWeights) {
                await recalculatePartyScores();
            } else {
                partyData = [...originalPartyData];
            }

            console.log('[RankParty] ✅ 정당 데이터 로드 완료:', partyData.length, '개');
            showNotification(`정당 랭킹 데이터 로드 완료 (${partyData.length}개 정당)`, 'success');

        } catch (error) {
            console.error('[RankParty] ❌ 정당 데이터 로드 실패:', error);
            partyData = getDefaultPartyData();
            originalPartyData = [...partyData];
            showError('정당 데이터를 불러오는데 실패했습니다. 기본 데이터를 사용합니다.');
        } finally {
            showLoading(false);
        }
    }

    // 기본 정당 데이터 (API 실패 시 사용)
    function getDefaultPartyData() {
        return [
            {
                name: "더불어민주당",
                party: "더불어민주당",
                rank: 1,
                rankSource: 'estimated',
                totalScore: 78.5,
                attendanceRate: 88.2,
                billPassSum: 245,
                petitionSum: 180,
                petitionPassSum: 95,
                chairmanCount: 8,
                secretaryCount: 15,
                invalidVoteRatio: 2.1,
                voteMatchRatio: 87.3,
                voteMismatchRatio: 12.7
            },
            {
                name: "국민의힘",
                party: "국민의힘",
                rank: 2,
                rankSource: 'estimated',
                totalScore: 75.2,
                attendanceRate: 85.7,
                billPassSum: 198,
                petitionSum: 145,
                petitionPassSum: 78,
                chairmanCount: 6,
                secretaryCount: 12,
                invalidVoteRatio: 2.8,
                voteMatchRatio: 84.1,
                voteMismatchRatio: 15.9
            },
            {
                name: "조국혁신당",
                party: "조국혁신당",
                rank: 3,
                rankSource: 'estimated',
                totalScore: 72.8,
                attendanceRate: 89.5,
                billPassSum: 45,
                petitionSum: 35,
                petitionPassSum: 22,
                chairmanCount: 1,
                secretaryCount: 2,
                invalidVoteRatio: 1.8,
                voteMatchRatio: 91.2,
                voteMismatchRatio: 8.8
            }
        ];
    }

    // === 🎨 UI 렌더링 함수들 ===

    // 정당 랭킹 테이블 렌더링 (기존과 동일하되 가중치 표시 추가)
    function renderPartyRankingTable() {
        const tableBody = document.getElementById('partyTableBody');
        
        if (!tableBody) {
            console.error('[RankParty] ❌ partyTableBody 요소를 찾을 수 없습니다');
            return;
        }

        if (!partyData || partyData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                        <div class="loading-spinner"></div>
                        정당 데이터를 불러오는 중...
                    </td>
                </tr>
            `;
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = getSortedPartyData().slice(startIndex, endIndex);

        const tableHTML = pageData.map((party, index) => {
            const partyColor = partyColors[party.name];
            
            return `
                <tr class="party-row" data-party="${party.name}" onclick="showPartyDetail('${party.name}')">
                    <td class="rank-cell">
                        <span style="color: ${partyColor?.main || '#333'}">${party.rank}</span>
                        ${party.rankSource === 'client_calculated' ? 
                            '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="클라이언트 가중치 적용">⚖️</span>' :
                            party.rankSource === 'api' ? 
                            '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="API 데이터">●</span>' : 
                            '<span style="color: #6c757d; font-size: 10px; margin-left: 5px;" title="추정 데이터">○</span>'
                        }
                    </td>
                    <td style="font-weight: 600; color: ${partyColor?.main || '#333'}">
                        ${party.totalScore.toFixed(1)}%
                        ${party.scoreChanged ? 
                            `<div style="font-size: 10px; color: #10b981; margin-top: 2px;">
                                🔄 재계산됨
                            </div>` : ''
                        }
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${partyColor?.main || '#999'}; display: inline-block;"></span>
                            <strong>${party.name}</strong>
                            ${party.weightApplied ? 
                                '<span style="color: #10b981; font-size: 10px; margin-left: 8px;" title="가중치 적용됨">🎯</span>' : ''
                            }
                        </div>
                    </td>
                    <td style="color: var(--example)">
                        ${getPartyLeader(party.name)}
                    </td>
                    <td class="home-icon">
                        <a href="${getPartyHomepage(party.name)}" 
                           target="_blank" 
                           rel="noopener noreferrer" 
                           onclick="event.stopPropagation();">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                            </svg>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

        tableBody.innerHTML = tableHTML;
        addBasicStyles();
        
        console.log(`[RankParty] ✅ 테이블 렌더링 완료: ${pageData.length}개 정당 표시`);
    }

    // 기존 UI 함수들 모두 유지 (정당 대표, 홈페이지, 정렬, 페이지네이션 등)
    function getPartyLeader(partyName) {
        const leaders = {
            "더불어민주당": "박찬대",
            "국민의힘": "공석", 
            "조국혁신당": "서왕진",
            "개혁신당": "천하람",
            "진보당": "윤종오",
            "기본소득당": "용혜인",
            "사회민주당": "한창민",
            "무소속": "-"
        };
        return leaders[partyName] || "-";
    }

    function getPartyHomepage(partyName) {
        const homepages = {
            "더불어민주당": "https://www.theminjoo.kr",
            "국민의힘": "https://www.peoplepowerparty.kr",
            "조국혁신당": "https://rebuildingkoreaparty.kr/",
            "개혁신당": "https://rallypoint.kr/main",
            "진보당": "https://jinboparty.com/main/",
            "기본소득당": "https://www.basicincomeparty.kr/",
            "사회민주당": "https://www.samindang.kr/",
            "무소속": "#"
        };
        return homepages[partyName] || "#";
    }

    function addBasicStyles() {
        if (document.getElementById('party-ranking-additional-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'party-ranking-additional-styles';
        style.textContent = `
            .party-row {
                transition: all 0.2s ease;
            }
            
            .party-row:hover {
                background-color: var(--main2) !important;
                transform: translateY(-1px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .rank-cell {
                font-weight: 700;
                font-size: 24px;
            }
            
            .loading-spinner {
                display: inline-block;
                width: 20px;
                height: 20px;
                border: 2px solid var(--side2);
                border-radius: 50%;
                border-top-color: var(--light-blue);
                animation: spin 1s ease-in-out infinite;
                margin-right: 8px;
                vertical-align: middle;
            }
            
            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    function getSortedPartyData() {
        if (!partyData || partyData.length === 0) {
            return [];
        }

        const sortedData = [...partyData];
        
        switch (currentSort) {
            case 'rank_asc':
            case 'rank':
                sortedData.sort((a, b) => (a.rank || 999) - (b.rank || 999));
                break;
                
            case 'rank_desc':
                sortedData.sort((a, b) => (b.rank || 999) - (a.rank || 999));
                break;
                
            case 'attendanceRate':
                sortedData.sort((a, b) => (b.attendanceRate || 0) - (a.attendanceRate || 0));
                break;
                
            case 'billPassSum':
                sortedData.sort((a, b) => (b.billPassSum || 0) - (a.billPassSum || 0));
                break;
                
            case 'petitionSum':
                sortedData.sort((a, b) => (b.petitionSum || 0) - (a.petitionSum || 0));
                break;
                
            case 'chairmanCount':
                sortedData.sort((a, b) => (b.chairmanCount || 0) - (a.chairmanCount || 0));
                break;
                
            case 'secretaryCount':
                sortedData.sort((a, b) => (b.secretaryCount || 0) - (a.secretaryCount || 0));
                break;
                
            default:
                sortedData.sort((a, b) => (a.rank || 999) - (b.rank || 999));
        }
        
        return sortedData;
    }

    // 기존 함수들 (페이지네이션, 정렬, 통계 등) 모두 유지
    function renderPagination() {
        let paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) {
            paginationContainer = document.createElement('div');
            paginationContainer.id = 'pagination-container';
            paginationContainer.style.textAlign = 'center';
            paginationContainer.style.marginTop = '20px';
            
            const table = document.querySelector('.party-table');
            if (table && table.parentNode) {
                table.parentNode.insertBefore(paginationContainer, table.nextSibling);
            }
        }
        
        const totalItems = partyData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let paginationHTML = '<div class="pagination">';
        
        if (currentPage > 1) {
            paginationHTML += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">이전</button>`;
        }
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPage) {
                paginationHTML += `<button class="page-btn active">${i}</button>`;
            } else {
                paginationHTML += `<button onclick="goToPage(${i})" class="page-btn">${i}</button>`;
            }
        }
        
        if (currentPage < totalPages) {
            paginationHTML += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">다음</button>`;
        }
        
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        
        addPaginationStyles();
    }

    function renderStatistics() {
        let statsContainer = document.getElementById('party-statistics') ||
                           document.getElementById('statistics') ||
                           document.querySelector('.statistics');
        
        if (!statsContainer) {
            const tableContainer = document.getElementById('party-ranking-table') || 
                                 document.querySelector('.main');
            if (tableContainer) {
                statsContainer = document.createElement('div');
                statsContainer.id = 'party-statistics';
                statsContainer.className = 'party-statistics';
                tableContainer.appendChild(statsContainer);
            } else {
                return;
            }
        }

        if (partyData.length === 0) return;

        const totalParties = partyData.length;
        const avgScore = partyData.reduce((sum, party) => sum + party.totalScore, 0) / totalParties;
        const avgAttendance = partyData.reduce((sum, party) => sum + party.attendanceRate, 0) / totalParties;
        const totalBillPass = partyData.reduce((sum, party) => sum + party.billPassSum, 0);
        
        // 🎯 가중치 업데이트 통계 추가
        const weightAppliedCount = partyData.filter(p => p.weightApplied).length;

        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>총 정당 수</h3>
                    <p class="stat-value">${totalParties}개</p>
                </div>
                <div class="stat-card">
                    <h3>평균 점수</h3>
                    <p class="stat-value">${avgScore.toFixed(1)}%</p>
                </div>
                <div class="stat-card">
                    <h3>평균 출석률</h3>
                    <p class="stat-value">${avgAttendance.toFixed(1)}%</p>
                </div>
                <div class="stat-card">
                    <h3>총 본회의 가결</h3>
                    <p class="stat-value">${totalBillPass}건</p>
                </div>
                ${weightAppliedCount > 0 ? `
                <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                    <h3>가중치 적용</h3>
                    <p class="stat-value">${weightAppliedCount}개 정당</p>
                </div>
                ` : ''}
            </div>
        `;
    }

    // 기존 이벤트 함수들 유지
    function goToPage(page) {
        const totalPages = Math.ceil(partyData.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            console.log(`[RankParty] 📄 페이지 이동: ${currentPage} → ${page}`);
            currentPage = page;
            renderPartyRankingTable();
            renderPagination();
        }
    }

    function setupSortingListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        const sortDropdown = document.getElementById('sortDropdown');
        const dropdownItems = document.querySelectorAll('.dropdown-item');

        if (settingsBtn && sortDropdown) {
            settingsBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                sortDropdown.classList.toggle('active');
            });

            document.addEventListener('click', function() {
                sortDropdown.classList.remove('active');
            });

            dropdownItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.stopPropagation();
                    
                    dropdownItems.forEach(i => i.classList.remove('active'));
                    this.classList.add('active');
                    
                    const sortType = this.getAttribute('data-sort');
                    applySorting(sortType);
                    
                    sortDropdown.classList.remove('active');
                });
            });
        }
    }

    function applySorting(sortType) {
        console.log('[RankParty] 📊 정렬 적용:', sortType);
        
        if (sortType === 'asc') {
            currentSort = 'rank_asc';
        } else if (sortType === 'desc') {
            currentSort = 'rank_desc';
        } else {
            currentSort = sortType;
        }
        
        currentPage = 1;
        renderPartyRankingTable();
        renderPagination();
    }

    function addPaginationStyles() {
        if (document.getElementById('pagination-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pagination-styles';
        style.textContent = `
            .pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 5px;
                margin: 20px 0;
            }
            
            .page-btn {
                padding: 8px 12px;
                border: 1px solid var(--side2);
                background: white;
                color: var(--string);
                cursor: pointer;
                border-radius: 4px;
                font-size: 14px;
                transition: all 0.2s ease;
            }
            
            .page-btn:hover {
                background: var(--main2);
                border-color: var(--light-blue);
            }
            
            .page-btn.active {
                background: var(--light-blue);
                color: white;
                border-color: var(--light-blue);
            }
            
            .page-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        `;
        
        document.head.appendChild(style);
    }

    // === 🔄 WeightSync 호환 함수들 ===
    async function refreshPartyRanking() {
        try {
            console.log('[RankParty] 🔄 정당 랭킹 데이터 새로고침...');
            showLoading(true);
            
            await loadPartyData();
            
            showNotification('정당 랭킹 데이터가 업데이트되었습니다', 'success');
            
        } catch (error) {
            console.error('[RankParty] ❌ 데이터 새로고침 실패:', error);
            showNotification('데이터 새로고침에 실패했습니다', 'error');
        } finally {
            showLoading(false);
        }
    }

    // === 🔧 전역 함수 등록 ===
    window.refreshPartyRankingData = refreshPartyRanking;
    window.loadPartyRankingData = loadPartyData;
    window.goToPage = goToPage;

    window.showPartyDetail = function(partyName) {
        const party = partyData.find(p => p.name === partyName);
        if (party) {
            window.location.href = `percent_party.html?party=${encodeURIComponent(partyName)}`;
        }
    };

    // === 🛠️ 디버그 유틸리티 ===
    window.partyRankingDebug = {
        getState: () => ({
            partyData,
            originalPartyData,
            weightSyncState,
            currentSort,
            currentPage
        }),
        
        refreshData: () => refreshPartyRanking(),
        recalculateScores: () => recalculatePartyScores(),
        getCurrentWeights: () => weightSyncState.currentWeights,
        getOriginalData: () => originalPartyData,
        
        // 🔧 BroadcastChannel 관련 디버그
        recreateChannel: () => {
            console.log('[RankParty] BroadcastChannel 재생성 시도...');
            const success = createBroadcastChannel();
            console.log('[RankParty] 재생성 결과:', success ? '성공' : '실패');
            return success;
        },
        
        getChannelStatus: () => {
            return {
                exists: !!weightSyncState.realTimeUpdateChannel,
                type: typeof weightSyncState.realTimeUpdateChannel,
                supported: typeof BroadcastChannel !== 'undefined'
            };
        },
        
        testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
            const success = safeBroadcast(testData);
            console.log('[RankParty] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
            return success;
        },
        
        showInfo: () => {
            console.log('[RankParty] 📊 정당 랭킹 페이지 정보 (v3.1.0):');
            console.log('- 로드된 정당 수:', partyData.length);
            console.log('- 원본 데이터:', originalPartyData.length, '개');
            console.log('- 성과 데이터:', Object.keys(partyPerformanceData).length, '개');
            console.log('- 랭킹 데이터:', Object.keys(partyRankingData).length, '개');
            console.log('- 현재 정렬:', currentSort);
            console.log('- 현재 페이지:', currentPage, '/', Math.ceil(partyData.length / itemsPerPage));
            console.log('- APIService 상태:', window.APIService?._isReady ? '준비됨' : '준비중');
            console.log('- 가중치 연결:', weightSyncState.percentPageConnected ? '연결됨' : '대기중');
            console.log('- 현재 가중치:', weightSyncState.currentWeights);
            console.log('- 마지막 가중치 업데이트:', weightSyncState.lastWeightUpdate || '없음');
            const weightAppliedCount = partyData.filter(p => p.weightApplied).length;
            console.log('- 가중치 적용된 정당:', weightAppliedCount, '개');
            console.log('- BroadcastChannel 상태:', this.getChannelStatus());
        },
        
        testWeightCalculation: (partyName) => {
            const party = originalPartyData.find(p => p.name === partyName);
            if (party && weightSyncState.currentWeights) {
                const bounds = calculateNormalizationBounds(originalPartyData);
                const score = calculatePartyScore(party, weightSyncState.currentWeights, bounds);
                console.log(`[RankParty] ${partyName} 점수 계산:`, score);
                return score;
            } else {
                console.log(`[RankParty] ${partyName} 찾을 수 없음 또는 가중치 없음`);
                return null;
            }
        }
    };

    // === 🚀 페이지 초기화 ===
    async function initializePage() {
        console.log('[RankParty] 🚀 클라이언트 가중치 연동 정당 랭킹 페이지 초기화... (v3.1.0)');
        
        try {
            // 실시간 연동 시스템 먼저 초기화
            initializeRealTimeSync();
            
            // 기본 정렬 설정
            currentSort = 'rank_asc';
            currentPage = 1;
            
            // 정당 데이터 로드
            await loadPartyData();
            
            // 이벤트 리스너 설정
            setupSortingListeners();
            
            // UI 렌더링
            renderPartyRankingTable();
            renderPagination();
            renderStatistics();
            
            // 연결 상태 표시 업데이트
            updateConnectionStatus();
            
            showNotification('클라이언트 가중치 연동 정당 랭킹 페이지 로드 완료!', 'success');
            console.log('[RankParty] ✅ 정당 랭킹 페이지 초기화 완료');
            
        } catch (error) {
            console.error('[RankParty] ❌ 페이지 초기화 오류:', error);
            showError('페이지 로드 중 오류가 발생했습니다');
            
            const tableBody = document.getElementById('partyTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                            데이터를 불러오는데 실패했습니다. 페이지를 새로고침해주세요.
                            <br><br>
                            <button onclick="location.reload()" style="padding: 8px 16px; margin-top: 10px;">새로고침</button>
                        </td>
                    </tr>
                `;
            }
        }
    }

    // 초기화 실행
    setTimeout(initializePage, 100);

    console.log('[RankParty] ✅ 클라이언트 가중치 연동 정당 랭킹 페이지 스크립트 로드 완료 (v3.1.0)');
});
