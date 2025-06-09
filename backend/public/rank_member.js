/**
 * rank_member.js (v2.2.0) - 실시간 가중치 연동 의원 랭킹 시스템
 * 개선사항: percent 페이지와 실시간 연동 + 자동 새로고침 + 사용자 피드백
 */

// === 📊 페이지 상태 관리 (강화된 버전) ===
let pageState = {
    memberList: [],
    memberRanking: [],
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
    
    // 🎯 실시간 가중치 연동 관련 상태
    weightSyncEnabled: true,
    lastWeightUpdate: null,
    isUpdatingFromWeights: false,
    percentPageConnected: false,
    realTimeUpdateChannel: null,
    updateInProgress: false,
    lastScoreData: null
};

// === 🔗 실시간 연동 시스템 초기화 ===
function initializeRealTimeSync() {
    console.log('[RankMember] 🔗 실시간 가중치 연동 시스템 초기화...');
    
    try {
        // 1. BroadcastChannel 설정 (percent 페이지와 실시간 통신)
        if (typeof BroadcastChannel !== 'undefined') {
            pageState.realTimeUpdateChannel = new BroadcastChannel('weight_updates_v2');
            
            pageState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                const data = event.data;
                console.log('[RankMember] 📡 가중치 업데이트 수신:', data);
                
                if (data.type === 'weights_updated_v2' && data.source === 'percent_page') {
                    await handleWeightUpdate(data);
                } else if (data.type === 'connection_check') {
                    // percent 페이지의 연결 확인 요청에 응답
                    pageState.realTimeUpdateChannel.postMessage({
                        type: 'connection_response',
                        source: 'rank_member_page',
                        timestamp: new Date().toISOString(),
                        status: 'connected'
                    });
                    pageState.percentPageConnected = true;
                    updateConnectionStatus();
                }
            });
            
            console.log('[RankMember] ✅ BroadcastChannel 초기화 완료');
        }
        
        // 2. localStorage 이벤트 감지 (weight_sync.js 호환)
        window.addEventListener('storage', function(e) {
            if (e.key === 'weight_change_event' && !pageState.isUpdatingFromWeights) {
                try {
                    const eventData = JSON.parse(e.newValue);
                    console.log('[RankMember] 📢 localStorage 가중치 변경 감지:', eventData);
                    handleWeightUpdate(eventData);
                } catch (error) {
                    console.warn('[RankMember] localStorage 이벤트 파싱 실패:', error);
                }
            }
        });
        
        // 3. 주기적 가중치 변경 감지
        setInterval(function() {
            const currentUpdate = localStorage.getItem('last_weight_update') || '0';
            if (currentUpdate !== pageState.lastWeightUpdate && !pageState.isUpdatingFromWeights) {
                pageState.lastWeightUpdate = currentUpdate;
                console.log('[RankMember] ⏰ 주기적 가중치 변경 감지');
                handleWeightUpdate({ type: 'periodic_check', timestamp: new Date().toISOString() });
            }
        }, 3000); // 3초마다 체크
        
        // 4. 연결 상태 주기적 확인
        setInterval(checkPercentPageConnection, 15000); // 15초마다
        
        console.log('[RankMember] ✅ 실시간 연동 시스템 초기화 완료');
        
    } catch (error) {
        console.error('[RankMember] 실시간 연동 시스템 초기화 실패:', error);
        pageState.weightSyncEnabled = false;
    }
}

// === 📡 percent 페이지 연결 상태 확인 ===
function checkPercentPageConnection() {
    if (pageState.realTimeUpdateChannel) {
        pageState.realTimeUpdateChannel.postMessage({
            type: 'connection_check',
            source: 'rank_member_page',
            timestamp: new Date().toISOString()
        });
    }
}

// === 🎯 가중치 업데이트 처리 (핵심 함수) ===
async function handleWeightUpdate(eventData) {
    if (pageState.isUpdatingFromWeights || pageState.updateInProgress) {
        console.log('[RankMember] 🔄 이미 업데이트 중입니다.');
        return;
    }

    try {
        pageState.isUpdatingFromWeights = true;
        pageState.updateInProgress = true;
        
        console.log('[RankMember] 🔄 가중치 변경으로 인한 의원 랭킹 업데이트 시작...');
        
        // 사용자에게 업데이트 시작 알림
        showWeightUpdateNotification('가중치가 변경되었습니다. 의원 랭킹을 업데이트하는 중...', 'info', 3000);
        
        // 로딩 상태 표시
        setLoadingState(true, '새로운 가중치로 랭킹 업데이트 중...');
        
        // 서버 처리 대기 (percent 페이지에서 이미 처리되었다면 짧게)
        const serverDelay = eventData.serverProcessed ? 2000 : 5000;
        console.log(`[RankMember] ⏳ 서버 처리 대기 (${serverDelay}ms)...`);
        
        await new Promise(resolve => setTimeout(resolve, serverDelay));
        
        // 🚀 새로운 데이터 로드
        await loadAllDataWithScoreUpdate();
        
        // 성공 알림
        showWeightUpdateNotification('✅ 의원 랭킹이 새로운 가중치로 업데이트되었습니다!', 'success', 5000);
        
        pageState.lastWeightUpdate = new Date().toISOString();
        
        // percent 페이지에 업데이트 완료 응답 전송
        sendUpdateResponse(eventData, true);
        
        console.log('[RankMember] ✅ 가중치 업데이트 완료');
        
    } catch (error) {
        console.error('[RankMember] ❌ 가중치 업데이트 실패:', error);
        
        showWeightUpdateNotification(`의원 랭킹 업데이트 실패: ${error.message}`, 'error', 6000);
        
        // 실패 응답 전송
        sendUpdateResponse(eventData, false, error.message);
        
    } finally {
        pageState.isUpdatingFromWeights = false;
        pageState.updateInProgress = false;
        setLoadingState(false);
    }
}

// === 📊 점수 업데이트를 고려한 데이터 로드 ===
async function loadAllDataWithScoreUpdate() {
    try {
        console.log('[RankMember] 📊 점수 업데이트 고려한 데이터 로드 시작...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        // 🎯 핵심: total_score가 포함된 데이터를 우선적으로 로드
        const results = await Promise.allSettled([
            window.APIService.getMemberPerformance(),  // total_score 포함
            window.APIService.getMemberRanking(),      // 순위 정보
            window.APIService.getAllMembers()          // 기본 정보
        ]);
        
        const [performanceResult, rankingResult, membersResult] = results;
        
        // 성과 데이터 처리 (total_score 우선)
        if (performanceResult.status === 'fulfilled' && performanceResult.value) {
            const performanceData = performanceResult.value;
            console.log(`[RankMember] ✅ 의원 성과 데이터 (total_score 포함): ${performanceData.length}명`);
            
            // total_score 기준으로 정렬하여 새로운 순위 생성
            const sortedPerformance = performanceData
                .filter(member => member.total_score !== undefined && member.total_score !== null)
                .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
                .map((member, index) => ({
                    ...member,
                    calculated_rank: index + 1  // 새로 계산된 순위
                }));
            
            pageState.lastScoreData = sortedPerformance;
            
            // 기존 memberList와 병합하여 filteredMembers 생성
            if (membersResult.status === 'fulfilled') {
                pageState.memberList = membersResult.value || [];
            }
            
            // 랭킹 데이터 처리
            if (rankingResult.status === 'fulfilled') {
                pageState.memberRanking = rankingResult.value || [];
            }
            
            // 데이터 병합 및 처리
            mergeAndProcessDataWithScores(sortedPerformance);
            
        } else {
            // 폴백: 기존 방식으로 로드
            console.warn('[RankMember] ⚠️ 성과 데이터 로드 실패, 기존 방식 사용');
            await loadAllData(); // 기존 함수 호출
        }
        
        console.log('[RankMember] ✅ 점수 업데이트 데이터 로드 완료');
        
    } catch (error) {
        console.error('[RankMember] ❌ 점수 업데이트 데이터 로드 실패:', error);
        throw error;
    }
}

// === 📊 점수 기반 데이터 병합 및 처리 ===
function mergeAndProcessDataWithScores(sortedPerformanceData) {
    try {
        console.log('[RankMember] 📊 점수 기반 데이터 병합 시작...');
        
        // 성과 데이터를 기본으로 하여 의원 정보 병합
        pageState.filteredMembers = sortedPerformanceData.map((performanceItem) => {
            const memberName = performanceItem.lawmaker_name || performanceItem.HG_NM || '';
            
            // 기본 의원 정보 찾기
            const memberInfo = pageState.memberList.find(m => m.name === memberName) || {};
            
            // 랭킹 정보 찾기
            const rankingInfo = pageState.memberRanking.find(r => r.HG_NM === memberName) || {};
            
            return {
                rank: performanceItem.calculated_rank || parseInt(rankingInfo.총점_순위) || 999,
                name: memberName,
                party: performanceItem.lawmaker_party || memberInfo.party || '정당 정보 없음',
                contact: memberInfo.phone || '',
                homepage: memberInfo.homepage || '',
                
                // 🎯 새로운 점수 정보
                totalScore: performanceItem.total_score || 0,
                scoreSource: 'updated_performance',
                lastUpdated: new Date().toISOString(),
                
                // 원본 데이터
                originalIndex: performanceItem.calculated_rank - 1,
                _performance: performanceItem,
                _member: memberInfo,
                _ranking: rankingInfo
            };
        });
        
        // 점수가 없는 의원들도 포함 (기존 memberList에서)
        pageState.memberList.forEach((member, index) => {
            const memberName = member.name || '';
            const alreadyExists = pageState.filteredMembers.some(fm => fm.name === memberName);
            
            if (!alreadyExists) {
                const rankingInfo = pageState.memberRanking.find(r => r.HG_NM === memberName) || {};
                
                pageState.filteredMembers.push({
                    rank: parseInt(rankingInfo.총점_순위) || (1000 + index),
                    name: memberName,
                    party: member.party || '정당 정보 없음',
                    contact: member.phone || '',
                    homepage: member.homepage || '',
                    totalScore: 0,
                    scoreSource: 'fallback',
                    originalIndex: index,
                    _member: member,
                    _ranking: rankingInfo
                });
            }
        });
        
        // 정렬 적용
        applySorting();
        
        // 필터 적용
        applyFilter();
        
        // 페이지네이션 계산
        calculatePagination();
        
        // 테이블 렌더링
        renderTable();
        
        console.log(`[RankMember] ✅ 점수 기반 데이터 병합 완료: ${pageState.filteredMembers.length}명`);
        
        // 점수 업데이트 통계 표시
        const scoreUpdatedCount = pageState.filteredMembers.filter(m => m.scoreSource === 'updated_performance').length;
        console.log(`[RankMember] 📊 업데이트된 점수: ${scoreUpdatedCount}명`);
        
        // UI에 업데이트 정보 표시
        showScoreUpdateInfo(scoreUpdatedCount);
        
    } catch (error) {
        console.error('[RankMember] ❌ 점수 기반 데이터 병합 실패:', error);
        // 폴백: 기존 방식으로 처리
        mergeAndProcessData();
    }
}

// === 📊 점수 업데이트 정보 표시 ===
function showScoreUpdateInfo(updatedCount) {
    try {
        let infoElement = document.getElementById('score-update-info');
        if (!infoElement) {
            infoElement = document.createElement('div');
            infoElement.id = 'score-update-info';
            infoElement.style.cssText = `
                margin: 10px 0; padding: 10px 15px; background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white; border-radius: 8px; font-size: 13px; text-align: center;
                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2); animation: slideIn 0.5s ease-out;
            `;
            
            const tableContainer = document.querySelector('.main') || document.body;
            const table = document.querySelector('.member-table');
            if (table && table.parentNode) {
                table.parentNode.insertBefore(infoElement, table);
            } else {
                tableContainer.appendChild(infoElement);
            }
        }
        
        infoElement.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
                <span>🎯</span>
                <span><strong>${updatedCount}명</strong>의 의원 점수가 새로운 가중치로 업데이트되었습니다!</span>
                <span style="font-size: 11px; opacity: 0.8;">${new Date().toLocaleTimeString('ko-KR')}</span>
            </div>
        `;
        
        // 애니메이션 스타일 추가
        if (!document.getElementById('score-update-styles')) {
            const style = document.createElement('style');
            style.id = 'score-update-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 10초 후 자동 숨김
        setTimeout(() => {
            if (infoElement.parentNode) {
                infoElement.style.opacity = '0';
                infoElement.style.transform = 'translateY(-10px)';
                setTimeout(() => infoElement.remove(), 300);
            }
        }, 10000);
        
    } catch (error) {
        console.warn('[RankMember] 점수 업데이트 정보 표시 실패:', error);
    }
}

// === 📤 업데이트 응답 전송 ===
function sendUpdateResponse(originalEvent, success, errorMessage = null) {
    try {
        const response = {
            page: 'rank_member.html',
            timestamp: new Date().toISOString(),
            success: success,
            source: 'rank_member_response',
            originalEventId: originalEvent.updateId || 'unknown',
            updatedMemberCount: pageState.filteredMembers.length,
            scoreUpdatedCount: pageState.filteredMembers.filter(m => m.scoreSource === 'updated_performance').length,
            errorMessage: errorMessage
        };
        
        // localStorage 응답 (percent 페이지가 확인)
        localStorage.setItem('weight_refresh_response', JSON.stringify(response));
        
        // BroadcastChannel 응답
        if (pageState.realTimeUpdateChannel) {
            pageState.realTimeUpdateChannel.postMessage({
                type: 'update_response',
                ...response
            });
        }
        
        console.log('[RankMember] 📤 업데이트 응답 전송:', response);
        
    } catch (error) {
        console.warn('[RankMember] 업데이트 응답 전송 실패:', error);
    }
}

// === 🔔 가중치 업데이트 전용 알림 시스템 ===
function showWeightUpdateNotification(message, type = 'info', duration = 4000) {
    try {
        // 기존 가중치 알림 제거
        const existingNotification = document.querySelector('.weight-update-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = 'weight-update-notification';
        notification.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            padding: 15px 25px; border-radius: 10px; z-index: 10001; font-size: 14px;
            max-width: 500px; box-shadow: 0 6px 20px rgba(0,0,0,0.15);
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
        let statusElement = document.getElementById('weight-sync-status');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'weight-sync-status';
            statusElement.style.cssText = `
                position: fixed; top: 10px; right: 10px; z-index: 1000;
                padding: 8px 12px; background: rgba(59, 130, 246, 0.9); color: white;
                border-radius: 20px; font-size: 11px; font-weight: 500;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1); backdrop-filter: blur(4px);
                transition: all 0.3s ease; font-family: 'Blinker', sans-serif;
            `;
            document.body.appendChild(statusElement);
        }
        
        if (pageState.percentPageConnected && pageState.weightSyncEnabled) {
            statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
            statusElement.innerHTML = '🔗 가중치 실시간 연동됨';
        } else if (pageState.weightSyncEnabled) {
            statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
            statusElement.innerHTML = '⏳ percent 페이지 연결 대기';
        } else {
            statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
            statusElement.innerHTML = '📴 가중치 연동 비활성화';
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

// 로딩 상태 관리 (개선된 버전)
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

// === 🚀 기존 API 데이터 로드 함수 (일부 수정) ===
async function loadAllData() {
    try {
        setLoadingState(true);
        console.log('[RankMember] 🚀 데이터 로드 시작...');
        
        if (!window.APIService || !window.APIService._isReady) {
            throw new Error('API 서비스가 준비되지 않았습니다.');
        }
        
        const results = await Promise.allSettled([
            window.APIService.getAllMembers(),
            window.APIService.getMemberRanking()
        ]);
        
        const [membersResult, rankingResult] = results;
        
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
        
        mergeAndProcessData();
        
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

// 데이터 병합 및 처리
function mergeAndProcessData() {
    try {
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
        
        applySorting();
        applyFilter();
        calculatePagination();
        renderTable();
        
        console.log(`[RankMember] 📊 데이터 처리 완료: ${pageState.filteredMembers.length}명`);
        
    } catch (error) {
        console.error('[RankMember] ❌ 데이터 처리 실패:', error);
        pageState.filteredMembers = [];
        renderTable();
    }
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
                ${member.scoreSource === 'updated_performance' ? 
                    '<span style="color: #10b981; font-size: 10px; margin-left: 5px;" title="가중치 업데이트됨">🎯</span>' : ''
                }
            </td>
            <td>
                <a href="percent_member.html?member=${encodeURIComponent(member.name)}" 
                   class="member-name">${member.name}</a>
                ${member.totalScore ? 
                    `<div style="font-size: 11px; color: #059669; margin-top: 2px;">점수: ${member.totalScore.toFixed(1)}</div>` : ''
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
    
    mergeAndProcessData();
    
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
            
            mergeAndProcessData();
            
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
            
            mergeAndProcessData();
            
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

// === 🔄 WeightSync 호환 함수들 (강화된 버전) ===
async function refreshMemberRankingData() {
    console.log('[RankMember] 🔄 의원 랭킹 데이터 새로고침...');
    try {
        await loadAllDataWithScoreUpdate();
        showNotification('의원 랭킹 데이터가 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error('[RankMember] ❌ 새로고침 실패:', error);
        showNotification('데이터 새로고침에 실패했습니다.', 'error');
    }
}

async function refreshMemberDetails() {
    return await refreshMemberRankingData();
}

async function loadMemberData() {
    return await loadAllDataWithScoreUpdate();
}

async function updateMemberRanking() {
    return await refreshMemberRankingData();
}

async function fetchMemberData() {
    return await loadAllDataWithScoreUpdate();
}

// 🎯 새로운 점수 변경 감지 함수
async function detectMemberScoreChanges(newData = null) {
    console.log('[RankMember] 🎯 의원 점수 변경 감지 함수 실행...');
    
    if (newData && newData.scoreFieldsUpdated && newData.scoreFieldsUpdated.includes('total_score')) {
        console.log('[RankMember] 📊 total_score 필드 업데이트 감지');
        await loadAllDataWithScoreUpdate();
        showWeightUpdateNotification('의원 total_score가 업데이트되었습니다!', 'success');
    } else {
        await refreshMemberRankingData();
    }
}

// === 🚀 페이지 초기화 (강화된 버전) ===
async function initializePage() {
    try {
        console.log('[RankMember] 🚀 실시간 가중치 연동 의원 랭킹 페이지 초기화... (v2.2.0)');
        
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
window.refreshMemberDetails = refreshMemberDetails;
window.loadMemberData = loadMemberData;
window.updateMemberRanking = updateMemberRanking;
window.fetchMemberData = fetchMemberData;
window.detectMemberScoreChanges = detectMemberScoreChanges;

// 🎯 강제 가중치 업데이트 함수 (개발자/테스트용)
window.forceWeightUpdate = function(testData = null) {
    const eventData = testData || {
        type: 'weights_updated_v2',
        timestamp: new Date().toISOString(),
        source: 'manual_test',
        serverProcessed: true
    };
    
    handleWeightUpdate(eventData);
};

// === 🛠️ 디버그 함수들 (강화된 버전) ===
window.rankMemberDebug = {
    getState: () => pageState,
    refreshData: () => refreshMemberRankingData(),
    reloadData: () => loadAllDataWithScoreUpdate(),
    testWeightUpdate: () => window.forceWeightUpdate(),
    
    showInfo: () => {
        console.log('[RankMember] 📊 페이지 정보 (v2.2.0):');
        console.log(`- 전체 의원: ${pageState.memberList.length}명`);
        console.log(`- 필터된 의원: ${pageState.filteredMembers.length}명`);
        console.log(`- 현재 페이지: ${pageState.currentPage}/${pageState.totalPages}`);
        console.log(`- 정렬: ${pageState.currentSort}`);
        console.log(`- 필터: ${pageState.currentFilter}`);
        console.log(`- 검색: "${pageState.searchQuery}"`);
        console.log(`- 랭킹 데이터: ${pageState.memberRanking.length}개`);
        console.log(`- API 연결: ${window.APIService?._isReady ? '✅' : '❌'}`);
        console.log(`- 가중치 연동: ${pageState.weightSyncEnabled ? '✅' : '❌'}`);
        console.log(`- percent 페이지 연결: ${pageState.percentPageConnected ? '✅' : '❌'}`);
        console.log(`- 마지막 가중치 업데이트: ${pageState.lastWeightUpdate || '없음'}`);
        console.log(`- 점수 업데이트된 의원: ${pageState.filteredMembers.filter(m => m.scoreSource === 'updated_performance').length}명`);
    },
    
    testConnection: () => {
        checkPercentPageConnection();
        console.log('[RankMember] percent 페이지 연결 테스트 전송');
    },
    
    simulateScoreUpdate: () => {
        const testData = {
            type: 'weights_updated_v2',
            timestamp: new Date().toISOString(),
            source: 'debug_simulation',
            serverProcessed: true,
            scoreFieldsUpdated: ['total_score']
        };
        handleWeightUpdate(testData);
    }
};

// DOM 로드 완료 후 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('[RankMember] 📄 DOM 로드 완료 (v2.2.0 - 실시간 가중치 연동)');
    
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

console.log('[RankMember] 📦 rank_member.js 로드 완료 (v2.2.0 - 실시간 가중치 연동)');
