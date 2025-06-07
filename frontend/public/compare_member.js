document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 국회의원 비교 페이지 로드 시작 (Django API 연동 + 가중치 감지 버전)');

    // === 🔧 상태 관리 변수들 ===
    let mpData = [];
    let selectedMembers = [];
    let isLoading = false;
    let partyData = {};
    let memberPhotos = {};
    let memberPerformanceData = {};
    let memberAttendanceData = {};
    let memberBillCountData = {};
    let memberRankingData = {};

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

    // 정당별 색상 데이터 가져오기 (폴백 색상 포함)
    function getPartyColors() {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        return {
            "더불어민주당": {
                color: computedStyle.getPropertyValue('--party-dp-main')?.trim() || "#152484",
                lightColor: computedStyle.getPropertyValue('--party-dp-secondary')?.trim() || "#15248480",
                bgColor: computedStyle.getPropertyValue('--party-dp-bg')?.trim() || "#152484"
            },
            "국민의힘": {
                color: computedStyle.getPropertyValue('--party-ppp-main')?.trim() || "#E61E2B",
                lightColor: computedStyle.getPropertyValue('--party-ppp-secondary')?.trim() || "#E61E2B80",
                bgColor: computedStyle.getPropertyValue('--party-ppp-bg')?.trim() || "#E61E2B"
            },
            "조국혁신당": {
                color: computedStyle.getPropertyValue('--party-rk-main')?.trim() || "#06275E",
                lightColor: computedStyle.getPropertyValue('--party-rk-secondary')?.trim() || "#0073CF",
                bgColor: computedStyle.getPropertyValue('--party-rk-bg')?.trim() || "#06275E"
            },
            "개혁신당": {
                color: computedStyle.getPropertyValue('--party-reform-main')?.trim() || "#FF7210",
                lightColor: computedStyle.getPropertyValue('--party-reform-secondary')?.trim() || "#FF721080",
                bgColor: computedStyle.getPropertyValue('--party-reform-bg')?.trim() || "#FF7210"
            },
            "진보당": {
                color: computedStyle.getPropertyValue('--party-jp-main')?.trim() || "#D6001C",
                lightColor: computedStyle.getPropertyValue('--party-jp-secondary')?.trim() || "#D6001C80",
                bgColor: computedStyle.getPropertyValue('--party-jp-bg')?.trim() || "#D6001C"
            },
            "기본소득당": {
                color: computedStyle.getPropertyValue('--party-bip-main')?.trim() || "#091E3A",
                lightColor: computedStyle.getPropertyValue('--party-bip-secondary')?.trim() || "#00D2C3",
                bgColor: computedStyle.getPropertyValue('--party-bip-bg')?.trim() || "#091E3A"
            },
            "사회민주당": {
                color: computedStyle.getPropertyValue('--party-sdp-main')?.trim() || "#43A213",
                lightColor: computedStyle.getPropertyValue('--party-sdp-secondary')?.trim() || "#F58400",
                bgColor: computedStyle.getPropertyValue('--party-sdp-bg')?.trim() || "#43A213"
            },
            "무소속": {
                color: computedStyle.getPropertyValue('--party-ind-main')?.trim() || "#4B5563",
                lightColor: computedStyle.getPropertyValue('--party-ind-secondary')?.trim() || "#9CA3AF",
                bgColor: computedStyle.getPropertyValue('--party-ind-bg')?.trim() || "#4B5563"
            }
        };
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
    }

    // 로딩 상태 표시
    function showLoading(show = true) {
        isLoading = show;
        const cards = document.querySelectorAll('.comparison-card');
        cards.forEach(card => {
            if (show) {
                card.style.opacity = '0.6';
                card.style.pointerEvents = 'none';
            } else {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
        });
    }

    // 정당명 정규화
    function normalizePartyName(partyName) {
        if (!partyName) return '무소속';
        
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

    // 국회의원 실적 데이터 로드
    async function fetchMemberPerformanceData() {
        try {
            console.log('📊 국회의원 실적 데이터 조회...');
            
            const rawData = await window.APIService.getMemberPerformance();
            
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('국회의원 실적 API 응답이 올바르지 않습니다.');
            }
            
            // 실적 데이터 매핑
            const performanceData = {};
            rawData.forEach(member => {
                const memberName = member.lawmaker_name || member.name;
                if (memberName) {
                    performanceData[memberName] = {
                        // === 기본 정보 ===
                        lawmaker_name: memberName,
                        party: normalizePartyName(member.party),
                        
                        // === 실적 점수들 (데이터 매핑에 따름) ===
                        total_score: parseFloat(member.total_score || member.total_socre || 0), // API에 오타가 있을 수 있음
                        attendance_score: parseFloat(member.attendance_score || 0),
                        petition_score: parseFloat(member.petition_score || 0),
                        petition_result_score: parseFloat(member.petition_result_score || 0),
                        committee_score: parseFloat(member.committee_score || 0),
                        
                        // === 투표 관련 ===
                        invalid_vote_ratio: parseFloat(member.invalid_vote_ratio || 0),
                        vote_match_ratio: parseFloat(member.vote_match_ratio || 0),
                        vote_mismatch_ratio: parseFloat(member.vote_mismatch_ratio || 0),
                        
                        // === 연결 ID ===
                        lawmaker_id: member.lawmaker || member.id,
                        
                        // === 원본 데이터 ===
                        _raw: member
                    };
                }
            });
            
            memberPerformanceData = performanceData;
            console.log(`✅ 국회의원 실적 데이터 로드 완료: ${Object.keys(performanceData).length}명`);
            return performanceData;
            
        } catch (error) {
            console.error('❌ 국회의원 실적 데이터 로드 실패:', error);
            memberPerformanceData = {};
            throw error;
        }
    }

    // 국회의원 출석 데이터 로드
    async function fetchMemberAttendanceData() {
        try {
            console.log('🏛️ 국회의원 출석 데이터 조회...');
            
            const rawData = await window.APIService.getMemberAttendance();
            
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('국회의원 출석 API 응답이 올바르지 않습니다.');
            }
            
            // 출석 데이터 매핑
            const attendanceData = {};
            rawData.forEach(member => {
                const memberName = member.member_name || member.lawmaker_name;
                if (memberName) {
                    attendanceData[memberName] = {
                        // === 기본 정보 ===
                        member_name: memberName,
                        party: normalizePartyName(member.party),
                        
                        // === 출석 관련 (데이터 매핑에 따름) ===
                        total_meetings: parseInt(member.total_meetings || 0),
                        attendance: parseInt(member.attendance || 0),
                        absences: parseInt(member.absences || 0),
                        leaves: parseInt(member.leaves || 0),
                        business_trips: parseInt(member.business_trips || 0),
                        attendance_rate: parseFloat(member.attendance_rate || 0),
                        
                        // === 원본 데이터 ===
                        _raw: member
                    };
                }
            });
            
            memberAttendanceData = attendanceData;
            console.log(`✅ 국회의원 출석 데이터 로드 완료: ${Object.keys(attendanceData).length}명`);
            return attendanceData;
            
        } catch (error) {
            console.error('❌ 국회의원 출석 데이터 로드 실패:', error);
            memberAttendanceData = {};
            throw error;
        }
    }

    // 국회의원 법안 수 데이터 로드
    async function fetchMemberBillCountData() {
        try {
            console.log('📋 국회의원 법안 수 데이터 조회...');
            
            const rawData = await window.APIService.getMemberBillCount();
            
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('국회의원 법안 수 API 응답이 올바르지 않습니다.');
            }
            
            // 법안 수 데이터 매핑 (id로 연결)
            const billCountData = {};
            rawData.forEach(bill => {
                const proposerName = bill.proposer;
                if (proposerName) {
                    billCountData[proposerName] = {
                        // === 기본 정보 ===
                        id: bill.id,
                        proposer: proposerName,
                        
                        // === 법안 수 관련 (데이터 매핑에 따름) ===
                        total: parseInt(bill.total || 0),
                        approved: parseInt(bill.approved || 0),
                        discarded: parseInt(bill.discarded || 0),
                        rejected: parseInt(bill.rejected || 0),
                        other: parseInt(bill.other || 0),
                        
                        // === 원본 데이터 ===
                        _raw: bill
                    };
                }
            });
            
            memberBillCountData = billCountData;
            console.log(`✅ 국회의원 법안 수 데이터 로드 완료: ${Object.keys(billCountData).length}명`);
            return billCountData;
            
        } catch (error) {
            console.error('❌ 국회의원 법안 수 데이터 로드 실패:', error);
            memberBillCountData = {};
            throw error;
        }
    }

    // 국회의원 랭킹 데이터 로드
    async function fetchMemberRankingData() {
        try {
            console.log('🏆 국회의원 랭킹 데이터 조회...');
            
            const rawData = await window.APIService.getMemberRanking();
            
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('국회의원 랭킹 API 응답이 올바르지 않습니다.');
            }
            
            // 랭킹 데이터 매핑
            const rankingData = {};
            rawData.forEach(member => {
                const memberName = member.HG_NM || member.lawmaker_name;
                if (memberName) {
                    rankingData[memberName] = {
                        // === 기본 정보 ===
                        name: memberName,
                        party: normalizePartyName(member.POLY_NM || member.party),
                        
                        // === 랭킹 정보 (데이터 매핑에 따름) ===
                        총점_순위: parseInt(member.총점_순위 || 999),
                        출석_순위: parseInt(member.출석_순위 || 999),
                        법안가결_순위: parseInt(member.법안가결_순위 || 999),
                        청원제시_순위: parseInt(member.청원제시_순위 || 999),
                        청원결과_순위: parseInt(member.청원결과_순위 || 999),
                        기권_무효_순위: parseInt(member.기권_무효_순위 || 999),
                        표결일치_순위: parseInt(member.표결일치_순위 || 999),
                        표결불일치_순위: parseInt(member.표결불일치_순위 || 999),
                        
                        // === 원본 데이터 ===
                        _raw: member
                    };
                }
            });
            
            memberRankingData = rankingData;
            console.log(`✅ 국회의원 랭킹 데이터 로드 완료: ${Object.keys(rankingData).length}명`);
            return rankingData;
            
        } catch (error) {
            console.error('❌ 국회의원 랭킹 데이터 로드 실패:', error);
            memberRankingData = {};
            throw error;
        }
    }

    // 국회의원 사진 데이터 로드
    async function fetchMemberPhotos() {
        try {
            console.log('📷 국회의원 사진 데이터 조회...');
            
            const rawData = await window.APIService.getMemberPhotos();
            
            if (!rawData || !Array.isArray(rawData)) {
                throw new Error('국회의원 사진 API 응답이 올바르지 않습니다.');
            }
            
            // 사진 데이터 매핑
            const photosData = {};
            rawData.forEach(photo => {
                const memberName = photo.member_name;
                if (memberName && photo.photo) {
                    photosData[memberName] = {
                        // === 기본 정보 ===
                        member_code: photo.member_code,
                        member_name: memberName,
                        
                        // === 사진 URL (데이터 매핑에 따름) ===
                        photo: photo.photo,
                        
                        // === 원본 데이터 ===
                        _raw: photo
                    };
                }
            });
            
            memberPhotos = photosData;
            console.log(`✅ 국회의원 사진 데이터 로드 완료: ${Object.keys(photosData).length}명`);
            return photosData;
            
        } catch (error) {
            console.error('❌ 국회의원 사진 데이터 로드 실패:', error);
            memberPhotos = {};
            throw error;
        }
    }

    // 두 국회의원 직접 비교 API 호출
    async function fetchMemberDirectComparison(member1, member2) {
        try {
            console.log(`🆚 국회의원 직접 비교 API 호출: ${member1} vs ${member2}`);
            
            const comparisonData = await window.APIService.compareMembers(member1, member2);
            
            if (comparisonData) {
                console.log(`✅ 국회의원 직접 비교 데이터 로드 완료: ${member1} vs ${member2}`);
                return comparisonData;
            }
            
            return null;
            
        } catch (error) {
            console.warn(`⚠️ 국회의원 직접 비교 API 실패, 기본 비교 로직 사용:`, error);
            return null;
        }
    }

    // === 📊 데이터 통합 및 가공 ===

    // APIService를 통해 국회의원 데이터 통합 로드
    async function fetchMemberData() {
        try {
            console.log('📋 국회의원 데이터 통합 로드 중...');
            showLoading(true);

            // APIService가 준비될 때까지 대기
            await waitForAPIService();

            if (!window.APIService || !window.APIService._isReady) {
                throw new Error('APIService를 사용할 수 없습니다');
            }

            // 병렬로 모든 데이터 로드
            const [performanceResult, attendanceResult, billCountResult, rankingResult, photosResult] = await Promise.allSettled([
                fetchMemberPerformanceData(),
                fetchMemberAttendanceData(),
                fetchMemberBillCountData(),
                fetchMemberRankingData(),
                fetchMemberPhotos()
            ]);

            // 결과 확인 및 로그
            const results = {
                performance: performanceResult.status === 'fulfilled',
                attendance: attendanceResult.status === 'fulfilled',
                billCount: billCountResult.status === 'fulfilled',
                ranking: rankingResult.status === 'fulfilled',
                photos: photosResult.status === 'fulfilled'
            };

            console.log('📊 API 로드 결과:', results);

            // 국회의원 데이터 통합 및 가공
            const allMemberNames = new Set();
            
            // 모든 API에서 의원 이름 수집
            Object.keys(memberPerformanceData).forEach(name => allMemberNames.add(name));
            Object.keys(memberAttendanceData).forEach(name => allMemberNames.add(name));
            Object.keys(memberBillCountData).forEach(name => allMemberNames.add(name));
            Object.keys(memberRankingData).forEach(name => allMemberNames.add(name));
            Object.keys(memberPhotos).forEach(name => allMemberNames.add(name));

            mpData = Array.from(allMemberNames).map(memberName => {
                const performance = memberPerformanceData[memberName];
                const attendance = memberAttendanceData[memberName];
                const billCount = memberBillCountData[memberName];
                const ranking = memberRankingData[memberName];
                const photo = memberPhotos[memberName];
                
                // 정당 정보 우선순위: 실적 > 출석 > 랭킹
                const memberParty = normalizePartyName(
                    performance?.party || 
                    attendance?.party || 
                    ranking?.party || 
                    '무소속'
                );
                
                return {
                    id: performance?.lawmaker_id || billCount?.id || Math.random().toString(36),
                    name: memberName,
                    party: memberParty,
                    district: `${memberParty} 소속`, // 지역구 정보가 없으므로 정당으로 대체
                    photo: photo?.photo || 'https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png',
                    
                    // 원본 데이터들
                    performance: performance,
                    attendance: attendance,
                    billCount: billCount,
                    ranking: ranking,
                    photoData: photo,
                    
                    // 계산된 통계
                    stats: calculateMemberStats(performance, attendance, billCount, ranking)
                };
            }).filter(member => member.name); // 이름이 있는 의원만

            // 데이터가 없는 경우 기본 데이터 사용
            if (mpData.length === 0) {
                mpData = getDefaultMemberData();
                showNotification('기본 데이터를 사용합니다', 'warning');
            }

            console.log('✅ 국회의원 데이터 통합 완료:', mpData.length, '명');
            showNotification(`국회의원 데이터 로드 완료 (${mpData.length}명)`, 'success');

        } catch (error) {
            console.error('❌ 국회의원 데이터 로드 실패:', error);
            
            // API 실패 시 기본 데이터 사용
            mpData = getDefaultMemberData();
            showError('국회의원 데이터를 불러오는데 실패했습니다. 기본 데이터를 사용합니다.');
        } finally {
            showLoading(false);
        }
    }

    // 국회의원별 통계 계산 (새로운 API 데이터 기반)
    function calculateMemberStats(performance, attendance, billCount, ranking) {
        try {
            // 1. 출석률 계산 (출석 API 데이터 우선 사용)
            let attendanceRate = 85; // 기본값
            let attendanceDetails = null;
            
            if (attendance) {
                attendanceRate = attendance.attendance_rate || 85;
                attendanceDetails = {
                    totalMeetings: attendance.total_meetings || 150,
                    attendance: attendance.attendance || Math.floor(attendanceRate * 1.5),
                    absences: attendance.absences || 0,
                    leaves: attendance.leaves || 0,
                    businessTrips: attendance.business_trips || 0
                };
            } else if (performance) {
                // 실적 API의 출석 점수 사용
                attendanceRate = performance.attendance_score || 85;
            }

            // 2. 법안 관련 통계 (법안 수 API 데이터 우선 사용)
            let billProposed = 30;
            let billPassRate = 35;
            let billDetails = null;
            
            if (billCount) {
                billProposed = billCount.total || 30;
                const approved = billCount.approved || 0;
                billPassRate = billProposed > 0 ? (approved / billProposed) * 100 : 35;
                
                billDetails = {
                    total: billProposed,
                    approved: billCount.approved || 0,
                    discarded: billCount.discarded || 0,
                    rejected: billCount.rejected || 0,
                    other: billCount.other || 0
                };
            } else if (performance) {
                // 실적 API의 본회의 가결 점수 사용
                billPassRate = performance.attendance_score || 35; // attendance_score가 본회의 가결 점수
                billProposed = Math.floor(billPassRate * 2); // 추정
            }

            // 3. 청원 통계 (실적 API 데이터 사용)
            let petitionProposed = 10;
            let petitionResult = 5;
            
            if (performance) {
                petitionProposed = performance.petition_score || 10;
                petitionResult = performance.petition_result_score || 5;
            }

            // 4. 위원회 정보 (실적 API + 기본 생성)
            let committeeInfo = getCommitteeInfo();
            if (performance && performance.committee_score) {
                // 위원회 점수가 높으면 더 높은 직책
                if (performance.committee_score > 80) {
                    committeeInfo.rank = 3; // 위원장
                } else if (performance.committee_score > 60) {
                    committeeInfo.rank = 2; // 간사
                } else {
                    committeeInfo.rank = 1; // 일반의원
                }
            }

            // 5. 투표 통계 (실적 API 데이터 사용)
            let invalidVoteRatio = 0.02;
            let voteMatchRatio = 0.85;
            let voteMismatchRatio = 0.15;
            
            if (performance) {
                invalidVoteRatio = performance.invalid_vote_ratio || 0.02;
                voteMatchRatio = performance.vote_match_ratio || 0.85;
                voteMismatchRatio = performance.vote_mismatch_ratio || 0.15;
            }

            // 6. 랭킹 정보
            let totalRank = 999;
            if (ranking) {
                totalRank = ranking.총점_순위 || 999;
            }

            return {
                // 출석 관련
                attendance: Math.round(attendanceRate),
                attendanceDetails: attendanceDetails,
                
                // 법안 관련
                billProposed: billProposed,
                billPassRate: Math.round(billPassRate),
                billDetails: billDetails,
                
                // 청원 관련
                petitionProposed: Math.round(petitionProposed),
                petitionResult: Math.round(petitionResult),
                
                // 위원회 관련
                committeePosition: committeeInfo.position,
                committeeRank: committeeInfo.rank,
                
                // 투표 관련
                invalidVotes: Math.round(invalidVoteRatio * 1000), // 건수로 변환
                voteConsistency: Math.round(voteMatchRatio * 100),
                voteInconsistency: Math.round(voteMismatchRatio * 100),
                
                // 랭킹 정보
                totalRank: totalRank,
                
                // 점수 정보 (실적 API)
                totalScore: performance?.total_score || 75,
                attendanceScore: performance?.attendance_score || attendanceRate,
                petitionScore: performance?.petition_score || petitionProposed,
                petitionResultScore: performance?.petition_result_score || petitionResult,
                committeeScore: performance?.committee_score || 50,
                
                // 원본 데이터 참조
                _performance: performance,
                _attendance: attendance,
                _billCount: billCount,
                _ranking: ranking
            };

        } catch (error) {
            console.error(`❌ 통계 계산 실패:`, error);
            return generateSampleStats();
        }
    }

    // 위원회 정보 생성
    function getCommitteeInfo() {
        const committees = [
            '국정감사위원회', '예산결산위원회', '법제사법위원회', '정무위원회', 
            '기획재정위원회', '교육위원회', '과학기술정보방송통신위원회', '외교통일위원회',
            '국방위원회', '행정안전위원회', '문화체육관광위원회', '농림축산식품해양수산위원회',
            '산업통상자원중소벤처기업위원회', '보건복지위원회', '환경노동위원회', '국토교통위원회'
        ];
        
        const positions = ['일반의원', '간사', '상임위원장'];
        const ranks = [1, 2, 3];
        
        const random = Math.random();
        let positionIndex;
        
        if (random < 0.1) { // 10% 확률로 위원장
            positionIndex = 2;
        } else if (random < 0.25) { // 15% 확률로 간사
            positionIndex = 1;
        } else {
            positionIndex = 0;
        }
        
        const committee = committees[Math.floor(Math.random() * committees.length)];
        const position = positions[positionIndex];
        const rank = ranks[positionIndex];
        
        return {
            position: `${committee} ${position}`,
            rank: rank,
            department: committee
        };
    }

    // 샘플 통계 생성 (API 실패 시)
    function generateSampleStats() {
        const consistency = Math.floor(Math.random() * 30) + 70;
        const committeeInfo = getCommitteeInfo();
        
        return {
            attendance: Math.round(Math.random() * 20 + 75),
            billProposed: Math.floor(Math.random() * 50) + 20,
            billPassRate: Math.floor(Math.random() * 40) + 30,
            petitionProposed: Math.floor(Math.random() * 20) + 5,
            petitionResult: Math.floor(Math.random() * 15) + 3,
            committeePosition: committeeInfo.position,
            committeeRank: committeeInfo.rank,
            invalidVotes: Math.floor(Math.random() * 10) + 2,
            voteConsistency: consistency,
            voteInconsistency: 100 - consistency,
            totalRank: Math.floor(Math.random() * 300) + 1,
            attendanceDetails: {
                totalMeetings: Math.floor(Math.random() * 50) + 100,
                attendance: Math.floor(Math.random() * 40) + 80,
                absences: Math.floor(Math.random() * 10) + 2,
                leaves: Math.floor(Math.random() * 5) + 1,
                businessTrips: Math.floor(Math.random() * 8) + 2
            },
            billDetails: {
                total: Math.floor(Math.random() * 50) + 20,
                approved: Math.floor(Math.random() * 30) + 10,
                discarded: Math.floor(Math.random() * 10) + 3,
                rejected: Math.floor(Math.random() * 8) + 2,
                other: Math.floor(Math.random() * 5) + 1
            }
        };
    }

    // 기본 국회의원 데이터 (API 실패 시 사용)
    function getDefaultMemberData() {
        return [
            {
                id: 1,
                name: "김민석",
                party: "더불어민주당",
                district: "서울 영등포구갑",
                photo: "https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png",
                stats: generateSampleStats()
            },
            {
                id: 2,
                name: "김병욱",
                party: "국민의힘",
                district: "대구 수성구갑",
                photo: "https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png",
                stats: generateSampleStats()
            },
            {
                id: 3,
                name: "김상훈",
                party: "국민의힘",
                district: "경북 구미시갑",
                photo: "https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png",
                stats: generateSampleStats()
            },
            {
                id: 4,
                name: "한동훈",
                party: "국민의힘",
                district: "서울 동작구을",
                photo: "https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png",
                stats: generateSampleStats()
            }
        ];
    }

    // === 🎨 UI 업데이트 함수들 ===

    // 국회의원 선택 함수
    function selectMP(mp, cardIndex) {
        const comparisonCards = document.querySelectorAll('.comparison-card');
        const card = comparisonCards[cardIndex];
        
        if (card) {
            // 이미 선택된 의원인지 확인
            if (selectedMembers.includes(mp.id) && mp.id !== null) {
                showNotification('이미 다른 칸에서 선택된 의원입니다', 'warning');
                return;
            }

            // 이전 선택 해제
            if (selectedMembers[cardIndex]) {
                const prevIndex = selectedMembers.indexOf(selectedMembers[cardIndex]);
                if (prevIndex !== -1 && prevIndex !== cardIndex) {
                    selectedMembers[prevIndex] = null;
                }
            }

            // 새로운 선택 저장
            selectedMembers[cardIndex] = mp.id;

            // localStorage에 현재 비교 정보 저장 (weight_sync.js에서 사용)
            if (selectedMembers[0] && selectedMembers[1]) {
                const member1 = mpData.find(m => m.id === selectedMembers[0]);
                const member2 = mpData.find(m => m.id === selectedMembers[1]);
                if (member1 && member2) {
                    localStorage.setItem('current_member_comparison', JSON.stringify({
                        member1: member1.name,
                        member2: member2.name
                    }));
                }
            }

            // 선택된 국회의원 정보 업데이트
            const mpSelected = card.querySelector('.mp-selected');
            const mpImage = mpSelected.querySelector('img');
            const mpName = mpSelected.querySelector('.mp-selected-name');
            const mpParty = mpSelected.querySelector('.mp-selected-party');
            
            // 의원 정보 업데이트
            mpImage.src = mp.photo;
            mpImage.onerror = function() {
                this.src = 'https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png';
            };
            mpName.textContent = mp.name;
            mpParty.textContent = `${mp.party} · ${mp.district}`;
            
            // 통계 정보 업데이트
            updateMPStats(card, mp, cardIndex);
            
            // 툴팁 상세 정보 업데이트
            updateTooltipDetails(card, mp);
            
            // 다른 카드에 의원이 선택되어 있다면 비교 업데이트
            const otherCardIndex = cardIndex === 0 ? 1 : 0;
            const otherMemberId = selectedMembers[otherCardIndex];
            if (otherMemberId) {
                const otherMember = mpData.find(m => m.id === otherMemberId);
                if (otherMember) {
                    const otherCard = comparisonCards[otherCardIndex];
                    updateMPStats(otherCard, otherMember, otherCardIndex);
                }
            }
            
            console.log(`✅ ${mp.name} 선택 완료 (카드 ${cardIndex + 1})`);
            showNotification(`${mp.name} 의원 정보 로드 완료`, 'success');
        }
    }

    // 국회의원 초기화 함수
    function resetMP(cardIndex) {
        const comparisonCards = document.querySelectorAll('.comparison-card');
        const card = comparisonCards[cardIndex];
        
        if (card) {
            // 선택 해제
            selectedMembers[cardIndex] = null;

            // localStorage에서 비교 정보 제거
            localStorage.removeItem('current_member_comparison');

            const mpSelected = card.querySelector('.mp-selected');
            const mpImage = mpSelected.querySelector('img');
            const mpName = mpSelected.querySelector('.mp-selected-name');
            const mpParty = mpSelected.querySelector('.mp-selected-party');
            
            mpImage.src = 'https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png';
            mpName.textContent = '국회의원을 검색하세요';
            mpParty.textContent = '';
            
            // 통계 정보 초기화
            resetMPStats(card);
            
            // 툴팁 정보 초기화
            resetTooltipDetails(card);
            
            // 다른 카드에 의원이 선택되어 있다면 비교 없이 단독 표시로 업데이트
            const otherCardIndex = cardIndex === 0 ? 1 : 0;
            const otherMemberId = selectedMembers[otherCardIndex];
            if (otherMemberId) {
                const otherMember = mpData.find(m => m.id === otherMemberId);
                if (otherMember) {
                    const otherCard = comparisonCards[otherCardIndex];
                    updateMPStats(otherCard, otherMember, otherCardIndex);
                }
            }
            
            console.log(`🔄 카드 ${cardIndex + 1} 초기화 완료`);
        }
    }

    // 툴팁 상세 정보 업데이트
    function updateTooltipDetails(card, mp) {
        try {
            // 출석 상세 정보 업데이트
            if (mp.stats.attendanceDetails) {
                const details = mp.stats.attendanceDetails;
                const attendanceTooltip = card.querySelector('.tooltip-content[data-for="attendance"]');
                if (attendanceTooltip) {
                    attendanceTooltip.querySelector('.detail-total-meetings').textContent = details.totalMeetings || '-';
                    attendanceTooltip.querySelector('.detail-attendance').textContent = details.attendance || '-';
                    attendanceTooltip.querySelector('.detail-absences').textContent = details.absences || '-';
                    attendanceTooltip.querySelector('.detail-leaves').textContent = details.leaves || '-';
                    attendanceTooltip.querySelector('.detail-business-trips').textContent = details.businessTrips || '-';
                }
            }

            // 법안 상세 정보 업데이트
            if (mp.stats.billDetails) {
                const details = mp.stats.billDetails;
                const billTooltip = card.querySelector('.tooltip-content[data-for="bill"]');
                if (billTooltip) {
                    billTooltip.querySelector('.detail-bill-total').textContent = details.total || '-';
                    billTooltip.querySelector('.detail-bill-approved').textContent = details.approved || '-';
                    billTooltip.querySelector('.detail-bill-discarded').textContent = details.discarded || '-';
                    billTooltip.querySelector('.detail-bill-rejected').textContent = details.rejected || '-';
                    billTooltip.querySelector('.detail-bill-other').textContent = details.other || '-';
                }
            }
        } catch (error) {
            console.error('툴팁 상세 정보 업데이트 실패:', error);
        }
    }

    // 국회의원 통계 정보 업데이트 함수 (HTML 순서와 정확히 매칭)
    async function updateMPStats(card, mp, cardIndex) {
        const statusItems = card.querySelectorAll('.status-item');
        
        // 두 명이 모두 선택된 경우 비교 수행
        const otherCardIndex = cardIndex === 0 ? 1 : 0;
        const otherMemberId = selectedMembers[otherCardIndex];
        const otherMember = otherMemberId ? mpData.find(m => m.id === otherMemberId) : null;
        
        let isWinner = {};
        let comparisonData = null;
        
        if (otherMember) {
            // 1차: API 직접 비교 시도
            try {
                comparisonData = await fetchMemberDirectComparison(mp.name, otherMember.name);
                if (comparisonData) {
                    console.log(`✅ API 비교 데이터 사용: ${mp.name} vs ${otherMember.name}`);
                    isWinner = mapAPIComparisonData(comparisonData, cardIndex);
                }
            } catch (error) {
                console.warn('API 비교 실패, 로컬 비교 로직 사용');
            }
            
            // 2차: 로컬 비교 로직
            if (!comparisonData) {
                isWinner = compareMemberStats(mp, otherMember, cardIndex);
            }
        }

        // HTML과 동일한 순서로 업데이트 배열 정의
        // HTML 순서: 국회의원 선택(skip), 출석, 본회의 가결, 청원 제안, 청원 결과, 위원회, 무효표 및 기권, 투표 결과 일치, 투표 결과 불일치
        const updates = [
            { // 0. 출석
                key: 'attendance',
                value: mp.stats.attendance,
                suffix: '%',
                threshold: 90,
                reverse: false
            },
            { // 1. 본회의 가결
                key: 'billPassRate',
                value: mp.stats.billPassRate,
                suffix: '%',
                threshold: 40,
                reverse: false
            },
            { // 2. 청원 제안
                key: 'petitionProposed',
                value: mp.stats.petitionProposed,
                suffix: '건',
                threshold: 15,
                reverse: false
            },
            { // 3. 청원 결과
                key: 'petitionResult',
                value: mp.stats.petitionResult,
                suffix: '건',
                threshold: 8,
                reverse: false
            },
            { // 4. 위원회
                key: 'committeePosition',
                value: mp.stats.committeePosition,
                suffix: '',
                threshold: null,
                special: 'committee'
            },
            { // 5. 무효표 및 기권
                key: 'invalidVotes',
                value: mp.stats.invalidVotes,
                suffix: '건',
                threshold: 5,
                reverse: true
            },
            { // 6. 투표 결과 일치
                key: 'voteConsistency',
                value: mp.stats.voteConsistency,
                suffix: '%',
                threshold: 85,
                reverse: false
            },
            { // 7. 투표 결과 불일치
                key: 'voteInconsistency',
                value: mp.stats.voteInconsistency,
                suffix: '%',
                threshold: 20,
                reverse: true
            }
        ];

        // HTML의 status-item 순서와 정확히 매칭하여 업데이트
        updates.forEach((update, index) => {
            // index + 1은 HTML의 실제 status-item 인덱스 (0번은 국회의원 선택이므로)
            if (index + 1 < statusItems.length) {
                const statusItem = statusItems[index + 1];
                const valueElement = statusItem.querySelector('.status-value');
                
                if (valueElement && update.value !== undefined) {
                    let displayValue = update.value;
                    
                    // 특별 처리 (위원회)
                    if (update.special === 'committee') {
                        displayValue = update.value;
                    } else {
                        displayValue = update.value + update.suffix;
                    }
                    
                    // WIN/LOSE 표시 (두 명 모두 선택된 경우)
                    if (otherMember && update.threshold !== null) {
                        const won = isWinner[update.key] || false;
                        valueElement.innerHTML = `${won ? 'WIN' : 'LOSE'}(${displayValue})`;
                        valueElement.className = `status-value ${won ? 'win' : 'lose'}`;
                        
                        // 정당 색상 적용
                        if (partyData[mp.party]) {
                            valueElement.style.color = won ? 
                                partyData[mp.party].color : 
                                partyData[mp.party].lightColor;
                        }
                    } else {
                        valueElement.textContent = displayValue;
                        
                        // 위원회 특별 처리
                        if (update.special === 'committee') {
                            const committeeRank = mp.stats.committeeRank || 1;
                            valueElement.className = 'status-value ' + (committeeRank > 1 ? 'win' : 'lose');
                        } else if (update.threshold !== null) {
                            const isGood = update.reverse ? 
                                update.value < update.threshold : 
                                update.value > update.threshold;
                            valueElement.className = 'status-value ' + (isGood ? 'win' : 'lose');
                        } else {
                            valueElement.className = 'status-value';
                        }
                    }
                }
            }
        });
        
        console.log(`✅ ${mp.name} 통계 업데이트 완료 (HTML 순서 매칭)`);
    }

    // API 비교 데이터를 내부 형식으로 매핑
    function mapAPIComparisonData(apiData, cardIndex) {
        // API 응답 구조에 따른 매핑 (실제 API 응답 구조에 맞춰 조정 필요)
        const comparison = {};
        
        if (apiData.comparison && apiData.comparison.winner) {
            // API에서 승자 정보를 제공하는 경우
            const winner = apiData.comparison.winner;
            comparison.attendance = winner.attendance === cardIndex;
            comparison.billPassRate = winner.billPassRate === cardIndex;
            comparison.petitionProposed = winner.petitionProposed === cardIndex;
            comparison.petitionResult = winner.petitionResult === cardIndex;
            comparison.committeePosition = winner.committeePosition === cardIndex;
            comparison.invalidVotes = winner.invalidVotes === cardIndex;
            comparison.voteConsistency = winner.voteConsistency === cardIndex;
            comparison.voteInconsistency = winner.voteInconsistency === cardIndex;
        } else {
            // 기본 구조로 매핑
            comparison.attendance = apiData.member1_better?.attendance || false;
            comparison.billPassRate = apiData.member1_better?.bill_pass || false;
            comparison.petitionProposed = apiData.member1_better?.petition_proposed || false;
            comparison.petitionResult = apiData.member1_better?.petition_result || false;
            comparison.committeePosition = apiData.member1_better?.committee || false;
            comparison.invalidVotes = apiData.member1_better?.invalid_votes || false;
            comparison.voteConsistency = apiData.member1_better?.vote_consistency || false;
            comparison.voteInconsistency = apiData.member1_better?.vote_inconsistency || false;
            
            // cardIndex가 1인 경우 반전
            if (cardIndex === 1) {
                Object.keys(comparison).forEach(key => {
                    comparison[key] = !comparison[key];
                });
            }
        }
        
        return comparison;
    }

    // 두 국회의원 비교 함수 (로컬 로직)
    function compareMemberStats(member1, member2, member1Index) {
        const comparison = {};
        
        comparison.attendance = member1.stats.attendance > member2.stats.attendance;
        comparison.billPassRate = member1.stats.billPassRate > member2.stats.billPassRate;
        comparison.petitionProposed = member1.stats.petitionProposed > member2.stats.petitionProposed;
        comparison.petitionResult = member1.stats.petitionResult > member2.stats.petitionResult;
        comparison.invalidVotes = member1.stats.invalidVotes < member2.stats.invalidVotes; // 적을수록 좋음
        comparison.voteConsistency = member1.stats.voteConsistency > member2.stats.voteConsistency;
        comparison.voteInconsistency = member1.stats.voteInconsistency < member2.stats.voteInconsistency; // 적을수록 좋음
        
        // 위원회 비교 (rank가 높을수록 좋음)
        comparison.committeePosition = member1.stats.committeeRank > member2.stats.committeeRank;
        
        return comparison;
    }

    // 툴팁 상세 정보 초기화
    function resetTooltipDetails(card) {
        try {
            // 출석 상세 정보 초기화
            const attendanceTooltip = card.querySelector('.tooltip-content[data-for="attendance"]');
            if (attendanceTooltip) {
                attendanceTooltip.querySelector('.detail-total-meetings').textContent = '-';
                attendanceTooltip.querySelector('.detail-attendance').textContent = '-';
                attendanceTooltip.querySelector('.detail-absences').textContent = '-';
                attendanceTooltip.querySelector('.detail-leaves').textContent = '-';
                attendanceTooltip.querySelector('.detail-business-trips').textContent = '-';
            }

            // 법안 상세 정보 초기화
            const billTooltip = card.querySelector('.tooltip-content[data-for="bill"]');
            if (billTooltip) {
                billTooltip.querySelector('.detail-bill-total').textContent = '-';
                billTooltip.querySelector('.detail-bill-approved').textContent = '-';
                billTooltip.querySelector('.detail-bill-discarded').textContent = '-';
                billTooltip.querySelector('.detail-bill-rejected').textContent = '-';
                billTooltip.querySelector('.detail-bill-other').textContent = '-';
            }
        } catch (error) {
            console.error('툴팁 상세 정보 초기화 실패:', error);
        }
    }

    // 국회의원 통계 정보 초기화 함수 (HTML 순서와 정확히 매칭)
    function resetMPStats(card) {
        const statusItems = card.querySelectorAll('.status-item');
        
        // HTML 순서와 동일하게 리셋값 정의
        const resetValues = [
            '-', // 출석
            '-', // 본회의 가결
            '-', // 청원 제안
            '-', // 청원 결과
            '-', // 위원회
            '-', // 무효표 및 기권
            '-', // 투표 결과 일치
            '-'  // 투표 결과 불일치
        ];

        resetValues.forEach((resetValue, index) => {
            // index + 1은 HTML의 실제 status-item 인덱스 (0번은 국회의원 선택이므로)
            if (index + 1 < statusItems.length) {
                const statusItem = statusItems[index + 1];
                const valueElement = statusItem.querySelector('.status-value');
                if (valueElement) {
                    valueElement.textContent = resetValue;
                    valueElement.className = 'status-value';
                    valueElement.style.color = '';
                }
            }
        });
    }

    // === 🔄 데이터 새로고침 함수들 ===

    // 전체 데이터 새로고침 (가중치 변경 시 사용)
    async function refreshMemberComparison() {
        try {
            console.log('🔄 국회의원 비교 데이터 새로고침...');
            showLoading(true);
            
            // 현재 선택된 의원들 정보 백업
            const currentSelections = selectedMembers.map((memberId, index) => {
                if (memberId) {
                    const member = mpData.find(m => m.id === memberId);
                    return member ? { member, cardIndex: index } : null;
                }
                return null;
            }).filter(selection => selection !== null);
            
            // 모든 데이터 다시 로드
            await fetchMemberData();
            
            // 이전 선택 복원
            currentSelections.forEach(({ member, cardIndex }) => {
                const updatedMember = mpData.find(m => m.name === member.name && m.party === member.party);
                if (updatedMember) {
                    selectMP(updatedMember, cardIndex);
                    console.log(`🔄 ${member.name} 의원 선택 복원 완료`);
                }
            });
            
            showNotification('국회의원 비교 데이터가 업데이트되었습니다', 'success');
            
        } catch (error) {
            console.error('❌ 데이터 새로고침 실패:', error);
            showNotification('데이터 새로고침에 실패했습니다', 'error');
        } finally {
            showLoading(false);
        }
    }

    // WeightSync 호환 함수들
    async function refreshCompareMemberData() {
        return await refreshMemberComparison();
    }

    async function loadCompareMemberData() {
        return await fetchMemberData();
    }

    async function updateCompareMemberData(newData) {
        console.log('[CompareMember] 📊 외부 데이터로 업데이트:', newData);
        
        if (newData && Array.isArray(newData)) {
            mpData = newData;
            showNotification('데이터가 업데이트되었습니다', 'success');
            
            // 현재 선택된 의원들 재설정
            selectedMembers.forEach((memberId, index) => {
                if (memberId) {
                    const member = mpData.find(m => m.id === memberId);
                    if (member) {
                        selectMP(member, index);
                    }
                }
            });
        }
    }

    // === 🔍 검색 및 필터 기능 ===

    // 검색 및 필터 기능 초기화
    function initializeSearchAndFilter() {
        // CSS에서 정당별 색상 데이터 초기화
        partyData = getPartyColors();

        // 검색 필터 태그 선택 효과
        const filterTags = document.querySelectorAll('.filter-tag');
        
        filterTags.forEach(tag => {
            tag.addEventListener('click', function() {
                if (this.textContent === '정당별 필터') {
                    filterTags.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                } else {
                    const allTag = document.querySelector('.filter-tag:first-child');
                    allTag.classList.remove('active');
                    this.classList.toggle('active');
                }
            });
        });
        
        // 국회의원 검색 기능
        const searchInputs = document.querySelectorAll('.mp-search-input');
        const searchResults = document.querySelectorAll('.mp-search-results');
        
        searchInputs.forEach((input, index) => {
            input.addEventListener('focus', function() {
                if (this.value.length > 0) {
                    searchResults[index].classList.add('show');
                }
            });
            
            input.addEventListener('blur', function() {
                setTimeout(() => {
                    searchResults[index].classList.remove('show');
                }, 200);
            });
            
            input.addEventListener('input', function() {
                const searchValue = this.value.toLowerCase().trim();
                
                if (searchValue.length > 0) {
                    searchResults[index].innerHTML = '';
                    
                    // 활성화된 정당 필터 가져오기
                    const activeFilters = Array.from(document.querySelectorAll('.filter-tag.active'))
                        .map(tag => tag.textContent)
                        .filter(text => text !== '정당별 필터');
                    
                    // 검색어 및 필터로 국회의원 필터링
                    let filteredMPs = mpData.filter(mp => {
                        const matchesSearch = mp.name.toLowerCase().includes(searchValue) || 
                                            mp.district.toLowerCase().includes(searchValue) ||
                                            mp.party.toLowerCase().includes(searchValue);
                        
                        const matchesFilter = activeFilters.length === 0 || 
                                            activeFilters.includes(mp.party) ||
                                            (activeFilters.includes('기타 정당') && 
                                             !['더불어민주당', '국민의힘', '조국혁신당', '개혁신당', '진보당', '무소속'].includes(mp.party));
                        
                        return matchesSearch && matchesFilter;
                    });
                    
                    if (filteredMPs.length > 0) {
                        filteredMPs.slice(0, 10).forEach(mp => { // 최대 10개만 표시
                            const item = document.createElement('div');
                            item.className = 'mp-search-item';
                            
                            // 정당 색상 가져오기
                            const partyStyle = partyData[mp.party] ? 
                                `background-color: ${partyData[mp.party].color};` : 
                                'background-color: #999;';
                            
                            item.innerHTML = `
                                <div class="mp-search-photo">
                                    <img src="${mp.photo}" alt="${mp.name}" onerror="this.src='https://raw.githubusercontent.com/moody1317/osbasicproject_4/refs/heads/main/chat.png';">
                                </div>
                                <div class="mp-search-info">
                                    <div class="mp-search-name">${mp.name}</div>
                                    <div class="mp-search-party">${mp.party} · ${mp.district}</div>
                                </div>
                                <div class="mp-search-party-badge" style="${partyStyle}"></div>
                            `;
                            
                            item.addEventListener('click', function() {
                                selectMP(mp, index);
                                input.value = '';
                                searchResults[index].classList.remove('show');
                            });
                            
                            searchResults[index].appendChild(item);
                        });
                    } else {
                        // 검색 결과가 없을 때
                        const noResult = document.createElement('div');
                        noResult.className = 'mp-search-item';
                        noResult.innerHTML = '<span>검색 결과가 없습니다.</span>';
                        noResult.style.color = '#999';
                        noResult.style.cursor = 'default';
                        searchResults[index].appendChild(noResult);
                    }
                    
                    searchResults[index].classList.add('show');
                } else {
                    searchResults[index].classList.remove('show');
                }
            });
        });
        
        // 국회의원 제거 버튼
        const removeButtons = document.querySelectorAll('.mp-remove');
        
        removeButtons.forEach((button, index) => {
            button.addEventListener('click', function() {
                resetMP(index);
            });
        });
        
        // 초기 필터 태그 설정
        if (filterTags.length > 0) {
            filterTags[0].classList.add('active');
        }
    }

    // === 🚀 페이지 초기화 ===
    async function initializePage() {
        console.log('🚀 국회의원 비교 페이지 초기화 중...');
        
        try {
            // 국회의원 데이터 로드
            await fetchMemberData();
            
            // 검색 및 필터 기능 초기화
            initializeSearchAndFilter();
            
            showNotification('국회의원 비교 페이지 로드 완료', 'success');
            console.log('✅ 국회의원 비교 페이지 초기화 완료');
            
        } catch (error) {
            console.error('❌ 페이지 초기화 오류:', error);
            showError('페이지 로드 중 오류가 발생했습니다');
        }
    }

    // === 🔧 전역 함수 등록 (WeightSync 및 디버그용) ===
    
    // WeightSync 연동 함수들
    window.refreshCompareMemberData = refreshCompareMemberData;
    window.loadCompareMemberData = loadCompareMemberData;
    window.updateCompareMemberData = updateCompareMemberData;
    window.fetchMemberData = fetchMemberData;
    
    // 디버그 유틸리티 (전역)
    window.compareMemberDebug = {
        getMemberData: () => mpData,
        getSelectedMembers: () => selectedMembers,
        getMemberPhotos: () => memberPhotos,
        getPerformanceData: () => memberPerformanceData,
        getAttendanceData: () => memberAttendanceData,
        getBillCountData: () => memberBillCountData,
        getRankingData: () => memberRankingData,
        reloadData: () => initializePage(),
        refreshData: () => refreshMemberComparison(),
        showMemberStats: (memberName) => {
            const member = mpData.find(m => m.name === memberName);
            if (member) {
                console.log(`📊 ${memberName} 통계:`, member.stats);
                return member.stats;
            } else {
                console.log(`❌ ${memberName} 의원을 찾을 수 없습니다`);
                return null;
            }
        },
        clearSelection: () => {
            selectedMembers = [];
            localStorage.removeItem('current_member_comparison');
            const cards = document.querySelectorAll('.comparison-card');
            cards.forEach((card, index) => resetMP(index));
        },
        showInfo: () => {
            console.log('📊 국회의원 비교 페이지 정보:');
            console.log('- 로드된 의원 수:', mpData.length);
            console.log('- 선택된 의원:', selectedMembers);
            console.log('- 실적 데이터:', Object.keys(memberPerformanceData).length, '명');
            console.log('- 출석 데이터:', Object.keys(memberAttendanceData).length, '명');
            console.log('- 법안 수 데이터:', Object.keys(memberBillCountData).length, '명');
            console.log('- 랭킹 데이터:', Object.keys(memberRankingData).length, '명');
            console.log('- 사진 데이터:', Object.keys(memberPhotos).length, '명');
            console.log('- APIService 상태:', window.APIService?._isReady ? '준비됨' : '대기중');
        },
        testAPIService: async () => {
            console.log('🔍 APIService 테스트 시작...');
            try {
                if (!window.APIService) {
                    console.error('❌ APIService가 없습니다');
                    return false;
                }
                
                const [performance, attendance, billCount, ranking, photos] = await Promise.allSettled([
                    window.APIService.getMemberPerformance(),
                    window.APIService.getMemberAttendance(),
                    window.APIService.getMemberBillCount(),
                    window.APIService.getMemberRanking(),
                    window.APIService.getMemberPhotos()
                ]);
                
                console.log('✅ 실적 데이터:', performance.status, performance.status === 'fulfilled' ? performance.value.length + '건' : performance.reason);
                console.log('✅ 출석 데이터:', attendance.status, attendance.status === 'fulfilled' ? attendance.value.length + '건' : attendance.reason);
                console.log('✅ 법안 수 데이터:', billCount.status, billCount.status === 'fulfilled' ? billCount.value.length + '건' : billCount.reason);
                console.log('✅ 랭킹 데이터:', ranking.status, ranking.status === 'fulfilled' ? ranking.value.length + '건' : ranking.reason);
                console.log('✅ 사진 데이터:', photos.status, photos.status === 'fulfilled' ? photos.value.length + '건' : photos.reason);
                
                return true;
            } catch (error) {
                console.error('❌ APIService 테스트 실패:', error);
                return false;
            }
        },
        testComparison: async (member1, member2) => {
            try {
                console.log(`🆚 ${member1} vs ${member2} 비교 테스트...`);
                const result = await fetchMemberDirectComparison(member1, member2);
                console.log('✅ 비교 결과:', result);
                return result;
            } catch (error) {
                console.error('❌ 비교 테스트 실패:', error);
                return null;
            }
        },
        simulateWeightChange: () => {
            console.log('🔧 가중치 변경 시뮬레이션...');
            const changeData = {
                type: 'weights_updated',
                timestamp: new Date().toISOString(),
                source: 'debug_simulation'
            };
            localStorage.setItem('weight_change_event', JSON.stringify(changeData));
            localStorage.setItem('last_weight_update', Date.now().toString());
            setTimeout(() => localStorage.removeItem('weight_change_event'), 100);
        },
        testHTMLMapping: () => {
            console.log('🔍 HTML 매핑 테스트...');
            const statusItems = document.querySelectorAll('.comparison-card:first-child .status-item');
            statusItems.forEach((item, index) => {
                const label = item.querySelector('.status-label')?.textContent?.trim() || 'Unknown';
                console.log(`HTML Index ${index}: ${label}`);
            });
        }
    };

    // 초기화 실행
    setTimeout(initializePage, 100);

    console.log('✅ 국회의원 비교 페이지 스크립트 로드 완료 (Django API 연동 + 가중치 감지 버전)');
    console.log('🔗 API 모드: Django API 직접 연동');
    console.log('📊 데이터 매핑: 새로운 필드 구조 적용');
    console.log('🔧 디버그 명령어:');
    console.log('  - window.compareMemberDebug.showInfo() : 페이지 정보 확인');
    console.log('  - window.compareMemberDebug.reloadData() : 데이터 새로고침');
    console.log('  - window.compareMemberDebug.testAPIService() : APIService 테스트');
    console.log('  - window.compareMemberDebug.clearSelection() : 선택 초기화');
    console.log('  - window.compareMemberDebug.testComparison("의원1", "의원2") : 비교 API 테스트');
    console.log('  - window.compareMemberDebug.simulateWeightChange() : 가중치 변경 시뮬레이션');
});
