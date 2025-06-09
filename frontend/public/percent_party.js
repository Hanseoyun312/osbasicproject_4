// 정당 상세정보 페이지 (Django API 연동 + 퍼센트 정규화 + styles.css 색상 적용 버전 - 가중치 반영 제거)

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 정당 상세 페이지 로드 시작 (styles.css 색상 적용 + 최적화된 퍼센트 기준 - 가중치 반영 없음)');

    // === 🔧 페이지 상태 관리 ===
    let pageState = {
        currentParty: '더불어민주당',
        partyData: {},
        partyPerformanceData: {},
        partyRankingData: {},
        isLoading: false,
        hasError: false
    };

    // === 🎨 정당별 브랜드 색상 (styles.css와 일치) ===
    const partyColors = {
        "더불어민주당": {
            main: "#152484",        // --party-dp-main
            secondary: "#004EA2",   // --party-dp-secondary
            url: "https://theminjoo.kr/"
        },
        "국민의힘": {
            main: "#E61E2B",        // --party-ppp-main
            secondary: "#D32036",   // --party-ppp-secondary
            url: "https://www.peoplepowerparty.kr/"
        },
        "조국혁신당": {
            main: "#06275E",        // --party-rk-main
            secondary: "#004098",   // --party-rk-secondary
            url: "https://rebuildingkoreaparty.kr"
        },
        "개혁신당": {
            main: "#FF7210",        // --party-reform-main
            secondary: "#F15A22",   // --party-reform-secondary
            url: "https://www.reformparty.kr/"
        },
        "진보당": {
            main: "#D6001C",        // --party-jp-main
            secondary: "#B20017",   // --party-jp-secondary
            url: "https://jinboparty.com/"
        },
        "기본소득당": {
            main: "#091E3A",        // --party-bip-main
            secondary: "#00D2C3",   // --party-bip-secondary
            url: "https://basicincomeparty.kr/"
        },
        "사회민주당": {
            main: "#F58400",        // --party-sdp-main (주황색)
            secondary: "#43A213",   // 보조색 (녹색)
            url: "https://www.samindang.kr/"
        },
        "무소속": {
            main: "#4B5563",        // --party-ind-main
            secondary: "#6B7280",   // --party-ind-secondary
            url: ""
        }
    };

    // === 🔧 HTML 순서와 정확히 일치하는 파이차트 데이터 구조 ===
    const statisticsConfig = [
        { key: 'attendance', label: '출석', colorVar: '--current-party-main' },                      // 1
        { key: 'plenary_pass', label: '본회의 가결', colorVar: '--current-party-secondary' },         // 2
        { key: 'petition_proposal', label: '청원 제안', colorVar: '--current-party-tertiary' },       // 3
        { key: 'petition_result', label: '청원 결과', colorVar: '--current-party-quaternary' },       // 4
        { key: 'secretary', label: '간사', colorVar: '--current-party-quinary' },                    // 5
        { key: 'invalid_abstention', label: '무효표 및 기권', colorVar: '--current-party-sixth' },     // 6
        { key: 'committee_chair', label: '위원장', colorVar: '--current-party-seventh' },            // 7
        { key: 'vote_match', label: '투표 결과 일치', colorVar: '--current-party-eighth' },           // 8
        { key: 'vote_mismatch', label: '투표 결과 불일치', colorVar: '--current-party-ninth' }         // 9
    ];

    // === 📊 최적화된 퍼센트 변환 기준 ===
    const PERCENTAGE_CRITERIA = {
        // 본회의 관련: 한 국회 회기 동안 평균적인 법안 수를 고려
        PLENARY_BILLS_MAX: 154553,        // 본회의 가결 최대 기준 (더 현실적으로 조정)
        
        // 청원 관련: 정당별 평균 청원 처리 건수를 고려  
        PETITION_PROPOSAL_MAX: 100,     // 청원 제안 최대 기준 (더 현실적으로 조정)
        PETITION_RESULT_MAX: 100,       // 청원 결과 최대 기준 (처리율을 고려)
        
        // 위원회 관련: 정당 규모에 따른 고정 퍼센트
        COMMITTEE_CHAIR_PERCENT: 5.0,  // 위원장: 있으면 5%
        SECRETARY_PERCENT: 3.0,        // 간사: 있으면 3% 
        
        // 무효표/기권: 일반적으로 5% 이하이므로 적절
        INVALID_VOTE_MAX: 10.0         // 최대 10%로 제한
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

    // 안전한 알림 표시 함수
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
        console.error('[PercentParty] ❌', message);
    }

    // 성공 메시지 표시
    function showSuccess(message) {
        showNotification(message, 'success');
        console.log('[PercentParty] ✅', message);
    }

    // 로딩 상태 표시
    function showLoading(show = true) {
        pageState.isLoading = show;
        const statsItems = document.querySelectorAll('.stats-item .value');
        
        // HTML 순서에 따라 로딩 표시
        statsItems.forEach((item, index) => {
            if (index < statisticsConfig.length) {
                if (show) {
                    item.textContent = '로딩중...';
                    item.style.color = '#999';
                    item.classList.add('loading');
                } else {
                    item.classList.remove('loading');
                    item.style.color = '';
                }
            }
        });
        
        // 파이차트 영역에 로딩 표시
        const svg = document.querySelector('.pie-chart svg');
        if (svg) {
            svg.querySelectorAll('path').forEach(path => {
                path.style.opacity = show ? '0.5' : '1';
            });
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

    // 🔧 비율 데이터 정규화 (compare_party.js와 동일한 로직)
    function normalizePercentage(value) {
        if (!value && value !== 0) return 0;
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 0;
        
        // 값이 100보다 크면 이미 퍼센트 형식으로 가정 (그대로 사용)
        // 값이 1보다 작으면 비율 형식으로 가정 (100 곱하기)
        if (numValue > 100) {
            return numValue; // 이미 퍼센트 (예: 2694.0 → 2694.0%)
        } else if (numValue <= 1) {
            return numValue * 100; // 비율을 퍼센트로 변환 (예: 0.85 → 85%)
        } else {
            return numValue; // 1~100 사이는 그대로 사용
        }
    }

    // 🔧 개수를 퍼센트로 변환 (최적화된 기준 적용)
    function convertCountToPercentage(count, maxCount) {
        if (!count && count !== 0) return 0;
        
        const numCount = parseInt(count);
        if (isNaN(numCount)) return 0;
        
        // 최대값 대비 퍼센트로 변환
        const percentage = (numCount / maxCount) * 100;
        return Math.min(percentage, 100); // 최대 100%로 제한
    }

    // 🔧 위원장/간사 수를 최적화된 퍼센트로 변환
    function convertLeaderToPercentage(count) {
        const numCount = parseInt(count || 0);
        if (isNaN(numCount)) return 0;
        
        // 위원장: 있으면 8% (중요도 상향), 없으면 0%
        return numCount > 0 ? PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT : 0.0;
    }

    function convertSecretaryToPercentage(count) {
        const numCount = parseInt(count || 0);
        if (isNaN(numCount)) return 0;
        
        // 간사: 있으면 5% (중요도 상향), 없으면 0%
        return numCount > 0 ? PERCENTAGE_CRITERIA.SECRETARY_PERCENT : 0.0;
    }

    // === 📊 API 데이터 로드 함수들 ===

    // 정당 성과 데이터 가져오기
    async function fetchPartyPerformanceData() {
        try {
            console.log('[PercentParty] 📊 정당 성과 데이터 조회...');
            
            const rawData = await window.APIService.getPartyPerformance();
            console.log('[PercentParty] 🔍 정당 성과 API 원본 응답:', rawData);
            
            // 다양한 응답 형식 처리
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && rawData.data && Array.isArray(rawData.data)) {
                processedData = rawData.data;
            } else if (rawData && typeof rawData === 'object') {
                const values = Object.values(rawData);
                if (values.length > 0 && Array.isArray(values[0])) {
                    processedData = values[0];
                } else if (values.length > 0) {
                    processedData = values;
                }
            }
            
            if (!processedData || !Array.isArray(processedData)) {
                console.warn('[PercentParty] ⚠️ 정당 성과 데이터 형식이 예상과 다름, 빈 배열 사용');
                processedData = [];
            }
            
            // 정당별 성과 데이터 매핑 (최적화된 퍼센트 기준 적용)
            const performanceData = {};
            processedData.forEach(party => {
                const partyName = normalizePartyName(party.party);
                if (partyName && partyName !== '정보없음') {
                    
                    // 🔧 원본 값들 로깅 (디버깅용)
                    console.log(`📊 ${partyName} 원본 데이터:`, {
                        avg_attendance: party.avg_attendance,
                        bill_pass_sum: party.bill_pass_sum,
                        petition_sum: party.petition_sum,
                        petition_pass_sum: party.petition_pass_sum,
                        committee_leader_count: party.committee_leader_count,
                        committee_secretary_count: party.committee_secretary_count,
                        avg_invalid_vote_ratio: party.avg_invalid_vote_ratio,
                        avg_vote_match_ratio: party.avg_vote_match_ratio,
                        avg_vote_mismatch_ratio: party.avg_vote_mismatch_ratio,
                        avg_total_score: party.avg_total_score
                    });
                    
                    performanceData[partyName] = {
                        // === 기본 정보 ===
                        party: partyName,
                        
                        // === 출석 관련 (이미 퍼센트) ===
                        avg_attendance: normalizePercentage(party.avg_attendance),
                        
                        // === 본회의 가결 (최적화된 기준: 154553건) ===
                        bill_pass_sum: convertCountToPercentage(party.bill_pass_sum, PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX),
                        bill_pass_count: parseInt(party.bill_pass_sum || 0), // 원본 개수 보존
                        
                        // === 청원 관련 (최적화된 기준: 100건) ===
                        petition_sum: convertCountToPercentage(party.petition_sum, PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX),
                        petition_count: parseInt(party.petition_sum || 0), // 원본 개수 보존
                        petition_pass_sum: convertCountToPercentage(party.petition_pass_sum, PERCENTAGE_CRITERIA.PETITION_RESULT_MAX),
                        petition_pass_count: parseInt(party.petition_pass_sum || 0), // 원본 개수 보존
                        
                        // === 위원회 관련 (최적화된 퍼센트: 8%/5%) ===
                        committee_leader_count: convertLeaderToPercentage(party.committee_leader_count), // 위원장: 있으면 8%
                        leader_count: parseInt(party.committee_leader_count || 0), // 원본 개수 보존
                        committee_secretary_count: convertSecretaryToPercentage(party.committee_secretary_count), // 간사: 있으면 5%
                        secretary_count: parseInt(party.committee_secretary_count || 0), // 원본 개수 보존
                        
                        // === 무효표 및 기권 관련 (이미 퍼센트, 최대 10%로 제한) ===
                        avg_invalid_vote_ratio: Math.min(normalizePercentage(party.avg_invalid_vote_ratio), PERCENTAGE_CRITERIA.INVALID_VOTE_MAX),
                        
                        // === 표결 일치 관련 (이미 퍼센트) ===
                        avg_vote_match_ratio: normalizePercentage(party.avg_vote_match_ratio),
                        
                        // === 표결 불일치 관련 (이미 퍼센트) ===
                        avg_vote_mismatch_ratio: normalizePercentage(party.avg_vote_mismatch_ratio),
                        
                        // === 총점 ===
                        avg_total_score: parseFloat(party.avg_total_score || 0),
                        
                        // === 원본 데이터 ===
                        _raw: party
                    };
                    
                    // 🔧 정규화된 값들 로깅 (디버깅용)
                    console.log(`📊 ${partyName} 최적화된 데이터:`, {
                        출석: `${performanceData[partyName].avg_attendance.toFixed(1)}%`,
                        본회의가결: `${performanceData[partyName].bill_pass_sum.toFixed(1)}% (${performanceData[partyName].bill_pass_count}건/${PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX}건)`,
                        청원제안: `${performanceData[partyName].petition_sum.toFixed(1)}% (${performanceData[partyName].petition_count}건/${PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX}건)`,
                        청원결과: `${performanceData[partyName].petition_pass_sum.toFixed(1)}% (${performanceData[partyName].petition_pass_count}건/${PERCENTAGE_CRITERIA.PETITION_RESULT_MAX}건)`,
                        위원장: `${performanceData[partyName].committee_leader_count.toFixed(1)}% (${performanceData[partyName].leader_count}명)`,
                        간사: `${performanceData[partyName].committee_secretary_count.toFixed(1)}% (${performanceData[partyName].secretary_count}명)`,
                        무효표기권: `${performanceData[partyName].avg_invalid_vote_ratio.toFixed(1)}%`,
                        투표일치: `${performanceData[partyName].avg_vote_match_ratio.toFixed(1)}%`,
                        투표불일치: `${performanceData[partyName].avg_vote_mismatch_ratio.toFixed(1)}%`
                    });
                }
            });
            
            pageState.partyPerformanceData = performanceData;
            console.log(`[PercentParty] ✅ 정당 성과 데이터 로드 완료: ${Object.keys(performanceData).length}개`);
            return performanceData;
            
        } catch (error) {
            console.error('[PercentParty] ❌ 정당 성과 데이터 로드 실패:', error);
            pageState.partyPerformanceData = {};
            return {};
        }
    }

    // 정당 랭킹 데이터 가져오기
    async function fetchPartyRankingData() {
        try {
            console.log('[PercentParty] 🏆 정당 랭킹 데이터 조회...');
            
            const rawData = await window.APIService.getPartyScoreRanking();
            console.log('[PercentParty] 🔍 정당 랭킹 API 원본 응답:', rawData);
            
            // 다양한 응답 형식 처리
            let processedData = null;
            
            if (Array.isArray(rawData)) {
                processedData = rawData;
            } else if (rawData && rawData.data && Array.isArray(rawData.data)) {
                processedData = rawData.data;
            } else if (rawData && typeof rawData === 'object') {
                const values = Object.values(rawData);
                if (values.length > 0 && Array.isArray(values[0])) {
                    processedData = values[0];
                } else if (values.length > 0) {
                    processedData = values;
                }
            }
            
            if (!processedData || !Array.isArray(processedData)) {
                console.warn('[PercentParty] ⚠️ 정당 랭킹 데이터 형식이 예상과 다름, 빈 배열 사용');
                processedData = [];
            }
            
            // 정당별 랭킹 데이터 매핑
            const rankingData = {};
            processedData.forEach(ranking => {
                const partyName = normalizePartyName(ranking.POLY_NM);
                if (partyName && partyName !== '정보없음') {
                    rankingData[partyName] = {
                        party: partyName,
                        rank: parseInt(ranking.평균실적_순위 || 999),
                        _raw: ranking
                    };
                }
            });
            
            pageState.partyRankingData = rankingData;
            console.log(`[PercentParty] ✅ 정당 랭킹 데이터 로드 완료: ${Object.keys(rankingData).length}개`);
            return rankingData;
            
        } catch (error) {
            console.error('[PercentParty] ❌ 정당 랭킹 데이터 로드 실패:', error);
            pageState.partyRankingData = {};
            return {};
        }
    }

    // === 🔄 API 데이터를 파이차트 형식으로 매핑 ===
    function mapApiDataToChartFormat(performanceData, partyName) {
        try {
            console.log('[PercentParty] 📊 API 데이터 매핑 시작:', performanceData);
            
            // API 데이터를 HTML 순서에 맞춘 9개 항목으로 매핑
            const mappedData = {
                // 1. 출석 → avg_attendance (이미 퍼센트)
                attendance: performanceData.avg_attendance || 85.0,
                
                // 2. 본회의 가결 → bill_pass_sum (최적화된 퍼센트로 변환됨)
                plenary_pass: performanceData.bill_pass_sum || 60.0,
                
                // 3. 청원 제안 → petition_sum (최적화된 퍼센트로 변환됨)
                petition_proposal: performanceData.petition_sum || 0.0,
                
                // 4. 청원 결과 → petition_pass_sum (최적화된 퍼센트로 변환됨)
                petition_result: performanceData.petition_pass_sum || 0.0,
                
                // 5. 간사 → committee_secretary_count (최적화된 퍼센트: 있으면 5%)
                secretary: performanceData.committee_secretary_count || 0.0,
                
                // 6. 무효표 및 기권 → avg_invalid_vote_ratio (이미 퍼센트, 최대 10%로 제한)
                invalid_abstention: performanceData.avg_invalid_vote_ratio || 5.0,
                
                // 7. 위원장 → committee_leader_count (최적화된 퍼센트: 있으면 8%)
                committee_chair: performanceData.committee_leader_count || 0.0,
                
                // 8. 투표 결과 일치 → avg_vote_match_ratio (이미 퍼센트)
                vote_match: performanceData.avg_vote_match_ratio || 85.0,
                
                // 9. 투표 결과 불일치 → avg_vote_mismatch_ratio (이미 퍼센트)
                vote_mismatch: performanceData.avg_vote_mismatch_ratio || 15.0
            };
            
            // 범위 제한 (0-100%)
            Object.keys(mappedData).forEach(key => {
                mappedData[key] = Math.max(0, Math.min(100, mappedData[key]));
            });
            
            console.log('[PercentParty] ✅ 매핑 완료:', mappedData);
            return mappedData;
            
        } catch (error) {
            console.error('[PercentParty] ❌ API 데이터 매핑 실패:', error);
            return generateTestDataForParty(partyName);
        }
    }

    // === 📊 정당 데이터 가져오기 ===
    async function fetchPartyData(partyName) {
        try {
            pageState.isLoading = true;
            showLoading(true);
            
            console.log('[PercentParty] 📊 정당 통계 데이터 가져오기:', partyName);
            
            // APIService 준비 대기
            await waitForAPIService();
            
            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('API 서비스가 연결되지 않았습니다');
            }
            
            // 정당 성과 및 랭킹 데이터 로드
            const [performanceResult, rankingResult] = await Promise.allSettled([
                fetchPartyPerformanceData(),
                fetchPartyRankingData()
            ]);
            
            // 결과 확인
            const results = {
                performance: performanceResult.status === 'fulfilled',
                ranking: rankingResult.status === 'fulfilled'
            };
            
            console.log('[PercentParty] 📊 API 로드 결과:', results);
            
            // 현재 선택된 정당 데이터 찾기
            let currentPartyData = null;
            let rankingData = null;
            
            if (results.performance) {
                const performanceData = pageState.partyPerformanceData;
                currentPartyData = performanceData[partyName];
            }
            
            if (results.ranking) {
                const rankingDataMap = pageState.partyRankingData;
                rankingData = rankingDataMap[partyName];
            }
            
            if (!currentPartyData) {
                console.warn(`[PercentParty] ⚠️ ${partyName} 성과 데이터를 찾을 수 없습니다, 기본 데이터 사용`);
                currentPartyData = generateDefaultPerformanceData(partyName);
            }
            
            console.log('[PercentParty] 🎯 선택된 정당 데이터:', currentPartyData);
            console.log('[PercentParty] 🏆 선택된 정당 랭킹:', rankingData);
            
            // API 데이터를 차트 형식으로 매핑
            const chartData = mapApiDataToChartFormat(currentPartyData, partyName);
            
            // 차트 업데이트
            updateChartFromData(chartData, partyName);
            
            // 순위 정보 포함한 성공 메시지
            const rankInfo = rankingData ? `${rankingData.rank}위` : '순위 정보 없음';
            const totalScore = currentPartyData.avg_total_score || 'N/A';
            
            // 퍼센트 기준 정보 추가
            const criteriaInfo = `(본회의: /${PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX}건, 청원: /${PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX}건, 위원장: ${PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT}%, 간사: ${PERCENTAGE_CRITERIA.SECRETARY_PERCENT}%)`;
            
            showSuccess(`${partyName} 통계 데이터를 성공적으로 불러왔습니다. (순위: ${rankInfo}, 총점: ${totalScore}점) ${criteriaInfo}`);
            
        } catch (error) {
            console.error('[PercentParty] ❌ 정당 통계 데이터 로드 실패:', error);
            
            // 에러 발생시 테스트 데이터 사용
            const testData = generateTestDataForParty(partyName);
            updateChartFromData(testData, partyName);
            
            showError(`API 연결 실패: ${error.message}. 기본 데이터를 표시합니다.`);
            
        } finally {
            pageState.isLoading = false;
            showLoading(false);
        }
    }

    // === 🧪 테스트용 데이터 생성 함수들 ===

    // 기본 성과 데이터 생성 (API 실패 시)
    function generateDefaultPerformanceData(partyName) {
        const baseData = {
            party: partyName,
            avg_attendance: 80 + Math.random() * 15,
            bill_pass_sum: 40 + Math.random() * 40,
            petition_sum: 30 + Math.random() * 50,
            petition_pass_sum: 20 + Math.random() * 40,
            committee_leader_count: Math.random() > 0.7 ? PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT : 0.0,
            committee_secretary_count: Math.random() > 0.5 ? PERCENTAGE_CRITERIA.SECRETARY_PERCENT : 0.0,
            avg_invalid_vote_ratio: Math.random() * 8 + 2,
            avg_vote_match_ratio: 75 + Math.random() * 20,
            avg_vote_mismatch_ratio: 5 + Math.random() * 20,
            avg_total_score: 60 + Math.random() * 30
        };
        
        // 정당별 특성 반영 (styles.css 색상과 일치하는 정당들)
        switch(partyName) {
            case '국민의힘':
                baseData.avg_attendance = 85.5;
                baseData.bill_pass_sum = 92.3;
                baseData.petition_sum = 76.8;
                baseData.petition_pass_sum = 68.2;
                baseData.committee_secretary_count = PERCENTAGE_CRITERIA.SECRETARY_PERCENT; // 간사 있음
                baseData.avg_invalid_vote_ratio = 7.1;
                baseData.committee_leader_count = PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT; // 위원장 있음
                baseData.avg_vote_match_ratio = 89.7;
                baseData.avg_vote_mismatch_ratio = 10.3;
                break;
            case '더불어민주당':
                baseData.avg_attendance = 87.2;
                baseData.bill_pass_sum = 89.1;
                baseData.petition_sum = 82.4;
                baseData.petition_pass_sum = 74.6;
                baseData.committee_secretary_count = PERCENTAGE_CRITERIA.SECRETARY_PERCENT; // 간사 있음
                baseData.avg_invalid_vote_ratio = 5.8;
                baseData.committee_leader_count = PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT; // 위원장 있음
                baseData.avg_vote_match_ratio = 91.2;
                baseData.avg_vote_mismatch_ratio = 8.8;
                break;
            case '조국혁신당':
                baseData.avg_attendance = 83.6;
                baseData.bill_pass_sum = 86.7;
                baseData.petition_sum = 78.9;
                baseData.petition_pass_sum = 71.2;
                baseData.committee_secretary_count = PERCENTAGE_CRITERIA.SECRETARY_PERCENT; // 간사 있음
                baseData.avg_invalid_vote_ratio = 6.4;
                baseData.committee_leader_count = 0.0; // 위원장 없음
                baseData.avg_vote_match_ratio = 88.5;
                baseData.avg_vote_mismatch_ratio = 11.5;
                break;
        }
        
        return baseData;
    }

    // 테스트용 더미 데이터 생성 (HTML 순서와 일치)
    function generateTestDataForParty(partyName) {
        console.log('[PercentParty] 🧪 테스트 데이터 생성:', partyName);
        
        const performanceData = generateDefaultPerformanceData(partyName);
        return mapApiDataToChartFormat(performanceData, partyName);
    }

    // === 🎨 UI 업데이트 함수들 ===

    // CSS 변수 업데이트 함수 (styles.css 색상 팔레트 사용)
    function updatePartyColors(partyName) {
        const partyInfo = partyColors[partyName];
        
        if (!partyInfo) {
            console.error(`[PercentParty] 정당 정보를 찾을 수 없습니다: "${partyName}"`);
            console.log('[PercentParty] 사용 가능한 정당들:', Object.keys(partyColors));
            return;
        }
        
        const root = document.documentElement;
        
        // styles.css에 정의된 정당별 색상 팔레트 사용
        const partyKey = {
            "더불어민주당": "dp",
            "국민의힘": "ppp", 
            "조국혁신당": "rk",
            "개혁신당": "reform",
            "진보당": "jp",
            "기본소득당": "bip",
            "사회민주당": "sdp",
            "무소속": "ind"
        }[partyName];
        
        if (partyKey) {
            // styles.css에 정의된 정당별 색상 변수들을 현재 활성 색상으로 설정
            root.style.setProperty('--current-party-main', `var(--party-${partyKey}-main)`);
            root.style.setProperty('--current-party-secondary', `var(--party-${partyKey}-secondary)`);
            root.style.setProperty('--current-party-tertiary', `var(--party-${partyKey}-tertiary)`);
            root.style.setProperty('--current-party-quaternary', `var(--party-${partyKey}-quaternary)`);
            root.style.setProperty('--current-party-quinary', `var(--party-${partyKey}-quinary)`);
            root.style.setProperty('--current-party-sixth', `var(--party-${partyKey}-sixth)`);
            root.style.setProperty('--current-party-seventh', `var(--party-${partyKey}-seventh)`);
            root.style.setProperty('--current-party-eighth', `var(--party-${partyKey}-eighth)`);
            root.style.setProperty('--current-party-ninth', `var(--party-${partyKey}-ninth)`);
            root.style.setProperty('--current-party-bg', `var(--party-${partyKey}-bg)`);
        } else {
            // 폴백: 직접 색상 설정
            root.style.setProperty('--current-party-main', partyInfo.main);
            root.style.setProperty('--current-party-secondary', partyInfo.secondary);
            root.style.setProperty('--current-party-tertiary', partyInfo.main + '99');
            root.style.setProperty('--current-party-quaternary', partyInfo.main + '88');
            root.style.setProperty('--current-party-quinary', partyInfo.main + '77');
            root.style.setProperty('--current-party-sixth', partyInfo.main + '66');
            root.style.setProperty('--current-party-seventh', partyInfo.main + '55');
            root.style.setProperty('--current-party-eighth', partyInfo.main + '44');
            root.style.setProperty('--current-party-ninth', partyInfo.main + '33');
            root.style.setProperty('--current-party-bg', partyInfo.main);
        }
        
        console.log(`[PercentParty] ✅ ${partyName} 색상 업데이트 완료 (styles.css 팔레트 사용)`);
    }

    // 각도를 라디안으로 변환
    function degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    // 극좌표를 직교좌표로 변환
    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = degreesToRadians(angleInDegrees - 90);
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    // SVG path 생성
    function createArcPath(centerX, centerY, radius, startAngle, endAngle) {
        const start = polarToCartesian(centerX, centerY, radius, endAngle);
        const end = polarToCartesian(centerX, centerY, radius, startAngle);
        
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        
        return [
            "M", centerX, centerY,
            "L", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
            "Z"
        ].join(" ");
    }

    // path 요소에 이벤트 리스너 추가
    function addPathEventListeners(path) {
        const tooltip = document.getElementById('chart-tooltip');
        
        path.addEventListener('mouseenter', function(e) {
            const label = this.getAttribute('data-label');
            const percent = this.getAttribute('data-percent');
            
            if (tooltip) {
                tooltip.textContent = `${label}: ${percent}%`;
                tooltip.classList.add('show');
            }
            
            // 호버 효과
            this.style.opacity = '0.8';
            this.style.stroke = 'white';
            this.style.strokeWidth = '2';
        });
        
        path.addEventListener('mousemove', function(e) {
            if (!tooltip) return;
            
            const rect = document.querySelector('.pie-chart').getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            tooltip.style.left = (x - tooltip.offsetWidth / 2) + 'px';
            tooltip.style.top = (y - tooltip.offsetHeight - 10) + 'px';
        });
        
        path.addEventListener('mouseleave', function() {
            if (tooltip) {
                tooltip.classList.remove('show');
            }
            
            // 호버 효과 제거
            this.style.opacity = '';
            this.style.stroke = '';
            this.style.strokeWidth = '';
        });
    }

    // 🔄 파이차트 업데이트 (HTML 순서 준수)
    function updatePieChart(data) {
        const svg = document.querySelector('.pie-chart svg');
        if (!svg) {
            console.error('[PercentParty] ❌ 파이차트 SVG 요소를 찾을 수 없습니다');
            return;
        }
        
        const centerX = 50;
        const centerY = 50;
        const radius = 45;
        
        // 기존 path 요소들 제거 (circle은 유지)
        svg.querySelectorAll('path').forEach(path => path.remove());
        
        // HTML 순서에 따라 0보다 큰 값들만 필터링
        const validData = statisticsConfig
            .map(config => ({
                ...config,
                value: data[config.key] || 0
            }))
            .filter(item => item.value > 0);
        
        if (validData.length === 0) {
            console.warn('[PercentParty] ⚠️ 표시할 데이터가 없습니다.');
            return;
        }
        
        // 총합 계산
        const total = validData.reduce((sum, item) => sum + item.value, 0);
        
        let currentAngle = 0;
        
        validData.forEach(item => {
            // 파이차트에서 실제 퍼센트 값 표시
            const actualPercent = item.value;
            const sliceAngle = (item.value / total) * 360;
            
            // path 요소 생성
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            const pathData = createArcPath(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            
            path.setAttribute('d', pathData);
            path.setAttribute('fill', `var(${item.colorVar})`);
            path.setAttribute('data-label', item.label);
            path.setAttribute('data-percent', actualPercent.toFixed(1));
            path.setAttribute('cursor', 'pointer');
            
            // 호버 효과를 위한 이벤트 리스너 추가
            addPathEventListeners(path);
            
            svg.appendChild(path);
            currentAngle += sliceAngle;
        });
        
        console.log('[PercentParty] ✅ 파이차트 업데이트 완료');
    }

    // 🔄 통계 섹션 업데이트 (HTML 순서와 정확히 매칭)
    function updateStatisticsSection(data, partyName) {
        const statsTitle = document.querySelector('.statistics-section h3');
        const statsItems = document.querySelectorAll('.stats-item');
        
        // 제목 업데이트
        if (statsTitle) {
            statsTitle.textContent = `${partyName} 통계`;
        }
        
        // HTML 순서에 따라 각 통계 항목 업데이트
        statisticsConfig.forEach((config, index) => {
            if (statsItems[index]) {
                const value = data[config.key] || 0;
                const labelElement = statsItems[index].querySelector('.label');
                const valueElement = statsItems[index].querySelector('.value');
                
                if (labelElement) labelElement.textContent = config.label;
                if (valueElement) {
                    valueElement.textContent = `${value.toFixed(1)}%`;
                    valueElement.classList.remove('loading');
                }
            }
        });
        
        console.log('[PercentParty] ✅ 통계 섹션 업데이트 완료');
    }

    // 차트 및 통계 전체 업데이트
    function updateChartFromData(partyStatistics, partyName) {
        updatePieChart(partyStatistics);
        updateStatisticsSection(partyStatistics, partyName);
    }

    // === 🔧 정당 변경 및 이벤트 처리 ===

    // 정당 변경 처리
    async function onPartyChange(selectedParty) {
        console.log('[PercentParty] 🔄 정당 변경:', selectedParty);
        
        pageState.currentParty = selectedParty;
        const partyInfo = partyColors[selectedParty];
        
        if (!partyInfo) {
            console.error(`[PercentParty] 정당 정보를 찾을 수 없습니다: "${selectedParty}"`);
            showError(`"${selectedParty}" 정당 정보를 찾을 수 없습니다.`);
            return;
        }
        
        // 드롭다운 버튼 텍스트 변경
        const dropdownBtn = document.querySelector('.dropdown-btn');
        if (dropdownBtn) {
            dropdownBtn.textContent = selectedParty;
            
            // SVG 아이콘 재추가
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '12');
            svg.setAttribute('height', '12');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M7 10l5 5 5-5z');
            path.setAttribute('fill', 'currentColor');
            
            svg.appendChild(path);
            dropdownBtn.appendChild(svg);
        }
        
        // 헤더 텍스트 변경
        const partyNameElement = document.getElementById('party-name');
        if (partyNameElement) {
            partyNameElement.textContent = selectedParty;
        }
        
        // 홈페이지 링크 업데이트
        const homeLink = document.getElementById('party-home-link');
        if (homeLink) {
            if (selectedParty === "무소속" || !partyInfo.url) {
                homeLink.style.display = "none";
            } else {
                homeLink.style.display = "inline-block";
                homeLink.href = partyInfo.url;
            }
        }
        
        // 정당 색상 업데이트 (styles.css 팔레트 사용)
        updatePartyColors(selectedParty);
        
        // URL 업데이트
        if (history.pushState) {
            const url = new URL(window.location);
            url.searchParams.set('party', selectedParty);
            history.pushState({ party: selectedParty }, '', url);
        }
        
        // 🎯 새로운 데이터 로드
        await fetchPartyData(selectedParty);
    }

    // === 🔧 전역 함수 등록 (기본 새로고침만 제공) ===

    // 수동 새로고침 기능만 제공 (가중치 업데이트 관련 제거)
    window.refreshPartyDetailData = function() {
        console.log('[PercentParty] 🔄 수동 새로고침 요청');
        return fetchPartyData(pageState.currentParty);
    };

    window.refreshPartyDetails = function() {
        console.log('[PercentParty] 🔄 수동 새로고침 요청');
        return fetchPartyData(pageState.currentParty);
    };

    // 브라우저 뒤로/앞으로 버튼 처리
    window.addEventListener('popstate', function(event) {
        if (event.state && event.state.party) {
            onPartyChange(event.state.party);
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            const partyFromUrl = urlParams.get('party');
            if (partyFromUrl) {
                onPartyChange(partyFromUrl);
            }
        }
    });

    // === 🚀 페이지 초기화 ===
    async function initializePage() {  
        console.log('[PercentParty] 📊 정당 상세 페이지 초기화 중... (가중치 반영 없음)');
        
        try {
            // URL 파라미터에서 정당명 가져오기
            const urlParams = new URLSearchParams(window.location.search);
            const selectedPartyFromUrl = urlParams.get('party');
            
            // 초기 정당 설정
            const initialParty = selectedPartyFromUrl || '더불어민주당';
            pageState.currentParty = initialParty;
            
            // 드롭다운 메뉴 토글
            const dropdownBtn = document.querySelector('.dropdown-btn');
            const dropdown = document.querySelector('.dropdown');
            
            if (dropdownBtn && dropdown) {
                dropdownBtn.addEventListener('click', function() {
                    dropdown.classList.toggle('active');
                });
            }
            
            // 드롭다운 항목 선택 시 처리
            const dropdownItems = document.querySelectorAll('.dropdown-content a');
            
            dropdownItems.forEach(item => {
                item.addEventListener('click', async function(e) {
                    e.preventDefault();
                    const selectedParty = this.dataset.party;
                    
                    await onPartyChange(selectedParty);
                    if (dropdown) {
                        dropdown.classList.remove('active');
                    }
                });
            });
            
            // 드롭다운 외부 클릭 시 닫기
            document.addEventListener('click', function(e) {
                if (dropdown && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });
            
            // APIService 준비 대기
            await waitForAPIService();
            
            // API 연결 확인
            if (!window.APIService || !window.APIService._isReady) {
                console.warn('[PercentParty] ⚠️ API 서비스가 연결되지 않았습니다. 기본 데이터를 사용합니다.');
                showError('API 연결 실패. 기본 데이터를 표시합니다.');
            } else {
                console.log('[PercentParty] ✅ API 서비스 연결됨');
            }
            
            // 초기 정당 데이터 로드
            console.log('[PercentParty] 🎯 초기 정당 설정:', initialParty);
            await onPartyChange(initialParty);
            
            console.log('[PercentParty] ✅ 정당 상세 페이지 초기화 완료');
            
        } catch (error) {
            console.error('[PercentParty] ❌ 페이지 초기화 실패:', error);
            
            // 폴백: 기본 데이터로 표시
            const testData = generateTestDataForParty('더불어민주당');
            updateChartFromData(testData, '더불어민주당');
            
            showNotification('일부 데이터 로드에 실패했습니다', 'warning', 5000);
        }
    }

    // === 🔧 디버그 유틸리티 (전역) ===
    window.partyPageDebug = {
        getState: () => pageState,
        getCurrentParty: () => pageState.currentParty,
        changeParty: (partyName) => onPartyChange(partyName),
        refreshData: () => fetchPartyData(pageState.currentParty),
        testAPICall: async () => {
            try {
                const [performance, ranking] = await Promise.all([
                    window.APIService.getPartyPerformance(),
                    window.APIService.getPartyScoreRanking()
                ]);
                console.log('[PercentParty] 🧪 성과 API 테스트 결과:', performance);
                console.log('[PercentParty] 🧪 랭킹 API 테스트 결과:', ranking);
                return { performance, ranking };
            } catch (error) {
                console.error('[PercentParty] 🧪 API 테스트 실패:', error);
                return null;
            }
        },
        showInfo: () => {
            console.log('[PercentParty] 📊 정당 상세 페이지 정보:');
            console.log('- 현재 정당:', pageState.currentParty);
            console.log('- APIService 상태:', window.APIService?._isReady ? '연결됨' : '연결 안됨');
            console.log('- 가중치 변경 감지: 비활성화됨 (제거됨)');
            console.log('- HTML 순서와 매핑:', statisticsConfig.map(c => c.label));
            console.log('- 성과 데이터:', Object.keys(pageState.partyPerformanceData).length > 0 ? '로드됨' : '미로드');
            console.log('- 랭킹 데이터:', Object.keys(pageState.partyRankingData).length > 0 ? '로드됨' : '미로드');
            console.log('- 환경 정보:', window.APIService?.getEnvironmentInfo());
            console.log('- 퍼센트 기준:', PERCENTAGE_CRITERIA);
            console.log('- 색상 시스템: styles.css 팔레트 사용');
        },
        testHTMLMapping: () => {
            console.log('[PercentParty] 🔍 HTML 매핑 테스트...');
            const statsItems = document.querySelectorAll('.stats-item');
            statisticsConfig.forEach((config, index) => {
                const label = statsItems[index]?.querySelector('.label')?.textContent;
                const value = statsItems[index]?.querySelector('.value')?.textContent;
                console.log(`${index + 1}. ${config.label} (${config.key}): ${label} = ${value}`);
            });
        },
        testNormalization: (testData) => {
            console.log('[PercentParty] 🔧 퍼센트 정규화 테스트 (최적화된 기준):');
            console.log('입력 데이터:', testData);
            console.log('퍼센트 기준:', PERCENTAGE_CRITERIA);
            
            const testPartyData = {
                avg_attendance: testData?.attendance || 87.5,
                bill_pass_sum: testData?.billPass || 96, // 96건
                petition_sum: testData?.petition || 64, // 64건  
                petition_pass_sum: testData?.petitionPass || 42, // 42건
                committee_leader_count: testData?.leader || 3, // 3명 → 8% (있음)
                committee_secretary_count: testData?.secretary || 8, // 8명 → 5% (있음)
                avg_invalid_vote_ratio: testData?.invalid || 0.058,
                avg_vote_match_ratio: testData?.match || 0.892,
                avg_vote_mismatch_ratio: testData?.mismatch || 0.108
            };
            
            console.log('원본 API 형식:', testPartyData);
            
            // 최적화된 변환 테스트
            console.log('최적화된 변환 테스트:');
            console.log(`  - 본회의 가결: 96건 → ${convertCountToPercentage(96, PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX).toFixed(1)}% (기준: ${PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX}건)`);
            console.log(`  - 청원 제안: 64건 → ${convertCountToPercentage(64, PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX).toFixed(1)}% (기준: ${PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX}건)`);
            console.log(`  - 청원 결과: 42건 → ${convertCountToPercentage(42, PERCENTAGE_CRITERIA.PETITION_RESULT_MAX).toFixed(1)}% (기준: ${PERCENTAGE_CRITERIA.PETITION_RESULT_MAX}건)`);
            console.log(`  - 위원장: 3명 → ${convertLeaderToPercentage(3)}% (고정)`);
            console.log(`  - 간사: 8명 → ${convertSecretaryToPercentage(8)}% (고정)`);
            
            const mapped = mapApiDataToChartFormat(testPartyData, '테스트정당');
            console.log('매핑된 차트 데이터:', mapped);
            
            return mapped;
        },
        testPerformanceData: () => fetchPartyPerformanceData(),
        testRankingData: () => fetchPartyRankingData(),
        getPerformanceData: () => pageState.partyPerformanceData,
        getRankingData: () => pageState.partyRankingData,
        getCriteria: () => PERCENTAGE_CRITERIA,
        testColorSystem: () => {
            console.log('[PercentParty] 🎨 색상 시스템 테스트:');
            Object.keys(partyColors).forEach(partyName => {
                const partyInfo = partyColors[partyName];
                console.log(`${partyName}:`, {
                    main: partyInfo.main,
                    secondary: partyInfo.secondary,
                    url: partyInfo.url || '없음'
                });
            });
        }
    };

    // 초기화 실행
    initializePage();

    console.log('[PercentParty] ✅ percent_party.js 로드 완료 (styles.css 색상 적용 + 최적화된 퍼센트 기준 - 가중치 반영 제거)');
    console.log('[PercentParty] 🔗 API 모드: Django API 직접 연동');
    console.log('[PercentParty] 🎨 색상 시스템: styles.css 정당별 색상 팔레트 사용');
    console.log('[PercentParty] 📊 최적화된 퍼센트 기준:');
    console.log('[PercentParty]   - 본회의 가결:', `최대 ${PERCENTAGE_CRITERIA.PLENARY_BILLS_MAX}건 기준`);
    console.log('[PercentParty]   - 청원 제안:', `최대 ${PERCENTAGE_CRITERIA.PETITION_PROPOSAL_MAX}건 기준`);
    console.log('[PercentParty]   - 청원 결과:', `최대 ${PERCENTAGE_CRITERIA.PETITION_RESULT_MAX}건 기준`);
    console.log('[PercentParty]   - 위원장:', `있으면 ${PERCENTAGE_CRITERIA.COMMITTEE_CHAIR_PERCENT}% (고정)`);
    console.log('[PercentParty]   - 간사:', `있으면 ${PERCENTAGE_CRITERIA.SECRETARY_PERCENT}% (고정)`);
    console.log('[PercentParty]   - 무효표/기권:', `최대 ${PERCENTAGE_CRITERIA.INVALID_VOTE_MAX}%로 제한`);
    console.log('[PercentParty] 🔧 주요 변경사항:');
    console.log('[PercentParty]   - 가중치 변경 감지 시스템 완전 제거');
    console.log('[PercentParty]   - setupWeightChangeListener() 함수 제거');
    console.log('[PercentParty]   - handleWeightUpdate() 함수 제거'); 
    console.log('[PercentParty]   - 가중치 관련 이벤트 리스너들 제거');
    console.log('[PercentParty]   - WeightSync 호환 업데이트 함수들 제거');
    console.log('[PercentParty]   - 수동 새로고침 기능만 유지');
    console.log('[PercentParty] 🔧 디버그 명령어:');
    console.log('[PercentParty]   - window.partyPageDebug.showInfo() : 페이지 정보 확인');
    console.log('[PercentParty]   - window.partyPageDebug.refreshData() : 수동 새로고침');
    console.log('[PercentParty]   - window.partyPageDebug.testColorSystem() : 색상 시스템 테스트');
    console.log('[PercentParty]   - window.partyPageDebug.getCriteria() : 퍼센트 기준 확인');
    console.log('[PercentParty]   - window.partyPageDebug.testNormalization(data) : 정규화 테스트');
});
