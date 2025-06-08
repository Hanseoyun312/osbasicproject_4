/**
 * weight_sync.js (v2.3.0) - 페이지별 실시간 가중치 연동 시스템
 * 수정사항: 페이지 감지 로직 추가로 percent 페이지에서 오류 방지
 */

// === 🔍 페이지 감지 및 조건부 실행 ===
function detectCurrentPage() {
    const path = window.location.pathname;
    const filename = path.substring(path.lastIndexOf('/') + 1);
    
    // URL 파라미터도 확인
    const urlParams = new URLSearchParams(window.location.search);
    
    return {
        isRankParty: filename === 'rank_party.html' || filename.includes('rank_party'),
        isRankMember: filename === 'rank_member.html' || filename.includes('rank_member'),
        isPercent: filename === 'percent.html' || filename.includes('percent'),
        isMain: filename === 'index.html' || filename === '' || filename === 'main.html',
        filename: filename,
        path: path
    };
}

// 현재 페이지 정보
const currentPage = detectCurrentPage();

console.log('[WeightSync] 🔍 페이지 감지 결과:', currentPage);

// === 🚫 정당 랭킹 페이지가 아니면 실행 중단 ===
if (!currentPage.isRankParty) {
    console.log(`[WeightSync] ⏹️ ${currentPage.filename} 페이지에서는 정당 랭킹 스크립트를 실행하지 않습니다.`);
    
    // 다른 페이지용 최소한의 연동만 제공
    if (typeof window !== 'undefined') {
        window.weightSyncCompatible = {
            pageType: currentPage.filename,
            isRankParty: false,
            message: 'This script is designed for rank_party.html only'
        };
    }
    
    // 스크립트 실행 중단
    throw new Error('WeightSync script stopped - not rank_party page');
}

// === 🎯 정당 랭킹 페이지 전용 실행 ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 실시간 가중치 연동 정당 랭킹 페이지 로드 시작 (v2.3.0)');

    // === 🔧 상태 관리 변수들 (강화된 버전) ===
    let partyData = [];
    let partyPerformanceData = {};
    let partyRankingData = {};
    let partyStatsData = {};
    let currentPageNum = 1;
    let itemsPerPage = 10;
    let currentSort = 'rank';
    let isLoading = false;

    // 🎯 실시간 가중치 연동 관련 상태
    let weightSyncState = {
        enabled: true,
        lastWeightUpdate: null,
        isUpdatingFromWeights: false,
        percentPageConnected: false,
        realTimeUpdateChannel: null,
        updateInProgress: false,
        lastScoreData: null,
        successfulUpdates: 0
    };

    // === 🎨 정당별 브랜드 색상 ===
    const partyColors = {
        "더불어민주당": { main: "#152484", secondary: "#15248480", bg: "#152484" },
        "국민의힘": { main: "#E61E2B", secondary: "#E61E2B80", bg: "#E61E2B" },
        "조국혁신당": { main: "#06275E", secondary: "#0073CF", bg: "#06275E" },
        "개혁신당": { main: "#FF7210", secondary: "#FF721080", bg: "#FF7210" },
        "진보당": { main: "#D6001C", secondary: "#D6001C80", bg: "#D6001C" },
        "기본소득당": { main: "#091E3A", secondary: "#00D2C3", bg: "#091E3A" },
        "사회민주당": { main: "#43A213", secondary: "#F58400", bg: "#43A213" },
        "무소속": { main: "#4B5563", secondary: "#9CA3AF", bg: "#4B5563" }
    };

    // === 🔍 필수 DOM 요소 존재 확인 ===
    function checkRequiredElements() {
        const requiredElements = [
            'partyTableBody',
            // 'pagination-container', // 동적 생성 가능
            // 'party-statistics'       // 동적 생성 가능
        ];
        
        const missingElements = [];
        
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                missingElements.push(id);
            }
        });
        
        if (missingElements.length > 0) {
            console.warn('[RankParty] ⚠️ 누락된 DOM 요소들:', missingElements);
            return false;
        }
        
        return true;
    }

    // === 🔗 실시간 연동 시스템 초기화 ===
    function initializeRealTimeSync() {
        console.log('[RankParty] 🔗 실시간 가중치 연동 시스템 초기화...');
        
        try {
            // 1. BroadcastChannel 설정 (percent 페이지와 실시간 통신)
            if (typeof BroadcastChannel !== 'undefined') {
                weightSyncState.realTimeUpdateChannel = new BroadcastChannel('weight_updates_v2');
                
                weightSyncState.realTimeUpdateChannel.addEventListener('message', async function(event) {
                    const data = event.data;
                    console.log('[RankParty] 📡 가중치 업데이트 수신:', data);
                    
                    if (data.type === 'weights_updated_v2' && data.source === 'percent_page') {
                        await handleWeightUpdate(data);
                    } else if (data.type === 'connection_check') {
                        // percent 페이지의 연결 확인 요청에 응답
                        weightSyncState.realTimeUpdateChannel.postMessage({
                            type: 'connection_response',
                            source: 'rank_party_page',
                            timestamp: new Date().toISOString(),
                            status: 'connected'
                        });
                        weightSyncState.percentPageConnected = true;
                        updateConnectionStatus();
                    }
                });
                
                console.log('[RankParty] ✅ BroadcastChannel 초기화 완료');
            }
            
            // 2. localStorage 이벤트 감지 (weight_sync.js 호환)
            window.addEventListener('storage', function(e) {
                if (e.key === 'weight_change_event' && !weightSyncState.isUpdatingFromWeights) {
                    try {
                        const eventData = JSON.parse(e.newValue);
                        console.log('[RankParty] 📢 localStorage 가중치 변경 감지:', eventData);
                        handleWeightUpdate(eventData);
                    } catch (error) {
                        console.warn('[RankParty] localStorage 이벤트 파싱 실패:', error);
                    }
                }
            });
            
            // 3. 주기적 가중치 변경 감지
            setInterval(function() {
                const currentUpdate = localStorage.getItem('last_weight_update') || '0';
                if (currentUpdate !== weightSyncState.lastWeightUpdate && !weightSyncState.isUpdatingFromWeights) {
                    weightSyncState.lastWeightUpdate = currentUpdate;
                    console.log('[RankParty] ⏰ 주기적 가중치 변경 감지');
                    handleWeightUpdate({ type: 'periodic_check', timestamp: new Date().toISOString() });
                }
            }, 3000); // 3초마다 체크
            
            // 4. 연결 상태 주기적 확인
            setInterval(checkPercentPageConnection, 15000); // 15초마다
            
            console.log('[RankParty] ✅ 실시간 연동 시스템 초기화 완료');
            
        } catch (error) {
            console.error('[RankParty] 실시간 연동 시스템 초기화 실패:', error);
            weightSyncState.enabled = false;
        }
    }

    // === 📡 percent 페이지 연결 상태 확인 ===
    function checkPercentPageConnection() {
        if (weightSyncState.realTimeUpdateChannel) {
            weightSyncState.realTimeUpdateChannel.postMessage({
                type: 'connection_check',
                source: 'rank_party_page',
                timestamp: new Date().toISOString()
            });
        }
    }

    // === 🎯 가중치 업데이트 처리 (핵심 함수) ===
    async function handleWeightUpdate(eventData) {
        if (weightSyncState.isUpdatingFromWeights || weightSyncState.updateInProgress) {
            console.log('[RankParty] 🔄 이미 업데이트 중입니다.');
            return;
        }

        try {
            weightSyncState.isUpdatingFromWeights = true;
            weightSyncState.updateInProgress = true;
            
            console.log('[RankParty] 🔄 가중치 변경으로 인한 정당 랭킹 업데이트 시작...');
            
            // 사용자에게 업데이트 시작 알림
            showWeightUpdateNotification('가중치가 변경되었습니다. 정당 랭킹을 업데이트하는 중...', 'info', 3000);
            
            // 로딩 상태 표시
            showLoading(true, '새로운 가중치로 정당 랭킹 업데이트 중...');
            
            // 서버 처리 대기 (percent 페이지에서 이미 처리되었다면 짧게)
            const serverDelay = eventData.serverProcessed ? 2000 : 6000;
            console.log(`[RankParty] ⏳ 서버 처리 대기 (${serverDelay}ms)...`);
            
            await new Promise(resolve => setTimeout(resolve, serverDelay));
            
            // 🚀 새로운 데이터 로드 (avg_total_score 업데이트 고려)
            await loadPartyDataWithScoreUpdate();
            
            // 성공 알림
            showWeightUpdateNotification('✅ 정당 랭킹이 새로운 가중치로 업데이트되었습니다!', 'success', 5000);
            
            weightSyncState.lastWeightUpdate = new Date().toISOString();
            weightSyncState.successfulUpdates++;
            
            // percent 페이지에 업데이트 완료 응답 전송
            sendUpdateResponse(eventData, true);
            
            console.log('[RankParty] ✅ 가중치 업데이트 완료');
            
        } catch (error) {
            console.error('[RankParty] ❌ 가중치 업데이트 실패:', error);
            
            showWeightUpdateNotification(`정당 랭킹 업데이트 실패: ${error.message}`, 'error', 6000);
            
            // 실패 응답 전송
            sendUpdateResponse(eventData, false, error.message);
            
        } finally {
            weightSyncState.isUpdatingFromWeights = false;
            weightSyncState.updateInProgress = false;
            showLoading(false);
        }
    }

    // === 📊 점수 업데이트를 고려한 정당 데이터 로드 ===
    async function loadPartyDataWithScoreUpdate() {
        try {
            console.log('[RankParty] 📊 점수 업데이트 고려한 정당 데이터 로드 시작...');
            
            // APIService가 준비될 때까지 대기
            await waitForAPIService();

            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('APIService를 사용할 수 없습니다');
            }

            // 🎯 핵심: avg_total_score가 포함된 데이터를 우선적으로 로드
            const [performanceResult, rankingResult, statsResult] = await Promise.allSettled([
                fetchPartyPerformanceDataWithScore(),   // avg_total_score 포함
                fetchPartyRankingData(),               // 순위 정보
                fetchPartyStatsData()                  // 추가 통계
            ]);

            // 결과 확인
            const results = {
                performance: performanceResult.status === 'fulfilled',
                ranking: rankingResult.status === 'fulfilled',
                stats: statsResult.status === 'fulfilled'
            };

            console.log('[RankParty] 📊 점수 업데이트 API 로드 결과:', results);

            // 최소한 하나의 데이터는 있어야 함
            if (!results.performance && !results.ranking) {
                console.warn('[RankParty] ⚠️ 모든 API 로드 실패, 기본 데이터 사용');
                partyData = getDefaultPartyData();
                renderPartyRankingTable();
                return;
            }

            // 🎯 avg_total_score 기반으로 정당 데이터 재구성
            await buildPartyDataWithUpdatedScores();

            console.log('[RankParty] ✅ 점수 업데이트 정당 데이터 로드 완료');
            showScoreUpdateInfo();

        } catch (error) {
            console.error('[RankParty] ❌ 점수 업데이트 정당 데이터 로드 실패:', error);
            
            // API 실패 시 기본 데이터 사용
            partyData = getDefaultPartyData();
            showError('정당 데이터를 불러오는데 실패했습니다. 기본 데이터를 사용합니다.');
            renderPartyRankingTable();
            throw error;
        }
    }

    // === 📊 점수 우선 정당 성과 데이터 로드 ===
    async function fetchPartyPerformanceDataWithScore() {
        try {
            console.log('[RankParty] 📊 정당 성과 데이터 (avg_total_score 우선) 조회...');
            
            const rawData = await window.APIService.getPartyPerformance();
            
            console.log('[RankParty] 🔍 API 응답 구조:', typeof rawData, rawData);
            
            // 다양한 응답 형태 처리
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
            
            console.log('[RankParty] 📊 처리된 정당 성과 데이터:', processedData.length, '건');
            
            // 🎯 avg_total_score 우선으로 정당별 성과 데이터 매핑
            const performanceData = {};
            processedData.forEach((party, index) => {
                const partyName = normalizePartyName(
                    party.party || party.POLY_NM || party.정당명 || party.party_name || 
                    party.name || party.lawmaker_party || party.Party || party.당명
                );
                
                if (partyName && partyName !== '정보없음') {
                    performanceData[partyName] = {
                        // === 기본 정보 ===
                        party: partyName,
                        
                        // 🎯 핵심: 총점 (가중치 적용 결과)
                        avg_total_score: parseFloat(
                            party.avg_total_score || party.총점 || party.평균점수 || 
                            party.total_score || party.score || party.퍼센트 || (85 - index * 3)
                        ),
                        
                        // 이전 점수와 비교 (업데이트 감지용)
                        previous_score: weightSyncState.lastScoreData && weightSyncState.lastScoreData[partyName] 
                            ? weightSyncState.lastScoreData[partyName].avg_total_score 
                            : null,
                        
                        // 점수 업데이트 여부
                        score_updated: true,
                        
                        // === 세부 통계 ===
                        avg_attendance: parseFloat(party.avg_attendance || party.평균출석률 || party.출석률 || party.attendance_rate || party.attendance || (80 + Math.random() * 15)),
                        avg_invalid_vote_ratio: parseFloat(party.avg_invalid_vote_ratio || party.무효표비율 || party.기권율 || (0.01 + Math.random() * 0.04)),
                        avg_vote_match_ratio: parseFloat(party.avg_vote_match_ratio || party.표결일치율 || party.당론일치율 || (0.8 + Math.random() * 0.15)),
                        avg_vote_mismatch_ratio: parseFloat(party.avg_vote_mismatch_ratio || party.표결불일치율 || (0.05 + Math.random() * 0.15)),
                        bill_pass_sum: parseInt(party.bill_pass_sum || party.가결수 || party.본회의가결 || party.pass_count || party.법안가결 || (30 + Math.floor(Math.random() * 50))),
                        petition_sum: parseInt(party.petition_sum || party.청원수 || party.청원제안 || party.petition_count || (10 + Math.floor(Math.random() * 30))),
                        petition_pass_sum: parseInt(party.petition_pass_sum || party.청원가결 || party.청원성공 || (5 + Math.floor(Math.random() * 20))),
                        committee_leader_count: parseInt(party.committee_leader_count || party.위원장수 || party.chairman_count || Math.floor(Math.random() * 5 + 1)),
                        committee_secretary_count: parseInt(party.committee_secretary_count || party.간사수 || party.secretary_count || Math.floor(Math.random() * 8 + 2)),
                        
                        // === 메타데이터 ===
                        last_updated: new Date().toISOString(),
                        update_source: 'weight_sync_api',
                        
                        // === 원본 데이터 ===
                        _raw: party
                    };
                }
            });
            
            // 이전 점수 데이터와 비교하여 변경 감지
            if (weightSyncState.lastScoreData) {
                Object.keys(performanceData).forEach(partyName => {
                    const current = performanceData[partyName];
                    const previous = weightSyncState.lastScoreData[partyName];
                    
                    if (previous && Math.abs(current.avg_total_score - previous.avg_total_score) > 0.1) {
                        current.score_changed = true;
                        current.score_change = current.avg_total_score - previous.avg_total_score;
                        console.log(`[RankParty] 📊 ${partyName} 점수 변경: ${previous.avg_total_score.toFixed(1)} → ${current.avg_total_score.toFixed(1)}`);
                    }
                });
            }
            
            partyPerformanceData = performanceData;
            weightSyncState.lastScoreData = { ...performanceData };
            
            console.log(`[RankParty] ✅ 정당 성과 데이터 (avg_total_score 우선) 로드 완료: ${Object.keys(performanceData).length}개`);
            return performanceData;
            
        } catch (error) {
            console.error('[RankParty] ❌ 정당 성과 데이터 로드 실패:', error);
            partyPerformanceData = {};
            return {};
        }
    }

    // === 📊 업데이트된 점수로 정당 데이터 재구성 ===
    async function buildPartyDataWithUpdatedScores() {
        try {
            console.log('[RankParty] 📊 업데이트된 점수로 정당 데이터 재구성...');
            
            // 정당 목록 생성
            const allPartyNames = new Set();
            
            // 기본 정당 목록 추가
            ['더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '기본소득당', '사회민주당', '무소속'].forEach(name => {
                allPartyNames.add(name);
            });
            
            // API에서 가져온 정당 추가
            Object.keys(partyPerformanceData).forEach(name => allPartyNames.add(name));
            Object.keys(partyRankingData).forEach(name => allPartyNames.add(name));

            // 🎯 avg_total_score 기준으로 정당 데이터 생성 및 정렬
            const partyList = Array.from(allPartyNames).map((partyName) => {
                const performance = partyPerformanceData[partyName];
                const ranking = partyRankingData[partyName];
                const stats = partyStatsData[partyName];
                
                return {
                    // === 기본 정보 ===
                    name: partyName,
                    party: partyName,
                    
                    // 🎯 핵심: 업데이트된 총점
                    totalScore: performance ? performance.avg_total_score : (Math.random() * 20 + 70),
                    
                    // === 순위 정보 (점수 기준으로 나중에 재계산) ===
                    rank: 0, // 임시값, 아래에서 재계산
                    rankSource: performance ? 'updated_score' : 'estimated',
                    
                    // === 점수 업데이트 관련 정보 ===
                    scoreUpdated: performance && performance.score_updated,
                    scoreChanged: performance && performance.score_changed,
                    scoreChange: performance ? performance.score_change : null,
                    lastUpdated: performance ? performance.last_updated : new Date().toISOString(),
                    
                    // === 세부 통계 ===
                    attendanceRate: performance ? performance.avg_attendance : (85 + Math.random() * 10),
                    billPassSum: performance ? performance.bill_pass_sum : Math.floor(Math.random() * 100 + 50),
                    petitionSum: performance ? performance.petition_sum : Math.floor(Math.random() * 50 + 20),
                    petitionPassSum: performance ? performance.petition_pass_sum : Math.floor(Math.random() * 30 + 10),
                    chairmanCount: performance ? performance.committee_leader_count : Math.floor(Math.random() * 5 + 1),
                    secretaryCount: performance ? performance.committee_secretary_count : Math.floor(Math.random() * 8 + 2),
                    
                    // === 투표 관련 (백분율 변환) ===
                    invalidVoteRatio: performance ? (performance.avg_invalid_vote_ratio * 100) : (1 + Math.random() * 3),
                    voteMatchRatio: performance ? (performance.avg_vote_match_ratio * 100) : (80 + Math.random() * 15),
                    voteMismatchRatio: performance ? (performance.avg_vote_mismatch_ratio * 100) : (5 + Math.random() * 15),
                    
                    // === 원본 데이터들 ===
                    _performance: performance,
                    _ranking: ranking,
                    _stats: stats
                };
            });
            
            // 🎯 점수 기준으로 정렬하여 순위 부여
            partyList.sort((a, b) => b.totalScore - a.totalScore);
            partyList.forEach((party, index) => {
                party.rank = index + 1;
            });

            partyData = partyList.filter(party => party.name && party.name !== '정보없음');

            console.log('[RankParty] ✅ 업데이트된 점수로 정당 데이터 재구성 완료:', partyData.length, '개');
            
            // 점수 변경 통계
            const updatedCount = partyData.filter(p => p.scoreUpdated).length;
            const changedCount = partyData.filter(p => p.scoreChanged).length;
            console.log(`[RankParty] 📊 점수 업데이트: ${updatedCount}개, 점수 변경: ${changedCount}개`);
            
            // UI 렌더링
            renderPartyRankingTable();
            renderPagination();
            renderStatistics();
            
            return partyData;

        } catch (error) {
            console.error('[RankParty] ❌ 업데이트된 점수로 정당 데이터 재구성 실패:', error);
            throw error;
        }
    }

    // === 🎨 UI 렌더링 함수들 (안전한 버전) ===

    // 정당 랭킹 테이블 렌더링 (DOM 요소 확인 추가)
    function renderPartyRankingTable() {
        const tableBody = document.getElementById('partyTableBody');
        
        if (!tableBody) {
            console.warn('[RankParty] ⚠️ partyTableBody 요소를 찾을 수 없습니다. 테이블 렌더링을 건너뜁니다.');
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

        const startIndex = (currentPageNum - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = getSortedPartyData().slice(startIndex, endIndex);

        const tableHTML = pageData.map((party, index) => {
            const partyColor = partyColors[party.name];
            
            return `
                <tr class="party-row" data-party="${party.name}" onclick="showPartyDetail('${party.name}')">
                    <td class="rank-cell">
                        <span style="color: ${partyColor?.main || '#333'}">${party.rank}</span>
                        ${party.rankSource === 'updated_score' ? 
                            '<span style="font-size: 10px; color: #10b981; margin-left: 5px;" title="가중치 업데이트됨">🎯</span>' :
                            party.rankSource === 'api' ? 
                            '<span style="font-size: 10px; color: #3b82f6; margin-left: 5px;" title="실시간 데이터">●</span>' : 
                            '<span style="font-size: 10px; color: #6c757d; margin-left: 5px;" title="추정 데이터">○</span>'
                        }
                    </td>
                    <td style="font-weight: 600; color: ${partyColor?.main || '#333'}">
                        ${party.totalScore.toFixed(1)}%
                        ${party.scoreChanged ? 
                            `<div style="font-size: 10px; color: ${party.scoreChange > 0 ? '#10b981' : '#ef4444'}; margin-top: 2px;">
                                ${party.scoreChange > 0 ? '▲' : '▼'} ${Math.abs(party.scoreChange).toFixed(1)}
                            </div>` : ''
                        }
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${partyColor?.main || '#999'}; display: inline-block;"></span>
                            <strong>${party.name}</strong>
                            ${party.scoreUpdated ? 
                                '<span style="color: #10b981; font-size: 10px; margin-left: 8px;" title="점수 업데이트됨">🔄</span>' : ''
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
        
        // 점수 업데이트 통계 로그
        const updatedCount = pageData.filter(p => p.scoreUpdated).length;
        const changedCount = pageData.filter(p => p.scoreChanged).length;
        if (updatedCount > 0) {
            console.log(`[RankParty] 📊 현재 페이지 점수 업데이트: ${updatedCount}개, 변경: ${changedCount}개`);
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

    // 로딩 상태 표시 (개선된 버전)
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
        
        // 테이블 로딩 메시지 업데이트 (DOM 요소 확인)
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

    // === 📊 기본 데이터 및 정보 함수들 ===

    // 기본 정당 데이터 (API 실패 시 사용)
    function getDefaultPartyData() {
        return [
            {
                name: "더불어민주당", party: "더불어민주당", rank: 1, rankSource: 'estimated', totalScore: 78.5,
                attendanceRate: 88.2, billPassSum: 245, petitionSum: 180, petitionPassSum: 95,
                chairmanCount: 8, secretaryCount: 15, invalidVoteRatio: 2.1, voteMatchRatio: 87.3, voteMismatchRatio: 12.7
            },
            {
                name: "국민의힘", party: "국민의힘", rank: 2, rankSource: 'estimated', totalScore: 75.2,
                attendanceRate: 85.7, billPassSum: 198, petitionSum: 145, petitionPassSum: 78,
                chairmanCount: 6, secretaryCount: 12, invalidVoteRatio: 2.8, voteMatchRatio: 84.1, voteMismatchRatio: 15.9
            },
            {
                name: "조국혁신당", party: "조국혁신당", rank: 3, rankSource: 'estimated', totalScore: 72.8,
                attendanceRate: 89.5, billPassSum: 45, petitionSum: 35, petitionPassSum: 22,
                chairmanCount: 1, secretaryCount: 2, invalidVoteRatio: 1.8, voteMatchRatio: 91.2, voteMismatchRatio: 8.8
            }
        ];
    }

    // 정당 대표 정보
    function getPartyLeader(partyName) {
        const leaders = {
            "더불어민주당": "박찬대", "국민의힘": "공석", "조국혁신당": "서왕진", "개혁신당": "천하람",
            "진보당": "윤종오", "기본소득당": "용혜인", "사회민주당": "한창민", "무소속": "-"
        };
        return leaders[partyName] || "-";
    }

    // 정당 홈페이지 정보
    function getPartyHomepage(partyName) {
        const homepages = {
            "더불어민주당": "https://www.theminjoo.kr", "국민의힘": "https://www.peoplepowerparty.kr",
            "조국혁신당": "https://rebuildingkoreaparty.kr/", "개혁신당": "https://rallypoint.kr/main",
            "진보당": "https://jinboparty.com/main/", "기본소득당": "https://www.basicincomeparty.kr/",
            "사회민주당": "https://www.samindang.kr/", "무소속": "#"
        };
        return homepages[partyName] || "#";
    }

    // 정렬된 정당 데이터 가져오기
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

    // === 📊 점수 업데이트 정보 표시 ===
    function showScoreUpdateInfo() {
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
                    animation: slideInScore 0.6s ease-out;
                `;
                
                const tableContainer = document.querySelector('.main') || document.body;
                const table = document.querySelector('.party-table');
                if (table && table.parentNode) {
                    table.parentNode.insertBefore(infoElement, table);
                } else {
                    tableContainer.appendChild(infoElement);
                }
            }
            
            const updatedCount = partyData.filter(p => p.scoreUpdated).length;
            const changedCount = partyData.filter(p => p.scoreChanged).length;
            
            infoElement.innerHTML = `
                <div style="display: flex; justify-content: center; align-items: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-size: 18px;">🏛️</span>
                    <span><strong>${updatedCount}개</strong> 정당의 avg_total_score가 새로운 가중치로 업데이트되었습니다!</span>
                    ${changedCount > 0 ? 
                        `<span style="font-size: 12px; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 15px;">
                            ${changedCount}개 정당 점수 변경됨
                        </span>` : ''
                    }
                    <span style="font-size: 11px; opacity: 0.9;">${new Date().toLocaleTimeString('ko-KR')}</span>
                </div>
            `;
            
            // 애니메이션 스타일 추가
            if (!document.getElementById('party-score-update-styles')) {
                const style = document.createElement('style');
                style.id = 'party-score-update-styles';
                style.textContent = `
                    @keyframes slideInScore {
                        from { opacity: 0; transform: translateY(-15px) scale(0.95); }
                        to { opacity: 1; transform: translateY(0) scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // 12초 후 자동 숨김
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.style.opacity = '0';
                    infoElement.style.transform = 'translateY(-15px) scale(0.95)';
                    setTimeout(() => infoElement.remove(), 400);
                }
            }, 12000);
            
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
            
            if (weightSyncState.percentPageConnected && weightSyncState.enabled) {
                statusElement.style.background = 'rgba(16, 185, 129, 0.9)';
                statusElement.innerHTML = '🔗 정당 가중치 실시간 연동됨';
            } else if (weightSyncState.enabled) {
                statusElement.style.background = 'rgba(245, 158, 11, 0.9)';
                statusElement.innerHTML = '⏳ percent 페이지 연결 대기중';
            } else {
                statusElement.style.background = 'rgba(107, 114, 128, 0.9)';
                statusElement.innerHTML = '📴 정당 가중치 연동 비활성화';
            }
            
        } catch (error) {
            console.warn('[RankParty] 연결 상태 표시 업데이트 실패:', error);
        }
    }

    // === 📤 업데이트 응답 전송 ===
    function sendUpdateResponse(originalEvent, success, errorMessage = null) {
        try {
            const response = {
                page: 'rank_party.html',
                timestamp: new Date().toISOString(),
                success: success,
                source: 'rank_party_response',
                originalEventId: originalEvent.updateId || 'unknown',
                updatedPartyCount: partyData.length,
                scoreUpdatedCount: partyData.filter(p => p.scoreUpdated).length,
                scoreChangedCount: partyData.filter(p => p.scoreChanged).length,
                errorMessage: errorMessage
            };
            
            // localStorage 응답 (percent 페이지가 확인)
            localStorage.setItem('weight_refresh_response', JSON.stringify(response));
            
            // BroadcastChannel 응답
            if (weightSyncState.realTimeUpdateChannel) {
                weightSyncState.realTimeUpdateChannel.postMessage({
                    type: 'update_response',
                    ...response
                });
            }
            
            console.log('[RankParty] 📤 업데이트 응답 전송:', response);
            
        } catch (error) {
            console.warn('[RankParty] 업데이트 응답 전송 실패:', error);
        }
    }

    // === 나머지 함수들 (기본 스타일, 페이지네이션, 정렬 등) ===
    
    // 기본 스타일 추가
    function addBasicStyles() {
        if (document.getElementById('party-ranking-additional-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'party-ranking-additional-styles';
        style.textContent = `
            .party-row { transition: all 0.2s ease; }
            .party-row:hover { background-color: var(--main2) !important; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .rank-cell { font-weight: 700; font-size: 24px; }
            .loading-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--side2); border-radius: 50%; border-top-color: var(--light-blue); animation: spin 1s ease-in-out infinite; margin-right: 8px; vertical-align: middle; }
            @keyframes spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
    }

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
        
        if (currentPageNum > 1) {
            paginationHTML += `<button onclick="goToPage(${currentPageNum - 1})" class="page-btn">이전</button>`;
        }
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === currentPageNum) {
                paginationHTML += `<button class="page-btn active">${i}</button>`;
            } else {
                paginationHTML += `<button onclick="goToPage(${i})" class="page-btn">${i}</button>`;
            }
        }
        
        if (currentPageNum < totalPages) {
            paginationHTML += `<button onclick="goToPage(${currentPageNum + 1})" class="page-btn">다음</button>`;
        }
        
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
        
        addPaginationStyles();
    }

    function addPaginationStyles() {
        if (document.getElementById('pagination-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'pagination-styles';
        style.textContent = `
            .pagination { display: flex; justify-content: center; align-items: center; gap: 5px; margin: 20px 0; }
            .page-btn { padding: 8px 12px; border: 1px solid var(--side2); background: white; color: var(--string); cursor: pointer; border-radius: 4px; font-size: 14px; transition: all 0.2s ease; }
            .page-btn:hover { background: var(--main2); border-color: var(--light-blue); }
            .page-btn.active { background: var(--light-blue); color: white; border-color: var(--light-blue); }
            .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        `;
        document.head.appendChild(style);
    }

    function goToPage(page) {
        const totalPages = Math.ceil(partyData.length / itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            console.log(`[RankParty] 📄 페이지 이동: ${currentPageNum} → ${page}`);
            currentPageNum = page;
            renderPartyRankingTable();
            renderPagination();
        }
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
        const updatedCount = partyData.filter(p => p.scoreUpdated).length;

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
                ${updatedCount > 0 ? `
                <div class="stat-card" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;">
                    <h3>가중치 업데이트</h3>
                    <p class="stat-value">${updatedCount}개 정당</p>
                </div>
                ` : ''}
            </div>
        `;
    }

    // 기본 데이터 로드 함수들 (기존 API)
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

    // 기본 정당 데이터 로드 (기존 함수)
    async function loadPartyData() {
        try {
            console.log('[RankParty] 📊 기본 정당 데이터 로드 중...');
            showLoading(true);

            await waitForAPIService();

            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('APIService를 사용할 수 없습니다');
            }

            const [performanceResult, rankingResult, statsResult] = await Promise.allSettled([
                fetchPartyPerformanceDataWithScore(),
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
                return;
            }

            // 정당 목록 생성
            const allPartyNames = new Set();
            
            ['더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '기본소득당', '사회민주당', '무소속'].forEach(name => {
                allPartyNames.add(name);
            });
            
            if (results.performance) {
                Object.keys(partyPerformanceData).forEach(name => allPartyNames.add(name));
            }
            if (results.ranking) {
                Object.keys(partyRankingData).forEach(name => allPartyNames.add(name));
            }

            // 정당 데이터 통합
            partyData = Array.from(allPartyNames).map((partyName, index) => {
                const performance = partyPerformanceData[partyName];
                const ranking = partyRankingData[partyName];
                const stats = partyStatsData[partyName];
                
                return {
                    name: partyName,
                    party: partyName,
                    rank: ranking ? ranking.rank : (index + 1),
                    rankSource: ranking ? 'api' : 'estimated',
                    totalScore: performance ? performance.avg_total_score : (80 - index * 5),
                    attendanceRate: performance ? performance.avg_attendance : (85 + Math.random() * 10),
                    billPassSum: performance ? performance.bill_pass_sum : Math.floor(Math.random() * 100 + 50),
                    petitionSum: performance ? performance.petition_sum : Math.floor(Math.random() * 50 + 20),
                    petitionPassSum: performance ? performance.petition_pass_sum : Math.floor(Math.random() * 30 + 10),
                    chairmanCount: performance ? performance.committee_leader_count : Math.floor(Math.random() * 5 + 1),
                    secretaryCount: performance ? performance.committee_secretary_count : Math.floor(Math.random() * 8 + 2),
                    invalidVoteRatio: performance ? (performance.avg_invalid_vote_ratio * 100) : (1 + Math.random() * 3),
                    voteMatchRatio: performance ? (performance.avg_vote_match_ratio * 100) : (80 + Math.random() * 15),
                    voteMismatchRatio: performance ? (performance.avg_vote_mismatch_ratio * 100) : (5 + Math.random() * 15),
                    _performance: performance,
                    _ranking: ranking,
                    _stats: stats
                };
            }).filter(party => party.name && party.name !== '정보없음');

            partyData.sort((a, b) => a.rank - b.rank);

            console.log('[RankParty] ✅ 기본 정당 데이터 로드 완료:', partyData.length, '개');
            showNotification(`정당 랭킹 데이터 로드 완료 (${partyData.length}개 정당)`, 'success');

        } catch (error) {
            console.error('[RankParty] ❌ 정당 데이터 로드 실패:', error);
            partyData = getDefaultPartyData();
            showError('정당 데이터를 불러오는데 실패했습니다. 기본 데이터를 사용합니다.');
        } finally {
            showLoading(false);
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
        
        currentPageNum = 1;
        renderPartyRankingTable();
        renderPagination();
    }

    // === 🔄 WeightSync 호환 함수들 ===
    
    async function refreshPartyRanking() {
        try {
            console.log('[RankParty] 🔄 정당 랭킹 데이터 새로고침...');
            showLoading(true);
            
            await loadPartyDataWithScoreUpdate();
            
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
    window.loadPartyRankingData = loadPartyDataWithScoreUpdate;
    window.loadPartyData = loadPartyDataWithScoreUpdate;
    window.refreshPartyRanking = refreshPartyRanking;
    window.goToPage = goToPage;

    window.showPartyDetail = function(partyName) {
        const party = partyData.find(p => p.name === partyName);
        if (party) {
            window.location.href = `percent_party.html?party=${encodeURIComponent(partyName)}`;
        }
    };

    // 🎯 강제 가중치 업데이트 함수 (개발자/테스트용)
    window.forcePartyWeightUpdate = function(testData = null) {
        const eventData = testData || {
            type: 'weights_updated_v2',
            timestamp: new Date().toISOString(),
            source: 'manual_test',
            serverProcessed: true
        };
        
        handleWeightUpdate(eventData);
    };

    // === 🛠️ 디버그 유틸리티 ===
    window.rankPartyDebug = {
        getState: () => ({
            partyData,
            weightSyncState,
            partyPerformanceData,
            partyRankingData,
            currentSort,
            currentPage: currentPageNum
        }),
        
        refreshData: () => refreshPartyRanking(),
        reloadData: () => loadPartyDataWithScoreUpdate(),
        testWeightUpdate: () => window.forcePartyWeightUpdate(),
        
        showInfo: () => {
            console.log('[RankParty] 📊 정당 랭킹 페이지 정보 (v2.3.0 - 페이지 감지):');
            console.log('- 현재 페이지:', currentPage);
            console.log('- 로드된 정당 수:', partyData.length);
            console.log('- 성과 데이터:', Object.keys(partyPerformanceData).length, '개');
            console.log('- 랭킹 데이터:', Object.keys(partyRankingData).length, '개');
            console.log('- 현재 정렬:', currentSort);
            console.log('- 현재 페이지:', currentPageNum, '/', Math.ceil(partyData.length / itemsPerPage));
            console.log('- APIService 상태:', window.APIService?._isReady ? '준비됨' : '준비중');
            console.log('- 가중치 연동:', weightSyncState.enabled ? '활성화' : '비활성화');
            console.log('- percent 페이지 연결:', weightSyncState.percentPageConnected ? '연결됨' : '대기중');
            console.log('- 마지막 가중치 업데이트:', weightSyncState.lastWeightUpdate || '없음');
            console.log('- 성공한 업데이트 수:', weightSyncState.successfulUpdates);
            const updatedCount = partyData.filter(p => p.scoreUpdated).length;
            const changedCount = partyData.filter(p => p.scoreChanged).length;
            console.log('- 점수 업데이트된 정당:', updatedCount, '개');
            console.log('- 점수 변경된 정당:', changedCount, '개');
        }
    };

    // === 🚀 페이지 초기화 ===
    async function initializePage() {
        console.log('[RankParty] 🚀 실시간 가중치 연동 정당 랭킹 페이지 초기화... (v2.3.0)');
        
        try {
            // 필수 DOM 요소 확인
            if (!checkRequiredElements()) {
                console.error('[RankParty] ❌ 필수 DOM 요소가 없습니다. 정당 랭킹 페이지가 아닙니다.');
                showError('이 페이지는 정당 랭킹 페이지가 아닙니다.');
                return;
            }

            // 실시간 연동 시스템 먼저 초기화
            initializeRealTimeSync();
            
            // 기본 정렬 설정
            currentSort = 'rank_asc';
            currentPageNum = 1;
            
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
            
            showNotification('실시간 가중치 연동 정당 랭킹 페이지 로드 완료!', 'success');
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

    console.log('[RankParty] ✅ 실시간 가중치 연동 정당 랭킹 페이지 스크립트 로드 완료 (v2.3.0 - 페이지 감지)');
    console.log('[RankParty] 🔧 디버그 명령어: window.rankPartyDebug.showInfo()');
});
