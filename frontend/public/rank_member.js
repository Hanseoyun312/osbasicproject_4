/**
 * rank_member.js (v3.1.0) - 클라이언트 사이드 가중치 연동 의원 랭킹 시스템 (BroadcastChannel 안전 처리)
 * 개선사항: percent 페이지의 가중치를 받아서 클라이언트에서 순위 재계산 + 안전한 채널 관리
 */

// === 📊 페이지 상태 관리 ===
let pageState = {
    memberList: [],
    memberRanking: [],
    originalMemberData: [],  // 원본 데이터 보관
    filteredMembers: [],
    currentPage: 1,
    itemsPerPage: 20,
    totalPages: 1,
    currentSort: 'asc',
    currentFilter: 'all',
    searchQuery: '',
    isLoading: false,
    hasError: false,
    initialized: false,
    
    // 🎯 클라이언트 가중치 관련 상태
    currentWeights: null,
    lastWeightUpdate: null,
    isRecalculating: false,
    realTimeUpdateChannel: null,
    percentPageConnected: false
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

    // 데이터 정규화를 위한 기준값들 (실제 데이터에서 동적으로 계산)
    normalizationBounds: {
        committee_secretary_count: { min: 0, max: 10 },
        invalid_vote_ratio: { min: 0, max: 100 },
        bill_pass_sum: { min: 0, max: 500 },
        committee_leader_count: { min: 0, max: 5 },
        petition_sum: { min: 0, max: 200 },
        petition_pass_sum: { min: 0, max: 100 },
        attendance_rate: { min: 0, max: 100 },
        vote_match_ratio: { min: 0, max: 100 },
        vote_mismatch_ratio: { min: 0, max: 100 }
    }
};

// === 📡 안전한 BroadcastChannel 관리 ===
function createBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') {
        console.warn('[RankMember] ⚠️ BroadcastChannel을 지원하지 않는 브라우저입니다');
        return false;
    }

    try {
        // 기존 채널이 있으면 정리
        if (pageState.realTimeUpdateChannel) {
            try {
                pageState.realTimeUpdateChannel.close();
            } catch (e) {
                // 이미 닫혔을 수 있음
            }
        }

        // 새 채널 생성
        pageState.realTimeUpdateChannel = new BroadcastChannel('client_weight_updates_v4');
        
        pageState.realTimeUpdateChannel.addEventListener('message', async function(event) {
            try {
                const data = event.data;
                console.log('[RankMember] 📡 가중치 업데이트 수신:', data);
                
                if (data.type === 'client_weights_updated' && data.source === 'percent_page') {
                    await handleClientWeightUpdate(data);
                } else if (data.type === 'connection_check') {
                    // percent 페이지의 연결 확인 요청에 응답
                    safeBroadcast({
                        type: 'connection_response',
                        source: 'rank_member_page',
                        timestamp: new Date().toISOString(),
                        status: 'connected'
                    });
                    pageState.percentPageConnected = true;
                    updateConnectionStatus();
                }
            } catch (error) {
                console.warn('[RankMember] 메시지 처리 실패:', error);
            }
        });

        // 채널 오류 처리
        pageState.realTimeUpdateChannel.addEventListener('error', function(error) {
            console.warn('[RankMember] BroadcastChannel 오류:', error);
            // 채널 재생성 시도
            setTimeout(createBroadcastChannel, 1000);
        });
        
        console.log('[RankMember] ✅ BroadcastChannel 초기화 완료');
        return true;
        
    } catch (error) {
        console.error('[RankMember] BroadcastChannel 초기화 실패:', error);
        pageState.realTimeUpdateChannel = null;
        return false;
    }
}

// === 📡 안전한 브로드캐스트 함수 ===
function safeBroadcast(data) {
    try {
        if (!pageState.realTimeUpdateChannel) {
            // 채널이 없으면 재생성 시도
            if (!createBroadcastChannel()) {
                return false;
            }
        }

        pageState.realTimeUpdateChannel.postMessage(data);
        return true;
        
    } catch (error) {
        console.warn('[RankMember] 브로드캐스트 실패, 채널 재생성 시도:', error);
        
        // 채널 재생성 시도
        if (createBroadcastChannel()) {
            try {
                pageState.realTimeUpdateChannel.postMessage(data);
                return true;
            } catch (retryError) {
                console.warn('[RankMember] 재시도 후에도 브로드캐스트 실패:', retryError);
            }
        }
        
        return false;
    }
}

// === 🔗 실시간 연동 시스템 초기화 ===
function initializeRealTimeSync() {
    console.log('[RankMember] 🔗 클라이언트 가중치 연동 시스템 초기화...');
    
    try {
        // 1. BroadcastChannel 설정
        createBroadcastChannel();
        
        // 2. localStorage 이벤트 감지
        window.addEventListener('storage', function(e) {
            if (e.key === 'client_weight_change_event' && !pageState.isRecalculating) {
                try {
                    const eventData = JSON.parse(e.newValue);
                    console.log('[RankMember] 📢 localStorage 가중치 변경 감지:', eventData);
                    handleClientWeightUpdate(eventData);
                } catch (error) {
                    console.warn('[RankMember] localStorage 이벤트 파싱 실패:', error);
                }
            }
        });
        
        // 3. 저장된 가중치 확인 및 로드
        loadStoredWeights();
        
        console.log('[RankMember] ✅ 실시간 연동 시스템 초기화 완료');
        
    } catch (error) {
        console.error('[RankMember] 실시간 연동 시스템 초기화 실패:', error);
    }
}

// === 💾 저장된 가중치 로드 ===
function loadStoredWeights() {
    try {
        const storedWeights = localStorage.getItem('current_weights');
        if (storedWeights) {
            const weightData = JSON.parse(storedWeights);
            console.log('[RankMember] 📥 저장된 가중치 로드:', weightData);
            
            pageState.currentWeights = weightData.weights;
            pageState.lastWeightUpdate = new Date(weightData.timestamp);
            
            // 데이터가 이미 로드되었다면 즉시 재계산
            if (pageState.originalMemberData.length > 0) {
                recalculateMemberScores();
            }
        } else {
            console.log('[RankMember] 📋 저장된 가중치 없음 - 기본 점수 사용');
        }
    } catch (error) {
        console.error('[RankMember] 저장된 가중치 로드 실패:', error);
    }
}

// === 🎯 핵심: 클라이언트 가중치 업데이트 처리 ===
async function handleClientWeightUpdate(eventData) {
    if (pageState.isRecalculating) {
        console.log('[RankMember] 🔄 이미 재계산 중입니다.');
        return;
    }

    try {
        pageState.isRecalculating = true;
        
        console.log('[RankMember] 🎯 클라이언트 가중치 업데이트 시작...');
        
        // 사용자에게 알림
        showWeightUpdateNotification('가중치가 변경되었습니다. 의원 순위를 재계산하는 중...', 'info', 3000);
        
        // 로딩 상태 표시
        setLoadingState(true, '새로운 가중치로 순위 재계산 중...');
        
        // 가중치 업데이트
        pageState.currentWeights = eventData.weights;
        pageState.lastWeightUpdate = new Date(eventData.timestamp);
        
        // 🧮 의원 점수 재계산
        await recalculateMemberScores();
        
        // 성공 알림
        showWeightUpdateNotification('✅ 의원 순위가 새로운 가중치로 업데이트되었습니다!', 'success', 4000);
        
        console.log('[RankMember] ✅ 클라이언트 가중치 업데이트 완료');
        
    } catch (error) {
        console.error('[RankMember] ❌ 클라이언트 가중치 업데이트 실패:', error);
        showWeightUpdateNotification(`순위 업데이트 실패: ${error.message}`, 'error', 5000);
    } finally {
        pageState.isRecalculating = false;
        setLoadingState(false);
    }
}

// === 🧮 핵심: 의원 점수 재계산 ===
async function recalculateMemberScores() {
    try {
        console.log('[RankMember] 🧮 의원 점수 재계산 시작...');
        
        if (!pageState.currentWeights) {
            console.log('[RankMember] ⚠️ 가중치가 없어서 기본 점수 사용');
            return;
        }
        
        if (pageState.originalMemberData.length === 0) {
            console.log('[RankMember] ⚠️ 원본 데이터가 없어서 재계산 불가');
            return;
        }
        
        // 1. 정규화 기준값 계산
        const bounds = calculateNormalizationBounds(pageState.originalMemberData);
        
        // 2. 각 의원의 점수 재계산
        const recalculatedMembers = pageState.originalMemberData.map((member, index) => {
            const newScore = calculateMemberScore(member, pageState.currentWeights, bounds);
            
            return {
                ...member,
                calculatedScore: newScore,
                rank: 0, // 임시값, 나중에 재정렬 후 계산
                scoreSource: 'client_calculated',
                lastUpdated: new Date().toISOString(),
                weightApplied: true
            };
        });
        
        // 3. 점수 기준으로 정렬하여 순위 부여
        recalculatedMembers.sort((a, b) => b.calculatedScore - a.calculatedScore);
        recalculatedMembers.forEach((member, index) => {
            member.rank = index + 1;
        });
        
        // 4. filteredMembers 업데이트
        pageState.filteredMembers = recalculatedMembers;
        
        // 5. 필터 및 정렬 다시 적용
        applyCurrentFiltersAndSort();
        
        // 6. UI 업데이트
        renderTable();
        renderPagination();
        
        // 7. 업데이트 정보 표시
        showScoreUpdateInfo(recalculatedMembers.length);
        
        console.log('[RankMember] ✅ 의원 점수 재계산 완료');
        
    } catch (error) {
        console.error('[RankMember] ❌ 의원 점수 재계산 실패:', error);
        throw error;
    }
}

// === 🧮 정규화 기준값 계산 ===
function calculateNormalizationBounds(memberData) {
    const bounds = {};
    
    Object.values(WEIGHT_CALCULATOR.FIELD_MAPPING).forEach(field => {
        const values = memberData
            .map(member => getFieldValue(member, field))
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
    
    console.log('[RankMember] 📊 정규화 기준값:', bounds);
    return bounds;
}

// === 🧮 개별 의원 점수 계산 ===
function calculateMemberScore(member, weights, bounds) {
    let totalScore = 0;
    let totalWeight = 0;
    
    Object.entries(weights).forEach(([weightLabel, weightValue]) => {
        const fieldName = WEIGHT_CALCULATOR.FIELD_MAPPING[weightLabel];
        
        if (fieldName && bounds[fieldName]) {
            const rawValue = getFieldValue(member, fieldName);
            const normalizedValue = normalizeValue(rawValue, bounds[fieldName]);
            const weightedValue = normalizedValue * weightValue;
            
            totalScore += weightedValue;
            totalWeight += weightValue;
            
            // 디버그 로그 (처음 몇 개만)
            if (member.name === pageState.originalMemberData[0]?.name) {
                console.log(`[RankMember] 📊 ${member.name} - ${weightLabel}: raw=${rawValue}, norm=${normalizedValue.toFixed(3)}, weight=${weightValue}, weighted=${weightedValue.toFixed(3)}`);
            }
        }
    });
    
    // 0-100 범위로 변환
    const finalScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    
    return Math.round(finalScore * 10) / 10; // 소수점 첫째자리까지
}

// === 🔧 유틸리티: 필드값 추출 ===
function getFieldValue(member, fieldName) {
    // 다양한 필드명 매핑 시도
    const possibleFields = [
        fieldName,
        // 성과 데이터에서
        member._performance?.[fieldName],
        // 랭킹 데이터에서
        member._ranking?.[fieldName],
        // 직접 필드에서
        member[fieldName],
        // 다른 필드명 변형들
        member[fieldName.replace('_', '')],
        member[fieldName.toUpperCase()],
        member[fieldName.toLowerCase()]
    ];
    
    for (const field of possibleFields) {
        if (field !== undefined && field !== null && !isNaN(parseFloat(field))) {
            return parseFloat(field);
        }
    }
    
    // 특별한 경우 처리
    switch (fieldName) {
        case 'attendance_rate':
            return parseFloat(member.attendanceRate || member.출석률 || 85);
        case 'bill_pass_sum':
            return parseInt(member.billPassSum || member.본회의가결 || 0);
        case 'petition_sum':
            return parseInt(member.petitionSum || member.청원수 || 0);
        case 'petition_pass_sum':
            return parseInt(member.petitionPassSum || member.청원가결 || 0);
        case 'committee_leader_count':
            return parseInt(member.chairmanCount || member.위원장수 || 0);
        case 'committee_secretary_count':
            return parseInt(member.secretaryCount || member.간사수 || 0);
        case 'invalid_vote_ratio':
            return parseFloat(member.invalidVoteRatio || member.무효표비율 || 2);
        case 'vote_match_ratio':
            return parseFloat(member.voteMatchRatio || member.표결일치율 || 85);
        case 'vote_mismatch_ratio':
            return parseFloat(member.voteMismatchRatio || member.표결불일치율 || 15);
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
        let infoElement = document.getElementById('member-score-update-info');
        if (!infoElement) {
            infoElement = document.createElement('div');
            infoElement.id = 'member-score-update-info';
            infoElement.style.cssText = `
                margin: 10px 0; padding: 12px 18px; 
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white; border-radius: 10px; font-size: 14px; text-align: center;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25); 
                animation: slideInMember 0.6s ease-out;
            `;
            
            const tableContainer = document.querySelector('.main') || document.body;
            const table = document.querySelector('.member-table');
            if (table && table.parentNode) {
                table.parentNode.insertBefore(infoElement, table);
            } else {
                tableContainer.appendChild(infoElement);
            }
        }
        
        const weightInfo = pageState.currentWeights ? 
            `(${Object.keys(pageState.currentWeights).length}개 가중치 적용)` : '';
        
        infoElement.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap;">
                <span style="font-size: 18px;">👤</span>
                <span><strong>${updatedCount}명</strong>의 의원 점수가 클라이언트에서 재계산되었습니다! ${weightInfo}</span>
                <span style="font-size: 11px; opacity: 0.9;">${new Date().toLocaleTimeString('ko-KR')}</span>
            </div>
        `;
        
        // 애니메이션 스타일 추가
        if (!document.getElementById('member-score-update-styles')) {
            const style = document.createElement('style');
            style.id = 'member-score-update-styles';
            style.textContent = `
                @keyframes slideInMember {
                    from { opacity: 0; transform: translateY(-12px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 8초 후 자동 숨김
        setTimeout(() => {
            if (infoElement.parentNode) {
                infoElement.style.opacity = '0';
                infoElement.style.transform = 'translateY(-12px) scale(0.95)';
                setTimeout(() => infoElement.remove(), 400);
            }
        }, 8000);
        
    } catch (error) {
        console.warn('[RankMember] 점수 업데이트 정보 표시 실패:', error);
    }
}

// === 🔔 가중치 업데이트 전용 알림 시스템 ===
function showWeightUpdateNotification(message, type = 'info', duration = 4000) {
    try {
        // 기존 가중치 알림 제거
        const existingNotification = document.querySelector('.member-weight-update-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = 'member-weight-update-notification';
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
                       'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'};
            color: white;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <span style="font-size: 16px;">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span>${message}</span>
                <span style="font-size: 16px;">👤</span>
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
        console.log(`[RankMember 가중치 알림] ${message} (${type})`);
    }
}

// === 🎨 연결 상태 표시 업데이트 ===
function updateConnectionStatus() {
    try {
        let statusElement = document.getElementById('member-weight-sync-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'member-weight-sync-status';
            statusElement.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 1000;
                padding: 8px 12px; background: rgba(59, 130, 246, 0.9); color: white;
                border-radius: 20px; font-size: 11px; font-weight: 500;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1); backdrop-filter: blur(4px);
                transition: all 0.3s ease; font-family: 'Blinker', sans-serif;
            `;
            document.body.appendChild(statusElement);
        }
        
        const hasWeights = pageState.currentWeights !== null;
        
        if (pageState.percentPageConnected && hasWeights) {
            statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
            statusElement.innerHTML = '🔗 의원 가중치 연동됨';
        } else if (hasWeights) {
            statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
            statusElement.innerHTML = '⚖️ 가중치 적용됨';
        } else if (pageState.percentPageConnected) {
            statusElement.style.background = 'rgba(59, 130, 246, 0.9)';
            statusElement.innerHTML = '⏳ 가중치 대기중';
        } else {
            statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
            statusElement.innerHTML = '📴 기본 순위';
        }
        
    } catch (error) {
        console.warn('[RankMember] 연결 상태 표시 업데이트 실패:', error);
    }
}

// === 📋 기존 함수들 (DOM 요소 캐시는 그대로 유지) ===
const elements = {
    memberTableBody: null,
    pagination: null,
    searchInput: null,
    searchButton: null,
    filterButtons: null,
    settingsBtn: null,
    sortDropdown: null
};

// DOM 요소 초기화
function initializeElements() {
    elements.memberTableBody = document.getElementById('memberTableBody');
    elements.pagination = document.getElementById('pagination');
    elements.searchInput = document.getElementById('searchInput');
    elements.searchButton = document.getElementById('searchButton');
    elements.filterButtons = document.querySelectorAll('.filter-btn');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.sortDropdown = document.getElementById('sortDropdown');
}

// 로딩 상태 관리
function setLoadingState(loading, message = '국회의원 데이터를 불러오는 중...') {
    pageState.isLoading = loading;
    
    if (elements.memberTableBody) {
        if (loading) {
            elements.memberTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                        <div class="loading-spinner"></div>
                        ${message}
                    </td>
                </tr>
            `;
        }
    }
    
    if (elements.searchButton) {
        elements.searchButton.disabled = loading;
    }
}

// 알림 표시
function showNotification(message, type = 'info', duration = 3000) {
    if (window.APIService && window.APIService.showNotification) {
        window.APIService.showNotification(message, type, duration);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// === 🚀 기존 API 데이터 로드 함수 (수정됨) ===
async function loadAllData() {
    try {
        setLoadingState(true);
        console.log('[RankMember] 🚀 데이터 로드 시작...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        const results = await Promise.allSettled([
            window.APIService.getAllMembers(),
            window.APIService.getMemberRanking(),
            window.APIService.getMemberPerformance()
        ]);
        
        const [membersResult, rankingResult, performanceResult] = results;
        
        if (membersResult.status === 'fulfilled') {
            pageState.memberList = membersResult.value || [];
            console.log(`[RankMember] ✅ 국회의원 명단: ${pageState.memberList.length}명`);
        } else {
            console.error('[RankMember] ❌ 국회의원 명단 로드 실패:', membersResult.reason);
            throw new Error('국회의원 명단을 불러올 수 없습니다.');
        }
        
        if (rankingResult.status === 'fulfilled') {
            pageState.memberRanking = rankingResult.value || [];
            console.log(`[RankMember] ✅ 랭킹 데이터: ${pageState.memberRanking.length}개`);
        } else {
            console.warn('[RankMember] ⚠️ 랭킹 데이터 로드 실패:', rankingResult.reason);
            pageState.memberRanking = [];
        }

        // 성과 데이터도 로드 (가중치 계산에 필요한 상세 정보)
        let memberPerformanceData = [];
        if (performanceResult.status === 'fulfilled') {
            memberPerformanceData = performanceResult.value || [];
            console.log(`[RankMember] ✅ 성과 데이터: ${memberPerformanceData.length}개`);
        }
        
        // 🎯 원본 데이터 병합 및 보관
        mergeAndStoreOriginalData(memberPerformanceData);
        
        // 가중치가 있으면 즉시 재계산, 없으면 기본 처리
        if (pageState.currentWeights) {
            await recalculateMemberScores();
        } else {
            mergeAndProcessData();
        }
        
        console.log('[RankMember] ✅ 데이터 로드 완료');
        return true;
        
    } catch (error) {
        console.error('[RankMember] ❌ 데이터 로드 실패:', error);
        pageState.hasError = true;
        showNotification('데이터 로드에 실패했습니다.', 'error');
        
        pageState.memberList = getFallbackData();
        pageState.memberRanking = [];
        mergeAndProcessData();
        
        throw error;
    } finally {
        setLoadingState(false);
    }
}

// === 🎯 원본 데이터 병합 및 저장 ===
function mergeAndStoreOriginalData(performanceData) {
    try {
        console.log('[RankMember] 📊 원본 데이터 병합 중...');
        
        pageState.originalMemberData = pageState.memberList.map((member, index) => {
            const memberName = member.name || '';
            const ranking = pageState.memberRanking.find(r => r.HG_NM === memberName);
            const performance = performanceData.find(p => p.lawmaker_name === memberName);
            
            return {
                // 기본 정보
                rank: ranking ? parseInt(ranking.총점_순위) || (index + 1) : (index + 1),
                name: memberName,
                party: member.party || '정당 정보 없음',
                contact: member.phone || '',
                homepage: member.homepage || '',
                originalIndex: index,
                
                // 🎯 가중치 계산에 필요한 상세 데이터
                attendanceRate: parseFloat(performance?.attendance_rate || ranking?.출석률 || 85),
                billPassSum: parseInt(performance?.bill_pass_sum || ranking?.본회의가결 || 0),
                petitionSum: parseInt(performance?.petition_sum || ranking?.청원수 || 0),
                petitionPassSum: parseInt(performance?.petition_pass_sum || ranking?.청원가결 || 0),
                chairmanCount: parseInt(performance?.committee_leader_count || ranking?.위원장수 || 0),
                secretaryCount: parseInt(performance?.committee_secretary_count || ranking?.간사수 || 0),
                invalidVoteRatio: parseFloat(performance?.invalid_vote_ratio || ranking?.무효표비율 || 2),
                voteMatchRatio: parseFloat(performance?.vote_match_ratio || ranking?.표결일치율 || 85),
                voteMismatchRatio: parseFloat(performance?.vote_mismatch_ratio || ranking?.표결불일치율 || 15),
                
                // 원본 데이터 참조
                _member: member,
                _ranking: ranking,
                _performance: performance
            };
        });
        
        console.log(`[RankMember] ✅ 원본 데이터 병합 완료: ${pageState.originalMemberData.length}명`);
        
    } catch (error) {
        console.error('[RankMember] ❌ 원본 데이터 병합 실패:', error);
        pageState.originalMemberData = [];
    }
}

// 기존 데이터 병합 및 처리 (가중치 없을 때 사용)
function mergeAndProcessData() {
    try {
        if (pageState.originalMemberData.length > 0) {
            // 원본 데이터가 있으면 그대로 사용
            pageState.filteredMembers = [...pageState.originalMemberData];
        } else {
            // 원본 데이터가 없으면 기본 처리
            pageState.filteredMembers = pageState.memberList.map((member, index) => {
                const memberName = member.name || '';
                const ranking = pageState.memberRanking.find(r => r.HG_NM === memberName);
                
                return {
                    rank: ranking ? parseInt(ranking.총점_순위) || (index + 1) : (index + 1),
                    name: memberName,
                    party: member.party || '정당 정보 없음',
                    contact: member.phone || '',
                    homepage: member.homepage || '',
                    originalIndex: index
                };
            });
        }
        
        applyCurrentFiltersAndSort();
        renderTable();
        
        console.log(`[RankMember] 📊 기본 데이터 처리 완료: ${pageState.filteredMembers.length}명`);
        
    } catch (error) {
        console.error('[RankMember] ❌ 데이터 처리 실패:', error);
        pageState.filteredMembers = [];
        renderTable();
    }
}

// === 🔄 필터 및 정렬 적용 ===
function applyCurrentFiltersAndSort() {
    // 정렬 적용
    applySorting();
    
    // 필터 적용
    applyFilter();
    
    // 페이지네이션 계산
    calculatePagination();
}

// 폴백 데이터
function getFallbackData() {
    return [
        {
            name: '나경원',
            party: '국민의힘',
            phone: '02-788-2721',
            homepage: 'https://www.assembly.go.kr'
        },
        {
            name: '이재명',
            party: '더불어민주당',
            phone: '02-788-2922',
            homepage: 'https://www.assembly.go.kr'
        },
        {
            name: '조국',
            party: '조국혁신당',
            phone: '02-788-2923',
            homepage: 'https://www.assembly.go.kr'
        }
    ];
}

// === 기존 함수들 (정렬, 필터, 렌더링 등) 유지 ===
function applySorting() {
    pageState.filteredMembers.sort((a, b) => {
        if (pageState.currentSort === 'asc') {
            return a.rank - b.rank;
        } else {
            return b.rank - a.rank;
        }
    });
}

function applyFilter() {
    let filtered = [...pageState.filteredMembers];
    
    if (pageState.currentFilter !== 'all') {
        filtered = filtered.filter(member => member.party === pageState.currentFilter);
    }
    
    if (pageState.searchQuery) {
        const query = pageState.searchQuery.toLowerCase();
        filtered = filtered.filter(member => 
            member.name.toLowerCase().includes(query) ||
            member.party.toLowerCase().includes(query)
        );
    }
    
    pageState.filteredMembers = filtered;
}

function calculatePagination() {
    pageState.totalPages = Math.ceil(pageState.filteredMembers.length / pageState.itemsPerPage);
    
    if (pageState.currentPage > pageState.totalPages) {
        pageState.currentPage = 1;
    }
}

function renderTable() {
    if (!elements.memberTableBody) return;
    
    if (pageState.filteredMembers.length === 0) {
        elements.memberTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--example);">
                    ${pageState.hasError ? '데이터 로드에 실패했습니다.' : '검색 결과가 없습니다.'}
                </td>
            </tr>
        `;
        renderPagination();
        return;
    }
    
    const startIndex = (pageState.currentPage - 1) * pageState.itemsPerPage;
    const endIndex = startIndex + pageState.itemsPerPage;
    const currentPageMembers = pageState.filteredMembers.slice(startIndex, endIndex);
    
    const tableHTML = currentPageMembers.map(member => `
        <tr>
            <td class="rank-cell">
                ${member.rank}
                ${member.scoreSource === 'client_calculated' ? 
                    '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="클라이언트 가중치 적용">⚖️</span>' : 
                    member.weightApplied ? 
                    '<span style="color: #3b82f6; font-size: 10px; margin-left: 5px;" title="가중치 적용됨">🎯</span>' : ''
                }
            </td>
            <td>
                <a href="percent_member.html?member=${encodeURIComponent(member.name)}" 
                   class="member-name">${member.name}</a>
                ${member.calculatedScore ? 
                    `<div style="font-size: 11px; color: #059669; margin-top: 2px;">점수: ${member.calculatedScore}</div>` : ''
                }
            </td>
            <td class="party-name">${member.party}</td>
            <td class="phone-number">${member.contact || '연락처 정보 없음'}</td>
            <td class="home-icon">
                ${member.homepage ? 
                    `<a href="${member.homepage}" target="_blank">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                        </svg>
                    </a>` : 
                    `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.3;">
                        <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                    </svg>`
                }
            </td>
        </tr>
    `).join('');
    
    elements.memberTableBody.innerHTML = tableHTML;
    renderPagination();
}

// === 기존 함수들 (검색, 필터, 페이지네이션 등) 모두 유지 ===
function renderPagination() {
    if (!elements.pagination) return;
    
    if (pageState.totalPages <= 1) {
        elements.pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    if (pageState.currentPage > 1) {
        paginationHTML += `<a href="#" class="prev-next" data-page="${pageState.currentPage - 1}">‹ 이전</a>`;
    }
    
    const startPage = Math.max(1, pageState.currentPage - 2);
    const endPage = Math.min(pageState.totalPages, pageState.currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<a href="#" data-page="1">1</a>`;
        if (startPage > 2) {
            paginationHTML += `<span class="ellipsis">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === pageState.currentPage ? 'active' : '';
        paginationHTML += `<a href="#" class="${activeClass}" data-page="${i}">${i}</a>`;
    }
    
    if (endPage < pageState.totalPages) {
        if (endPage < pageState.totalPages - 1) {
            paginationHTML += `<span class="ellipsis">...</span>`;
        }
        paginationHTML += `<a href="#" data-page="${pageState.totalPages}">${pageState.totalPages}</a>`;
    }
    
    if (pageState.currentPage < pageState.totalPages) {
        paginationHTML += `<a href="#" class="prev-next" data-page="${pageState.currentPage + 1}">다음 ›</a>`;
    }
    
    elements.pagination.innerHTML = paginationHTML;
    
    elements.pagination.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = parseInt(this.dataset.page);
            if (page !== pageState.currentPage && page >= 1 && page <= pageState.totalPages) {
                pageState.currentPage = page;
                renderTable();
            }
        });
    });
}

function setupSearch() {
    if (!elements.searchInput || !elements.searchButton) return;
    
    let searchTimeout;
    elements.searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            performSearch(this.value);
        }, 300);
    });
    
    elements.searchButton.addEventListener('click', function() {
        performSearch(elements.searchInput.value);
    });
    
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch(this.value);
        }
    });
}

function performSearch(query) {
    pageState.searchQuery = query.trim();
    pageState.currentPage = 1;
    
    applyCurrentFiltersAndSort();
    renderTable();
    
    console.log(`[RankMember] 🔍 검색 실행: "${pageState.searchQuery}"`);
}

function setupFilters() {
    if (!elements.filterButtons) return;
    
    elements.filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            elements.filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            pageState.currentFilter = this.dataset.filter;
            pageState.currentPage = 1;
            
            applyCurrentFiltersAndSort();
            renderTable();
            
            console.log(`[RankMember] 📋 필터 적용: ${pageState.currentFilter}`);
        });
    });
}

function setupSorting() {
    if (!elements.settingsBtn || !elements.sortDropdown) return;
    
    elements.settingsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        elements.sortDropdown.classList.toggle('active');
    });
    
    elements.sortDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function() {
            elements.sortDropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            pageState.currentSort = this.dataset.sort;
            
            applyCurrentFiltersAndSort();
            renderTable();
            
            elements.sortDropdown.classList.remove('active');
            
            console.log(`[RankMember] 🔄 정렬 변경: ${pageState.currentSort}`);
        });
    });
    
    document.addEventListener('click', function() {
        if (elements.sortDropdown) {
            elements.sortDropdown.classList.remove('active');
        }
    });
}

// === 🔄 WeightSync 호환 함수들 ===
async function refreshMemberRankingData() {
    console.log('[RankMember] 🔄 의원 랭킹 데이터 새로고침...');
    try {
        await loadAllData();
        showNotification('의원 랭킹 데이터가 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error('[RankMember] ❌ 새로고침 실패:', error);
        showNotification('데이터 새로고침에 실패했습니다.', 'error');
    }
}

// === 🚀 페이지 초기화 ===
async function initializePage() {
    try {
        console.log('[RankMember] 🚀 클라이언트 가중치 연동 의원 랭킹 페이지 초기화... (v3.1.0)');
        
        // 실시간 연동 시스템 먼저 초기화
        initializeRealTimeSync();
        
        // DOM 요소 초기화
        initializeElements();
        
        // 이벤트 리스너 설정
        setupSearch();
        setupFilters();
        setupSorting();
        
        // 데이터 로드
        await loadAllData();
        
        // 연결 상태 표시 업데이트
        updateConnectionStatus();
        
        pageState.initialized = true;
        console.log('[RankMember] ✅ 페이지 초기화 완료');
        
    } catch (error) {
        console.error('[RankMember] ❌ 페이지 초기화 실패:', error);
        pageState.hasError = true;
        showNotification('페이지 초기화에 실패했습니다.', 'error');
    }
}

// === 🔧 전역 함수 등록 ===
window.refreshMemberRankingData = refreshMemberRankingData;
window.refreshMemberDetails = refreshMemberRankingData;
window.loadMemberData = loadAllData;

// === 🛠️ 디버그 함수들 (개선된 버전) ===
window.memberRankingDebug = {
    getState: () => pageState,
    refreshData: () => refreshMemberRankingData(),
    recalculateScores: () => recalculateMemberScores(),
    getCurrentWeights: () => pageState.currentWeights,
    getOriginalData: () => pageState.originalMemberData,
    
    recreateChannel: () => {
        console.log('[RankMember] BroadcastChannel 재생성 시도...');
        const success = createBroadcastChannel();
        console.log('[RankMember] 재생성 결과:', success ? '성공' : '실패');
        return success;
    },
    
    getChannelStatus: () => {
        return {
            exists: !!pageState.realTimeUpdateChannel,
            type: typeof pageState.realTimeUpdateChannel,
            supported: typeof BroadcastChannel !== 'undefined'
        };
    },
    
    testBroadcast: (testData = { test: true, timestamp: new Date().toISOString() }) => {
        const success = safeBroadcast(testData);
        console.log('[RankMember] 테스트 브로드캐스트 결과:', success ? '성공' : '실패');
        return success;
    },
    
    showInfo: () => {
        console.log('[RankMember] 📊 페이지 정보 (v3.1.0):');
        console.log(`- 전체 의원: ${pageState.memberList.length}명`);
        console.log(`- 원본 데이터: ${pageState.originalMemberData.length}명`);
        console.log(`- 필터된 의원: ${pageState.filteredMembers.length}명`);
        console.log(`- 현재 페이지: ${pageState.currentPage}/${pageState.totalPages}`);
        console.log(`- API 연결: ${window.APIService?._isReady ? '✅' : '❌'}`);
        console.log(`- 가중치 연결: ${pageState.percentPageConnected ? '✅' : '❌'}`);
        console.log(`- 현재 가중치:`, pageState.currentWeights);
        console.log(`- 마지막 가중치 업데이트: ${pageState.lastWeightUpdate || '없음'}`);
        const weightAppliedCount = pageState.filteredMembers.filter(m => m.weightApplied).length;
        console.log(`- 가중치 적용된 의원: ${weightAppliedCount}명`);
        console.log('- BroadcastChannel 상태:', this.getChannelStatus());
    },
    
    testWeightCalculation: (memberName) => {
        const member = pageState.originalMemberData.find(m => m.name === memberName);
        if (member && pageState.currentWeights) {
            const bounds = calculateNormalizationBounds(pageState.originalMemberData);
            const score = calculateMemberScore(member, pageState.currentWeights, bounds);
            console.log(`[RankMember] ${memberName} 점수 계산:`, score);
            return score;
        } else {
            console.log(`[RankMember] ${memberName} 찾을 수 없음 또는 가중치 없음`);
            return null;
        }
    }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('[RankMember] 📄 DOM 로드 완료 (v3.1.0 - 클라이언트 가중치 연동 + BroadcastChannel 안전 처리)');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    function waitForAPI() {
        attempts++;
        
        if (window.APIService && window.APIService._isReady) {
            console.log('[RankMember] ✅ API 서비스 연결 확인');
            initializePage();
        } else if (attempts < maxAttempts) {
            setTimeout(waitForAPI, 100);
        } else {
            console.warn('[RankMember] ⚠️ API 서비스 연결 타임아웃, 폴백 데이터 사용');
            pageState.memberList = getFallbackData();
            pageState.memberRanking = [];
            mergeAndProcessData();
            initializeElements();
            setupSearch();
            setupFilters();
            setupSorting();
            initializeRealTimeSync();
        }
    }
    
    waitForAPI();
});

console.log('[RankMember] 📦 rank_member.js 로드 완료 (v3.1.0 - 클라이언트 가중치 연동 + BroadcastChannel 안전 처리)');
