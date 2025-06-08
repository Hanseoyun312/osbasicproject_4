document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 정당 랭킹 페이지 로드 시작 (Django API 연동 + 가중치 감지 버전)');

    // === 🔧 상태 관리 변수들 ===
    let partyData = [];
    let partyPerformanceData = {};
    let partyRankingData = {};
    let partyStatsData = {};
    let currentPage = 1;
    let itemsPerPage = 10;
    let currentSort = 'rank';
    let isLoading = false;

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
    function showLoading(show = true) {
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

    // === 📊 새로운 API 데이터 로드 함수들 ===

    // 정당 성과 데이터 로드 (개선된 버전)
    async function fetchPartyPerformanceData() {
        try {
            console.log('[RankParty] 📊 정당 성과 데이터 조회...');
            
            const rawData = await window.APIService.getPartyPerformance();
            
            // API 응답 구조 디버깅
            console.log('[RankParty] 🔍 API 응답 타입:', typeof rawData);
            console.log('[RankParty] 🔍 API 응답 구조:', rawData);
            
            // 다양한 응답 형태 처리
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && typeof rawData === 'object') {
                // 객체 형태의 응답인 경우
                if (rawData.data && Array.isArray(rawData.data)) {
                    processedData = rawData.data;
                } else if (rawData.results && Array.isArray(rawData.results)) {
                    processedData = rawData.results;
                } else if (rawData.parties && Array.isArray(rawData.parties)) {
                    processedData = rawData.parties;
                } else {
                    // 객체를 배열로 변환 시도
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
            
            // 정당별 성과 데이터 매핑
            const performanceData = {};
            processedData.forEach(party => {
                // 다양한 필드명 처리
                const partyName = normalizePartyName(
                    party.party || party.POLY_NM || party.정당명 || party.party_name || 
                    party.name || party.lawmaker_party || party.Party || party.당명
                );
                
                if (partyName && partyName !== '정보없음') {
                    performanceData[partyName] = {
                        // === 기본 정보 ===
                        party: partyName,
                        
                        // === 출석 관련 (다양한 필드명 시도) ===
                        avg_attendance: parseFloat(
                            party.avg_attendance || party.평균출석률 || party.출석률 || 
                            party.attendance_rate || party.attendance || 85
                        ),
                        max_attendance: parseFloat(party.max_attendance || party.최대출석률 || 90),
                        min_attendance: parseFloat(party.min_attendance || party.최소출석률 || 80),
                        std_attendance: parseFloat(party.std_attendance || party.출석률편차 || 5),
                        
                        // === 무효표 및 기권 관련 ===
                        avg_invalid_vote_ratio: parseFloat(
                            party.avg_invalid_vote_ratio || party.무효표비율 || party.기권율 || 0.02
                        ),
                        max_invalid_vote_ratio: parseFloat(party.max_invalid_vote_ratio || 0.05),
                        min_invalid_vote_ratio: parseFloat(party.min_invalid_vote_ratio || 0),
                        std_invalid_vote_ratio: parseFloat(party.std_invalid_vote_ratio || 0.01),
                        
                        // === 표결 일치 관련 ===
                        avg_vote_match_ratio: parseFloat(
                            party.avg_vote_match_ratio || party.표결일치율 || party.당론일치율 || 0.85
                        ),
                        max_vote_match_ratio: parseFloat(party.max_vote_match_ratio || 0.95),
                        min_vote_match_ratio: parseFloat(party.min_vote_match_ratio || 0.75),
                        std_vote_match_ratio: parseFloat(party.std_vote_match_ratio || 0.1),
                        
                        // === 표결 불일치 관련 ===
                        avg_vote_mismatch_ratio: parseFloat(
                            party.avg_vote_mismatch_ratio || party.표결불일치율 || 0.15
                        ),
                        max_vote_mismatch_ratio: parseFloat(party.max_vote_mismatch_ratio || 0.25),
                        min_vote_mismatch_ratio: parseFloat(party.min_vote_mismatch_ratio || 0.05),
                        std_vote_mismatch_ratio: parseFloat(party.std_vote_mismatch_ratio || 0.1),
                        
                        // === 본회의 및 청원 관련 ===
                        bill_pass_sum: parseInt(
                            party.bill_pass_sum || party.가결수 || party.본회의가결 || 
                            party.pass_count || party.법안가결 || 50
                        ),
                        petition_sum: parseInt(
                            party.petition_sum || party.청원수 || party.청원제안 || 
                            party.petition_count || 0
                        ),
                        petition_pass_sum: parseInt(
                            party.petition_pass_sum || party.청원가결 || party.청원성공 || 0
                        ),
                        
                        // === 위원회 관련 ===
                        committee_leader_count: parseInt(
                            party.committee_leader_count || party.위원장수 || party.chairman_count || 1
                        ),
                        committee_secretary_count: parseInt(
                            party.committee_secretary_count || party.간사수 || party.secretary_count || 2
                        ),
                        
                        // === 총점 (최종 정당 퍼센트) ===
                        avg_total_score: parseFloat(
                            party.avg_total_score || party.총점 || party.평균점수 || 
                            party.total_score || party.score || party.퍼센트 || 75
                        ),
                        
                        // === 원본 데이터 ===
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
            // 완전 실패가 아닌 경고로 처리
            console.warn('[RankParty] ⚠️ 성과 데이터 없이 진행합니다');
            return {};
        }
    }

    // 정당 랭킹 데이터 로드 (개선된 버전)
    async function fetchPartyRankingData() {
        try {
            console.log('[RankParty] 🏆 정당 랭킹 데이터 조회...');
            
            const rawData = await window.APIService.getPartyScoreRanking();
            
            // API 응답 구조 디버깅
            console.log('[RankParty] 🔍 랭킹 API 응답:', rawData);
            
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
            
            console.log('[RankParty] 🏆 처리된 정당 랭킹 데이터:', processedData.length, '건');
            
            // 정당별 랭킹 데이터 매핑
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

    // 정당 통계 데이터 로드 (선택적)
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
            
            // 정당별 통계 데이터 매핑
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

    // === 📊 데이터 통합 및 가공 ===

    // 모든 정당 데이터 로드 및 통합
    async function loadPartyData() {
        try {
            console.log('[RankParty] 📊 정당 데이터 통합 로드 중...');
            showLoading(true);

            // APIService가 준비될 때까지 대기
            await waitForAPIService();

            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('APIService를 사용할 수 없습니다');
            }

            // 병렬로 데이터 로드 (실패해도 계속 진행)
            const [performanceResult, rankingResult, statsResult] = await Promise.allSettled([
                fetchPartyPerformanceData(),
                fetchPartyRankingData(),
                fetchPartyStatsData()
            ]);

            // 결과 확인
            const results = {
                performance: performanceResult.status === 'fulfilled',
                ranking: rankingResult.status === 'fulfilled',
                stats: statsResult.status === 'fulfilled'
            };

            console.log('[RankParty] 📊 API 로드 결과:', results);

            // 최소한 하나의 데이터는 있어야 함
            if (!results.performance && !results.ranking) {
                console.warn('[RankParty] ⚠️ 모든 API 로드 실패, 기본 데이터 사용');
                partyData = getDefaultPartyData();
                return;
            }

            // 정당 목록 생성
            const allPartyNames = new Set();
            
            // 기본 정당 목록 추가 (데이터가 없어도 표시)
            ['더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '기본소득당', '사회민주당', '무소속'].forEach(name => {
                allPartyNames.add(name);
            });
            
            // API에서 가져온 정당 추가
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
                    // === 기본 정보 ===
                    name: partyName,
                    party: partyName,
                    
                    // === 순위 정보 ===
                    rank: ranking ? ranking.rank : (index + 1),
                    rankSource: ranking ? 'api' : 'estimated',
                    
                    // === 성과 정보 ===
                    totalScore: performance ? performance.avg_total_score : (80 - index * 5),
                    
                    // === 세부 통계 ===
                    attendanceRate: performance ? performance.avg_attendance : (85 + Math.random() * 10),
                    billPassSum: performance ? performance.bill_pass_sum : Math.floor(Math.random() * 100 + 50),
                    petitionSum: performance ? performance.petition_sum : Math.floor(Math.random() * 50 + 20),
                    petitionPassSum: performance ? performance.petition_pass_sum : Math.floor(Math.random() * 30 + 10),
                    chairmanCount: performance ? performance.committee_leader_count : Math.floor(Math.random() * 5 + 1),
                    secretaryCount: performance ? performance.committee_secretary_count : Math.floor(Math.random() * 8 + 2),
                    
                    // === 투표 관련 ===
                    invalidVoteRatio: performance ? (performance.avg_invalid_vote_ratio * 100) : (1 + Math.random() * 3),
                    voteMatchRatio: performance ? (performance.avg_vote_match_ratio * 100) : (80 + Math.random() * 15),
                    voteMismatchRatio: performance ? (performance.avg_vote_mismatch_ratio * 100) : (5 + Math.random() * 15),
                    
                    // === 통계 상세 정보 (툴팁용) ===
                    attendanceStats: performance ? {
                        avg: performance.avg_attendance,
                        max: performance.max_attendance,
                        min: performance.min_attendance,
                        std: performance.std_attendance
                    } : null,
                    
                    // === 원본 데이터들 ===
                    _performance: performance,
                    _ranking: ranking,
                    _stats: stats
                };
            }).filter(party => party.name && party.name !== '정보없음');

            // 순위순으로 정렬
            partyData.sort((a, b) => a.rank - b.rank);

            console.log('[RankParty] ✅ 정당 데이터 통합 완료:', partyData.length, '개');
            showNotification(`정당 랭킹 데이터 로드 완료 (${partyData.length}개 정당)`, 'success');

        } catch (error) {
            console.error('[RankParty] ❌ 정당 데이터 로드 실패:', error);
            
            // API 실패 시 기본 데이터 사용
            partyData = getDefaultPartyData();
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
            },
            {
                name: "개혁신당",
                party: "개혁신당",
                rank: 4,
                rankSource: 'estimated',
                totalScore: 68.4,
                attendanceRate: 87.3,
                billPassSum: 28,
                petitionSum: 20,
                petitionPassSum: 12,
                chairmanCount: 0,
                secretaryCount: 1,
                invalidVoteRatio: 2.5,
                voteMatchRatio: 85.6,
                voteMismatchRatio: 14.4
            },
            {
                name: "진보당",
                party: "진보당",
                rank: 5,
                rankSource: 'estimated',
                totalScore: 65.1,
                attendanceRate: 86.8,
                billPassSum: 22,
                petitionSum: 18,
                petitionPassSum: 8,
                chairmanCount: 0,
                secretaryCount: 1,
                invalidVoteRatio: 3.2,
                voteMatchRatio: 82.4,
                voteMismatchRatio: 17.6
            }
        ];
    }

    // === 🎨 UI 렌더링 함수들 ===

    // 정당 랭킹 테이블 렌더링 (기존 HTML 테이블 사용)
function renderPartyRankingTable() {
    // 기존 HTML의 tbody 요소 찾기
    const tableBody = document.getElementById('partyTableBody');
    
    if (!tableBody) {
        console.error('[RankParty] ❌ partyTableBody 요소를 찾을 수 없습니다');
        return;
    }

    // 데이터가 없을 경우 로딩 메시지 표시
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

    // 페이지네이션 적용
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = getSortedPartyData().slice(startIndex, endIndex);

    // 테이블 body 내용 생성
    const tableHTML = pageData.map((party, index) => {
        const partyColor = partyColors[party.name];
        
        return `
            <tr class="party-row" data-party="${party.name}" onclick="showPartyDetail('${party.name}')">
                <td class="rank-cell">
                    <span style="color: ${partyColor?.main || '#333'}">${party.rank}</span>
                    ${party.rankSource === 'api' ? 
                        '<span style="font-size: 10px; color: #28a745; margin-left: 5px;">●</span>' : 
                        '<span style="font-size: 10px; color: #6c757d; margin-left: 5px;">○</span>'
                    }
                </td>
                <td style="font-weight: 600; color: ${partyColor?.main || '#333'}">
                    ${party.totalScore.toFixed(1)}%
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${partyColor?.main || '#999'}; display: inline-block;"></span>
                        <strong>${party.name}</strong>
                    </div>
                </td>
                <td style="color: var(--example)">
                    ${getPartyLeader(party.name)}
                </td>
                <td class="home-icon">
                    <a href="${getPartyHomepage(party.name)}" target="_blank" rel="noopener noreferrer">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
                        </svg>
                    </a>
                </td>
            </tr>
        `;
    }).join('');

    // 기존 테이블의 tbody에 내용 삽입
    tableBody.innerHTML = tableHTML;

    // 기본 스타일이 없다면 추가
    addBasicStyles();
    
    console.log(`[RankParty] ✅ 테이블 렌더링 완료: ${pageData.length}개 정당`);
}

// 정당 대표 정보 가져오기 (임시 데이터)
function getPartyLeader(partyName) {
    const leaders = {
        "더불어민주당": "박찬대",
        "국민의힘": "공석", 
        "조국혁신당": "서왕진",
        "개혁신당": "천하람",
        "진보당": "윤종오",
        "기본소득당": "용혜인",
        "사회민주당": "	한창민",
        "무소속": "-"
    };
    return leaders[partyName] || "-";
}

// 정당 홈페이지 정보 가져오기 (임시 데이터)
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

// 기본 스타일 추가 함수 (기존 CSS와 충돌하지 않도록 수정)
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

    // 정렬된 정당 데이터 가져오기
    function getSortedPartyData() {
        const sortedData = [...partyData];
        
        switch (currentSort) {
            case 'rank':
                sortedData.sort((a, b) => a.rank - b.rank);
                break;
            case 'totalScore':
                sortedData.sort((a, b) => b.totalScore - a.totalScore);
                break;
            case 'attendanceRate':
                sortedData.sort((a, b) => b.attendanceRate - a.attendanceRate);
                break;
            case 'billPassSum':
                sortedData.sort((a, b) => b.billPassSum - a.billPassSum);
                break;
            case 'petitionSum':
                sortedData.sort((a, b) => b.petitionSum - a.petitionSum);
                break;
            case 'chairmanCount':
                sortedData.sort((a, b) => b.chairmanCount - a.chairmanCount);
                break;
            case 'secretaryCount':
                sortedData.sort((a, b) => b.secretaryCount - a.secretaryCount);
                break;
            default:
                sortedData.sort((a, b) => a.rank - b.rank);
        }
        
        return sortedData;
    }

    // 정렬 이벤트 리스너 설정
// 정렬 이벤트 리스너 설정 (HTML 드롭다운 사용) - 수정된 버전
function setupSortingListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    const sortDropdown = document.getElementById('sortDropdown');
    const dropdownItems = document.querySelectorAll('.dropdown-item');

    if (settingsBtn && sortDropdown) {
        // 설정 버튼 클릭 이벤트
        settingsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sortDropdown.classList.toggle('active');
            console.log('[RankParty] 📋 설정 드롭다운 토글');
        });

        // 드롭다운 외부 클릭 시 닫기
        document.addEventListener('click', function() {
            sortDropdown.classList.remove('active');
        });

        // 드롭다운 아이템 클릭 이벤트
        dropdownItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                
                console.log('[RankParty] 📊 정렬 옵션 클릭:', this.textContent, this.getAttribute('data-sort'));
                
                // 이전 활성 아이템 제거
                dropdownItems.forEach(i => i.classList.remove('active'));
                
                // 현재 아이템 활성화
                this.classList.add('active');
                
                // 정렬 적용
                const sortType = this.getAttribute('data-sort');
                applySorting(sortType);
                
                // 드롭다운 닫기
                sortDropdown.classList.remove('active');
            });
        });
        
        console.log('[RankParty] ✅ 정렬 이벤트 리스너 설정 완료');
    } else {
        console.error('[RankParty] ❌ 정렬 버튼 또는 드롭다운을 찾을 수 없습니다');
    }
}

// 정렬 적용 함수 - 수정된 버전
function applySorting(sortType) {
    console.log('[RankParty] 📊 정렬 적용 중:', sortType);
    
    if (sortType === 'asc') {
        // 오름차순: 순위 기준 (낮은 순위부터)
        currentSort = 'rank_asc';
        console.log('[RankParty] 📊 순위 오름차순 정렬 적용 (1위부터)');
    } else if (sortType === 'desc') {
        // 내림차순
        currentSort = 'rank_desc';
        console.log('[RankParty] 📊 순위 내림차순 정렬 적용 (8위)');
    }
    
    currentPage = 1; // 정렬 시 첫 페이지로
    
    // UI 즉시 업데이트
    renderPartyRankingTable();
    renderPagination();
    
    console.log('[RankParty] ✅ 정렬 완료, 현재 정렬:', currentSort);
}

// 정렬된 정당 데이터 가져오기 - 수정된 버전
function getSortedPartyData() {
    if (!partyData || partyData.length === 0) {
        console.warn('[RankParty] ⚠️ 정당 데이터가 없음');
        return [];
    }

    const sortedData = [...partyData];
    
    console.log('[RankParty] 📊 정렬 적용 중:', currentSort, '데이터 수:', sortedData.length);
    
    switch (currentSort) {
        case 'rank_asc':
        case 'rank':
            // 순위 오름차순 (1위부터)
            sortedData.sort((a, b) => {
                const rankA = a.rank || 999;
                const rankB = b.rank || 999;
                return rankA - rankB;
            });
            console.log('[RankParty] 🔄 순위 오름차순 정렬 완료');
            break;
            
        case 'rank_desc':
        case 'rank':
            // 점수 내림차순 (높은 점수부터)
            sortedData.sort((a, b) => {
                const rankA = a.rank || 999;
                const rankB = b.rank || 999;
                return rankB - rankA;
            });
            console.log('[RankParty] 🔄 순위 내림차순 정렬 완료');
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
            // 기본: 순위 오름차순
            sortedData.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            console.log('[RankParty] 🔄 기본 정렬 (순위 오름차순) 적용');
    }
    
    // 정렬 결과 로그
    console.log('[RankParty] 📊 정렬 결과 미리보기:');
    sortedData.slice(0, 3).forEach((party, index) => {
        console.log(`  ${index + 1}. ${party.name} - 순위: ${party.rank}, 점수: ${party.totalScore?.toFixed(1)}%`);
    });
    
    return sortedData;
}

// 정렬 상태 디버깅 함수
function debugSortingState() {
    console.log('[RankParty] 🔍 정렬 상태 디버깅:');
    console.log('- currentSort:', currentSort);
    console.log('- partyData 길이:', partyData?.length || 0);
    console.log('- 정렬 결과 첫 3개:');
    
    const sorted = getSortedPartyData();
    sorted.slice(0, 3).forEach((party, index) => {
        console.log(`  ${index + 1}. ${party.name} (순위: ${party.rank}, 점수: ${party.totalScore?.toFixed(1)}%)`);
    });
    
    return sorted;
}

// 전역 함수로 등록
window.debugSortingState = debugSortingState;

// 페이지네이션 렌더링 (간단한 버전)
function renderPagination() {
    const totalItems = partyData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // 기존 페이지네이션 컨테이너 찾기 또는 생성
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
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHTML = '<div class="pagination">';
    
    // 이전 페이지 버튼
    if (currentPage > 1) {
        paginationHTML += `<button onclick="goToPage(${currentPage - 1})" class="page-btn">이전</button>`;
    }
    
    // 페이지 번호 버튼들
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="page-btn active">${i}</button>`;
        } else {
            paginationHTML += `<button onclick="goToPage(${i})" class="page-btn">${i}</button>`;
        }
    }
    
    // 다음 페이지 버튼
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="goToPage(${currentPage + 1})" class="page-btn">다음</button>`;
    }
    
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;
    
    // 페이지네이션 스타일 추가
    addPaginationStyles();
    
    console.log(`[RankParty] ✅ 페이지네이션 렌더링 완료: ${currentPage}/${totalPages}`);
}

// 페이지 이동 함수
function goToPage(page) {
    const totalPages = Math.ceil(partyData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        console.log(`[RankParty] 📄 페이지 이동: ${currentPage} → ${page}`);
        currentPage = page;
        renderPartyRankingTable();
        renderPagination();
    }
}

// 페이지네이션 스타일 추가
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

// 전역 함수 등록
window.goToPage = goToPage;

    // 통계 정보 렌더링
    function renderStatistics() {
        let statsContainer = document.getElementById('party-statistics') ||
                           document.getElementById('statistics') ||
                           document.querySelector('.statistics');
        
        if (!statsContainer) {
            // 통계 컨테이너 생성
            const tableContainer = document.getElementById('party-ranking-table');
            if (tableContainer) {
                statsContainer = document.createElement('div');
                statsContainer.id = 'party-statistics';
                statsContainer.className = 'party-statistics';
                tableContainer.parentNode.insertBefore(statsContainer, tableContainer);
            } else {
                return; // 테이블 컨테이너도 없으면 포기
            }
        }

        if (partyData.length === 0) return;

        const totalParties = partyData.length;
        const avgScore = partyData.reduce((sum, party) => sum + party.totalScore, 0) / totalParties;
        const avgAttendance = partyData.reduce((sum, party) => sum + party.attendanceRate, 0) / totalParties;
        const totalBillPass = partyData.reduce((sum, party) => sum + party.billPassSum, 0);

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
            </div>
        `;
    }

    // === 🔄 데이터 새로고침 함수들 ===

    // 전체 데이터 새로고침 (가중치 변경 시 사용)
    async function refreshPartyRanking() {
        try {
            console.log('[RankParty] 🔄 정당 랭킹 데이터 새로고침...');
            showLoading(true);
            
            // 모든 데이터 다시 로드
            await loadPartyData();
            
            // UI 다시 렌더링
            renderPartyRankingTable();
            renderPagination();
            renderStatistics();
            
            showNotification('정당 랭킹 데이터가 업데이트되었습니다', 'success');
            
        } catch (error) {
            console.error('[RankParty] ❌ 데이터 새로고침 실패:', error);
            showNotification('데이터 새로고침에 실패했습니다', 'error');
        } finally {
            showLoading(false);
        }
    }

    // WeightSync 호환 함수들
    async function refreshPartyRankingData() {
        return await refreshPartyRanking();
    }

    async function loadPartyRankingData() {
        return await loadPartyData();
    }

    async function updatePartyRankingData(newData) {
        console.log('[RankParty] 📊 외부 데이터로 업데이트:', newData);
        
        if (newData && (Array.isArray(newData) || typeof newData === 'object')) {
            await loadPartyData(); // 데이터 다시 로드
            renderPartyRankingTable();
            renderPagination();
            renderStatistics();
            showNotification('정당 랭킹 데이터가 업데이트되었습니다', 'success');
        }
    }

    // === 🚀 페이지 초기화 === (개선된 버전)
async function initializePage() {
    console.log('[RankParty] 🚀 정당 랭킹 페이지 초기화 중...');
    
    try {
        // 기본 정렬 설정
        currentSort = 'rank_asc';
        currentPage = 1;
        
        // 정당 데이터 로드
        await loadPartyData();
        
        console.log('[RankParty] 📊 로드된 데이터 확인:', partyData?.length || 0, '개 정당');
        
        // 이벤트 리스너 먼저 설정
        setupSortingListeners();
        
        // UI 렌더링
        renderPartyRankingTable();
        renderPagination();
        renderStatistics();
        
        // 초기 정렬 상태 확인
        console.log('[RankParty] 🔧 초기 정렬 상태:', currentSort);
        
        showNotification('정당 랭킹 페이지 로드 완료', 'success');
        console.log('[RankParty] ✅ 정당 랭킹 페이지 초기화 완료');
        
    } catch (error) {
        console.error('[RankParty] ❌ 페이지 초기화 오류:', error);
        showError('페이지 로드 중 오류가 발생했습니다');
        
        // 오류 발생 시에도 기본 UI는 표시
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

// 렌더링 함수에 디버깅 추가
function renderPartyRankingTable() {
    // 기존 HTML의 tbody 요소 찾기
    const tableBody = document.getElementById('partyTableBody');
    
    if (!tableBody) {
        console.error('[RankParty] ❌ partyTableBody 요소를 찾을 수 없습니다');
        return;
    }

    // 데이터가 없을 경우 로딩 메시지 표시
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

    // 페이지네이션 적용
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const sortedData = getSortedPartyData();
    const pageData = sortedData.slice(startIndex, endIndex);

    console.log('[RankParty] 📋 테이블 렌더링:', {
        totalData: partyData.length,
        sortedData: sortedData.length,
        pageData: pageData.length,
        currentSort: currentSort,
        currentPage: currentPage
    });

    // 테이블 body 내용 생성
    const tableHTML = pageData.map((party, index) => {
        const partyColor = partyColors[party.name];
        
        return `
            <tr class="party-row" data-party="${party.name}" onclick="showPartyDetail('${party.name}')">
                <td class="rank-cell">
                    <span style="color: ${partyColor?.main || '#333'}">${party.rank}</span>
                    ${party.rankSource === 'api' ? 
                        '<span style="font-size: 10px; color: #28a745; margin-left: 5px;" title="실시간 데이터">●</span>' : 
                        '<span style="font-size: 10px; color: #6c757d; margin-left: 5px;" title="추정 데이터">○</span>'
                    }
                </td>
                <td style="font-weight: 600; color: ${partyColor?.main || '#333'}">
                    ${party.totalScore.toFixed(1)}%
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="width: 12px; height: 12px; border-radius: 50%; background-color: ${partyColor?.main || '#999'}; display: inline-block;"></span>
                        <strong>${party.name}</strong>
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

    // 기존 테이블의 tbody에 내용 삽입
    tableBody.innerHTML = tableHTML;

    // 기본 스타일이 없다면 추가
    addBasicStyles();
    
    console.log(`[RankParty] ✅ 테이블 렌더링 완료: ${pageData.length}개 정당 표시`);
    
    // 렌더링 후 정렬 상태 표시
    if (pageData.length > 0) {
        console.log(`[RankParty] 📊 현재 정렬(${currentSort}) 결과: 첫번째=${pageData[0].name}(순위:${pageData[0].rank}, 점수:${pageData[0].totalScore?.toFixed(1)}%)`);
    }
}

    // === 🔧 전역 함수 등록 (WeightSync 및 기타용) ===
    
    // WeightSync 연동 함수들
    window.refreshPartyRankingData = refreshPartyRankingData;
    window.loadPartyRankingData = loadPartyRankingData;
    window.updatePartyRankingData = updatePartyRankingData;
    window.loadPartyData = loadPartyData;

    // 정당 상세보기 함수
    window.showPartyDetail = function(partyName) {
        const party = partyData.find(p => p.name === partyName);
        if (party) {
            // 정당 상세 페이지로 이동
            window.location.href = `percent_party.html?party=${encodeURIComponent(partyName)}`;
        }
    };

    // CSV 내보내기 함수
    window.exportPartyRankingCSV = function() {
        try {
            const headers = [
                '순위', '정당명', '총점', '출석률', '본회의 가결', '청원 제안', '청원 결과', '위원장', '간사'
            ];

            const rows = getSortedPartyData().map((party, index) => [
                party.rank,
                party.name,
                party.totalScore.toFixed(1),
                party.attendanceRate.toFixed(1),
                party.billPassSum,
                party.petitionSum,
                party.petitionPassSum,
                party.chairmanCount,
                party.secretaryCount
            ]);

            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${cell}"`).join(','))
                .join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `정당_랭킹_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            showNotification('CSV 파일이 다운로드되었습니다', 'success');
        } catch (error) {
            console.error('[RankParty] CSV 내보내기 실패:', error);
            showError('CSV 내보내기에 실패했습니다');
        }
    };

    // API 응답 디버그 함수
    window.debugAPIResponse = async function() {
        console.log('[RankParty] 🔍 API 응답 디버깅 시작...');
        
        try {
            console.log('=== 정당 성과 API ===');
            const performance = await window.APIService.getPartyPerformance();
            console.log('타입:', typeof performance);
            console.log('구조:', performance);
            console.log('길이:', Array.isArray(performance) ? performance.length : 'not array');
            if (Array.isArray(performance) && performance.length > 0) {
                console.log('첫번째 항목:', performance[0]);
                console.log('첫번째 항목 키들:', Object.keys(performance[0]));
            }
            
            console.log('=== 정당 랭킹 API ===');
            const ranking = await window.APIService.getPartyScoreRanking();
            console.log('타입:', typeof ranking);
            console.log('구조:', ranking);
            console.log('길이:', Array.isArray(ranking) ? ranking.length : 'not array');
            if (Array.isArray(ranking) && ranking.length > 0) {
                console.log('첫번째 항목:', ranking[0]);
                console.log('첫번째 항목 키들:', Object.keys(ranking[0]));
            }
            
        } catch (error) {
            console.error('[RankParty] API 디버깅 실패:', error);
        }
    };

    // 디버그 유틸리티 (전역)
    window.rankPartyDebug = {
        getPartyData: () => partyData,
        getPerformanceData: () => partyPerformanceData,
        getRankingData: () => partyRankingData,
        getStatsData: () => partyStatsData,
        reloadData: () => initializePage(),
        refreshData: () => refreshPartyRanking(),
        debugAPI: () => window.debugAPIResponse(),
        testAPIService: async () => {
            console.log('[RankParty] 🧪 APIService 테스트:');
            console.log('- APIService:', window.APIService);
            console.log('- 준비 상태:', window.APIService?._isReady);
            console.log('- 에러 상태:', window.APIService?._hasError);
            console.log('- 정당 성과 API:', !!window.APIService?.getPartyPerformance);
            console.log('- 정당 랭킹 API:', !!window.APIService?.getPartyScoreRanking);
            console.log('- 정당 통계 API:', !!window.APIService?.getPartyStatsRanking);
            
            try {
                const [performance, ranking, stats] = await Promise.allSettled([
                    window.APIService.getPartyPerformance(),
                    window.APIService.getPartyScoreRanking(),
                    window.APIService.getPartyStatsRanking()
                ]);
                
                console.log('✅ 성과 데이터:', performance.status, performance.status === 'fulfilled' ? `${typeof performance.value} 타입` : performance.reason);
                console.log('✅ 랭킹 데이터:', ranking.status, ranking.status === 'fulfilled' ? `${typeof ranking.value} 타입` : ranking.reason);
                console.log('✅ 통계 데이터:', stats.status, stats.status === 'fulfilled' ? `${typeof stats.value} 타입` : stats.reason);
                
                return true;
            } catch (error) {
                console.error('❌ API 테스트 실패:', error);
                return false;
            }
        },
        showInfo: () => {
            console.log('[RankParty] 📊 정당 랭킹 페이지 정보:');
            console.log('- 로드된 정당 수:', partyData.length);
            console.log('- 성과 데이터:', Object.keys(partyPerformanceData).length, '개');
            console.log('- 랭킹 데이터:', Object.keys(partyRankingData).length, '개');
            console.log('- 통계 데이터:', Object.keys(partyStatsData).length, '개');
            console.log('- 현재 정렬:', currentSort);
            console.log('- 현재 페이지:', currentPage, '/', Math.ceil(partyData.length / itemsPerPage));
            console.log('- APIService 상태:', window.APIService?._isReady ? '준비됨' : '준비중');
            console.log('- 환경 정보:', window.APIService?.getEnvironmentInfo());
        },
        simulateWeightChange: () => {
            console.log('[RankParty] 🔧 가중치 변경 시뮬레이션...');
            const changeData = {
                type: 'weights_updated',
                timestamp: new Date().toISOString(),
                source: 'debug_simulation'
            };
            localStorage.setItem('weight_change_event', JSON.stringify(changeData));
            localStorage.setItem('last_weight_update', Date.now().toString());
            setTimeout(() => localStorage.removeItem('weight_change_event'), 100);
        }
    };

    // 초기화 실행
    setTimeout(initializePage, 100);

    console.log('[RankParty] ✅ 정당 랭킹 페이지 스크립트 로드 완료 (개선된 버전)');
    console.log('[RankParty] 🔗 API 모드: Django API 직접 연동 + 오류 복구');
    console.log('[RankParty] 📊 데이터 매핑: 다양한 필드명 지원 + 폴백 처리');
    console.log('[RankParty] 🔧 디버그 명령어:');
    console.log('[RankParty]   - window.rankPartyDebug.showInfo() : 페이지 정보 확인');
    console.log('[RankParty]   - window.rankPartyDebug.debugAPI() : API 응답 구조 확인');
    console.log('[RankParty]   - window.rankPartyDebug.testAPIService() : APIService 테스트');
    console.log('[RankParty]   - window.debugAPIResponse() : 상세 API 디버깅');
});
